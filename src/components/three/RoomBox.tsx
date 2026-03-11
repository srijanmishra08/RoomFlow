"use client";

import { useRef } from "react";
import * as THREE from "three";

interface RoomBoxProps {
  width: number;
  height: number;
  depth: number;
}

export function RoomBox({ width, height, depth }: RoomBoxProps) {
  const halfW = width / 2;
  const halfD = depth / 2;

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          color="#f0f0f0"
          side={THREE.DoubleSide}
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, height / 2, -halfD]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color="#fafafa"
          side={THREE.DoubleSide}
          transparent
          opacity={0.15}
        />
      </mesh>

      {/* Left wall */}
      <mesh
        position={[-halfW, height / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[depth, height]} />
        <meshStandardMaterial
          color="#fafafa"
          side={THREE.DoubleSide}
          transparent
          opacity={0.15}
        />
      </mesh>

      {/* Room outline edges */}
      <lineSegments>
        <edgesGeometry
          args={[new THREE.BoxGeometry(width, height, depth)]}
        />
        <lineBasicMaterial color="#94a3b8" linewidth={1} />
      </lineSegments>
      <mesh position={[0, height / 2, 0]} visible={false}>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
    </group>
  );
}
