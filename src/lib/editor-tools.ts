// Pure editor helpers: edge/center snapping against neighbouring objects and
// room bounds. Kept free of three.js/react so it unit-tests trivially.

export interface Footprint {
  id: string;
  positionX: number;
  positionZ: number;
  scaleX: number; // width in metres
  scaleZ: number; // depth in metres
}

export interface SnapResult {
  x: number;
  z: number;
  /** Which axes actually snapped (for showing alignment guides). */
  snappedX: boolean;
  snappedZ: boolean;
  /** Guide line coordinates (world) when snapped, for rendering. */
  guideX?: number;
  guideZ?: number;
}

const DEFAULT_THRESHOLD = 0.15;

// Candidate alignment values for one axis of a footprint: min edge, center, max edge.
function axisAnchors(center: number, size: number): number[] {
  const half = (size || 1) / 2;
  return [center - half, center, center + half];
}

/**
 * Snap a moving object's x/z against neighbours' edges/centers and room walls.
 * Returns adjusted position plus guide info. Chooses the smallest correction
 * per axis within `threshold`.
 */
export function snapToNeighbours(
  moving: Footprint,
  x: number,
  z: number,
  neighbours: Footprint[],
  room?: { width: number; depth: number },
  threshold = DEFAULT_THRESHOLD
): SnapResult {
  const myAnchorsX = axisAnchors(0, moving.scaleX); // offsets relative to center
  const myAnchorsZ = axisAnchors(0, moving.scaleZ);

  const targetsX: number[] = [];
  const targetsZ: number[] = [];
  for (const n of neighbours) {
    if (n.id === moving.id) continue;
    targetsX.push(...axisAnchors(n.positionX, n.scaleX));
    targetsZ.push(...axisAnchors(n.positionZ, n.scaleZ));
  }
  if (room) {
    // Wall inner faces + room center lines.
    targetsX.push(-room.width / 2, 0, room.width / 2);
    targetsZ.push(-room.depth / 2, 0, room.depth / 2);
  }

  let bestDX: number | null = null;
  let guideX: number | undefined;
  for (const off of myAnchorsX) {
    const mine = x + off;
    for (const t of targetsX) {
      const d = t - mine;
      if (Math.abs(d) <= threshold && (bestDX === null || Math.abs(d) < Math.abs(bestDX))) {
        bestDX = d;
        guideX = t;
      }
    }
  }
  let bestDZ: number | null = null;
  let guideZ: number | undefined;
  for (const off of myAnchorsZ) {
    const mine = z + off;
    for (const t of targetsZ) {
      const d = t - mine;
      if (Math.abs(d) <= threshold && (bestDZ === null || Math.abs(d) < Math.abs(bestDZ))) {
        bestDZ = d;
        guideZ = t;
      }
    }
  }

  return {
    x: +(x + (bestDX ?? 0)).toFixed(3),
    z: +(z + (bestDZ ?? 0)).toFixed(3),
    snappedX: bestDX !== null,
    snappedZ: bestDZ !== null,
    guideX,
    guideZ,
  };
}

/** Distance between two 3D points, rounded to cm. */
export function distance3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  return +Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z).toFixed(2);
}
