"use client";

// Immersive viewer for equirectangular (2:1) 360° images. The viewer stands at
// the centre of a textured sphere and looks around — exact to the source image,
// no ML and no server work.

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const MIN_FOV = 30;
const MAX_FOV = 100;
const MAX_PITCH = (85 * Math.PI) / 180;
// Image centre sits at -X on the flipped sphere; start the camera facing it.
const START_YAW = Math.PI / 2;

function PanoSphere({ url }: { url: string }) {
  const loaded = useLoader(THREE.TextureLoader, url, (loader) => {
    loader.setCrossOrigin("anonymous");
  });
  const texture = useMemo(() => {
    loaded.colorSpace = THREE.SRGBColorSpace;
    loaded.anisotropy = 8;
    loaded.needsUpdate = true;
    return loaded;
  }, [loaded]);
  return (
    // scale.x = -1 un-mirrors the image when seen from inside the sphere.
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 96, 64]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} toneMapped={false} />
    </mesh>
  );
}

function PanoControls({ autoRotate }: { autoRotate: boolean }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const st = useRef({ yaw: START_YAW, pitch: 0, fov: 75, touched: false });
  const lastFrame = useRef(0);

  useEffect(() => {
    const el = gl.domElement;
    const prevTouchAction = el.style.touchAction;
    el.style.touchAction = "none";
    const pointers = new Map<number, { x: number; y: number }>();
    const s = st.current;

    const pinchDistance = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const onDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      s.touched = true;
    };
    const onMove = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      if (pointers.size === 1) {
        // Degrees of view per pixel: a full-height drag sweeps one field of view.
        const k = ((s.fov * Math.PI) / 180) / Math.max(1, el.clientHeight);
        s.yaw += (e.clientX - p.x) * k;
        s.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, s.pitch + (e.clientY - p.y) * k));
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      } else if (pointers.size === 2) {
        const before = pinchDistance();
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const after = pinchDistance();
        if (before > 0 && after > 0) s.fov = Math.max(MIN_FOV, Math.min(MAX_FOV, s.fov * (before / after)));
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      s.touched = true;
      s.fov = Math.max(MIN_FOV, Math.min(MAX_FOV, s.fov + e.deltaY * 0.05));
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      el.style.touchAction = prevTouchAction;
    };
  }, [gl]);

  useFrame(() => {
    const s = st.current;
    // Own timing (capped) rather than the loop's delta: a non-finite value there
    // would put NaN into the camera rotation and blank the whole view.
    const now = performance.now();
    const dt = lastFrame.current ? Math.min(0.1, (now - lastFrame.current) / 1000) : 0;
    lastFrame.current = now;
    if (autoRotate && !s.touched && Number.isFinite(dt)) s.yaw += dt * 0.06;
    camera.rotation.set(s.pitch, s.yaw, 0, "YXZ");
    if (camera.fov !== s.fov) {
      camera.fov = s.fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

interface PanoramaViewerProps {
  url: string;
  className?: string;
  /** Slowly spin until the viewer first interacts. */
  autoRotate?: boolean;
}

export function PanoramaViewer({ url, className = "", autoRotate = true }: PanoramaViewerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen?.();
  }

  return (
    <div ref={wrapRef} className={`relative w-full h-full bg-black overflow-hidden ${className}`}>
      <Canvas camera={{ fov: 75, near: 0.1, far: 200, position: [0, 0, 0] }} gl={{ antialias: true }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <PanoSphere url={url} />
        </Suspense>
        <PanoControls autoRotate={autoRotate} />
      </Canvas>
      <div className="pointer-events-none absolute left-3 bottom-3 rounded-md bg-black/55 px-2.5 py-1 text-[11px] text-white/85">
        Drag to look around · scroll or pinch to zoom
      </div>
      <button
        onClick={toggleFullscreen}
        className="absolute right-3 bottom-3 rounded-md bg-black/55 px-2.5 py-1 text-[11px] text-white/90 hover:bg-black/75"
      >
        {fullscreen ? "Exit full screen" : "Full screen"}
      </button>
    </div>
  );
}
