// Floor-plan image → room polygon(s). Classical computer vision, no ML and no
// network: threshold the wall strokes, seal door gaps, flood-fill the enclosed
// free space, trace each region's outline and simplify it to a clean
// (mostly rectilinear) polygon.
//
// Works best on high-contrast plans (dark walls on a light page, or the
// inverse). It does not read dimensions, text, doors or windows — the caller
// supplies real-world scale and the designer adds openings afterwards.
//
// All coordinates are in the pixel space of the grayscale input. Pure and
// dependency-free so it runs in the browser and under jest.

export interface Pt {
  x: number;
  y: number;
}

export interface RoomCandidate {
  /** Outline in input-pixel coordinates; winding matches the plan editor's default rectangle. */
  points: Pt[];
  areaPx: number;
}

export interface DetectResult {
  width: number;
  height: number;
  candidates: RoomCandidate[];
}

export interface DetectOptions {
  /** Smallest accepted room, as a fraction of the image area. */
  minAreaFrac?: number;
  /** Largest accepted room (rejects the page frame), as a fraction of the image area. */
  maxAreaFrac?: number;
  /** Maximum number of candidates returned. */
  maxCandidates?: number;
}

// Door-sealing radii (fractions of the longest image side), tried ascending so
// the tightest seal that encloses a room wins, but every radius contributes
// candidates (whole footprint and individual rooms both surface).
const SEAL_RADII = [0.012, 0.02, 0.03, 0.045, 0.065, 0.09];

// ---- grayscale → wall mask -------------------------------------------------

function otsuThreshold(gray: ArrayLike<number>): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i] & 255]++;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/** 1 where the pixel is part of a wall stroke. Handles dark-on-light and light-on-dark plans. */
function wallMask(gray: ArrayLike<number>): Uint8Array {
  // Cap the threshold: colour-filled plans make Otsu land on pastel fills; only
  // genuinely dark pixels should count as walls.
  const t = Math.min(otsuThreshold(gray), 140);
  const mask = new Uint8Array(gray.length);
  let dark = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] <= t) {
      mask[i] = 1;
      dark++;
    }
  }
  // More than half "dark" means the page itself is dark (blueprint style):
  // walls are the light strokes instead.
  if (dark > gray.length / 2) {
    for (let i = 0; i < gray.length; i++) mask[i] = mask[i] ? 0 : 1;
  }
  return mask;
}

// ---- morphology via integral images (square structuring element) ------------

function integralOf(mask: Uint8Array, w: number, h: number): Int32Array {
  const W = w + 1;
  const integral = new Int32Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += mask[y * w + x];
      integral[(y + 1) * W + (x + 1)] = integral[y * W + (x + 1)] + row;
    }
  }
  return integral;
}

function boxMorph(mask: Uint8Array, w: number, h: number, r: number, mode: "dilate" | "erode"): Uint8Array {
  const integral = integralOf(mask, w, h);
  const W = w + 1;
  const out = new Uint8Array(w * h);
  const full = (2 * r + 1) * (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      const sum =
        integral[(y1 + 1) * W + (x1 + 1)] -
        integral[y0 * W + (x1 + 1)] -
        integral[(y1 + 1) * W + x0] +
        integral[y0 * W + x0];
      out[y * w + x] = mode === "dilate" ? (sum > 0 ? 1 : 0) : sum === full ? 1 : 0;
    }
  }
  return out;
}

function count(mask: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i];
  return n;
}

/** Drop strokes thinner than ~2r+1 px (text, dimension lines, furniture outlines). */
function removeThinStrokes(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const raw = count(mask);
  if (raw === 0) return mask;
  const opened = boxMorph(boxMorph(mask, w, h, r, "erode"), w, h, r, "dilate");
  // If almost everything vanished the plan is drawn with hairline walls —
  // keep the raw strokes and rely on door sealing instead.
  return count(opened) / raw < 0.3 ? mask : opened;
}

// ---- connected components --------------------------------------------------

interface Component {
  label: number;
  area: number;
  touchesBorder: boolean;
}

function labelComponents(free: Uint8Array, w: number, h: number): { labels: Int32Array; comps: Component[] } {
  const labels = new Int32Array(w * h);
  const comps: Component[] = [];
  const stack = new Int32Array(w * h);
  let next = 1;
  for (let start = 0; start < free.length; start++) {
    if (!free[start] || labels[start]) continue;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = next;
    let area = 0;
    let border = false;
    while (sp > 0) {
      const idx = stack[--sp];
      area++;
      const x = idx % w;
      const y = (idx - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
      if (x > 0 && free[idx - 1] && !labels[idx - 1]) {
        labels[idx - 1] = next;
        stack[sp++] = idx - 1;
      }
      if (x < w - 1 && free[idx + 1] && !labels[idx + 1]) {
        labels[idx + 1] = next;
        stack[sp++] = idx + 1;
      }
      if (y > 0 && free[idx - w] && !labels[idx - w]) {
        labels[idx - w] = next;
        stack[sp++] = idx - w;
      }
      if (y < h - 1 && free[idx + w] && !labels[idx + w]) {
        labels[idx + w] = next;
        stack[sp++] = idx + w;
      }
    }
    comps.push({ label: next, area, touchesBorder: border });
    next++;
  }
  return { labels, comps };
}

// ---- outline tracing & simplification --------------------------------------

// 8 neighbours clockwise starting east (image coordinates, y down).
const DX = [1, 1, 0, -1, -1, -1, 0, 1];
const DY = [0, 1, 1, 1, 0, -1, -1, -1];

/** Moore-neighbour boundary trace with Jacob's stopping criterion. */
function traceOutline(mask: Uint8Array, w: number, h: number): Pt[] {
  let sx = -1;
  let sy = -1;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      sx = i % w;
      sy = (i - sx) / w;
      break;
    }
  }
  if (sx < 0) return [];

  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const dirIndex = (vx: number, vy: number) => {
    for (let k = 0; k < 8; k++) if (DX[k] === vx && DY[k] === vy) return k;
    return 4;
  };

  const pts: Pt[] = [];
  let cx = sx;
  let cy = sy;
  // The raster-first pixel has background to its west: that is the backtrack.
  let back = 4;
  const startBack = back;
  const maxSteps = 8 * (w + h) * 4 + 1000;
  for (let step = 0; step < maxSteps; step++) {
    pts.push({ x: cx, y: cy });
    let moved = false;
    for (let i = 1; i <= 8; i++) {
      const d = (back + i) % 8;
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (inside(nx, ny)) {
        const pd = (d + 7) % 8;
        back = dirIndex(DX[pd] - DX[d], DY[pd] - DY[d]);
        cx = nx;
        cy = ny;
        moved = true;
        break;
      }
    }
    if (!moved) break; // isolated pixel
    if (cx === sx && cy === sy && back === startBack) break;
  }
  return pts;
}

function perpDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

function rdp(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts.slice();
  let maxD = 0;
  let idx = 0;
  const a = pts[0];
  const b = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDistance(pts[i], a, b);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= eps) return [a, b];
  const left = rdp(pts.slice(0, idx + 1), eps);
  const right = rdp(pts.slice(idx), eps);
  return left.slice(0, -1).concat(right);
}

/** RDP for a closed ring: split at two far-apart anchors so neither end is special. */
function simplifyClosed(ring: Pt[], eps: number): Pt[] {
  if (ring.length < 4) return ring.slice();
  let far = 0;
  let farD = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i].x - ring[0].x, ring[i].y - ring[0].y);
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  const first = rdp(ring.slice(0, far + 1), eps);
  const second = rdp(ring.slice(far).concat([ring[0]]), eps);
  return first.slice(0, -1).concat(second.slice(0, -1));
}

/** Snap near-horizontal / near-vertical edges to exact axes (most plans are rectilinear). */
function snapOrthogonal(pts: Pt[], maxAngleDeg = 10): Pt[] {
  const out = pts.map((p) => ({ ...p }));
  const tan = Math.tan((maxAngleDeg * Math.PI) / 180);
  const n = out.length;
  for (let i = 0; i < n; i++) {
    const a = out[i];
    const b = out[(i + 1) % n];
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    if (dy <= tan * dx) {
      const y = (a.y + b.y) / 2;
      a.y = y;
      b.y = y;
    } else if (dx <= tan * dy) {
      const x = (a.x + b.x) / 2;
      a.x = x;
      b.x = x;
    }
  }
  return out;
}

/** Remove repeated points and vertices lying on the line between their neighbours. */
function dropRedundant(pts: Pt[], minGap: number): Pt[] {
  let cur = pts.slice();
  for (let pass = 0; pass < 3; pass++) {
    const next: Pt[] = [];
    const n = cur.length;
    for (let i = 0; i < n; i++) {
      const prev = cur[(i + n - 1) % n];
      const p = cur[i];
      const nxt = cur[(i + 1) % n];
      if (Math.hypot(p.x - prev.x, p.y - prev.y) < minGap) continue;
      const cross = (p.x - prev.x) * (nxt.y - p.y) - (p.y - prev.y) * (nxt.x - p.x);
      const scale = Math.hypot(p.x - prev.x, p.y - prev.y) * Math.hypot(nxt.x - p.x, nxt.y - p.y);
      if (scale > 0 && Math.abs(cross) / scale < 0.02) continue; // collinear
      next.push(p);
    }
    if (next.length === cur.length) return next;
    cur = next;
    if (cur.length < 3) break;
  }
  return cur;
}

/** Shoelace sum with x right / y down; positive for the plan editor's default winding. */
export function signedArea2(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a;
}

function bboxOf(pts: Pt[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

function sameRoom(a: RoomCandidate, b: RoomCandidate): boolean {
  const ba = bboxOf(a.points);
  const bb = bboxOf(b.points);
  const ix = Math.max(0, Math.min(ba.maxX, bb.maxX) - Math.max(ba.minX, bb.minX));
  const iy = Math.max(0, Math.min(ba.maxY, bb.maxY) - Math.max(ba.minY, bb.minY));
  const inter = ix * iy;
  const union =
    (ba.maxX - ba.minX) * (ba.maxY - ba.minY) + (bb.maxX - bb.minX) * (bb.maxY - bb.minY) - inter;
  const areaRatio = Math.min(a.areaPx, b.areaPx) / Math.max(a.areaPx, b.areaPx);
  return union > 0 && inter / union > 0.8 && areaRatio > 0.8;
}

// ---- public API -------------------------------------------------------------

/**
 * Detect enclosed rooms in a grayscale floor-plan image.
 * `gray` is row-major, length width*height, values 0..255.
 */
export function detectRooms(
  gray: ArrayLike<number>,
  width: number,
  height: number,
  options: DetectOptions = {}
): DetectResult {
  const { minAreaFrac = 0.012, maxAreaFrac = 0.92, maxCandidates = 8 } = options;
  const total = width * height;
  const maxDim = Math.max(width, height);
  if (gray.length !== total) throw new Error("gray buffer does not match width*height");

  const rawWalls = wallMask(gray);
  const walls = removeThinStrokes(rawWalls, width, height, Math.max(1, Math.round(maxDim * 0.003)));

  const found: RoomCandidate[] = [];
  for (const frac of SEAL_RADII) {
    const rc = Math.max(2, Math.round(maxDim * frac));
    const sealed = boxMorph(walls, width, height, rc, "dilate");
    const free = new Uint8Array(total);
    for (let i = 0; i < total; i++) free[i] = sealed[i] ? 0 : 1;

    const { labels, comps } = labelComponents(free, width, height);
    for (const comp of comps) {
      if (comp.touchesBorder) continue;
      // Area was measured after eroding by rc on every side; the restored room is larger.
      if (comp.area < total * minAreaFrac * 0.25) continue;

      const region = new Uint8Array(total);
      for (let i = 0; i < total; i++) region[i] = labels[i] === comp.label ? 1 : 0;
      // Grow back to the inner wall face, but never across a wall pixel.
      let grown = boxMorph(region, width, height, rc, "dilate");
      for (let i = 0; i < total; i++) if (walls[i]) grown[i] = 0;
      // Regrowing also pushes into sealed doorways, leaving notches roughly one
      // door wide. Opening at the seal radius removes anything narrower than a
      // door; real rooms were already wider than that to survive sealing.
      grown = boxMorph(boxMorph(grown, width, height, rc, "erode"), width, height, rc, "dilate");

      const area = count(grown);
      if (area < total * minAreaFrac || area > total * maxAreaFrac) continue;

      const outline = traceOutline(grown, width, height);
      if (outline.length < 4) continue;

      const eps = Math.max(2, maxDim * 0.008);
      let poly = simplifyClosed(outline, eps);
      poly = snapOrthogonal(poly);
      poly = dropRedundant(poly, Math.max(2, eps * 0.75));
      if (poly.length < 3) continue;
      if (signedArea2(poly) < 0) poly.reverse();

      const candidate: RoomCandidate = { points: poly, areaPx: area };
      if (!found.some((c) => sameRoom(c, candidate))) found.push(candidate);
    }
  }

  found.sort((a, b) => b.areaPx - a.areaPx);
  return { width, height, candidates: found.slice(0, maxCandidates) };
}

/** Longest edge of a polygon, in the polygon's own units. */
export function longestEdge(pts: Pt[]): number {
  let best = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    best = Math.max(best, Math.hypot(q.x - p.x, q.y - p.y));
  }
  return best;
}

/** Round to centimetres. */
const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Convert a pixel-space outline to metres at a fixed image scale, centred on the
 * origin. Also returns the pixel point that maps to the origin so the source
 * image can be drawn aligned underneath. Scale belongs to the *image*, so it
 * stays constant when the designer switches between rooms detected in it.
 */
export function toMetresAt(
  pts: Pt[],
  metresPerPx: number
): { points: { x: number; z: number }[]; originPx: Pt } {
  const box = bboxOf(pts);
  const originPx = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  return {
    points: pts.map((p) => ({
      x: round2((p.x - originPx.x) * metresPerPx),
      z: round2((p.y - originPx.y) * metresPerPx),
    })),
    originPx,
  };
}

/**
 * Convert a pixel-space outline to metres, scaled so its longest edge equals
 * `longestEdgeMetres`.
 */
export function toMetres(
  pts: Pt[],
  longestEdgeMetres: number
): { points: { x: number; z: number }[]; metresPerPx: number; originPx: Pt } {
  const longest = longestEdge(pts);
  const metresPerPx = longest > 0 ? longestEdgeMetres / longest : 0.01;
  return { ...toMetresAt(pts, metresPerPx), metresPerPx };
}
