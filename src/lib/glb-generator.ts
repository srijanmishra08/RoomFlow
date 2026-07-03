/**
 * Server-side GLB generator for the hybrid 3D revision pipeline.
 *
 * Generates real, renderable GLB files from uploaded images:
 * - Floor plan → 3D room with textured floor + walls
 * - Interior render → 3D scene with image projected on backdrop + depth-estimated geometry
 * - Generic image → 3D scene with image as framed artwork on wall
 */

// GLB binary generation utilities — no external GLTF library needed at runtime

// ---------- GLB binary writer (manual, avoids NodeIO filesystem dependency) ----------

/**
 * Build a minimal GLTF JSON document and pack into a GLB binary buffer.
 * This avoids needing @gltf-transform's NodeIO which depends on filesystem.
 */
function packGLB(gltfJson: Record<string, unknown>, binaryChunks: Uint8Array[]): Buffer {
  // Combine all binary chunks into one buffer
  let totalBinLength = 0;
  for (const chunk of binaryChunks) totalBinLength += chunk.byteLength;
  const binBuffer = new Uint8Array(totalBinLength);
  let offset = 0;
  for (const chunk of binaryChunks) {
    binBuffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  // Pad binary to 4-byte alignment
  const binPadding = (4 - (binBuffer.byteLength % 4)) % 4;
  const paddedBin = new Uint8Array(binBuffer.byteLength + binPadding);
  paddedBin.set(binBuffer);

  // JSON chunk
  const jsonStr = JSON.stringify(gltfJson);
  const jsonEncoder = new TextEncoder();
  const jsonBytes = jsonEncoder.encode(jsonStr);
  const jsonPadding = (4 - (jsonBytes.byteLength % 4)) % 4;
  const paddedJson = new Uint8Array(jsonBytes.byteLength + jsonPadding);
  paddedJson.set(jsonBytes);
  for (let i = jsonBytes.byteLength; i < paddedJson.byteLength; i++) paddedJson[i] = 0x20; // space

  // GLB header: magic + version + total length
  const totalLength = 12 + 8 + paddedJson.byteLength + (paddedBin.byteLength > 0 ? 8 + paddedBin.byteLength : 0);
  const glb = new ArrayBuffer(totalLength);
  const view = new DataView(glb);

  // Header
  view.setUint32(0, 0x46546c67, true); // magic "glTF"
  view.setUint32(4, 2, true);           // version 2
  view.setUint32(8, totalLength, true);

  // JSON chunk
  view.setUint32(12, paddedJson.byteLength, true);
  view.setUint32(16, 0x4e4f534a, true); // "JSON"
  new Uint8Array(glb, 20).set(paddedJson);

  // Binary chunk (if any data)
  if (paddedBin.byteLength > 0) {
    const binOffset = 20 + paddedJson.byteLength;
    view.setUint32(binOffset, paddedBin.byteLength, true);
    view.setUint32(binOffset + 4, 0x004e4942, true); // "BIN\0"
    new Uint8Array(glb, binOffset + 8).set(paddedBin);
  }

  return Buffer.from(glb);
}

// ---------- Geometry helpers ----------

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Create a flat quad (2 triangles) of given size */
function createQuadGeometry(
  width: number,
  height: number,
  transform: {
    position?: Vec3;
    rotationAxis?: "x" | "y" | "z";
    rotationAngle?: number;
    normal?: Vec3;
  } = {}
): { positions: number[]; normals: number[]; uvs: number[]; indices: number[] } {
  // Default quad in XY plane at origin
  const hw = width / 2;
  const hh = height / 2;

  let positions = [
    -hw, -hh, 0,
    hw, -hh, 0,
    hw, hh, 0,
    -hw, hh, 0,
  ];

  const uvs = [0, 0, 1, 0, 1, 1, 0, 1];
  const indices = [0, 1, 2, 0, 2, 3];

  // Apply rotation
  const { rotationAxis, rotationAngle, position, normal } = transform;
  if (rotationAxis && rotationAngle) {
    positions = rotatePositions(positions, rotationAxis, rotationAngle);
  }

  // Apply translation
  if (position) {
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += position.x;
      positions[i + 1] += position.y;
      positions[i + 2] += position.z;
    }
  }

  // Compute normals
  const n = normal || { x: 0, y: 0, z: 1 };
  const normals = [
    n.x, n.y, n.z,
    n.x, n.y, n.z,
    n.x, n.y, n.z,
    n.x, n.y, n.z,
  ];

  return { positions, normals, uvs, indices };
}

function rotatePositions(positions: number[], axis: "x" | "y" | "z", angle: number): number[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const result = [...positions];

  for (let i = 0; i < result.length; i += 3) {
    const x = result[i], y = result[i + 1], z = result[i + 2];
    if (axis === "x") {
      result[i + 1] = y * cos - z * sin;
      result[i + 2] = y * sin + z * cos;
    } else if (axis === "y") {
      result[i] = x * cos + z * sin;
      result[i + 2] = -x * sin + z * cos;
    } else {
      result[i] = x * cos - y * sin;
      result[i + 1] = x * sin + y * cos;
    }
  }

  return result;
}

/** Create a box geometry (6 quads) — exported for future use */
export function createBoxGeometry(
  w: number, h: number, d: number,
  position: Vec3 = { x: 0, y: 0, z: 0 }
): { positions: number[]; normals: number[]; uvs: number[]; indices: number[] } {
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const faces: { positions: number[]; normals: number[]; uvs: number[]; indices: number[] }[] = [];

  // Front face (+Z)
  faces.push(createQuadGeometry(w, h, {
    position: { x: position.x, y: position.y + hh, z: position.z + hd },
    normal: { x: 0, y: 0, z: 1 },
  }));

  // Back face (-Z)
  faces.push({
    ...createQuadGeometry(w, h, {
      rotationAxis: "y", rotationAngle: Math.PI,
      position: { x: position.x, y: position.y + hh, z: position.z - hd },
      normal: { x: 0, y: 0, z: -1 },
    }),
  });

  // Right face (+X)
  faces.push(createQuadGeometry(d, h, {
    rotationAxis: "y", rotationAngle: Math.PI / 2,
    position: { x: position.x + hw, y: position.y + hh, z: position.z },
    normal: { x: 1, y: 0, z: 0 },
  }));

  // Left face (-X)
  faces.push(createQuadGeometry(d, h, {
    rotationAxis: "y", rotationAngle: -Math.PI / 2,
    position: { x: position.x - hw, y: position.y + hh, z: position.z },
    normal: { x: -1, y: 0, z: 0 },
  }));

  // Top face (+Y)
  faces.push(createQuadGeometry(w, d, {
    rotationAxis: "x", rotationAngle: -Math.PI / 2,
    position: { x: position.x, y: position.y + h, z: position.z },
    normal: { x: 0, y: 1, z: 0 },
  }));

  // Bottom face (-Y)
  faces.push(createQuadGeometry(w, d, {
    rotationAxis: "x", rotationAngle: Math.PI / 2,
    position: { x: position.x, y: position.y, z: position.z },
    normal: { x: 0, y: -1, z: 0 },
  }));

  return mergeGeometries(faces);
}

function mergeGeometries(
  geoms: { positions: number[]; normals: number[]; uvs: number[]; indices: number[] }[]
): { positions: number[]; normals: number[]; uvs: number[]; indices: number[] } {
  const allPos: number[] = [];
  const allNorm: number[] = [];
  const allUV: number[] = [];
  const allIdx: number[] = [];
  let vertexOffset = 0;

  for (const g of geoms) {
    allPos.push(...g.positions);
    allNorm.push(...g.normals);
    allUV.push(...g.uvs);
    for (const idx of g.indices) allIdx.push(idx + vertexOffset);
    vertexOffset += g.positions.length / 3;
  }

  return { positions: allPos, normals: allNorm, uvs: allUV, indices: allIdx };
}

// ---------- GLTF JSON builder ----------

interface GLTFBuilder {
  bufferData: number[];
  accessors: Record<string, unknown>[];
  bufferViews: Record<string, unknown>[];
  meshes: Record<string, unknown>[];
  nodes: Record<string, unknown>[];
  materials: Record<string, unknown>[];
  textures: Record<string, unknown>[];
  images: Record<string, unknown>[];
  scene: { nodes: number[] };
}

function createBuilder(): GLTFBuilder {
  return {
    bufferData: [],
    accessors: [],
    bufferViews: [],
    meshes: [],
    nodes: [],
    materials: [],
    textures: [],
    images: [],
    scene: { nodes: [] },
  };
}

function addImage(builder: GLTFBuilder, imageBytes: Uint8Array, mimeType: string): number {
  const offset = builder.bufferData.length;
  for (let i = 0; i < imageBytes.length; i++) builder.bufferData.push(imageBytes[i]);
  // Pad to 4-byte alignment
  while (builder.bufferData.length % 4 !== 0) builder.bufferData.push(0);

  const bvIndex = builder.bufferViews.length;
  builder.bufferViews.push({
    buffer: 0,
    byteOffset: offset,
    byteLength: imageBytes.length,
  });

  const imgIndex = builder.images.length;
  builder.images.push({
    bufferView: bvIndex,
    mimeType,
  });

  return imgIndex;
}

function addTexture(builder: GLTFBuilder, imageIndex: number): number {
  const texIndex = builder.textures.length;
  builder.textures.push({ source: imageIndex });
  return texIndex;
}

function addMaterial(
  builder: GLTFBuilder,
  opts: {
    name: string;
    color?: [number, number, number, number];
    textureIndex?: number;
    doubleSided?: boolean;
    alphaMode?: "OPAQUE" | "BLEND" | "MASK";
    emissiveFactor?: [number, number, number];
    roughness?: number;
    metallic?: number;
  }
): number {
  const mat: Record<string, unknown> = {
    name: opts.name,
    pbrMetallicRoughness: {
      baseColorFactor: opts.color || [1, 1, 1, 1],
      metallicFactor: opts.metallic ?? 0,
      roughnessFactor: opts.roughness ?? 0.9,
      ...(opts.textureIndex !== undefined
        ? { baseColorTexture: { index: opts.textureIndex } }
        : {}),
    },
    doubleSided: opts.doubleSided ?? false,
    alphaMode: opts.alphaMode || "OPAQUE",
  };

  if (opts.emissiveFactor) {
    mat.emissiveFactor = opts.emissiveFactor;
  }

  const idx = builder.materials.length;
  builder.materials.push(mat);
  return idx;
}

function addGeometry(
  builder: GLTFBuilder,
  geom: { positions: number[]; normals: number[]; uvs: number[]; indices: number[] },
  materialIndex: number,
  nodeName: string,
  translation?: [number, number, number]
): number {
  // Positions
  const posOffset = builder.bufferData.length;
  const posArray = new Float32Array(geom.positions);
  const posBytes = new Uint8Array(posArray.buffer);
  for (let i = 0; i < posBytes.length; i++) builder.bufferData.push(posBytes[i]);

  const posMin = [Infinity, Infinity, Infinity];
  const posMax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < geom.positions.length; i += 3) {
    posMin[0] = Math.min(posMin[0], geom.positions[i]);
    posMin[1] = Math.min(posMin[1], geom.positions[i + 1]);
    posMin[2] = Math.min(posMin[2], geom.positions[i + 2]);
    posMax[0] = Math.max(posMax[0], geom.positions[i]);
    posMax[1] = Math.max(posMax[1], geom.positions[i + 1]);
    posMax[2] = Math.max(posMax[2], geom.positions[i + 2]);
  }

  const posBVIndex = builder.bufferViews.length;
  builder.bufferViews.push({
    buffer: 0,
    byteOffset: posOffset,
    byteLength: posBytes.length,
    target: 34962, // ARRAY_BUFFER
  });

  const posAccIndex = builder.accessors.length;
  builder.accessors.push({
    bufferView: posBVIndex,
    componentType: 5126, // FLOAT
    count: geom.positions.length / 3,
    type: "VEC3",
    min: posMin,
    max: posMax,
  });

  // Normals
  const normOffset = builder.bufferData.length;
  const normArray = new Float32Array(geom.normals);
  const normBytes = new Uint8Array(normArray.buffer);
  for (let i = 0; i < normBytes.length; i++) builder.bufferData.push(normBytes[i]);

  const normBVIndex = builder.bufferViews.length;
  builder.bufferViews.push({
    buffer: 0,
    byteOffset: normOffset,
    byteLength: normBytes.length,
    target: 34962,
  });

  const normAccIndex = builder.accessors.length;
  builder.accessors.push({
    bufferView: normBVIndex,
    componentType: 5126,
    count: geom.normals.length / 3,
    type: "VEC3",
  });

  // UVs
  const uvOffset = builder.bufferData.length;
  const uvArray = new Float32Array(geom.uvs);
  const uvBytes = new Uint8Array(uvArray.buffer);
  for (let i = 0; i < uvBytes.length; i++) builder.bufferData.push(uvBytes[i]);

  const uvBVIndex = builder.bufferViews.length;
  builder.bufferViews.push({
    buffer: 0,
    byteOffset: uvOffset,
    byteLength: uvBytes.length,
    target: 34962,
  });

  const uvAccIndex = builder.accessors.length;
  builder.accessors.push({
    bufferView: uvBVIndex,
    componentType: 5126,
    count: geom.uvs.length / 2,
    type: "VEC2",
  });

  // Indices
  const idxOffset = builder.bufferData.length;
  const idxArray = new Uint16Array(geom.indices);
  const idxBytes = new Uint8Array(idxArray.buffer);
  for (let i = 0; i < idxBytes.length; i++) builder.bufferData.push(idxBytes[i]);
  // Pad to 4-byte alignment
  while (builder.bufferData.length % 4 !== 0) builder.bufferData.push(0);

  const idxBVIndex = builder.bufferViews.length;
  builder.bufferViews.push({
    buffer: 0,
    byteOffset: idxOffset,
    byteLength: idxBytes.length,
    target: 34963, // ELEMENT_ARRAY_BUFFER
  });

  const idxAccIndex = builder.accessors.length;
  builder.accessors.push({
    bufferView: idxBVIndex,
    componentType: 5123, // UNSIGNED_SHORT
    count: geom.indices.length,
    type: "SCALAR",
  });

  // Mesh
  const meshIndex = builder.meshes.length;
  builder.meshes.push({
    name: nodeName,
    primitives: [
      {
        attributes: {
          POSITION: posAccIndex,
          NORMAL: normAccIndex,
          TEXCOORD_0: uvAccIndex,
        },
        indices: idxAccIndex,
        material: materialIndex,
      },
    ],
  });

  // Node
  const nodeIndex = builder.nodes.length;
  const node: Record<string, unknown> = {
    name: nodeName,
    mesh: meshIndex,
  };
  if (translation) node.translation = translation;
  builder.nodes.push(node);
  builder.scene.nodes.push(nodeIndex);

  return nodeIndex;
}

function buildGLB(builder: GLTFBuilder): Buffer {
  const bufferBytes = new Uint8Array(builder.bufferData);

  const gltf: Record<string, unknown> = {
    asset: { version: "2.0", generator: "RoomFlow GLB Generator" },
    scene: 0,
    scenes: [builder.scene],
    nodes: builder.nodes,
    meshes: builder.meshes,
    accessors: builder.accessors,
    bufferViews: builder.bufferViews,
    buffers: [{ byteLength: bufferBytes.length }],
    materials: builder.materials,
  };

  if (builder.textures.length > 0) gltf.textures = builder.textures;
  if (builder.images.length > 0) gltf.images = builder.images;

  return packGLB(gltf, [bufferBytes]);
}

// ---------- Public API ----------

/**
 * Generate a 3D room scene from a floor plan image.
 * Creates: textured floor with the uploaded image, walls, ceiling, baseboard accents.
 */
export function generateFloorPlanScene(
  imageBuffer: Uint8Array,
  mimeType: string,
  roomWidth: number = 6,
  roomDepth: number = 6,
  roomHeight: number = 3
): Buffer {
  const builder = createBuilder();

  // Add the floor plan image as a texture
  const imgIdx = addImage(builder, imageBuffer, mimeType);
  const texIdx = addTexture(builder, imgIdx);

  // Materials
  const floorMat = addMaterial(builder, {
    name: "FloorPlan",
    textureIndex: texIdx,
    roughness: 0.8,
  });

  const wallMat = addMaterial(builder, {
    name: "Walls",
    color: [0.96, 0.94, 0.92, 0.7],
    roughness: 0.9,
    doubleSided: true,
    alphaMode: "BLEND",
  });

  const ceilingMat = addMaterial(builder, {
    name: "Ceiling",
    color: [0.98, 0.98, 0.98, 0.3],
    roughness: 0.95,
    doubleSided: true,
    alphaMode: "BLEND",
  });

  const baseboardMat = addMaterial(builder, {
    name: "Baseboard",
    color: [0.77, 0.71, 0.63, 1],
    roughness: 0.7,
  });

  const hw = roomWidth / 2;
  const hd = roomDepth / 2;

  // Floor with floor plan texture
  const floor = createQuadGeometry(roomWidth, roomDepth, {
    rotationAxis: "x",
    rotationAngle: -Math.PI / 2,
    position: { x: 0, y: 0.001, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
  });
  addGeometry(builder, floor, floorMat, "Floor_FloorPlan");

  // Back wall
  const backWall = createQuadGeometry(roomWidth, roomHeight, {
    position: { x: 0, y: roomHeight / 2, z: -hd },
    normal: { x: 0, y: 0, z: 1 },
  });
  addGeometry(builder, backWall, wallMat, "Wall_Back");

  // Left wall
  const leftWall = createQuadGeometry(roomDepth, roomHeight, {
    rotationAxis: "y",
    rotationAngle: Math.PI / 2,
    position: { x: -hw, y: roomHeight / 2, z: 0 },
    normal: { x: 1, y: 0, z: 0 },
  });
  addGeometry(builder, leftWall, wallMat, "Wall_Left");

  // Right wall
  const rightWall = createQuadGeometry(roomDepth, roomHeight, {
    rotationAxis: "y",
    rotationAngle: -Math.PI / 2,
    position: { x: hw, y: roomHeight / 2, z: 0 },
    normal: { x: -1, y: 0, z: 0 },
  });
  addGeometry(builder, rightWall, wallMat, "Wall_Right");

  // Front wall (barely visible)
  const frontWall = createQuadGeometry(roomWidth, roomHeight, {
    rotationAxis: "y",
    rotationAngle: Math.PI,
    position: { x: 0, y: roomHeight / 2, z: hd },
    normal: { x: 0, y: 0, z: -1 },
  });
  addGeometry(builder, frontWall, wallMat, "Wall_Front");

  // Ceiling
  const ceiling = createQuadGeometry(roomWidth, roomDepth, {
    rotationAxis: "x",
    rotationAngle: Math.PI / 2,
    position: { x: 0, y: roomHeight, z: 0 },
    normal: { x: 0, y: -1, z: 0 },
  });
  addGeometry(builder, ceiling, ceilingMat, "Ceiling");

  // Baseboard on back wall
  const bbBack = createQuadGeometry(roomWidth, 0.1, {
    position: { x: 0, y: 0.05, z: -hd + 0.001 },
    normal: { x: 0, y: 0, z: 1 },
  });
  addGeometry(builder, bbBack, baseboardMat, "Baseboard_Back");

  // Baseboard on left wall
  const bbLeft = createQuadGeometry(roomDepth, 0.1, {
    rotationAxis: "y",
    rotationAngle: Math.PI / 2,
    position: { x: -hw + 0.001, y: 0.05, z: 0 },
    normal: { x: 1, y: 0, z: 0 },
  });
  addGeometry(builder, bbLeft, baseboardMat, "Baseboard_Left");

  return buildGLB(builder);
}

/**
 * Generate a 3D scene from an interior render image.
 * Creates: a curved backdrop with the image projected, a floor plane, and a subtle frame.
 * The user can orbit around the scene to see the render in 3D space.
 */
export function generateInteriorRenderScene(
  imageBuffer: Uint8Array,
  mimeType: string,
  aspectRatio: number = 16 / 9
): Buffer {
  const builder = createBuilder();

  // Add the interior image as a texture
  const imgIdx = addImage(builder, imageBuffer, mimeType);
  const texIdx = addTexture(builder, imgIdx);

  // Materials
  const imageMat = addMaterial(builder, {
    name: "InteriorRender",
    textureIndex: texIdx,
    roughness: 0.5,
    emissiveFactor: [0.15, 0.15, 0.15], // slight glow for photo realism
  });

  const floorMat = addMaterial(builder, {
    name: "Floor",
    color: [0.91, 0.88, 0.83, 1],
    roughness: 0.9,
  });

  const frameMat = addMaterial(builder, {
    name: "Frame",
    color: [0.3, 0.28, 0.25, 1],
    roughness: 0.4,
    metallic: 0.3,
  });

  const sideWallMat = addMaterial(builder, {
    name: "SideWalls",
    color: [0.95, 0.93, 0.9, 0.5],
    roughness: 0.9,
    doubleSided: true,
    alphaMode: "BLEND",
  });

  // Scene dimensions
  const sceneWidth = 8;
  const sceneHeight = sceneWidth / aspectRatio;
  const sceneDepth = 6;

  // Main image as a curved backdrop (segmented plane for slight curvature)
  const segments = 12;
  const curveRadius = 5;
  const curveAngle = Math.PI * 0.4; // 72 degrees of arc
  const backdropPositions: number[] = [];
  const backdropNormals: number[] = [];
  const backdropUVs: number[] = [];
  const backdropIndices: number[] = [];

  for (let j = 0; j <= 1; j++) {
    const y = j * sceneHeight;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = -curveAngle / 2 + t * curveAngle;
      const x = Math.sin(angle) * curveRadius;
      const z = -(Math.cos(angle) * curveRadius - curveRadius * 0.8);

      backdropPositions.push(x, y, z);
      // Normal points inward (toward viewer)
      backdropNormals.push(-Math.sin(angle), 0, Math.cos(angle));
      backdropUVs.push(t, j);
    }
  }

  for (let i = 0; i < segments; i++) {
    const a = i;
    const b = i + 1;
    const c = segments + 1 + i + 1;
    const d = segments + 1 + i;
    backdropIndices.push(a, b, c, a, c, d);
  }

  addGeometry(
    builder,
    { positions: backdropPositions, normals: backdropNormals, uvs: backdropUVs, indices: backdropIndices },
    imageMat,
    "Backdrop_InteriorRender"
  );

  // Floor
  const floor = createQuadGeometry(sceneWidth * 1.2, sceneDepth, {
    rotationAxis: "x",
    rotationAngle: -Math.PI / 2,
    position: { x: 0, y: 0, z: sceneDepth / 2 - 1 },
    normal: { x: 0, y: 1, z: 0 },
  });
  addGeometry(builder, floor, floorMat, "Floor");

  // Frame around the backdrop - top bar
  const frameThickness = 0.08;
  const frameWidth = sceneWidth * 0.9;
  const topFrame = createQuadGeometry(frameWidth, frameThickness, {
    position: { x: 0, y: sceneHeight + frameThickness / 2, z: -curveRadius * 0.2 + 0.01 },
    normal: { x: 0, y: 0, z: 1 },
  });
  addGeometry(builder, topFrame, frameMat, "Frame_Top");

  // Frame - bottom bar
  const bottomFrame = createQuadGeometry(frameWidth, frameThickness, {
    position: { x: 0, y: -frameThickness / 2, z: -curveRadius * 0.2 + 0.01 },
    normal: { x: 0, y: 0, z: 1 },
  });
  addGeometry(builder, bottomFrame, frameMat, "Frame_Bottom");

  // Side walls for depth
  const leftSide = createQuadGeometry(sceneDepth * 0.5, sceneHeight * 1.2, {
    rotationAxis: "y",
    rotationAngle: Math.PI / 2,
    position: { x: -sceneWidth / 2 - 0.5, y: sceneHeight * 0.6, z: 1 },
    normal: { x: 1, y: 0, z: 0 },
  });
  addGeometry(builder, leftSide, sideWallMat, "Wall_Left");

  const rightSide = createQuadGeometry(sceneDepth * 0.5, sceneHeight * 1.2, {
    rotationAxis: "y",
    rotationAngle: -Math.PI / 2,
    position: { x: sceneWidth / 2 + 0.5, y: sceneHeight * 0.6, z: 1 },
    normal: { x: -1, y: 0, z: 0 },
  });
  addGeometry(builder, rightSide, sideWallMat, "Wall_Right");

  return buildGLB(builder);
}

/**
 * Generate a 3D scene from a generic reference image.
 * Creates: image displayed as framed artwork in a simple gallery-like room.
 */
export function generateImageScene(
  imageBuffer: Uint8Array,
  mimeType: string
): Buffer {
  const builder = createBuilder();

  const imgIdx = addImage(builder, imageBuffer, mimeType);
  const texIdx = addTexture(builder, imgIdx);

  const imageMat = addMaterial(builder, {
    name: "ReferenceImage",
    textureIndex: texIdx,
    roughness: 0.3,
    emissiveFactor: [0.1, 0.1, 0.1],
  });

  const wallMat = addMaterial(builder, {
    name: "GalleryWall",
    color: [0.95, 0.93, 0.9, 1],
    roughness: 0.95,
    doubleSided: true,
  });

  const floorMat = addMaterial(builder, {
    name: "Floor",
    color: [0.85, 0.8, 0.75, 1],
    roughness: 0.8,
  });

  const frameMat = addMaterial(builder, {
    name: "Frame",
    color: [0.25, 0.22, 0.2, 1],
    roughness: 0.3,
    metallic: 0.5,
  });

  // Image plane on the wall (centered, raised)
  const imgWidth = 4;
  const imgHeight = 3;
  const imgPlane = createQuadGeometry(imgWidth, imgHeight, {
    position: { x: 0, y: 2, z: -2.99 },
    normal: { x: 0, y: 0, z: 1 },
  });
  addGeometry(builder, imgPlane, imageMat, "ReferenceImage");

  // Frame around image
  const ft = 0.12;
  // Top
  addGeometry(builder, createQuadGeometry(imgWidth + ft * 2, ft, {
    position: { x: 0, y: 2 + imgHeight / 2 + ft / 2, z: -2.98 },
    normal: { x: 0, y: 0, z: 1 },
  }), frameMat, "Frame_Top");
  // Bottom
  addGeometry(builder, createQuadGeometry(imgWidth + ft * 2, ft, {
    position: { x: 0, y: 2 - imgHeight / 2 - ft / 2, z: -2.98 },
    normal: { x: 0, y: 0, z: 1 },
  }), frameMat, "Frame_Bottom");
  // Left
  addGeometry(builder, createQuadGeometry(ft, imgHeight + ft * 2, {
    position: { x: -imgWidth / 2 - ft / 2, y: 2, z: -2.98 },
    normal: { x: 0, y: 0, z: 1 },
  }), frameMat, "Frame_Left");
  // Right
  addGeometry(builder, createQuadGeometry(ft, imgHeight + ft * 2, {
    position: { x: imgWidth / 2 + ft / 2, y: 2, z: -2.98 },
    normal: { x: 0, y: 0, z: 1 },
  }), frameMat, "Frame_Right");

  // Gallery room
  const rw = 8, rh = 4, rd = 8;
  // Back wall
  addGeometry(builder, createQuadGeometry(rw, rh, {
    position: { x: 0, y: rh / 2, z: -rd / 2 },
    normal: { x: 0, y: 0, z: 1 },
  }), wallMat, "Wall_Back");

  // Floor
  addGeometry(builder, createQuadGeometry(rw, rd, {
    rotationAxis: "x",
    rotationAngle: -Math.PI / 2,
    position: { x: 0, y: 0.001, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
  }), floorMat, "Floor");

  // Left wall
  addGeometry(builder, createQuadGeometry(rd, rh, {
    rotationAxis: "y",
    rotationAngle: Math.PI / 2,
    position: { x: -rw / 2, y: rh / 2, z: 0 },
    normal: { x: 1, y: 0, z: 0 },
  }), wallMat, "Wall_Left");

  // Right wall
  addGeometry(builder, createQuadGeometry(rd, rh, {
    rotationAxis: "y",
    rotationAngle: -Math.PI / 2,
    position: { x: rw / 2, y: rh / 2, z: 0 },
    normal: { x: -1, y: 0, z: 0 },
  }), wallMat, "Wall_Right");

  return buildGLB(builder);
}
