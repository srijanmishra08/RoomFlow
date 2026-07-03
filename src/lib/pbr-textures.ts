// Procedural PBR texture library. Generates tileable canvas-based texture maps
// (color + bump + roughness) entirely client-side — no external image assets —
// so floors/walls/ceilings get real material depth beyond flat colors.
//
// SurfaceMaterial { type: "texture", value: "<textureId>" } resolves here.

import * as THREE from "three";

export interface PBRTextureDef {
  id: string;
  label: string;
  /** Representative swatch color for UI chips. */
  swatch: string;
  /** Which surfaces this makes sense on (UI hint only). */
  surfaces: ("floor" | "wall" | "ceiling")[];
  /** World metres covered by one texture tile. */
  tileSize: number;
  draw: (ctx: CanvasRenderingContext2D, size: number, rng: () => number) => void;
  roughness: number;
  bumpScale: number;
}

// Deterministic PRNG so textures are stable across renders.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawWoodPlanks(base: string, grain: string, gap: string) {
  return (ctx: CanvasRenderingContext2D, size: number, rng: () => number) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    const plankH = size / 4;
    for (let row = 0; row < 4; row++) {
      const y = row * plankH;
      // Stagger plank seams per row.
      const seam = ((row % 2) * 0.5 + rng() * 0.2) * size;
      ctx.fillStyle = gap;
      ctx.fillRect(0, y, size, 2);
      ctx.fillRect(seam % size, y, 2, plankH);
      // Grain streaks.
      ctx.strokeStyle = grain;
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 14; i++) {
        const gy = y + rng() * plankH;
        ctx.lineWidth = 0.5 + rng() * 1.2;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(size * 0.3, gy + (rng() - 0.5) * 6, size * 0.7, gy + (rng() - 0.5) * 6, size, gy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  };
}

function drawMarble(base: string, vein: string) {
  return (ctx: CanvasRenderingContext2D, size: number, rng: () => number) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = vein;
    for (let v = 0; v < 7; v++) {
      ctx.globalAlpha = 0.15 + rng() * 0.25;
      ctx.lineWidth = 0.5 + rng() * 1.5;
      let x = rng() * size, y = 0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      while (y < size) {
        x += (rng() - 0.5) * 40;
        y += 10 + rng() * 25;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
}

function drawTiles(base: string, groutColor: string, n: number) {
  return (ctx: CanvasRenderingContext2D, size: number, rng: () => number) => {
    ctx.fillStyle = groutColor;
    ctx.fillRect(0, 0, size, size);
    const t = size / n, g = 2;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        // Slight per-tile tonal variation.
        const l = (rng() - 0.5) * 12;
        ctx.fillStyle = shade(base, l);
        ctx.fillRect(i * t + g, j * t + g, t - g * 2, t - g * 2);
      }
    }
  };
}

function drawFabric(base: string, thread: string) {
  return (ctx: CanvasRenderingContext2D, size: number, rng: () => number) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = thread;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < size; i += 3) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
    }
    // Random slubs.
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = thread;
      ctx.fillRect(rng() * size, rng() * size, 2 + rng() * 4, 1);
    }
    ctx.globalAlpha = 1;
  };
}

function drawConcrete(base: string) {
  return (ctx: CanvasRenderingContext2D, size: number, rng: () => number) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 2200; i++) {
      const l = (rng() - 0.5) * 22;
      ctx.fillStyle = shade(base, l);
      ctx.globalAlpha = 0.3;
      ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2);
    }
    ctx.globalAlpha = 1;
  };
}

function drawBrick(brick: string, mortar: string) {
  return (ctx: CanvasRenderingContext2D, size: number, rng: () => number) => {
    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, size, size);
    const rows = 8, bh = size / rows, bw = size / 4, g = 2;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (bw / 2);
      for (let c = -1; c < 5; c++) {
        ctx.fillStyle = shade(brick, (rng() - 0.5) * 16);
        ctx.fillRect(c * bw + off + g, r * bh + g, bw - g * 2, bh - g * 2);
      }
    }
  };
}

function drawHerringbone(base: string, grain: string) {
  return (ctx: CanvasRenderingContext2D, size: number, rng: () => number) => {
    ctx.fillStyle = shade(base, -20);
    ctx.fillRect(0, 0, size, size);
    const w = size / 8, l = w * 3;
    for (let y = -1; y < 10; y++) {
      for (let x = -1; x < 10; x++) {
        ctx.save();
        ctx.translate(x * l * 0.5, y * w * 2);
        ctx.rotate(((x + y) % 2 ? 45 : -45) * (Math.PI / 180));
        ctx.fillStyle = shade(base, (rng() - 0.5) * 14);
        ctx.fillRect(0, 0, l, w - 1.5);
        ctx.strokeStyle = grain;
        ctx.globalAlpha = 0.25;
        for (let s = 0; s < 3; s++) {
          const gy = rng() * w;
          ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(l, gy); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }
  };
}

/** Lighten/darken a hex color by `amt` (−255..255). */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v + amt));
  const r = c((n >> 16) & 255), g = c((n >> 8) & 255), b = c(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export const PBR_TEXTURES: PBRTextureDef[] = [
  { id: "oak", label: "Oak Planks", swatch: "#c9a876", surfaces: ["floor"], tileSize: 2,
    draw: drawWoodPlanks("#c9a876", "#a98b5f", "#8a7048"), roughness: 0.65, bumpScale: 0.6 },
  { id: "walnut", label: "Walnut", swatch: "#7a5a3e", surfaces: ["floor"], tileSize: 2,
    draw: drawWoodPlanks("#7a5a3e", "#5d4430", "#4a3626"), roughness: 0.55, bumpScale: 0.6 },
  { id: "herringbone", label: "Herringbone", swatch: "#b99667", surfaces: ["floor"], tileSize: 1.6,
    draw: drawHerringbone("#b99667", "#93764f"), roughness: 0.6, bumpScale: 0.5 },
  { id: "marble", label: "Marble", swatch: "#eceae6", surfaces: ["floor", "wall"], tileSize: 2.5,
    draw: drawMarble("#eceae6", "#9aa0a8"), roughness: 0.25, bumpScale: 0.2 },
  { id: "tile", label: "Ceramic Tile", swatch: "#dfd9cf", surfaces: ["floor", "wall"], tileSize: 1.2,
    draw: drawTiles("#dfd9cf", "#b8b0a4", 4), roughness: 0.35, bumpScale: 0.5 },
  { id: "fabric", label: "Linen Weave", swatch: "#d8cfc0", surfaces: ["wall"], tileSize: 0.8,
    draw: drawFabric("#d8cfc0", "#b5a890"), roughness: 0.95, bumpScale: 0.4 },
  { id: "concrete", label: "Concrete", swatch: "#b7b3ad", surfaces: ["floor", "wall", "ceiling"], tileSize: 2.5,
    draw: drawConcrete("#b7b3ad"), roughness: 0.9, bumpScale: 0.35 },
  { id: "brick", label: "Brick", swatch: "#a5624a", surfaces: ["wall"], tileSize: 1.5,
    draw: drawBrick("#a5624a", "#cfc4b6"), roughness: 0.85, bumpScale: 0.8 },
];

export function getTextureDef(id: string): PBRTextureDef | undefined {
  return PBR_TEXTURES.find((t) => t.id === id);
}

export interface PBRMaps {
  map: THREE.Texture;
  bumpMap: THREE.Texture;
  roughness: number;
  bumpScale: number;
  tileSize: number;
}

const cache = new Map<string, PBRMaps>();

/** Build (and cache) THREE textures for a library id. Client-only. */
export function getPBRMaps(id: string): PBRMaps | null {
  if (typeof document === "undefined") return null;
  const def = getTextureDef(id);
  if (!def) return null;
  const hit = cache.get(id);
  if (hit) return hit;

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  def.draw(ctx, size, mulberry32(1337));
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  // Bump map: grayscale copy of the color map (structure follows pattern).
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext("2d")!;
  bctx.filter = "grayscale(1) contrast(1.4)";
  bctx.drawImage(canvas, 0, 0);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  const maps: PBRMaps = { map, bumpMap, roughness: def.roughness, bumpScale: def.bumpScale * 0.02, tileSize: def.tileSize };
  cache.set(id, maps);
  return maps;
}
