"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";
import { Suspense, useState } from "react";
import { RoomBox, type SurfaceMaterial, type FloorPoint } from "./RoomBox";
import { FurnitureObject } from "./FurnitureObject";
import { ObjectInspector } from "./ObjectInspector";

export interface RoomObjectData {
  id: string;
  name: string;
  modelUrl: string | null;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  status: string;
  material: string | null;
  brand: string | null;
  supplier: string | null;
  cost: number | null;
  currency: string;
  deliveryDate: string | null;
  color: string | null;
  comments?: Array<{
    id: string;
    content: string;
    createdAt: string;
    user: { name: string; role?: string };
  }>;
}

interface RoomViewerProps {
  width: number;
  height: number;
  depth: number;
  objects: RoomObjectData[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isEditable?: boolean;
  onObjectMove?: (id: string, x: number, y: number, z: number) => void;
  floorPoints?: FloorPoint[] | null;
  roomModelUrl?: string | null;
  floorMaterial?: SurfaceMaterial | null;
  wallMaterial?: SurfaceMaterial | null;
  ceilingMaterial?: SurfaceMaterial | null;
}

export function RoomViewer({
  width,
  height,
  depth,
  objects,
  selectedId,
  onSelect,
  isEditable = false,
  floorPoints,
  roomModelUrl,
  floorMaterial,
  wallMaterial,
  ceilingMaterial,
}: RoomViewerProps) {
  return (
    <div className="canvas-container w-full h-full rounded-xl overflow-hidden border border-[var(--border)]">
      <Canvas
        camera={{ position: [width * 1.5, height * 1.5, depth * 1.5], fov: 50 }}
        shadows
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[5, 10, 5]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[0, height - 0.5, 0]} intensity={0.4} color="#fff5e6" />
          <hemisphereLight args={["#ffeebb", "#080820", 0.3]} />

          {/* Room structure */}
          <RoomBox
            width={width}
            height={height}
            depth={depth}
            floorPoints={floorPoints}
            modelUrl={roomModelUrl}
            floorMaterial={floorMaterial}
            wallMaterial={wallMaterial}
            ceilingMaterial={ceilingMaterial}
          />

          {/* Floor grid */}
          <Grid
            args={[width * 2, depth * 2]}
            position={[0, 0.01, 0]}
            cellSize={0.5}
            cellColor="#d4c9b8"
            sectionSize={1}
            sectionColor="#b8a99a"
            fadeDistance={25}
          />

          {/* Shadow plane */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0.002, 0]}>
            <planeGeometry args={[width, depth]} />
            <shadowMaterial opacity={0.2} />
          </mesh>

          {/* Objects */}
          {objects.map((obj) => (
            <FurnitureObject
              key={obj.id}
              data={obj}
              isSelected={selectedId === obj.id}
              onClick={() => onSelect(obj.id)}
              isEditable={isEditable}
            />
          ))}

          <OrbitControls
            makeDefault
            maxPolarAngle={Math.PI / 2}
            minDistance={2}
            maxDistance={30}
          />
          <Environment preset="apartment" />
        </Suspense>
      </Canvas>
    </div>
  );
}
