import { prisma } from "@/lib/prisma";

// SaaS plan definitions. Limits are enforced server-side via assertWithinPlan().
// Keep in sync with the Plan enum in schema.prisma.

export type PlanId = "FREE" | "PRO" | "STUDIO";

export interface PlanLimits {
  id: PlanId;
  label: string;
  priceInr: number;        // monthly, INR
  maxProjects: number;     // -1 = unlimited
  maxRoomsPerProject: number;
  maxRendersPerMonth: number;
  realtimeCollab: boolean;
  stripePriceEnv: string;  // env var holding the Stripe price id
}

export const PLANS: Record<PlanId, PlanLimits> = {
  FREE: {
    id: "FREE", label: "Free", priceInr: 0,
    maxProjects: 2, maxRoomsPerProject: 3, maxRendersPerMonth: 10,
    realtimeCollab: false, stripePriceEnv: "",
  },
  PRO: {
    id: "PRO", label: "Pro", priceInr: 1499,
    maxProjects: 25, maxRoomsPerProject: 20, maxRendersPerMonth: 300,
    realtimeCollab: true, stripePriceEnv: "STRIPE_PRICE_PRO",
  },
  STUDIO: {
    id: "STUDIO", label: "Studio", priceInr: 4999,
    maxProjects: -1, maxRoomsPerProject: -1, maxRendersPerMonth: 5000,
    realtimeCollab: true, stripePriceEnv: "STRIPE_PRICE_STUDIO",
  },
};

export function planLimits(plan: PlanId): PlanLimits {
  return PLANS[plan] ?? PLANS.FREE;
}

const unlimited = (n: number) => n < 0;

/**
 * Returns null if the action is allowed, or a { error, status } describing why
 * it is blocked by the designer's current plan. Pure check against counts.
 */
export async function assertWithinPlan(
  designerId: string,
  action: "create-project" | "create-room",
  ctx?: { projectId?: string }
): Promise<{ error: string; status: number } | null> {
  const designer = await prisma.designer.findUnique({ where: { id: designerId } });
  if (!designer) return { error: "Designer not found", status: 404 };
  const limits = planLimits(designer.plan as PlanId);

  if (action === "create-project") {
    if (unlimited(limits.maxProjects)) return null;
    const count = await prisma.project.count({ where: { designerId } });
    if (count >= limits.maxProjects) {
      return {
        error: `Your ${limits.label} plan allows ${limits.maxProjects} projects. Upgrade to add more.`,
        status: 402,
      };
    }
  }

  if (action === "create-room" && ctx?.projectId) {
    if (unlimited(limits.maxRoomsPerProject)) return null;
    const count = await prisma.room.count({ where: { projectId: ctx.projectId } });
    if (count >= limits.maxRoomsPerProject) {
      return {
        error: `Your ${limits.label} plan allows ${limits.maxRoomsPerProject} rooms per project. Upgrade to add more.`,
        status: 402,
      };
    }
  }

  return null;
}
