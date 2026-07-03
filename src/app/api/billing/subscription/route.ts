import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLANS, planLimits, type PlanId } from "@/lib/plans";
import { createCheckoutSession, isStripeEnabled } from "@/lib/stripe";
import { enforceRateLimit } from "@/lib/rate-limit";

// GET /api/billing/subscription — current plan, limits, and available plans
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const designer = await prisma.designer.findUnique({ where: { userId: session.user.id } });
  if (!designer) {
    return NextResponse.json({ error: "Designer profile not found" }, { status: 404 });
  }
  const plan = designer.plan as PlanId;
  return NextResponse.json({
    plan,
    limits: planLimits(plan),
    renewsAt: designer.planRenewsAt,
    stripeEnabled: isStripeEnabled,
    plans: Object.values(PLANS),
  });
}

// POST /api/billing/subscription — start a Stripe Checkout for the chosen plan
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "subscription", 10, 60_000);
  if (limited) return limited;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStripeEnabled) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }

  const designer = await prisma.designer.findUnique({
    where: { userId: session.user.id },
    include: { user: { select: { email: true } } },
  });
  if (!designer) {
    return NextResponse.json({ error: "Designer profile not found" }, { status: 404 });
  }

  const { plan } = await req.json();
  if (plan !== "PRO" && plan !== "STUDIO") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId = process.env[PLANS[plan as PlanId].stripePriceEnv];
  if (!priceId) {
    return NextResponse.json({ error: "Plan price not configured" }, { status: 503 });
  }

  const base = process.env["NEXTAUTH_URL"] ?? "http://localhost:3000";
  try {
    const url = await createCheckoutSession({
      priceId,
      customerEmail: designer.user.email,
      designerId: designer.id,
      successUrl: `${base}/dashboard/settings?billing=success`,
      cancelUrl: `${base}/dashboard/settings?billing=cancelled`,
    });
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed" },
      { status: 502 }
    );
  }
}
