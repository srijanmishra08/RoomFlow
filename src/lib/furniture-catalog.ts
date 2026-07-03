// ─── Built-in Furniture Catalog ──────────────────────────────────────────
// Foyr-style ready-to-use furniture library. Each item renders as a real
// procedural 3D model (grouped Three.js meshes) — no GLB upload required.
//
// The procedural "kind" is the single source of truth for geometry. It is
// stored on the RoomObject via the `material` field as `kind:<kind>` so we
// need NO database migration. When `material` has no kind tag we fall back to
// resolving a kind from the object name (keyword match), so older objects and
// hand-typed names still render sensibly.

export type FurnitureKind =
  | "sofa"
  | "armchair"
  | "diningChair"
  | "coffeeTable"
  | "diningTable"
  | "deskTable"
  | "bed"
  | "nightstand"
  | "wardrobe"
  | "bookshelf"
  | "tvUnit"
  | "tv"
  | "floorLamp"
  | "rug"
  | "plant"
  | "fridge"
  | "stove"
  | "kitchenCounter"
  | "toilet"
  | "sink"
  | "bathtub"
  | "box";

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  kind: FurnitureKind;
  /** default footprint in metres: [width(x), height(y), depth(z)] */
  dims: [number, number, number];
  color: string;
  /** indicative retail price (used to seed object cost / quotes) */
  price: number;
}

export interface CatalogCategory {
  id: string;
  label: string;
  icon: string; // emoji used as a lightweight thumbnail
}

export const CATALOG_CATEGORIES: CatalogCategory[] = [
  { id: "seating", label: "Seating", icon: "🛋️" },
  { id: "tables", label: "Tables", icon: "🪑" },
  { id: "bedroom", label: "Bedroom", icon: "🛏️" },
  { id: "storage", label: "Storage", icon: "🗄️" },
  { id: "kitchen", label: "Kitchen", icon: "🍳" },
  { id: "bath", label: "Bath", icon: "🛁" },
  { id: "lighting", label: "Lighting", icon: "💡" },
  { id: "decor", label: "Decor", icon: "🪴" },
  { id: "electronics", label: "Electronics", icon: "📺" },
];

export const FURNITURE_CATALOG: CatalogItem[] = [
  // Seating
  { id: "sofa-3", name: "3-Seater Sofa", category: "seating", kind: "sofa", dims: [2.2, 0.85, 0.95], color: "#7c8aa5", price: 45000 },
  { id: "sofa-2", name: "2-Seater Sofa", category: "seating", kind: "sofa", dims: [1.6, 0.85, 0.95], color: "#8a9bb0", price: 32000 },
  { id: "armchair", name: "Armchair", category: "seating", kind: "armchair", dims: [0.9, 0.85, 0.9], color: "#9c6b53", price: 18000 },
  { id: "dining-chair", name: "Dining Chair", category: "seating", kind: "diningChair", dims: [0.5, 0.95, 0.5], color: "#5b4636", price: 4500 },

  // Tables
  { id: "coffee-table", name: "Coffee Table", category: "tables", kind: "coffeeTable", dims: [1.1, 0.42, 0.6], color: "#6b4f3a", price: 12000 },
  { id: "dining-table", name: "Dining Table", category: "tables", kind: "diningTable", dims: [1.8, 0.75, 0.95], color: "#5b4636", price: 28000 },
  { id: "desk", name: "Office Desk", category: "tables", kind: "deskTable", dims: [1.4, 0.75, 0.7], color: "#4a4a4a", price: 16000 },

  // Bedroom
  { id: "bed-queen", name: "Queen Bed", category: "bedroom", kind: "bed", dims: [1.6, 0.6, 2.1], color: "#b9a89a", price: 38000 },
  { id: "bed-king", name: "King Bed", category: "bedroom", kind: "bed", dims: [1.9, 0.6, 2.1], color: "#b9a89a", price: 52000 },
  { id: "nightstand", name: "Nightstand", category: "bedroom", kind: "nightstand", dims: [0.5, 0.5, 0.4], color: "#6b4f3a", price: 6500 },

  // Storage
  { id: "wardrobe", name: "Wardrobe", category: "storage", kind: "wardrobe", dims: [1.5, 2.1, 0.6], color: "#8a7059", price: 34000 },
  { id: "bookshelf", name: "Bookshelf", category: "storage", kind: "bookshelf", dims: [0.9, 1.8, 0.32], color: "#6b4f3a", price: 14000 },
  { id: "tv-unit", name: "TV Unit", category: "storage", kind: "tvUnit", dims: [1.8, 0.5, 0.4], color: "#3a3a3a", price: 17000 },

  // Kitchen
  { id: "fridge", name: "Refrigerator", category: "kitchen", kind: "fridge", dims: [0.7, 1.8, 0.7], color: "#d7dbe0", price: 42000 },
  { id: "stove", name: "Stove / Range", category: "kitchen", kind: "stove", dims: [0.6, 0.9, 0.6], color: "#9aa0a6", price: 26000 },
  { id: "counter", name: "Kitchen Counter", category: "kitchen", kind: "kitchenCounter", dims: [2.0, 0.9, 0.6], color: "#c9c2b6", price: 30000 },

  // Bath
  { id: "toilet", name: "Toilet", category: "bath", kind: "toilet", dims: [0.4, 0.75, 0.65], color: "#f2f4f6", price: 12000 },
  { id: "sink", name: "Wash Basin", category: "bath", kind: "sink", dims: [0.6, 0.85, 0.45], color: "#f2f4f6", price: 9000 },
  { id: "bathtub", name: "Bathtub", category: "bath", kind: "bathtub", dims: [1.7, 0.6, 0.8], color: "#f2f4f6", price: 36000 },

  // Lighting
  { id: "floor-lamp", name: "Floor Lamp", category: "lighting", kind: "floorLamp", dims: [0.4, 1.6, 0.4], color: "#e8c87a", price: 7500 },

  // Decor
  { id: "rug", name: "Area Rug", category: "decor", kind: "rug", dims: [2.4, 0.03, 1.6], color: "#a8584f", price: 9000 },
  { id: "plant", name: "Potted Plant", category: "decor", kind: "plant", dims: [0.5, 1.2, 0.5], color: "#3f8f4f", price: 3500 },

  // Electronics
  { id: "tv", name: "Television", category: "electronics", kind: "tv", dims: [1.4, 0.8, 0.08], color: "#111418", price: 55000 },
];

const KIND_TAG = /(?:^|;)\s*kind:([a-zA-Z]+)/;

const KNOWN_KINDS = new Set<string>([
  "sofa", "armchair", "diningChair", "coffeeTable", "diningTable", "deskTable",
  "bed", "nightstand", "wardrobe", "bookshelf", "tvUnit", "tv", "floorLamp",
  "rug", "plant", "fridge", "stove", "kitchenCounter", "toilet", "sink",
  "bathtub", "box",
]);

/** Resolve the procedural kind for an object from its `material` tag or name. */
export function resolveKind(
  material: string | null | undefined,
  name: string | null | undefined
): FurnitureKind {
  const tagged = material?.match(KIND_TAG)?.[1] as FurnitureKind | undefined;
  if (tagged && KNOWN_KINDS.has(tagged)) return tagged;

  const lower = (name || "").toLowerCase();
  const byName: [RegExp, FurnitureKind][] = [
    [/sofa|couch|settee/, "sofa"],
    [/armchair|recliner|lounge/, "armchair"],
    [/dining chair|chair/, "diningChair"],
    [/coffee table/, "coffeeTable"],
    [/dining table|dining/, "diningTable"],
    [/desk/, "deskTable"],
    [/table/, "coffeeTable"],
    [/bed|mattress/, "bed"],
    [/nightstand|bedside/, "nightstand"],
    [/wardrobe|closet|almirah/, "wardrobe"],
    [/bookshelf|shelf|bookcase/, "bookshelf"],
    [/tv unit|media unit|console/, "tvUnit"],
    [/television|\btv\b|screen/, "tv"],
    [/fridge|refriger/, "fridge"],
    [/stove|range|cooktop|hob/, "stove"],
    [/counter|cabinet/, "kitchenCounter"],
    [/toilet|wc|commode/, "toilet"],
    [/basin|sink|washbasin/, "sink"],
    [/bathtub|tub/, "bathtub"],
    [/lamp|light/, "floorLamp"],
    [/rug|carpet|mat/, "rug"],
    [/plant|pot|tree|fern/, "plant"],
  ];
  for (const [re, kind] of byName) if (re.test(lower)) return kind;
  return "box";
}

/** Build the `material` tag string that encodes a procedural kind. */
export function kindTag(kind: FurnitureKind): string {
  return `kind:${kind}`;
}
