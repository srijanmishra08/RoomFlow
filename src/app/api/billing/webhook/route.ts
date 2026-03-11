import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/billing/webhook — Stripe webhook handler
export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const stripe = (await import("stripe")).default;
  const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY);

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as any;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;

      if (userId && plan) {
        await prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            plan: plan as any,
            stripeCustomerId: session.customer,
            stripeSubId: session.subscription,
          },
          update: {
            plan: plan as any,
            stripeCustomerId: session.customer,
            stripeSubId: session.subscription,
            cancelAtPeriodEnd: false,
          },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as any;
      const existingSub = await prisma.subscription.findFirst({
        where: { stripeSubId: sub.id },
      });

      if (existingSub) {
        await prisma.subscription.update({
          where: { id: existingSub.id },
          data: {
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          },
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as any;
      const existingSub = await prisma.subscription.findFirst({
        where: { stripeSubId: sub.id },
      });

      if (existingSub) {
        await prisma.subscription.update({
          where: { id: existingSub.id },
          data: { plan: "FREE", stripeSubId: null, stripePriceId: null },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
