"use client";

import { useMemo, useRef, Component, type ReactNode } from "react";
import { useLoader } from "@react-three/fiber";
import { TransformControls } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import type { RoomObjectData } from "./RoomViewer";
import { ProceduralFurniture } from "./ProceduralFurniture";
import { resolveKind } from "@/lib/furniture-catalog";

// Color mapping for status
function statusToColor(status: string): string {
  switch (status) {
    case "FINALIZED":
      return "#22c55e";
    case "IN_PROGRESS":
      return "#eab308";
    case "PLANNED":
    default:
      return "#9ca3af";
  }
}

export type GizmoMode = "translate" | "rotate" | "scale";

export interface TransformPatch {
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationY: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

interface FurnitureObjectProps {
  data: RoomObjectData;
  isSelected: boolean;
  /** Part of a multi-selection but not the primary (gizmo-carrying) piece. */
  isMultiSelected?: boolean;
  onClick: (additive: boolean) => void;
  isEditable: boolean;
  /** Active manipulation mode for the selected piece. */
  gizmoMode?: GizmoMode;
  /** Called when the piece is dragged to a new floor position (metres). */
  onMove?: (id: string, x: number, y: number, z: number) => void;
  /** Called after any transform commit (translate/rotate/scale). */
  onTransform?: (id: string, patch: TransformPatch) => void;
}

// Error boundary to catch GLTF load failures inside Canvas
class ModelErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// GLTF model meshes (no positioning — the parent group positions it).
function GLTFMeshes({ url, data }: { url: string; data: RoomObjectData }) {
  const gltf = useLoader(GLTFLoader, url);
  const scene = useMemo(() => gltf.scene.clone(), [gltf]);
  return (
    <group scale={[data.scaleX, data.scaleY, data.scaleZ]}>
      <primitive object={scene} castShadow />
    </group>
  );
}

// Check if a URL looks like it could be a valid GLTF/GLB resource
function isValidModelUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return false;
  if (url.includes("polyhaven.com/a/")) return false;
  const lower = url.toLowerCase();
  if (lower.endsWith(".glb") || lower.endsWith(".gltf")) return true;
  if (lower.includes(".glb?") || lower.includes(".gltf?")) return true;
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;
  if (url.startsWith("/api/") || url.startsWith("/uploads/")) return true;
  return false;
}

export function FurnitureObject({
  data,
  isSelected,
  isMultiSelected = false,
  onClick,
  isEditable,
  gizmoMode = "translate",
  onMove,
  onTransform,
}: FurnitureObjectProps) {
  const groupRef = useRef<THREE.Group>(null);

  const hasModel = isValidModelUrl(data.modelUrl);
  const kind = resolveKind(data.material, data.name);
  const w = data.scaleX || 1;
  const h = data.scaleY || 1;
  const d = data.scaleZ || 1;
  const color = data.color || "#8a93a5";
  const ringR = Math.max(w, d) / 2 + 0.18;
  const dotY = hasModel ? 1.6 : h + 0.18;

  // Visual content sitting on the floor (y from 0 up).
  const meshes = hasModel ? (
    <ModelErrorBoundary
      fallback={<ProceduralFurniture kind={kind} w={w} h={h} d={d} color={color} />}
    >
      <GLTFMeshes url={data.modelUrl!} data={data} />
    </ModelErrorBoundary>
  ) : (
    <ProceduralFurniture kind={kind} w={w} h={h} d={d} color={color} />
  );

  const body = (
    <group
      ref={groupRef}
      position={[data.positionX, data.positionY, data.positionZ]}
      rotation={[data.rotationX, data.rotationY, data.rotationZ]}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e.nativeEvent.shiftKey);
      }}
    >
      {meshes}

      {(isSelected || isMultiSelected) && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ringR, ringR + 0.12, 48]} />
          <meshBasicMaterial color={isSelected ? "#3b82f6" : "#93c5fd"} />
        </mesh>
      )}

      <mesh position={[0, dotY, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color={statusToColor(data.status)} />
      </mesh>
    </group>
  );

  // Manipulation gizmo only on the selected, editable piece.
  if (isSelected && isEditable && (onMove || onTransform)) {
    const commit = () => {
      const g = groupRef.current;
      if (!g) return;
      // Back-compat: translate still fires onMove.
      if (gizmoMode === "translate" && onMove) {
        onMove(data.id, +g.position.x.toFixed(2), +g.position.y.toFixed(2), +g.position.z.toFixed(2));
      }
      onTransform?.(data.id, {
        positionX: +g.position.x.toFixed(2),
        positionY: +g.position.y.toFixed(2),
        positionZ: +g.position.z.toFixed(2),
        rotationY: +g.rotation.y.toFixed(3),
        scaleX: +(data.scaleX * g.scale.x).toFixed(2),
        scaleY: +(data.scaleY * g.scale.y).toFixed(2),
        scaleZ: +(data.scaleZ * g.scale.z).toFixed(2),
      });
    };
    return (
      <TransformControls
        mode={gizmoMode}
        showY={gizmoMode !== "translate"}
        translationSnap={gizmoMode === "translate" ? 0.1 : undefined}
        rotationSnap={gizmoMode === "rotate" ? Math.PI / 24 : undefined}
        size={0.7}
        onMouseUp={commit}
      >
        {body}
      </TransformControls>
    );
  }

  return body;
}
