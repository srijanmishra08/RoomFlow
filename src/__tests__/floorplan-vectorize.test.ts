import { detectRooms, longestEdge, toMetres, signedArea2, type Pt } from "@/lib/floorplan-vectorize";

const W = 200;
const H = 200;

function blank(value = 255): Uint8Array {
  return new Uint8Array(W * H).fill(value);
}

function fill(g: Uint8Array, x0: number, y0: number, x1: number, y1: number, v: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y * W + x] = v;
}

/** Rectangular wall ring of the given thickness; optional door gap cut into the top wall. */
function ring(g: Uint8Array, x0: number, y0: number, x1: number, y1: number, t: number, wall = 0, floor = 255) {
  fill(g, x0, y0, x1, y1, wall);
  fill(g, x0 + t, y0 + t, x1 - t, y1 - t, floor);
}

function bbox(pts: Pt[]) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

describe("detectRooms", () => {
  it("finds the interior of a closed room at the inner wall faces", () => {
    const g = blank();
    ring(g, 30, 40, 170, 160, 8);
    const { candidates } = detectRooms(g, W, H);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    const b = bbox(candidates[0].points);
    expect(b.minX).toBeGreaterThanOrEqual(36);
    expect(b.minX).toBeLessThanOrEqual(41);
    expect(b.maxX).toBeGreaterThanOrEqual(158);
    expect(b.maxX).toBeLessThanOrEqual(163);
    expect(b.minY).toBeGreaterThanOrEqual(46);
    expect(b.minY).toBeLessThanOrEqual(51);
    expect(b.maxY).toBeGreaterThanOrEqual(148);
    expect(b.maxY).toBeLessThanOrEqual(153);
  });

  it("returns a clean four-corner rectilinear polygon", () => {
    const g = blank();
    ring(g, 30, 40, 170, 160, 8);
    const poly = detectRooms(g, W, H).candidates[0].points;
    expect(poly).toHaveLength(4);
    // every edge axis-aligned
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      expect(p.x === q.x || p.y === q.y).toBe(true);
    }
  });

  it("still encloses a room whose wall has a door gap", () => {
    const g = blank();
    ring(g, 30, 40, 170, 160, 8);
    fill(g, 80, 40, 100, 47, 255); // 21px door through the top wall
    const { candidates } = detectRooms(g, W, H);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    const b = bbox(candidates[0].points);
    // The doorway must not leave a notch: outline stays on the inner faces.
    expect(b.minY).toBeGreaterThanOrEqual(46);
    expect(b.maxX - b.minX).toBeGreaterThan(115);
  });

  it("traces an L-shaped room with six corners", () => {
    const g = blank();
    // outer L footprint = big rect minus top-right block, walls 8 thick
    fill(g, 30, 30, 170, 170, 0);
    fill(g, 38, 38, 162, 162, 255);
    // carve the top-right notch out of the room: wall block inside the room
    fill(g, 100, 38, 170, 100, 0);
    const { candidates } = detectRooms(g, W, H);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    const poly = candidates[0].points;
    expect(poly.length).toBe(6);
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      expect(p.x === q.x || p.y === q.y).toBe(true);
    }
  });

  it("ignores thin text-like strokes inside the room", () => {
    const g = blank();
    ring(g, 30, 40, 170, 160, 8);
    fill(g, 70, 90, 130, 91, 0); // 2px dimension-line style stroke
    fill(g, 100, 70, 101, 120, 0);
    const poly = detectRooms(g, W, H).candidates[0].points;
    expect(poly).toHaveLength(4);
  });

  it("handles light-on-dark blueprint plans", () => {
    const g = blank(20); // dark page
    ring(g, 30, 40, 170, 160, 8, 235, 20); // light walls
    const { candidates } = detectRooms(g, W, H);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    const b = bbox(candidates[0].points);
    expect(b.maxX - b.minX).toBeGreaterThan(115);
  });

  it("finds nothing in an empty page", () => {
    expect(detectRooms(blank(), W, H).candidates).toHaveLength(0);
  });

  it("uses the winding the plan editor expects (positive shoelace, x right / y down)", () => {
    const g = blank();
    ring(g, 30, 40, 170, 160, 8);
    const poly = detectRooms(g, W, H).candidates[0].points;
    expect(signedArea2(poly)).toBeGreaterThan(0);
  });

  it("rejects mismatched buffers", () => {
    expect(() => detectRooms(new Uint8Array(10), W, H)).toThrow();
  });
});

describe("toMetres", () => {
  const rect: Pt[] = [
    { x: 40, y: 50 },
    { x: 160, y: 50 },
    { x: 160, y: 150 },
    { x: 40, y: 150 },
  ];

  it("scales so the longest edge equals the requested length", () => {
    const { points } = toMetres(rect, 6);
    const xs = points.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(6, 1);
  });

  it("centres the outline on the origin", () => {
    const { points } = toMetres(rect, 6);
    const xs = points.map((p) => p.x);
    const zs = points.map((p) => p.z);
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(0, 1);
    expect((Math.max(...zs) + Math.min(...zs)) / 2).toBeCloseTo(0, 1);
  });

  it("reports metres-per-pixel and the pixel origin for aligning an underlay", () => {
    const { metresPerPx, originPx } = toMetres(rect, 6);
    expect(metresPerPx).toBeCloseTo(6 / 120, 5);
    expect(originPx).toEqual({ x: 100, y: 100 });
  });

  it("longestEdge measures the largest side", () => {
    expect(longestEdge(rect)).toBe(120);
  });
});
