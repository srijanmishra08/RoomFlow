// Lightweight, dependency-free "AI assist": keyword search + rule-based
// auto-furnishing over the built-in catalog. Deterministic, runs client-side.

import { FURNITURE_CATALOG, type CatalogItem } from "./furniture-catalog";

// ─── Semantic-ish catalog search ──────────────────────────────
// Token-overlap scoring with synonym expansion. No model needed.

const SYNONYMS: Record<string, string[]> = {
  couch: ["sofa", "seating"],
  settee: ["sofa"],
  tv: ["television", "electronics"],
  telly: ["tv"],
  desk: ["table", "office"],
  lamp: ["lighting", "light"],
  light: ["lighting", "lamp"],
  plant: ["decor", "greenery"],
  rug: ["carpet", "decor"],
  bed: ["bedroom"],
  chair: ["seating"],
  storage: ["wardrobe", "bookshelf", "cabinet"],
  kitchen: ["fridge", "stove", "counter"],
  bath: ["toilet", "sink", "bathtub"],
};

function expand(token: string): string[] {
  return [token, ...(SYNONYMS[token] ?? [])];
}

function haystack(item: CatalogItem): string {
  return `${item.name} ${item.category} ${item.kind}`.toLowerCase();
}

export function searchCatalog(query: string): CatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return FURNITURE_CATALOG;
  const tokens = q.split(/\s+/).flatMap(expand);
  const scored = FURNITURE_CATALOG.map((item) => {
    const hay = haystack(item);
    let score = 0;
    for (const t of tokens) {
      if (!t) continue;
      if (hay.includes(t)) score += hay.startsWith(t) ? 3 : 2;
    }
    return { item, score };
  });
  const hits = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  return (hits.length ? hits : scored.sort((a, b) => b.score - a.score)).map((s) => s.item);
}

// ─── Rule-based auto-furnish ──────────────────────────────────

export type RoomKind = "living" | "bedroom" | "office" | "dining" | "kitchen";

export interface Placement {
  item: CatalogItem;
  x: number;
  z: number;
  rotationY: number;
}

function byId(id: string): CatalogItem | undefined {
  return FURNITURE_CATALOG.find((c) => c.id === id);
}
function byKind(kind: CatalogItem["kind"]): CatalogItem | undefined {
  return FURNITURE_CATALOG.find((c) => c.kind === kind);
}

// Recipes: kinds to place + where, relative to room half-extents.
// pos returns world (x,z) from half-width hw and half-depth hd.
type Slot = { kind: CatalogItem["kind"]; pos: (hw: number, hd: number) => [number, number]; rot?: number };

const RECIPES: Record<RoomKind, Slot[]> = {
  living: [
    { kind: "sofa", pos: (hw, hd) => [0, -hd + 0.6], rot: 0 },
    { kind: "coffeeTable", pos: () => [0, -0.4] },
    { kind: "rug", pos: () => [0, -0.4] },
    { kind: "tvUnit", pos: (hw, hd) => [0, hd - 0.4], rot: Math.PI },
    { kind: "tv", pos: (hw, hd) => [0, hd - 0.4], rot: Math.PI },
    { kind: "armchair", pos: (hw) => [-hw + 0.7, 0], rot: Math.PI / 2 },
    { kind: "floorLamp", pos: (hw, hd) => [hw - 0.5, -hd + 0.5] },
    { kind: "plant", pos: (hw, hd) => [hw - 0.5, hd - 0.5] },
  ],
  bedroom: [
    { kind: "bed", pos: (hw, hd) => [0, -hd + 1.2], rot: 0 },
    { kind: "nightstand", pos: (hw, hd) => [-1.2, -hd + 0.4] },
    { kind: "nightstand", pos: (hw, hd) => [1.2, -hd + 0.4] },
    { kind: "wardrobe", pos: (hw) => [hw - 0.4, 0], rot: -Math.PI / 2 },
    { kind: "floorLamp", pos: (hw, hd) => [-hw + 0.5, hd - 0.5] },
    { kind: "rug", pos: () => [0, 0.3] },
  ],
  office: [
    { kind: "deskTable", pos: (hw, hd) => [0, -hd + 0.6], rot: 0 },
    { kind: "diningChair", pos: (hw, hd) => [0, -hd + 1.4], rot: Math.PI },
    { kind: "bookshelf", pos: (hw) => [hw - 0.3, 0], rot: -Math.PI / 2 },
    { kind: "plant", pos: (hw, hd) => [-hw + 0.5, hd - 0.5] },
    { kind: "floorLamp", pos: (hw, hd) => [hw - 0.5, hd - 0.5] },
  ],
  dining: [
    { kind: "diningTable", pos: () => [0, 0] },
    { kind: "diningChair", pos: () => [0, -0.9], rot: 0 },
    { kind: "diningChair", pos: () => [0, 0.9], rot: Math.PI },
    { kind: "diningChair", pos: () => [-0.9, 0], rot: -Math.PI / 2 },
    { kind: "diningChair", pos: () => [0.9, 0], rot: Math.PI / 2 },
    { kind: "plant", pos: (hw, hd) => [hw - 0.5, hd - 0.5] },
  ],
  kitchen: [
    { kind: "kitchenCounter", pos: (hw, hd) => [0, -hd + 0.4], rot: 0 },
    { kind: "stove", pos: (hw, hd) => [-1.2, -hd + 0.4] },
    { kind: "sink", pos: (hw, hd) => [1.2, -hd + 0.4] },
    { kind: "fridge", pos: (hw) => [hw - 0.4, 0], rot: -Math.PI / 2 },
  ],
};

/** Infer a room kind from its name (best effort). */
export function inferRoomKind(name: string): RoomKind {
  const n = name.toLowerCase();
  if (/bed|master|guest/.test(n)) return "bedroom";
  if (/office|study|work/.test(n)) return "office";
  if (/dining/.test(n)) return "dining";
  if (/kitchen/.test(n)) return "kitchen";
  return "living";
}

// ─── Restyle: palette swap across objects ─────────────────────

export interface Palette {
  id: string;
  label: string;
  // role → hex
  upholstery: string; // soft seating
  wood: string;       // tables / storage
  metal: string;      // lamps / electronics
  accent: string;     // rugs / decor
  neutral: string;    // fallback
}

export const PALETTES: Palette[] = [
  { id: "warm", label: "Warm Neutral", upholstery: "#b08968", wood: "#7f5539", metal: "#caa472", accent: "#e6ccb2", neutral: "#ddb892" },
  { id: "cool", label: "Cool Modern", upholstery: "#6c8ea4", wood: "#3d5a6c", metal: "#9db4c0", accent: "#c9d6df", neutral: "#8aa1b1" },
  { id: "mono", label: "Monochrome", upholstery: "#4a4a4a", wood: "#2e2e2e", metal: "#9a9a9a", accent: "#d9d9d9", neutral: "#6e6e6e" },
  { id: "sage", label: "Sage & Sand", upholstery: "#a3b18a", wood: "#588157", metal: "#dad7cd", accent: "#e9edc9", neutral: "#bcc4a8" },
  { id: "jewel", label: "Jewel Tones", upholstery: "#6a4c93", wood: "#1a535c", metal: "#c9a227", accent: "#9d4edd", neutral: "#4cc9f0" },
];

const UPHOLSTERY: CatalogItem["kind"][] = ["sofa", "armchair", "bed"];
const WOOD: CatalogItem["kind"][] = ["coffeeTable", "diningTable", "deskTable", "nightstand", "wardrobe", "bookshelf", "tvUnit", "diningChair", "kitchenCounter"];
const METAL: CatalogItem["kind"][] = ["floorLamp", "tv", "fridge", "stove", "sink"];
const ACCENT: CatalogItem["kind"][] = ["rug", "plant", "bathtub", "toilet"];

/** Pick the palette colour for a given furniture kind. */
export function colorForKind(kind: CatalogItem["kind"], p: Palette): string {
  if (UPHOLSTERY.includes(kind)) return p.upholstery;
  if (WOOD.includes(kind)) return p.wood;
  if (METAL.includes(kind)) return p.metal;
  if (ACCENT.includes(kind)) return p.accent;
  return p.neutral;
}

/**
 * Generate furniture placements for a room. Positions are clamped to stay
 * inside the room footprint (assumes the room is centred at origin).
 */
export function autoFurnish(kind: RoomKind, width: number, depth: number): Placement[] {
  const hw = width / 2;
  const hd = depth / 2;
  const slots = RECIPES[kind] ?? RECIPES.living;
  const out: Placement[] = [];
  for (const slot of slots) {
    const item = byKind(slot.kind) ?? byId(slot.kind);
    if (!item) continue;
    const [rx, rz] = slot.pos(hw, hd);
    // Clamp so the piece centre keeps half its footprint inside the walls.
    const marginX = item.dims[0] / 2 + 0.05;
    const marginZ = item.dims[2] / 2 + 0.05;
    const x = Math.max(-hw + marginX, Math.min(hw - marginX, rx));
    const z = Math.max(-hd + marginZ, Math.min(hd - marginZ, rz));
    out.push({ item, x, z, rotationY: slot.rot ?? 0 });
  }
  return out;
}
