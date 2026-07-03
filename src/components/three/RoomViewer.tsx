"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Environment, Line, Html } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import { RoomBox, type SurfaceMaterial, type FloorPoint, type WallOpening } from "./RoomBox";
import { FurnitureObject, type GizmoMode, type TransformPatch } from "./FurnitureObject";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";

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
  /** All selected ids (multi-select); selectedId is the primary. */
  selectedIds?: string[];
  onSelect: (id: string | null, additive?: boolean) => void;
  /** When true, clicks on the floor measure distances instead of selecting. */
  measureMode?: boolean;
  isEditable?: boolean;
  onObjectMove?: (id: string, x: number, y: number, z: number) => void;
  onObjectTransform?: (id: string, patch: TransformPatch) => void;
  gizmoMode?: GizmoMode;
  /** Receives a capture() that renders the scene and returns a PNG data URL. */
  onCaptureReady?: (capture: CaptureFn) => void;
  floorPoints?: FloorPoint[] | null;
  openings?: WallOpening[] | null;
  roomModelUrl?: string | null;
  floorMaterial?: SurfaceMaterial | null;
  wallMaterial?: SurfaceMaterial | null;
  ceilingMaterial?: SurfaceMaterial | null;
  onCameraSnapshot?: (snapshot: {
    cameraPosition: { x: number; y: number; z: number };
    cameraRotation: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  }) => void;
  focusView?: {
    cameraPosition: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  } | null;
}

// Click-two-points distance measuring on the floor plane.
function MeasureLayer({ width, depth, active }: { width: number; depth: number; active: boolean }) {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  useEffect(() => {
    if (!active) setPoints([]);
  }, [active]);
  if (!active) return null;
  const dist = points.length === 2 ? points[0].distanceTo(points[1]) : null;
  const mid = points.length === 2
    ? points[0].clone().add(points[1]).multiplyScalar(0.5)
    : null;
  return (
    <group>
      {/* Invisible pick plane covering the room floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.005, 0]}
        onClick={(e) => {
          e.stopPropagation();
          const p = e.point.clone();
          p.y = 0.02;
          setPoints((prev) => (prev.length >= 2 ? [p] : [...prev, p]));
        }}
      >
        <planeGeometry args={[width * 2, depth * 2]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      ))}
      {points.length === 2 && (
        <>
          <Line points={[points[0], points[1]]} color="#f59e0b" lineWidth={2} />
          {mid && dist !== null && (
            <Html position={[mid.x, mid.y + 0.15, mid.z]} center>
              <div style={{
                background: "#f59e0b", color: "#fff", padding: "2px 8px",
                borderRadius: 6, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
              }}>
                {dist.toFixed(2)} m
              </div>
            </Html>
          )}
        </>
      )}
    </group>
  );
}

export interface CaptureOptions {
  /** Output size. Omit for current canvas size. "pano" renders a 360° equirect. */
  width?: number;
  height?: number;
  pano?: boolean;
}
export type CaptureFn = (opts?: CaptureOptions) => string;

// 360° equirectangular capture: render a cube map from the camera position,
// then CPU-remap each output pixel's view direction onto the right cube face.
function renderEquirect(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  outW = 4096
): string {
  const face = 1024;
  const rt = new THREE.WebGLCubeRenderTarget(face, { generateMipmaps: false });
  const cubeCam = new THREE.CubeCamera(0.1, 100, rt);
  cubeCam.position.copy((camera as THREE.PerspectiveCamera).position);
  cubeCam.update(gl, scene);

  // Read back all 6 faces (+X -X +Y -Y +Z -Z).
  const faces: Uint8Array[] = [];
  for (let i = 0; i < 6; i++) {
    const buf = new Uint8Array(face * face * 4);
    gl.readRenderTargetPixels(rt, 0, 0, face, face, buf, i);
    faces.push(buf);
  }
  rt.dispose();

  const outH = outW / 2;
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(outW, outH);
  const d = img.data;

  for (let y = 0; y < outH; y++) {
    const phi = ((y + 0.5) / outH) * Math.PI; // 0..π from top
    const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
    for (let x = 0; x < outW; x++) {
      const theta = ((x + 0.5) / outW) * 2 * Math.PI - Math.PI; // -π..π
      // Direction in three.js coords (y up, -z forward).
      const dx = sinPhi * Math.sin(theta);
      const dy = cosPhi;
      const dz = -sinPhi * Math.cos(theta);
      const ax = Math.abs(dx), ay = Math.abs(dy), az = Math.abs(dz);
      let f: number, u: number, v: number;
      if (ax >= ay && ax >= az) {
        f = dx > 0 ? 0 : 1; u = (dx > 0 ? -dz : dz) / ax; v = -dy / ax;
      } else if (ay >= ax && ay >= az) {
        f = dy > 0 ? 2 : 3; u = dx / ay; v = (dy > 0 ? dz : -dz) / ay;
      } else {
        f = dz > 0 ? 4 : 5; u = (dz > 0 ? dx : -dx) / az; v = -dy / az;
      }
      // Cube RT faces come back with (0,0) at bottom-left; flip v.
      const px = Math.min(face - 1, Math.max(0, ((u + 1) / 2) * face) | 0);
      const py = Math.min(face - 1, Math.max(0, ((1 - (v + 1) / 2)) * face) | 0);
      const src = (py * face + px) * 4;
      const dst = (y * outW + x) * 4;
      const fb = faces[f];
      d[dst] = fb[src]; d[dst + 1] = fb[src + 1]; d[dst + 2] = fb[src + 2]; d[dst + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

// Bridges high-res / 360° PNG captures out of the R3F context.
function CaptureBridge({ onReady }: { onReady?: (capture: CaptureFn) => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (!onReady) return;
    onReady((opts?: CaptureOptions) => {
      if (opts?.pano) return renderEquirect(gl, scene, camera);
      if (opts?.width && opts?.height) {
        // Temporarily resize the drawing buffer for a high-res still.
        const prev = new THREE.Vector2();
        gl.getSize(prev);
        const prevPR = gl.getPixelRatio();
        const cam = camera as THREE.PerspectiveCamera;
        const prevAspect = cam.aspect;
        gl.setPixelRatio(1);
        gl.setSize(opts.width, opts.height, false);
        cam.aspect = opts.width / opts.height;
        cam.updateProjectionMatrix();
        gl.render(scene, camera);
        const url = gl.domElement.toDataURL("image/png");
        gl.setPixelRatio(prevPR);
        gl.setSize(prev.x, prev.y, false);
        cam.aspect = prevAspect;
        cam.updateProjectionMatrix();
        gl.render(scene, camera);
        return url;
      }
      gl.render(scene, camera); // ensure fresh frame in the drawing buffer
      return gl.domElement.toDataURL("image/png");
    });
  }, [gl, scene, camera, onReady]);
  return null;
}

export function RoomViewer({
  width,
  height,
  depth,
  objects,
  selectedId,
  selectedIds,
  onSelect,
  measureMode = false,
  isEditable = false,
  onObjectMove,
  onObjectTransform,
  gizmoMode = "translate",
  onCaptureReady,
  floorPoints,
  openings,
  roomModelUrl,
  floorMaterial,
  wallMaterial,
  ceilingMaterial,
  onCameraSnapshot,
  focusView,
}: RoomViewerProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const focusKey = JSON.stringify(focusView ?? null);

  useEffect(() => {
    if (!focusView || !controlsRef.current) return;
    const controls = controlsRef.current;
    controls.object.position.set(
      focusView.cameraPosition.x,
      focusView.cameraPosition.y,
      focusView.cameraPosition.z
    );
    controls.target.set(focusView.target.x, focusView.target.y, focusView.target.z);
    controls.update();
  }, [focusKey, focusView]);

  function emitCameraSnapshot() {
    if (!onCameraSnapshot || !controlsRef.current) return;
    const camera = controlsRef.current.object as THREE.PerspectiveCamera;
    const target = controlsRef.current.target;
    onCameraSnapshot({
      cameraPosition: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      cameraRotation: { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z },
      target: { x: target.x, y: target.y, z: target.z },
    });
  }

  return (
    <div className="canvas-container w-full h-full rounded-xl overflow-hidden border border-[var(--border)]">
      <Canvas
        camera={{ position: [width * 1.5, height * 1.5, depth * 1.5], fov: 50 }}
        shadows
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <Suspense fallback={null}>
          <CaptureBridge onReady={onCaptureReady} />
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
            openings={openings}
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
              isMultiSelected={(selectedIds ?? []).includes(obj.id) && selectedId !== obj.id}
              onClick={(additive) => onSelect(obj.id, additive)}
              isEditable={isEditable && !measureMode}
              gizmoMode={gizmoMode}
              onMove={onObjectMove}
              onTransform={onObjectTransform}
            />
          ))}

          <MeasureLayer width={width} depth={depth} active={measureMode} />

          <OrbitControls
            makeDefault
            ref={controlsRef}
            maxPolarAngle={Math.PI / 2}
            minDistance={2}
            maxDistance={30}
            onEnd={emitCameraSnapshot}
          />
          <Environment preset="apartment" />
        </Suspense>
      </Canvas>
    </div>
  );
}
