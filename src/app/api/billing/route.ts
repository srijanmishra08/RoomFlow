import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PLANS = {
  FREE: { name: "Free", price: 0, projects: 2, rooms: 5, assets: 20 },
  STARTER: { name: "Starter", price: 999, projects: 10, rooms: 50, assets: 200 },
  PRO: { name: "Pro", price: 2499, projects: 50, rooms: 500, assets: 2000 },
  STUDIO: { name: "Studio", price: 4999, projects: -1, rooms: -1, assets: -1 },
};

// GET /api/billing — get subscription + usage
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [subscription, designer] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: session.user.id } }),
    prisma.designer.findUnique({
      where: { userId: session.user.id },
      include: {
        projects: { select: { id: true } },
        assets: { select: { id: true } },
      },
    }),
  ]);

  const plan = subscription?.plan || "FREE";
  const limits = PLANS[plan as keyof typeof PLANS] || PLANS.FREE;

  // Count rooms across all projects
  let roomCount = 0;
  if (designer) {
    const rooms = await prisma.room.count({
      where: { project: { designerId: designer.id } },
    });
    roomCount = rooms;
  }

  return NextResponse.json({
    plan,
    plans: PLANS,
    subscription: subscription || { plan: "FREE" },
    usage: {
      projects: designer?.projects.length || 0,
      rooms: roomCount,
      assets: designer?.assets.length || 0,
    },
    limits,
  });
}

// POST /api/billing — create checkout session or manage subscription
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action, plan } = body;

  if (action === "checkout") {
    // In production, integrate with Stripe here:
    // 1. Create or retrieve Stripe customer
    // 2. Create Checkout Session with price lookup
    // 3. Return checkout URL
    //
    // For now, we simulate upgrading locally
    if (!plan || !PLANS[plan as keyof typeof PLANS]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const stripeEnabled = !!process.env.STRIPE_SECRET_KEY;

    if (stripeEnabled) {
      // Real Stripe integration
      const stripe = (await import("stripe")).default;
      const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);

      let sub = await prisma.subscription.findUnique({
        where: { userId: session.user.id },
      });

      let customerId = sub?.stripeCustomerId;

      if (!customerId) {
        const customer = await stripeClient.customers.create({
          email: session.user.email || undefined,
          metadata: { userId: session.user.id },
        });
        customerId = customer.id;
      }

      const priceId = process.env[`STRIPE_PRICE_${plan}`];
      if (!priceId) {
        return NextResponse.json({ error: "Price not configured for this plan" }, { status: 400 });
      }

      const checkoutSession = await stripeClient.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.NEXTAUTH_URL}/dashboard/settings?billing=success`,
        cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/settings?billing=cancelled`,
        metadata: { userId: session.user.id, plan },
      });

      return NextResponse.json({ url: checkoutSession.url });
    }

    // Local / demo mode: upgrade directly
    await prisma.subscription.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        plan: plan as any,
      },
      update: {
        plan: plan as any,
      },
    });

    return NextResponse.json({ success: true, plan });
  }

  if (action === "cancel") {
    const sub = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (sub?.stripeSubId && process.env.STRIPE_SECRET_KEY) {
      const stripe = (await import("stripe")).default;
      const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY);
      await stripeClient.subscriptions.update(sub.stripeSubId, {
        cancel_at_period_end: true,
      });
    }

    await prisma.subscription.update({
      where: { userId: session.user.id },
      data: { cancelAtPeriodEnd: true },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
