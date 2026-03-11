"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface SurfaceMaterial {
  type: "color" | "texture";
  value: string;
  repeat?: number;
}

export interface FloorPoint {
  x: number;
  z: number;
}

interface RoomBoxProps {
  width: number;
  height: number;
  depth: number;
  floorPoints?: FloorPoint[] | null;
  modelUrl?: string | null;
  floorMaterial?: SurfaceMaterial | null;
  wallMaterial?: SurfaceMaterial | null;
  ceilingMaterial?: SurfaceMaterial | null;
}

// Color presets for surfaces
const FLOOR_DEFAULT = "#e8e0d4";   // warm wood-like
const WALL_DEFAULT = "#f5f0eb";    // warm off-white
const CEILING_DEFAULT = "#fafafa"; // light white

function getSurfaceColor(mat: SurfaceMaterial | null | undefined, fallback: string): string {
  if (!mat || mat.type !== "color") return fallback;
  return mat.value;
}

// Build wall geometry for polygon rooms (extrude walls from floor polygon)
function PolygonWalls({ points, height, wallColor }: { points: FloorPoint[]; height: number; wallColor: string }) {
  const wallGeometries = useMemo(() => {
    const walls: { position: THREE.Vector3; rotation: THREE.Euler; width: number }[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dx, dz);
      walls.push({
        position: new THREE.Vector3((a.x + b.x) / 2, height / 2, (a.z + b.z) / 2),
        rotation: new THREE.Euler(0, angle, 0),
        width: length,
      });
    }
    return walls;
  }, [points, height]);

  return (
    <>
      {wallGeometries.map((w, i) => (
        <mesh key={i} position={w.position} rotation={w.rotation} receiveShadow>
          <planeGeometry args={[w.width, height]} />
          <meshStandardMaterial
            color={wallColor}
            side={THREE.DoubleSide}
            transparent
            opacity={0.45}
            roughness={0.8}
          />
        </mesh>
      ))}
    </>
  );
}

// Build floor shape from polygon points
function PolygonFloor({ points, floorColor }: { points: FloorPoint[]; floorColor: string }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(points[0].x, points[0].z);
    for (let i = 1; i < points.length; i++) {
      s.lineTo(points[i].x, points[i].z);
    }
    s.closePath();
    return s;
  }, [points]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial
        color={floorColor}
        side={THREE.DoubleSide}
        roughness={0.9}
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
  floorColor,
  wallColor,
  ceilingColor,
}: {
  width: number;
  height: number;
  depth: number;
  floorColor: string;
  wallColor: string;
  ceilingColor: string;
}) {
  const halfW = width / 2;
  const halfD = depth / 2;

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={floorColor} side={THREE.DoubleSide} roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={ceilingColor} side={THREE.DoubleSide} transparent opacity={0.2} roughness={0.9} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, height / 2, -halfD]} receiveShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} transparent opacity={0.45} roughness={0.8} />
      </mesh>

      {/* Left wall */}
      <mesh position={[-halfW, height / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[depth, height]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} transparent opacity={0.45} roughness={0.8} />
      </mesh>

      {/* Right wall (subtle, for depth) */}
      <mesh position={[halfW, height / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[depth, height]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} transparent opacity={0.15} roughness={0.8} />
      </mesh>

      {/* Front wall (very subtle) */}
      <mesh position={[0, height / 2, halfD]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} transparent opacity={0.08} roughness={0.8} />
      </mesh>

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
  modelUrl,
  floorMaterial,
  wallMaterial,
  ceilingMaterial,
}: RoomBoxProps) {
  const floorColor = getSurfaceColor(floorMaterial, FLOOR_DEFAULT);
  const wallColor = getSurfaceColor(wallMaterial, WALL_DEFAULT);
  const ceilingColor = getSurfaceColor(ceilingMaterial, CEILING_DEFAULT);

  // If a 3D file is uploaded for the room, render it directly
  if (modelUrl && (modelUrl.endsWith(".glb") || modelUrl.endsWith(".gltf") || modelUrl.startsWith("blob:") || modelUrl.startsWith("/uploads/"))) {
    return <ImportedRoom url={modelUrl} />;
  }

  // Polygon floor plan (non-cuboid)
  if (floorPoints && floorPoints.length >= 3) {
    return (
      <group>
        <PolygonFloor points={floorPoints} floorColor={floorColor} />
        <PolygonWalls points={floorPoints} height={height} wallColor={wallColor} />

        {/* Ceiling from same polygon */}
        <group position={[0, height, 0]} rotation={[Math.PI, 0, 0]}>
          <PolygonFloor points={floorPoints} floorColor={ceilingColor} />
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
      floorColor={floorColor}
      wallColor={wallColor}
      ceilingColor={ceilingColor}
    />
  );
}
