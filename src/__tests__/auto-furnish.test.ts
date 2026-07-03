/** @jest-environment node */
import {
  searchCatalog,
  inferRoomKind,
  autoFurnish,
  colorForKind,
  PALETTES,
} from "@/lib/auto-furnish";

describe("auto-furnish", () => {
  describe("inferRoomKind", () => {
    it("maps obvious room names to kinds", () => {
      expect(inferRoomKind("Master Bedroom")).toBe("bedroom");
      expect(inferRoomKind("Home Office")).toBe("office");
      expect(inferRoomKind("Living Room")).toBe("living");
      expect(inferRoomKind("Dining Area")).toBe("dining");
      expect(inferRoomKind("Kitchen")).toBe("kitchen");
    });

    it("falls back to living for unknown names", () => {
      expect(inferRoomKind("Mystery Space 42")).toBe("living");
    });

    it("is case-insensitive", () => {
      expect(inferRoomKind("BEDROOM")).toBe("bedroom");
    });
  });

  describe("searchCatalog", () => {
    it("finds items by name token", () => {
      const r = searchCatalog("sofa");
      expect(r.length).toBeGreaterThan(0);
      expect(r.every((i) => typeof i.id === "string" && typeof i.name === "string")).toBe(true);
    });

    it("expands synonyms (couch -> sofa)", () => {
      const r = searchCatalog("couch");
      expect(r.length).toBeGreaterThan(0);
    });

    it("returns an array for empty query without throwing", () => {
      expect(Array.isArray(searchCatalog(""))).toBe(true);
    });
  });

  describe("autoFurnish", () => {
    it("places pieces inside the room footprint", () => {
      const w = 5;
      const d = 5;
      const placements = autoFurnish("living", w, d);
      expect(placements.length).toBeGreaterThan(0);
      for (const p of placements) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(w / 2 + 1e-6);
        expect(Math.abs(p.z)).toBeLessThanOrEqual(d / 2 + 1e-6);
        expect(typeof p.rotationY).toBe("number");
        expect(p.item).toBeDefined();
      }
    });

    it("produces placements for every supported kind", () => {
      for (const kind of ["living", "bedroom", "office", "dining", "kitchen"] as const) {
        expect(autoFurnish(kind, 4, 4).length).toBeGreaterThan(0);
      }
    });
  });

  describe("palettes / colorForKind", () => {
    it("exposes 5 palettes with required roles", () => {
      expect(PALETTES).toHaveLength(5);
      for (const p of PALETTES) {
        expect(p.id).toBeTruthy();
        expect(p.label).toBeTruthy();
        for (const role of ["upholstery", "wood", "metal", "accent", "neutral"] as const) {
          expect(p[role]).toMatch(/^#[0-9a-fA-F]{3,8}$/);
        }
      }
    });

    it("returns a hex color for a kind", () => {
      const c = colorForKind("sofa", PALETTES[0]);
      expect(c).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    });
  });
});
