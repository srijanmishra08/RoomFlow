"use client";

import { useRef, useState, useMemo, useEffect, Component, type ReactNode } from "react";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import type { RoomObjectData } from "./RoomViewer";

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

// Category-based shape/color for placeholder objects
function categoryStyle(name: string): { color: string; geometry: "box" | "cylinder" | "sphere" } {
  const lower = name.toLowerCase();
  if (lower.includes("chair") || lower.includes("sofa") || lower.includes("couch"))
    return { color: "#6366f1", geometry: "box" };
  if (lower.includes("table") || lower.includes("desk"))
    return { color: "#8b5cf6", geometry: "box" };
  if (lower.includes("lamp") || lower.includes("light"))
    return { color: "#f59e0b", geometry: "cylinder" };
  if (lower.includes("plant") || lower.includes("pot"))
    return { color: "#22c55e", geometry: "sphere" };
  if (lower.includes("bed") || lower.includes("mattress"))
    return { color: "#ec4899", geometry: "box" };
  return { color: "#64748b", geometry: "box" };
}

interface FurnitureObjectProps {
  data: RoomObjectData;
  isSelected: boolean;
  onClick: () => void;
  isEditable: boolean;
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

// Placeholder box when no GLTF model URL is provided (or when load fails)
function PlaceholderBox({
  data,
  isSelected,
  onClick,
  label,
}: {
  data: RoomObjectData;
  isSelected: boolean;
  onClick: () => void;
  label?: string;
}) {
  const style = categoryStyle(data.name);
  const color = data.color || (isSelected ? "#3b82f6" : style.color);

  return (
    <group
      position={[data.positionX, data.positionY + 0.5, data.positionZ]}
      rotation={[data.rotationX, data.rotationY, data.rotationZ]}
      scale={[data.scaleX, data.scaleY, data.scaleZ]}
    >
      <mesh
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {style.geometry === "box" && <boxGeometry args={[1, 1, 1]} />}
        {style.geometry === "cylinder" && <cylinderGeometry args={[0.3, 0.4, 1.2, 16]} />}
        {style.geometry === "sphere" && <sphereGeometry args={[0.5, 16, 16]} />}
        <meshStandardMaterial
          color={color}
          transparent
          opacity={isSelected ? 1 : 0.85}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>

      {/* Selection indicator ring */}
      {isSelected && (
        <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.7, 0.85, 32]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
      )}

      {/* Status dot */}
      <mesh position={[0, 0.7, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={statusToColor(data.status)} />
      </mesh>
    </group>
  );
}

// GLTF model loader component
function GLTFModel({
  url,
  data,
  isSelected,
  onClick,
}: {
  url: string;
  data: RoomObjectData;
  isSelected: boolean;
  onClick: () => void;
}) {
  const gltf = useLoader(GLTFLoader, url);
  const scene = useMemo(() => gltf.scene.clone(), [gltf]);

  return (
    <group
      position={[data.positionX, data.positionY, data.positionZ]}
      rotation={[data.rotationX, data.rotationY, data.rotationZ]}
      scale={[data.scaleX, data.scaleY, data.scaleZ]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <primitive object={scene} castShadow />

      {/* Selection ring */}
      {isSelected && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.7, 0.85, 32]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
      )}

      {/* Status indicator */}
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={statusToColor(data.status)} />
      </mesh>
    </group>
  );
}

// Check if a URL looks like it could be a valid GLTF/GLB resource
function isValidModelUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return false;
  // Reject obvious non-model URLs (HTML pages, polyhaven browse pages, etc.)
  if (url.includes("polyhaven.com/a/")) return false;
  // Must end in .glb/.gltf OR be a proper API URL
  const lower = url.toLowerCase();
  if (lower.endsWith(".glb") || lower.endsWith(".gltf")) return true;
  if (lower.includes(".glb?") || lower.includes(".gltf?")) return true;
  // Allow blob/data URLs and API endpoints that serve models
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;
  if (url.startsWith("/api/") || url.startsWith("/uploads/")) return true;
  return false;
}

export function FurnitureObject({
  data,
  isSelected,
  onClick,
  isEditable,
}: FurnitureObjectProps) {
  const placeholder = (
    <PlaceholderBox data={data} isSelected={isSelected} onClick={onClick} />
  );

  if (isValidModelUrl(data.modelUrl)) {
    return (
      <ModelErrorBoundary fallback={placeholder}>
        <GLTFModel
          url={data.modelUrl!}
          data={data}
          isSelected={isSelected}
          onClick={onClick}
        />
      </ModelErrorBoundary>
    );
  }

  return placeholder;
}
