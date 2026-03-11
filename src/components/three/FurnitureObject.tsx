"use client";

import { useRef, useState, useMemo } from "react";
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

interface FurnitureObjectProps {
  data: RoomObjectData;
  isSelected: boolean;
  onClick: () => void;
  isEditable: boolean;
}

// Placeholder box when no GLTF model URL is provided
function PlaceholderBox({
  data,
  isSelected,
  onClick,
}: {
  data: RoomObjectData;
  isSelected: boolean;
  onClick: () => void;
}) {
  const color = data.color || statusToColor(data.status);
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <group
      position={[data.positionX, data.positionY + 0.5, data.positionZ]}
      rotation={[data.rotationX, data.rotationY, data.rotationZ]}
      scale={[data.scaleX, data.scaleY, data.scaleZ]}
    >
      <mesh
        ref={meshRef}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={isSelected ? 1 : 0.8}
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

export function FurnitureObject({
  data,
  isSelected,
  onClick,
  isEditable,
}: FurnitureObjectProps) {
  if (data.modelUrl) {
    return (
      <GLTFModel
        url={data.modelUrl}
        data={data}
        isSelected={isSelected}
        onClick={onClick}
      />
    );
  }

  return (
    <PlaceholderBox data={data} isSelected={isSelected} onClick={onClick} />
  );
}
