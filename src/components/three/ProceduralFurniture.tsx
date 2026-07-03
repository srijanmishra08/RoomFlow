"use client";

// ─── Procedural Furniture ────────────────────────────────────────────────
// Renders recognisable furniture from grouped primitive meshes, sized to a
// real-world bounding box [w, h, d] in metres. No GLB assets required.
//
// Convention: every model is built sitting on the floor (y from 0 upward),
// centred on x/z. The parent <group> (in FurnitureObject) supplies world
// position + rotation. We consume [w,h,d] as geometry, NOT as a Three scale,
// so proportions stay correct at any size.

import * as THREE from "three";
import type { FurnitureKind } from "@/lib/furniture-catalog";

function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return `#${c.getHexString()}`;
}

interface PartProps {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  roughness?: number;
  metalness?: number;
}

function Part({ position, size, color, roughness = 0.7, metalness = 0.05 }: PartProps) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  );
}

function Cyl({
  position,
  radius,
  height,
  color,
  radialSegments = 16,
}: {
  position: [number, number, number];
  radius: number;
  height: number;
  color: string;
  radialSegments?: number;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, height, radialSegments]} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />
    </mesh>
  );
}

interface Built {
  w: number;
  h: number;
  d: number;
  color: string;
}

function Sofa({ w, h, d, color }: Built) {
  const seatH = h * 0.42;
  const backH = h - seatH;
  const armW = Math.min(0.18, w * 0.12);
  const dark = shade(color, -0.08);
  return (
    <group>
      <Part position={[0, seatH / 2, 0]} size={[w, seatH, d]} color={color} />
      <Part position={[0, seatH + 0.06, d * 0.05]} size={[w - armW * 2, 0.12, d * 0.7]} color={shade(color, 0.06)} />
      <Part position={[0, seatH + backH / 2, -d / 2 + 0.12]} size={[w, backH, 0.22]} color={color} />
      <Part position={[-w / 2 + armW / 2, seatH * 0.9, 0]} size={[armW, seatH * 1.1, d]} color={dark} />
      <Part position={[w / 2 - armW / 2, seatH * 0.9, 0]} size={[armW, seatH * 1.1, d]} color={dark} />
      {[[-w / 2 + 0.1, d / 2 - 0.1], [w / 2 - 0.1, d / 2 - 0.1], [-w / 2 + 0.1, -d / 2 + 0.1], [w / 2 - 0.1, -d / 2 + 0.1]].map(
        ([x, z], i) => <Cyl key={i} position={[x, 0.04, z]} radius={0.03} height={0.08} color="#3a3a3a" />
      )}
    </group>
  );
}

function Armchair(p: Built) {
  return <Sofa {...p} />;
}

function Chair({ w, h, d, color }: Built) {
  const seatH = h * 0.45;
  const legR = 0.022;
  const legs: [number, number][] = [
    [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05],
    [-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05],
  ];
  return (
    <group>
      <Part position={[0, seatH, 0]} size={[w, 0.06, d]} color={color} />
      <Part position={[0, seatH + (h - seatH) / 2, -d / 2 + 0.04]} size={[w, h - seatH, 0.05]} color={color} />
      {legs.map(([x, z], i) => <Cyl key={i} position={[x, seatH / 2, z]} radius={legR} height={seatH} color={shade(color, -0.15)} />)}
    </group>
  );
}

function Table({ w, h, d, color }: Built) {
  const topT = 0.06;
  const legR = 0.04;
  const inset = 0.12;
  const legs: [number, number][] = [
    [-w / 2 + inset, d / 2 - inset], [w / 2 - inset, d / 2 - inset],
    [-w / 2 + inset, -d / 2 + inset], [w / 2 - inset, -d / 2 + inset],
  ];
  return (
    <group>
      <Part position={[0, h - topT / 2, 0]} size={[w, topT, d]} color={color} roughness={0.45} />
      {legs.map(([x, z], i) => <Cyl key={i} position={[x, (h - topT) / 2, z]} radius={legR} height={h - topT} color={shade(color, -0.12)} />)}
    </group>
  );
}

function Desk({ w, h, d, color }: Built) {
  const topT = 0.05;
  return (
    <group>
      <Part position={[0, h - topT / 2, 0]} size={[w, topT, d]} color={color} roughness={0.4} />
      <Part position={[-w / 2 + 0.04, (h - topT) / 2, 0]} size={[0.06, h - topT, d - 0.06]} color={shade(color, -0.1)} />
      <Part position={[w / 2 - 0.04, (h - topT) / 2, 0]} size={[0.06, h - topT, d - 0.06]} color={shade(color, -0.1)} />
      <Part position={[0, h - topT - 0.12, -d / 2 + 0.05]} size={[w - 0.1, 0.2, 0.03]} color={shade(color, -0.05)} />
    </group>
  );
}

function Bed({ w, h, d, color }: Built) {
  const frameH = h * 0.35;
  const mattH = h * 0.4;
  const headH = h * 1.4;
  return (
    <group>
      <Part position={[0, frameH / 2, 0]} size={[w, frameH, d]} color={shade(color, -0.18)} />
      <Part position={[0, frameH + mattH / 2, 0.04]} size={[w - 0.06, mattH, d - 0.1]} color={shade(color, 0.1)} roughness={0.9} />
      <Part position={[-w * 0.22, frameH + mattH + 0.04, -d / 2 + 0.28]} size={[w * 0.36, 0.1, 0.32]} color="#f3eee6" roughness={1} />
      <Part position={[w * 0.22, frameH + mattH + 0.04, -d / 2 + 0.28]} size={[w * 0.36, 0.1, 0.32]} color="#f3eee6" roughness={1} />
      <Part position={[0, frameH + mattH + 0.02, d * 0.12]} size={[w - 0.04, 0.06, d * 0.62]} color={color} roughness={1} />
      <Part position={[0, headH / 2, -d / 2 + 0.04]} size={[w, headH, 0.08]} color={shade(color, -0.22)} />
    </group>
  );
}

function Cabinet({ w, h, d, color, doors = 2, handles = true }: Built & { doors?: number; handles?: boolean }) {
  const panels = [];
  const dw = w / doors;
  for (let i = 0; i < doors; i++) {
    const x = -w / 2 + dw * (i + 0.5);
    panels.push(<Part key={`d${i}`} position={[x, h / 2, d / 2 - 0.01]} size={[dw - 0.02, h - 0.04, 0.03]} color={shade(color, 0.04)} />);
    if (handles) panels.push(<Cyl key={`h${i}`} position={[x + dw * 0.32, h / 2, d / 2 + 0.02]} radius={0.012} height={0.12} color="#2a2a2a" />);
  }
  return (
    <group>
      <Part position={[0, h / 2, 0]} size={[w, h, d]} color={color} />
      {panels}
    </group>
  );
}

function Bookshelf({ w, h, d, color }: Built) {
  const shelves = Math.max(3, Math.round(h / 0.4));
  const items: React.ReactNode[] = [];
  items.push(<Part key="l" position={[-w / 2 + 0.02, h / 2, 0]} size={[0.04, h, d]} color={color} />);
  items.push(<Part key="r" position={[w / 2 - 0.02, h / 2, 0]} size={[0.04, h, d]} color={color} />);
  items.push(<Part key="bk" position={[0, h / 2, -d / 2 + 0.01]} size={[w, h, 0.02]} color={shade(color, -0.1)} />);
  for (let i = 0; i <= shelves; i++) {
    const y = (h / shelves) * i;
    items.push(<Part key={`s${i}`} position={[0, Math.min(y, h - 0.02), 0]} size={[w, 0.03, d]} color={color} />);
  }
  const palette = ["#a0522d", "#2e5d7a", "#6b8e23", "#8b3a3a", "#4a4e69"];
  for (let s = 0; s < shelves; s++) {
    for (let b = 0; b < 4; b++) {
      const y = (h / shelves) * s + (h / shelves) * 0.5;
      const x = -w / 2 + 0.1 + b * (w * 0.22);
      items.push(<Part key={`b${s}-${b}`} position={[x, y, d * 0.1]} size={[w * 0.16, h / shelves * 0.7, d * 0.6]} color={palette[(s + b) % palette.length]} />);
    }
  }
  return <group>{items}</group>;
}

function TvUnit({ w, h, d, color }: Built) {
  return (
    <group>
      <Part position={[0, h / 2, 0]} size={[w, h, d]} color={color} roughness={0.4} />
      <Part position={[-w * 0.25, h / 2, d / 2 - 0.01]} size={[w * 0.45, h - 0.06, 0.02]} color={shade(color, 0.06)} />
      <Part position={[w * 0.25, h / 2, d / 2 - 0.01]} size={[w * 0.45, h - 0.06, 0.02]} color={shade(color, 0.06)} />
    </group>
  );
}

function Tv({ w, h, d, color }: Built) {
  const standH = 0.5;
  return (
    <group>
      <Cyl position={[0, standH / 2, 0]} radius={0.04} height={standH} color="#222" />
      <Part position={[0, standH + h / 2, 0]} size={[w, h, Math.max(d, 0.05)]} color="#0a0a0a" />
      <Part position={[0, standH + h / 2, d / 2]} size={[w - 0.06, h - 0.06, 0.01]} color={color} metalness={0.3} roughness={0.2} />
    </group>
  );
}

function Lamp({ w, h, d, color }: Built) {
  const baseR = Math.min(w, d) / 2;
  return (
    <group>
      <Cyl position={[0, 0.02, 0]} radius={baseR} height={0.04} color="#333" />
      <Cyl position={[0, h * 0.5, 0]} radius={0.02} height={h * 0.85} color="#555" />
      <mesh position={[0, h - 0.12, 0]} castShadow>
        <coneGeometry args={[baseR * 1.4, 0.28, 24, 1, true]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, h - 0.15, 0]} intensity={6} distance={4} color="#ffe9c0" />
    </group>
  );
}

function Rug({ w, d, color }: Built) {
  return (
    <group>
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <boxGeometry args={[w, 0.03, d]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <mesh position={[0, 0.031, 0]}>
        <boxGeometry args={[w * 0.86, 0.005, d * 0.82]} />
        <meshStandardMaterial color={shade(color, 0.12)} roughness={1} />
      </mesh>
    </group>
  );
}

function Plant({ w, h, d, color }: Built) {
  const potH = h * 0.28;
  const potR = Math.min(w, d) / 2.4;
  return (
    <group>
      <mesh position={[0, potH / 2, 0]} castShadow>
        <cylinderGeometry args={[potR, potR * 0.78, potH, 16]} />
        <meshStandardMaterial color="#9c6b53" roughness={0.8} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        const r = potR * 0.6;
        return (
          <mesh key={i} position={[Math.cos(a) * r, potH + (h - potH) * 0.55, Math.sin(a) * r]} castShadow>
            <sphereGeometry args={[(h - potH) * 0.32, 12, 12]} />
            <meshStandardMaterial color={shade(color, (i % 2 ? 0.06 : -0.06))} roughness={0.9} />
          </mesh>
        );
      })}
      <mesh position={[0, potH + (h - potH) * 0.62, 0]} castShadow>
        <sphereGeometry args={[(h - potH) * 0.4, 12, 12]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  );
}

function Fridge({ w, h, d, color }: Built) {
  return (
    <group>
      <Part position={[0, h / 2, 0]} size={[w, h, d]} color={color} roughness={0.3} metalness={0.4} />
      <Part position={[w / 2 - 0.03, h * 0.7, d / 2 - 0.005]} size={[0.04, h * 0.5, 0.04]} color="#888" metalness={0.6} />
      <Part position={[w / 2 - 0.03, h * 0.25, d / 2 - 0.005]} size={[0.04, h * 0.32, 0.04]} color="#888" metalness={0.6} />
      <Part position={[0, h * 0.46, d / 2]} size={[w, 0.01, 0.005]} color={shade(color, -0.2)} />
    </group>
  );
}

function Stove({ w, h, d, color }: Built) {
  return (
    <group>
      <Part position={[0, h / 2, 0]} size={[w, h, d]} color={color} roughness={0.3} metalness={0.5} />
      <Part position={[0, h + 0.005, 0]} size={[w, 0.02, d]} color="#1a1a1a" />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <Cyl key={i} position={[sx * w * 0.24, h + 0.02, sz * d * 0.24]} radius={Math.min(w, d) * 0.13} height={0.01} color="#333" />
      ))}
    </group>
  );
}

function Counter({ w, h, d, color }: Built) {
  return (
    <group>
      <Part position={[0, (h - 0.05) / 2, 0]} size={[w, h - 0.05, d]} color={color} />
      <Part position={[0, h - 0.025, 0]} size={[w + 0.04, 0.05, d + 0.04]} color={shade(color, -0.25)} roughness={0.25} metalness={0.2} />
    </group>
  );
}

function Toilet({ w, h, d, color }: Built) {
  return (
    <group>
      <mesh position={[0, h * 0.22, d * 0.08]} castShadow>
        <cylinderGeometry args={[w * 0.5, w * 0.42, h * 0.44, 18]} />
        <meshStandardMaterial color={color} roughness={0.2} />
      </mesh>
      <Part position={[0, h * 0.7, -d / 2 + 0.08]} size={[w * 0.9, h * 0.6, 0.18]} color={color} roughness={0.2} />
      <Part position={[0, h * 0.46, d * 0.05]} size={[w, 0.04, d * 0.55]} color={shade(color, -0.05)} />
    </group>
  );
}

function Sink({ w, h, d, color }: Built) {
  return (
    <group>
      <Cyl position={[0, h * 0.32, 0]} radius={0.03} height={h * 0.64} color="#cfd3d8" />
      <Part position={[0, h * 0.7, 0]} size={[w, 0.12, d]} color={color} roughness={0.2} />
      <Cyl position={[0, h * 0.78, d * 0.18]} radius={0.02} height={0.16} color="#b8bcc2" />
    </group>
  );
}

function Bathtub({ w, h, d, color }: Built) {
  return (
    <group>
      <Part position={[0, h / 2, 0]} size={[w, h, d]} color={color} roughness={0.2} />
      <Part position={[0, h - 0.04, 0]} size={[w - 0.16, 0.08, d - 0.16]} color={shade(color, -0.08)} />
    </group>
  );
}

function Generic({ w, h, d, color }: Built) {
  return <Part position={[0, h / 2, 0]} size={[w, h, d]} color={color} />;
}

export function ProceduralFurniture({
  kind,
  w,
  h,
  d,
  color,
}: {
  kind: FurnitureKind;
  w: number;
  h: number;
  d: number;
  color: string;
}) {
  const b: Built = { w: Math.max(0.05, w), h: Math.max(0.05, h), d: Math.max(0.05, d), color };
  switch (kind) {
    case "sofa": return <Sofa {...b} />;
    case "armchair": return <Armchair {...b} />;
    case "diningChair": return <Chair {...b} />;
    case "coffeeTable": return <Table {...b} />;
    case "diningTable": return <Table {...b} />;
    case "deskTable": return <Desk {...b} />;
    case "bed": return <Bed {...b} />;
    case "nightstand": return <Cabinet {...b} doors={1} />;
    case "wardrobe": return <Cabinet {...b} doors={2} />;
    case "bookshelf": return <Bookshelf {...b} />;
    case "tvUnit": return <TvUnit {...b} />;
    case "tv": return <Tv {...b} />;
    case "floorLamp": return <Lamp {...b} />;
    case "rug": return <Rug {...b} />;
    case "plant": return <Plant {...b} />;
    case "fridge": return <Fridge {...b} />;
    case "stove": return <Stove {...b} />;
    case "kitchenCounter": return <Counter {...b} />;
    case "toilet": return <Toilet {...b} />;
    case "sink": return <Sink {...b} />;
    case "bathtub": return <Bathtub {...b} />;
    default: return <Generic {...b} />;
  }
}
