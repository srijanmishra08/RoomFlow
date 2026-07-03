"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getPBRMaps } from "@/lib/pbr-textures";

export interface SurfaceMaterial {
  type: "color" | "texture";
  value: string;
  repeat?: number;
}

export interface FloorPoint {
  x: number;
  z: number;
}

export interface WallOpening {
  wall: number;      // edge index (rect: 0=back,1=right,2=front,3=left)
  offset: number;    // 0..1 center position along the wall
  width: number;     // metres
  height: number;    // metres
  sill: number;      // bottom height off floor (door = 0)
  type: "door" | "window";
}

interface RoomBoxProps {
  width: number;
  height: number;
  depth: number;
  floorPoints?: FloorPoint[] | null;
  openings?: WallOpening[] | null;
  modelUrl?: string | null;
  floorMaterial?: SurfaceMaterial | null;
  wallMaterial?: SurfaceMaterial | null;
  ceilingMaterial?: SurfaceMaterial | null;
}

// Build a wall face (length × height, base at y=0) with rectangular holes punched
// for each opening. Returns a flat Shape in local wall coordinates.
function buildWallShape(length: number, height: number, openings: WallOpening[]): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-length / 2, 0);
  s.lineTo(length / 2, 0);
  s.lineTo(length / 2, height);
  s.lineTo(-length / 2, height);
  s.closePath();
  for (const o of openings) {
    const cx = (o.offset - 0.5) * length;
    const x0 = Math.max(-length / 2 + 0.02, cx - o.width / 2);
    const x1 = Math.min(length / 2 - 0.02, cx + o.width / 2);
    const y0 = Math.max(0.001, o.sill);
    const y1 = Math.min(height - 0.02, o.sill + o.height);
    if (x1 <= x0 || y1 <= y0) continue;
    const hole = new THREE.Path();
    hole.moveTo(x0, y0);
    hole.lineTo(x1, y0);
    hole.lineTo(x1, y1);
    hole.lineTo(x0, y1);
    hole.closePath();
    s.holes.push(hole);
  }
  return s;
}

// One wall face with optional openings, plus glazing/trim per opening.
function Wall({
  length,
  height,
  appearance,
  opacity,
  openings,
  position,
  rotation,
}: {
  length: number;
  height: number;
  appearance: SurfaceAppearance;
  opacity: number;
  openings: WallOpening[];
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const geo = useMemo(() => {
    const g = new THREE.ShapeGeometry(buildWallShape(length, height, openings));
    // ShapeGeometry UVs are in shape units (metres); normalise to 0..1 so
    // texture repeat counts tiles across the whole face.
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (uv.getX(i) + length / 2) / length, uv.getY(i) / height);
    }
    uv.needsUpdate = true;
    return g;
  }, [length, height, openings]);
  const { map, bumpMap } = useMemo(
    () => repeatedMaps(appearance, length, height),
    [appearance, length, height]
  );
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial
          color={appearance.color}
          map={map}
          bumpMap={bumpMap}
          bumpScale={appearance.bumpScale}
          side={THREE.DoubleSide}
          transparent
          opacity={opacity}
          roughness={appearance.roughness}
        />
      </mesh>
      {openings.map((o, i) => {
        const cx = (o.offset - 0.5) * length;
        const y0 = Math.max(0.001, o.sill);
        const y1 = Math.min(height - 0.02, o.sill + o.height);
        const cy = (y0 + y1) / 2;
        const w = Math.max(0.05, o.width);
        const h = Math.max(0.05, y1 - y0);
        return (
          <group key={i} position={[cx, 0, 0]}>
            {/* Frame outline */}
            <lineSegments position={[0, cy, 0]}>
              <edgesGeometry args={[new THREE.PlaneGeometry(w, h)]} />
              <lineBasicMaterial color={o.type === "door" ? "#7c5c3b" : "#8aa0b8"} />
            </lineSegments>
            {/* Glass for windows */}
            {o.type === "window" && (
              <mesh position={[0, cy, 0]}>
                <planeGeometry args={[w, h]} />
                <meshStandardMaterial
                  color="#bcdcff"
                  transparent
                  opacity={0.25}
                  roughness={0.1}
                  metalness={0.1}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}
            {/* Door slab (thin, ajar) for doors */}
            {o.type === "door" && (
              <mesh position={[-w / 2 + 0.02, cy, 0.04]} rotation={[0, 0.35, 0]}>
                <boxGeometry args={[w * 0.96, h, 0.04]} />
                <meshStandardMaterial color="#8a6a47" roughness={0.7} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

// Color presets for surfaces
const FLOOR_DEFAULT = "#e8e0d4";   // warm wood-like
const WALL_DEFAULT = "#f5f0eb";    // warm off-white
const CEILING_DEFAULT = "#fafafa"; // light white

function getSurfaceColor(mat: SurfaceMaterial | null | undefined, fallback: string): string {
  if (!mat || mat.type !== "color") return fallback;
  return mat.value;
}

// Resolved appearance for a surface: flat color, or procedural PBR maps.
export interface SurfaceAppearance {
  color: string;
  map?: THREE.Texture;
  bumpMap?: THREE.Texture;
  bumpScale?: number;
  roughness: number;
  /** World metres per texture tile (for repeat calc). */
  tileSize?: number;
}

function useSurfaceAppearance(
  mat: SurfaceMaterial | null | undefined,
  fallbackColor: string,
  fallbackRoughness: number
): SurfaceAppearance {
  return useMemo(() => {
    if (mat?.type === "texture") {
      const maps = getPBRMaps(mat.value);
      if (maps) {
        return {
          color: "#ffffff",
          map: maps.map,
          bumpMap: maps.bumpMap,
          bumpScale: maps.bumpScale,
          roughness: maps.roughness,
          tileSize: maps.tileSize * (mat.repeat ?? 1),
        };
      }
    }
    return { color: getSurfaceColor(mat, fallbackColor), roughness: fallbackRoughness };
  }, [mat, fallbackColor, fallbackRoughness]);
}

// Clone maps with a repeat matched to the surface's world size, so patterns
// keep a consistent physical scale on differently sized surfaces.
function repeatedMaps(app: SurfaceAppearance, w: number, h: number) {
  if (!app.map || !app.tileSize) return { map: undefined, bumpMap: undefined };
  const rx = Math.max(1, Math.round(w / app.tileSize));
  const ry = Math.max(1, Math.round(h / app.tileSize));
  const map = app.map.clone();
  map.repeat.set(rx, ry);
  map.needsUpdate = true;
  const bumpMap = app.bumpMap?.clone();
  if (bumpMap) {
    bumpMap.repeat.set(rx, ry);
    bumpMap.needsUpdate = true;
  }
  return { map, bumpMap };
}

// Build wall geometry for polygon rooms (extrude walls from floor polygon)
function PolygonWalls({
  points,
  height,
  wallAppearance,
  openings,
}: {
  points: FloorPoint[];
  height: number;
  wallAppearance: SurfaceAppearance;
  openings: WallOpening[];
}) {
  const walls = useMemo(() => {
    const out: { position: [number, number, number]; rotation: [number, number, number]; width: number }[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dx, dz);
      out.push({
        position: [(a.x + b.x) / 2, 0, (a.z + b.z) / 2],
        rotation: [0, angle, 0],
        width: length,
      });
    }
    return out;
  }, [points]);

  return (
    <>
      {walls.map((w, i) => (
        <Wall
          key={i}
          length={w.width}
          height={height}
          appearance={wallAppearance}
          opacity={0.45}
          openings={openings.filter((o) => o.wall === i)}
          position={w.position}
          rotation={w.rotation}
        />
      ))}
    </>
  );
}

// Build floor shape from polygon points
function PolygonFloor({ points, appearance }: { points: FloorPoint[]; appearance: SurfaceAppearance }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(points[0].x, points[0].z);
    for (let i = 1; i < points.length; i++) {
      s.lineTo(points[i].x, points[i].z);
    }
    s.closePath();
    return s;
  }, [points]);
  const { map, bumpMap } = useMemo(() => {
    if (!appearance.map || !appearance.tileSize) return { map: undefined, bumpMap: undefined };
    // ShapeGeometry UVs are in metres already; 1 repeat per tileSize metres.
    const m = appearance.map.clone();
    m.repeat.set(1 / appearance.tileSize, 1 / appearance.tileSize);
    m.needsUpdate = true;
    const b = appearance.bumpMap?.clone();
    if (b) { b.repeat.copy(m.repeat); b.needsUpdate = true; }
    return { map: m, bumpMap: b };
  }, [appearance]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial
        color={appearance.color}
        map={map}
        bumpMap={bumpMap}
        bumpScale={appearance.bumpScale}
        side={THREE.DoubleSide}
        roughness={appearance.roughness}
        metalness={0.05}
      />
    </mesh>
  );
}

// Room loaded from a GLTF/GLB file
function ImportedRoom({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  const scene = useMemo(() => gltf.scene.clone(), [gltf]);
  return <primitive object={scene} receiveShadow castShadow />;
}

// Cuboid room (default)
function CuboidRoom({
  width,
  height,
  depth,
  floorApp,
  wallApp,
  ceilingApp,
  openings,
}: {
  width: number;
  height: number;
  depth: number;
  floorApp: SurfaceAppearance;
  wallApp: SurfaceAppearance;
  ceilingApp: SurfaceAppearance;
  openings: WallOpening[];
}) {
  const halfW = width / 2;
  const halfD = depth / 2;
  const wallOpenings = (i: number) => openings.filter((o) => o.wall === i);
  const floorMaps = useMemo(() => repeatedMaps(floorApp, width, depth), [floorApp, width, depth]);

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          color={floorApp.color}
          map={floorMaps.map}
          bumpMap={floorMaps.bumpMap}
          bumpScale={floorApp.bumpScale}
          side={THREE.DoubleSide}
          roughness={floorApp.roughness}
          metalness={0.05}
        />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={ceilingApp.color} side={THREE.DoubleSide} transparent opacity={0.2} roughness={ceilingApp.roughness} />
      </mesh>

      {/* Walls (edge indices match rect floor: 0=back,1=right,2=front,3=left) */}
      <Wall length={width} height={height} appearance={wallApp} opacity={0.45}
        openings={wallOpenings(0)} position={[0, 0, -halfD]} rotation={[0, 0, 0]} />
      <Wall length={depth} height={height} appearance={wallApp} opacity={0.15}
        openings={wallOpenings(1)} position={[halfW, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
      <Wall length={width} height={height} appearance={wallApp} opacity={0.08}
        openings={wallOpenings(2)} position={[0, 0, halfD]} rotation={[0, Math.PI, 0]} />
      <Wall length={depth} height={height} appearance={wallApp} opacity={0.45}
        openings={wallOpenings(3)} position={[-halfW, 0, 0]} rotation={[0, Math.PI / 2, 0]} />

      {/* Baseboard accent on back wall */}
      <mesh position={[0, 0.05, -halfD + 0.001]}>
        <planeGeometry args={[width, 0.1]} />
        <meshStandardMaterial color="#c4b5a0" />
      </mesh>

      {/* Baseboard accent on left wall */}
      <mesh position={[-halfW + 0.001, 0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[depth, 0.1]} />
        <meshStandardMaterial color="#c4b5a0" />
      </mesh>

      {/* Room outline edges */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
        <lineBasicMaterial color="#94a3b8" linewidth={1} />
      </lineSegments>
      <mesh position={[0, height / 2, 0]} visible={false}>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
    </group>
  );
}

export function RoomBox({
  width,
  height,
  depth,
  floorPoints,
  openings,
  modelUrl,
  floorMaterial,
  wallMaterial,
  ceilingMaterial,
}: RoomBoxProps) {
  const ops = openings ?? [];
  const floorApp = useSurfaceAppearance(floorMaterial, FLOOR_DEFAULT, 0.9);
  const wallApp = useSurfaceAppearance(wallMaterial, WALL_DEFAULT, 0.8);
  const ceilingApp = useSurfaceAppearance(ceilingMaterial, CEILING_DEFAULT, 0.9);

  // If a 3D file is uploaded for the room, render it directly
  if (modelUrl && (modelUrl.endsWith(".glb") || modelUrl.endsWith(".gltf") || modelUrl.startsWith("blob:") || modelUrl.startsWith("/uploads/"))) {
    return <ImportedRoom url={modelUrl} />;
  }

  // Polygon floor plan (non-cuboid)
  if (floorPoints && floorPoints.length >= 3) {
    return (
      <group>
        <PolygonFloor points={floorPoints} appearance={floorApp} />
        <PolygonWalls points={floorPoints} height={height} wallAppearance={wallApp} openings={ops} />

        {/* Ceiling from same polygon */}
        <group position={[0, height, 0]} rotation={[Math.PI, 0, 0]}>
          <PolygonFloor points={floorPoints} appearance={ceilingApp} />
        </group>
      </group>
    );
  }

  // Default cuboid room
  return (
    <CuboidRoom
      width={width}
      height={height}
      depth={depth}
      floorApp={floorApp}
      wallApp={wallApp}
      ceilingApp={ceilingApp}
      openings={ops}
    />
  );
}
