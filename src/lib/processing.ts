/**
 * File processing pipeline for the hybrid 3D revision system.
 *
 * Case 1: 3D file (GLB/GLTF/OBJ/FBX) → optimize & serve directly
 * Case 2: Floor plan image → generates a 3D room with the image as floor texture
 * Case 3: Interior render image → generates a 3D scene with image on curved backdrop
 * Case 4: Generic image → generates a gallery scene displaying the image
 */

import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";
import {
  generateFloorPlanScene,
  generateInteriorRenderScene,
  generateImageScene,
} from "./glb-generator";

const EXT_3D = new Set(["glb", "gltf", "obj", "fbx"]);
const EXT_IMAGE = new Set(["png", "jpg", "jpeg", "webp"]);
const EXT_DRAWING = new Set(["pdf", "dxf", "dwg"]);

// Floor-plan related keywords in filename
const FLOOR_PLAN_KEYWORDS = /floor.?plan|layout|blueprint|plan.?view|top.?view|2d.?plan/i;
const STRUCTURAL_KEYWORDS = /structur|framing|foundation|beam|column|section/i;

export type RevisionTypeValue = "MODEL_3D" | "FLOOR_PLAN" | "INTERIOR_RENDER" | "STRUCTURAL" | "IMAGE";

export interface ProcessingResult {
  type: RevisionTypeValue;
  sceneUrl: string | null;
  thumbnail: string | null;
  metadata: Record<string, unknown>;
  status: "READY" | "PROCESSING" | "FAILED";
}

/**
 * Determine the revision type from the uploaded file.
 */
export function classifyUpload(filename: string, ext: string): RevisionTypeValue {
  if (EXT_3D.has(ext)) {
    return "MODEL_3D";
  }

  if (EXT_IMAGE.has(ext) || EXT_DRAWING.has(ext)) {
    if (FLOOR_PLAN_KEYWORDS.test(filename)) return "FLOOR_PLAN";
    if (STRUCTURAL_KEYWORDS.test(filename)) return "STRUCTURAL";
    // Heuristic: images with "render", "interior", "design" → interior render
    if (/render|interior|design|3d|visual/i.test(filename)) return "INTERIOR_RENDER";
    return "IMAGE";
  }

  return "IMAGE";
}

/**
 * Process a 3D model file.
 * For GLB/GLTF: the file is already usable as a scene.
 * For OBJ/FBX: would need conversion (stub — returns source as scene).
 */
export function process3DModel(
  fileUrl: string,
  ext: string,
  nodeNames: string[]
): ProcessingResult {
  // GLB/GLTF can be rendered directly
  if (ext === "glb" || ext === "gltf") {
    return {
      type: "MODEL_3D",
      sceneUrl: fileUrl,
      thumbnail: null,
      metadata: { nodeNames, format: ext, needsConversion: false },
      status: "READY",
    };
  }

  // OBJ/FBX would need server-side conversion to GLTF
  // In production: queue a conversion job (Blender headless / gltf-transform)
  // For now: mark as processing — designer will see status
  return {
    type: "MODEL_3D",
    sceneUrl: null,
    thumbnail: null,
    metadata: {
      nodeNames,
      format: ext,
      needsConversion: true,
      conversionNote: `${ext.toUpperCase()} files require conversion to GLTF. Connect a processing service to enable automatic conversion.`,
    },
    status: ext === "obj" ? "READY" : "PROCESSING", // OBJ has partial Three.js support
  };
}

/**
 * Process a floor plan image.
 * Generates a 3D room scene with the floor plan projected on the floor,
 * plus walls, ceiling, and baseboard accents. Returns an actual renderable GLB.
 */
export async function processFloorPlan(
  fileUrl: string,
  imageBuffer: Uint8Array,
  mimeType: string,
  roomWidth: number = 6,
  roomDepth: number = 6,
  roomHeight: number = 3
): Promise<ProcessingResult> {
  try {
    const glb = generateFloorPlanScene(imageBuffer, mimeType, roomWidth, roomDepth, roomHeight);
    const sceneUrl = await saveGeneratedGLB(glb, "floorplan");

    return {
      type: "FLOOR_PLAN",
      sceneUrl,
      thumbnail: fileUrl,
      metadata: {
        sourceType: "floor_plan",
        generatedScene: true,
        roomDimensions: { width: roomWidth, depth: roomDepth, height: roomHeight },
        processingSteps: [
          "Floor plan image loaded",
          "3D room geometry generated",
          "Image projected as floor texture",
          "Walls and ceiling added",
          "GLB scene exported",
        ],
      },
      status: "READY",
    };
  } catch (err) {
    return {
      type: "FLOOR_PLAN",
      sceneUrl: null,
      thumbnail: fileUrl,
      metadata: {
        sourceType: "floor_plan",
        error: err instanceof Error ? err.message : "Unknown error during 3D generation",
      },
      status: "FAILED",
    };
  }
}

/**
 * Process an interior render image.
 * Generates a 3D scene with the image projected on a curved backdrop,
 * creating a pseudo-3D panoramic view. Returns an actual renderable GLB.
 */
export async function processInteriorRender(
  fileUrl: string,
  imageBuffer: Uint8Array,
  mimeType: string
): Promise<ProcessingResult> {
  try {
    const glb = generateInteriorRenderScene(imageBuffer, mimeType);
    const sceneUrl = await saveGeneratedGLB(glb, "interior");

    return {
      type: "INTERIOR_RENDER",
      sceneUrl,
      thumbnail: fileUrl,
      metadata: {
        sourceType: "interior_render",
        generatedScene: true,
        processingSteps: [
          "Interior render loaded",
          "Curved backdrop geometry generated",
          "Image projected onto backdrop",
          "Floor and side walls added",
          "GLB scene exported",
        ],
      },
      status: "READY",
    };
  } catch (err) {
    return {
      type: "INTERIOR_RENDER",
      sceneUrl: null,
      thumbnail: fileUrl,
      metadata: {
        sourceType: "interior_render",
        error: err instanceof Error ? err.message : "Unknown error during 3D generation",
      },
      status: "FAILED",
    };
  }
}

/**
 * Process a generic image (reference photo, etc.).
 * Generates a gallery-style 3D scene displaying the image as framed artwork.
 */
export async function processImage(
  fileUrl: string,
  imageBuffer: Uint8Array,
  mimeType: string
): Promise<ProcessingResult> {
  try {
    const glb = generateImageScene(imageBuffer, mimeType);
    const sceneUrl = await saveGeneratedGLB(glb, "image");

    return {
      type: "IMAGE",
      sceneUrl,
      thumbnail: fileUrl,
      metadata: {
        sourceType: "reference_image",
        generatedScene: true,
      },
      status: "READY",
    };
  } catch (err) {
    return {
      type: "IMAGE",
      sceneUrl: null,
      thumbnail: fileUrl,
      metadata: {
        sourceType: "reference_image",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      status: "FAILED",
    };
  }
}

/**
 * Save a generated GLB file to disk (or blob storage in production).
 */
async function saveGeneratedGLB(glb: Buffer, prefix: string): Promise<string> {
  const filename = `${prefix}-${uuid()}.glb`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`generated/${filename}`, glb, {
      access: "public",
      addRandomSuffix: false,
      contentType: "model/gltf-binary",
    });
    return blob.url;
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const filepath = path.join(dir, filename);
  await writeFile(filepath, glb);
  return `/uploads/${filename}`;
}

/**
 * Main processing dispatcher.
 * Now async: image types generate actual GLB scenes server-side.
 */
export async function processFile(
  fileUrl: string,
  filename: string,
  ext: string,
  nodeNames: string[] = [],
  imageBuffer?: Uint8Array,
  mimeType?: string,
  roomDimensions?: { width: number; depth: number; height: number }
): Promise<ProcessingResult> {
  const type = classifyUpload(filename, ext);

  switch (type) {
    case "MODEL_3D":
      return process3DModel(fileUrl, ext, nodeNames);
    case "FLOOR_PLAN":
      if (imageBuffer && mimeType) {
        return processFloorPlan(
          fileUrl,
          imageBuffer,
          mimeType,
          roomDimensions?.width,
          roomDimensions?.depth,
          roomDimensions?.height
        );
      }
      return {
        type: "FLOOR_PLAN",
        sceneUrl: null,
        thumbnail: fileUrl,
        metadata: { sourceType: "floor_plan", note: "Image buffer not provided for 3D generation" },
        status: "FAILED",
      };
    case "INTERIOR_RENDER":
      if (imageBuffer && mimeType) {
        return processInteriorRender(fileUrl, imageBuffer, mimeType);
      }
      return {
        type: "INTERIOR_RENDER",
        sceneUrl: null,
        thumbnail: fileUrl,
        metadata: { sourceType: "interior_render", note: "Image buffer not provided for 3D generation" },
        status: "FAILED",
      };
    case "STRUCTURAL":
      if (imageBuffer && mimeType) {
        // Structural drawings get the floor plan treatment
        try {
          const { generateFloorPlanScene } = await import("./glb-generator");
          const glb = generateFloorPlanScene(imageBuffer, mimeType);
          const sceneUrl = await saveGeneratedGLB(glb, "structural");
          return {
            type: "STRUCTURAL",
            sceneUrl,
            thumbnail: fileUrl,
            metadata: { sourceType: "structural_drawing", generatedScene: true },
            status: "READY",
          };
        } catch {
          // Fall through to static
        }
      }
      return {
        type: "STRUCTURAL",
        sceneUrl: null,
        thumbnail: fileUrl,
        metadata: { sourceType: "structural_drawing" },
        status: "FAILED",
      };
    case "IMAGE":
    default:
      if (imageBuffer && mimeType) {
        return processImage(fileUrl, imageBuffer, mimeType);
      }
      return {
        type: "IMAGE",
        sceneUrl: null,
        thumbnail: fileUrl,
        metadata: { sourceType: "reference_image" },
        status: "READY",
      };
  }
}
