/** @jest-environment node */
// Mock the prisma client before importing the module under test.
const mockPrisma = {
  designer: { findUnique: jest.fn() },
  project: { count: jest.fn() },
  room: { count: jest.fn() },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { PLANS, planLimits, assertWithinPlan } from "@/lib/plans";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("plans", () => {
  describe("planLimits", () => {
    it("defines the three tiers with expected project caps", () => {
      expect(PLANS.FREE.maxProjects).toBe(2);
      expect(PLANS.PRO.maxProjects).toBeGreaterThan(PLANS.FREE.maxProjects);
      expect(PLANS.STUDIO.maxProjects).toBe(-1); // unlimited
    });

    it("falls back to FREE for an unknown plan", () => {
      // @ts-expect-error testing defensive fallback
      expect(planLimits("BOGUS").id).toBe("FREE");
    });
  });

  describe("assertWithinPlan: create-project", () => {
    it("blocks with 402 when a FREE designer is at the project cap", async () => {
      mockPrisma.designer.findUnique.mockResolvedValue({ id: "d1", plan: "FREE" });
      mockPrisma.project.count.mockResolvedValue(2);
      const res = await assertWithinPlan("d1", "create-project");
      expect(res?.status).toBe(402);
    });

    it("allows when under the cap", async () => {
      mockPrisma.designer.findUnique.mockResolvedValue({ id: "d1", plan: "FREE" });
      mockPrisma.project.count.mockResolvedValue(1);
      expect(await assertWithinPlan("d1", "create-project")).toBeNull();
    });

    it("allows unlimited plans without counting", async () => {
      mockPrisma.designer.findUnique.mockResolvedValue({ id: "d1", plan: "STUDIO" });
      const res = await assertWithinPlan("d1", "create-project");
      expect(res).toBeNull();
      expect(mockPrisma.project.count).not.toHaveBeenCalled();
    });

    it("404s when the designer is missing", async () => {
      mockPrisma.designer.findUnique.mockResolvedValue(null);
      const res = await assertWithinPlan("nope", "create-project");
      expect(res?.status).toBe(404);
    });
  });

  describe("assertWithinPlan: create-room", () => {
    it("blocks with 402 at the per-project room cap", async () => {
      mockPrisma.designer.findUnique.mockResolvedValue({ id: "d1", plan: "FREE" });
      mockPrisma.room.count.mockResolvedValue(PLANS.FREE.maxRoomsPerProject);
      const res = await assertWithinPlan("d1", "create-room", { projectId: "p1" });
      expect(res?.status).toBe(402);
    });
  });
});
