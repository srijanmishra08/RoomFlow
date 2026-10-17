"use client";

// Progressive GPU path tracer for photorealistic stills. Mounted inside the R3F
// <Canvas> only while a render job is active; it takes over the render loop
// (a priority-1 useFrame disables R3F's auto-render), accumulates samples, then
// hands back a PNG. Everything it changes in the scene is restored on unmount.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { WebGLPathTracer } from "three-gpu-pathtracer";

export interface PathTraceJob {
  id: number;
  /** Samples per pixel to accumulate before finishing. */
  samples: number;
  /** Internal resolution multiplier (1 = canvas size). */
  renderScale: number;
}

interface Props {
  job: PathTraceJob;
  roomWidth: number;
  roomDepth: number;
  roomHeight: number;
  /** Floor-plan centroid (x, z); wall facing is judged against it. */
  centroid: [number, number];
  onProgress: (samples: number) => void;
  onDone: (dataUrl: string) => void;
  onError: (message: string) => void;
}

// Let selection/gizmo removal land in the scene graph before it is captured.
const SETTLE_MS = 200;

export function PathTraceRunner({
  job,
  roomWidth,
  roomDepth,
  roomHeight,
  centroid,
  onProgress,
  onDone,
  onError,
}: Props) {
  const [cx, cz] = centroid; // primitives: an array prop would restart the job on every re-render
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  const tracerRef = useRef<WebGLPathTracer | null>(null);
  const finishedRef = useRef(false);
  const lastReportedRef = useRef(-1);
  const callbacks = useRef({ onProgress, onDone, onError });
  useEffect(() => {
    callbacks.current = { onProgress, onDone, onError };
  });

  useEffect(() => {
    finishedRef.current = false;
    lastReportedRef.current = -1;
    const restores: Array<() => void> = [];
    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      try {
        scene.updateMatrixWorld(true);
        const camPos = camera.position;
        const box = new THREE.Box3();
        const center = new THREE.Vector3();
        const normal = new THREE.Vector3();

        scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh || !mesh.visible) return;

          const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          const role = mesh.userData?.ptRole as "wall" | "ceiling" | undefined;

          // Raster-only helpers (grid shader, shadow catcher, markers) would
          // show up as solid geometry in a physically based render.
          let hide =
            !!mesh.userData?.ptHide ||
            !!(mat as THREE.ShaderMaterial | undefined)?.isShaderMaterial ||
            mat?.type === "ShadowMaterial";

          // Cutaway: drop walls/ceiling that sit between the camera and the room
          // so an outside-in view reads like a dollhouse render, not a closed box.
          if (role === "wall") {
            box.setFromObject(mesh).getCenter(center);
            mesh.getWorldDirection(normal);
            const toCentreX = cx - center.x;
            const toCentreZ = cz - center.z;
            if (normal.x * toCentreX + normal.z * toCentreZ < 0) normal.negate(); // inward
            if (normal.dot(camPos.clone().sub(center)) < 0) hide = true;
          } else if (role === "ceiling" && camPos.y > roomHeight) {
            hide = true;
          }

          if (hide) {
            mesh.visible = false;
            restores.push(() => {
              mesh.visible = true;
            });
            return;
          }

          // Raster tricks (see-through walls) don't belong in a path-traced image.
          if (role && mat) {
            const m = mat as THREE.MeshStandardMaterial;
            const prev = { transparent: m.transparent, opacity: m.opacity };
            m.transparent = false;
            m.opacity = 1;
            m.needsUpdate = true;
            restores.push(() => {
              m.transparent = prev.transparent;
              m.opacity = prev.opacity;
              m.needsUpdate = true;
            });
          }
        });

        // The raster rig lights the room with ambient/hemisphere lights, which a
        // path tracer ignores. Give it a physical fixture: a ceiling panel.
        const panel = new THREE.RectAreaLight(
          0xfff0dc,
          14,
          Math.min(Math.max(roomWidth * 0.4, 1), 2.6),
          Math.min(Math.max(roomDepth * 0.4, 1), 2.6)
        );
        panel.position.set(cx, roomHeight - 0.03, cz);
        panel.lookAt(cx, 0, cz);
        scene.add(panel);
        restores.push(() => {
          scene.remove(panel);
        });

        const tracer = new WebGLPathTracer(gl);
        tracer.bounces = 5;
        tracer.transmissiveBounces = 6;
        tracer.filterGlossyFactor = 0.4;
        tracer.renderScale = job.renderScale;
        tracer.rasterizeScene = false; // no preview pass — samples only
        tracer.dynamicLowRes = false;
        tracer.renderDelay = 0;
        tracer.minSamples = 1;
        tracer.fadeDuration = 0;
        tracer.tiles.set(2, 2); // keeps each GPU dispatch short so the tab stays responsive
        scene.updateMatrixWorld(true);
        tracer.setScene(scene, camera);
        tracerRef.current = tracer;
      } catch (err) {
        callbacks.current.onError(
          err instanceof Error
            ? `Photoreal render failed to start: ${err.message}`
            : "Photoreal render failed to start (WebGL2 with float textures is required)."
        );
      }
    }, SETTLE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      const tracer = tracerRef.current;
      tracerRef.current = null;
      try {
        tracer?.dispose();
      } catch {
        /* disposal is best-effort */
      }
      gl.setRenderTarget(null);
      for (const restore of restores.reverse()) restore();
    };
  }, [job.id, job.renderScale, scene, camera, gl, roomWidth, roomDepth, roomHeight, cx, cz]);

  // Priority 1 → R3F stops auto-rendering; we draw (or wait) every frame.
  useFrame(() => {
    const tracer = tracerRef.current;
    if (!tracer || finishedRef.current) return;
    try {
      tracer.renderSample();
      const n = Math.floor(tracer.samples);
      if (n !== lastReportedRef.current) {
        lastReportedRef.current = n;
        callbacks.current.onProgress(n);
      }
      if (n >= job.samples) {
        finishedRef.current = true;
        callbacks.current.onDone(gl.domElement.toDataURL("image/png"));
      }
    } catch (err) {
      finishedRef.current = true;
      callbacks.current.onError(err instanceof Error ? `Photoreal render failed: ${err.message}` : "Photoreal render failed.");
    }
  }, 1);

  return null;
}
