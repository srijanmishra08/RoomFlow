"use client";

import { useMemo, useRef, useState } from "react";
import type { FloorPoint, WallOpening } from "./RoomBox";

interface FloorPlanEditorProps {
  /** Current polygon (metres). Empty/short → seeded from width×depth rectangle. */
  floorPoints?: FloorPoint[] | null;
  width: number;
  depth: number;
  /** Persist a new polygon (metres). */
  onChange: (points: FloorPoint[]) => void;
  /** Doors/windows to show and drag along walls. */
  openings?: WallOpening[] | null;
  onOpeningsChange?: (openings: WallOpening[]) => void;
  onClose: () => void;
}

const PAD = 40;            // svg padding px
const VIEW = 520;          // svg drawable px (square)
const SNAP = 0.1;          // metre grid snap
const HANDLE = 7;          // vertex handle radius px

function rect(width: number, depth: number): FloorPoint[] {
  const w = width / 2;
  const d = depth / 2;
  return [
    { x: -w, z: -d },
    { x: w, z: -d },
    { x: w, z: d },
    { x: -w, z: d },
  ];
}

function snap(v: number): number {
  return Math.round(v / SNAP) * SNAP;
}

export function FloorPlanEditor({ floorPoints, width, depth, onChange, openings, onOpeningsChange, onClose }: FloorPlanEditorProps) {
  const seed = floorPoints && floorPoints.length >= 3 ? floorPoints : rect(width, depth);
  const [pts, setPts] = useState<FloorPoint[]>(seed.map((p) => ({ ...p })));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [ops, setOps] = useState<WallOpening[]>((openings ?? []).map((o) => ({ ...o })));
  const [dragOp, setDragOp] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // World bounds → fit into VIEW with margin.
  const bounds = useMemo(() => {
    const xs = pts.map((p) => p.x);
    const zs = pts.map((p) => p.z);
    const minX = Math.min(...xs, -1);
    const maxX = Math.max(...xs, 1);
    const minZ = Math.min(...zs, -1);
    const maxZ = Math.max(...zs, 1);
    const span = Math.max(maxX - minX, maxZ - minZ) * 1.2 || 4;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    return { minX: cx - span / 2, minZ: cz - span / 2, span };
  }, [pts]);

  const scale = VIEW / bounds.span;

  // world(metres) → svg(px)
  const toPx = (p: FloorPoint) => ({
    x: PAD + (p.x - bounds.minX) * scale,
    y: PAD + (p.z - bounds.minZ) * scale,
  });
  // svg(px) → world(metres)
  const toWorld = (px: number, py: number): FloorPoint => ({
    x: snap((px - PAD) / scale + bounds.minX),
    z: snap((py - PAD) / scale + bounds.minZ),
  });

  function eventToSvg(e: React.PointerEvent): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * (VIEW + PAD * 2),
      y: ((e.clientY - r.top) / r.height) * (VIEW + PAD * 2),
    };
  }

  // Fractional position (0..1) of the cursor along wall edge `wall`.
  function offsetOnWall(wall: number, world: FloorPoint): number {
    const a = pts[wall];
    const b = pts[(wall + 1) % pts.length];
    const abx = b.x - a.x, abz = b.z - a.z;
    const len2 = abx * abx + abz * abz || 1;
    const t = ((world.x - a.x) * abx + (world.z - a.z) * abz) / len2;
    return Math.min(0.95, Math.max(0.05, t));
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = eventToSvg(e);
    if (!s) return;
    if (dragIdx !== null) {
      const w = toWorld(s.x, s.y);
      setPts((prev) => prev.map((p, i) => (i === dragIdx ? w : p)));
      return;
    }
    if (dragOp !== null) {
      // Slide the opening along its wall (raw world coords, no grid snap).
      const raw: FloorPoint = {
        x: (s.x - PAD) / scale + bounds.minX,
        z: (s.y - PAD) / scale + bounds.minZ,
      };
      setOps((prev) =>
        prev.map((o, i) => (i === dragOp ? { ...o, offset: +offsetOnWall(o.wall, raw).toFixed(3) } : o))
      );
    }
  }

  function commit(next: FloorPoint[]) {
    setPts(next);
    onChange(next.map((p) => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2) })));
  }

  function endDrag() {
    if (dragOp !== null) {
      setDragOp(null);
      onOpeningsChange?.(ops);
    }
    if (dragIdx === null) return;
    setDragIdx(null);
    commit(pts);
  }

  // Insert vertex at midpoint of edge i→i+1.
  function addVertex(i: number) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const mid = { x: snap((a.x + b.x) / 2), z: snap((a.z + b.z) / 2) };
    const next = [...pts];
    next.splice(i + 1, 0, mid);
    commit(next);
  }

  function removeVertex(i: number) {
    if (pts.length <= 3) return; // need triangle min
    commit(pts.filter((_, j) => j !== i));
  }

  const polyStr = pts.map((p) => { const q = toPx(p); return `${q.x},${q.y}`; }).join(" ");

  // Edge length labels (metres).
  const edges = pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const m = toPx({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
    return { i, len, mx: m.x, my: m.y };
  });

  const area = polygonArea(pts);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-[640px]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
          <div>
            <h3 className="font-semibold text-sm">📐 Floor Plan Editor</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Drag corners · click edge ＋ to add · right-click corner to delete · drag D/W to slide doors & windows · area {area.toFixed(1)} m²
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-lg leading-none">×</button>
        </div>

        <div className="p-4">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW + PAD * 2} ${VIEW + PAD * 2}`}
            className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] touch-none select-none"
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
          >
            {/* grid */}
            {gridLines(bounds, scale).map((g, i) => (
              <line key={i} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="var(--border)" strokeWidth={0.5} opacity={0.5} />
            ))}

            {/* floor polygon */}
            <polygon points={polyStr} fill="var(--primary)" fillOpacity={0.12} stroke="var(--primary)" strokeWidth={2} />

            {/* edge labels + add buttons */}
            {edges.map((e) => (
              <g key={`e${e.i}`}>
                <rect x={e.mx - 18} y={e.my - 9} width={36} height={16} rx={3} fill="var(--card)" stroke="var(--border)" strokeWidth={0.5} />
                <text x={e.mx} y={e.my + 2} textAnchor="middle" fontSize={10} fill="var(--foreground)">{e.len.toFixed(2)}m</text>
                <circle
                  cx={e.mx} cy={e.my + 18} r={8}
                  fill="var(--primary)" className="cursor-pointer"
                  onClick={() => addVertex(e.i)}
                />
                <text x={e.mx} y={e.my + 21} textAnchor="middle" fontSize={11} fill="white" className="pointer-events-none">＋</text>
              </g>
            ))}

            {/* doors & windows on walls: drag to slide along the wall */}
            {ops.map((o, i) => {
              if (o.wall >= pts.length) return null;
              const a = pts[o.wall];
              const b = pts[(o.wall + 1) % pts.length];
              const wallLen = Math.hypot(b.x - a.x, b.z - a.z) || 1;
              const half = Math.min(0.45, o.width / 2 / wallLen);
              const p0 = toPx({ x: a.x + (b.x - a.x) * (o.offset - half), z: a.z + (b.z - a.z) * (o.offset - half) });
              const p1 = toPx({ x: a.x + (b.x - a.x) * (o.offset + half), z: a.z + (b.z - a.z) * (o.offset + half) });
              const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
              const isDoor = o.type === "door";
              return (
                <g key={`o${i}`}
                  className="cursor-grab"
                  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setDragOp(i); }}
                >
                  <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y}
                    stroke={isDoor ? "#b45309" : "#0369a1"} strokeWidth={dragOp === i ? 8 : 6} strokeLinecap="round" />
                  <circle cx={mx} cy={my} r={9} fill={isDoor ? "#b45309" : "#0369a1"} />
                  <text x={mx} y={my + 3.5} textAnchor="middle" fontSize={10} fill="white" className="pointer-events-none">
                    {isDoor ? "D" : "W"}
                  </text>
                </g>
              );
            })}

            {/* vertices */}
            {pts.map((p, i) => {
              const q = toPx(p);
              return (
                <circle
                  key={`v${i}`}
                  cx={q.x} cy={q.y} r={HANDLE}
                  fill={dragIdx === i ? "var(--primary)" : "white"}
                  stroke="var(--primary)" strokeWidth={2}
                  className="cursor-move"
                  onPointerDown={(e) => { e.preventDefault(); setDragIdx(i); }}
                  onContextMenu={(e) => { e.preventDefault(); removeVertex(i); }}
                />
              );
            })}
          </svg>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[var(--border)]">
          <div className="flex gap-2">
            <button
              onClick={() => commit(rect(width, depth))}
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]"
            >
              Reset to rectangle
            </button>
            <button
              onClick={() => commit(lShape(width, depth))}
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]"
            >
              L-shape
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-xs px-4 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function polygonArea(pts: FloorPoint[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
}

function lShape(width: number, depth: number): FloorPoint[] {
  const w = width / 2;
  const d = depth / 2;
  return [
    { x: -w, z: -d },
    { x: w, z: -d },
    { x: w, z: 0 },
    { x: 0, z: 0 },
    { x: 0, z: d },
    { x: -w, z: d },
  ];
}

function gridLines(bounds: { minX: number; minZ: number; span: number }, scale: number) {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const start = Math.ceil(bounds.minX);
  const endX = bounds.minX + bounds.span;
  const endZ = bounds.minZ + bounds.span;
  for (let x = start; x <= endX; x++) {
    const px = PAD + (x - bounds.minX) * scale;
    lines.push({ x1: px, y1: PAD, x2: px, y2: PAD + VIEW });
  }
  for (let z = Math.ceil(bounds.minZ); z <= endZ; z++) {
    const py = PAD + (z - bounds.minZ) * scale;
    lines.push({ x1: PAD, y1: py, x2: PAD + VIEW, y2: py });
  }
  return lines;
}
