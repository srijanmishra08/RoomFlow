import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhook } from "@/lib/stripe";
import { PLANS, type PlanId } from "@/lib/plans";
import { logger } from "@/lib/logger";

// Stripe price id → plan. Built from env so it tracks PLANS config.
function planForPrice(priceId: string | undefined): PlanId | null {
  if (!priceId) return null;
  for (const p of Object.values(PLANS)) {
    if (p.stripePriceEnv && process.env[p.stripePriceEnv] === priceId) return p.id;
  }
  return null;
}

// POST /api/billing/webhook — Stripe subscription lifecycle events.
export async function POST(req: NextRequest) {
  const payload = await req.text();
  const event = verifyWebhook(payload, req.headers.get("stripe-signature"));
  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        const designerId = s.client_reference_id ?? s.metadata?.designerId;
        if (designerId) {
          await prisma.designer.update({
            where: { id: designerId },
            data: {
              stripeCustomerId: s.customer ?? undefined,
              stripeSubscriptionId: s.subscription ?? undefined,
            },
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object;
        const priceId = sub.items?.data?.[0]?.price?.id;
        const plan = planForPrice(priceId);
        const active = sub.status === "active" || sub.status === "trialing";
        const renewsAt = sub.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : null;
        await prisma.designer.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { plan: active && plan ? plan : "FREE", planRenewsAt: renewsAt },
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await prisma.designer.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { plan: "FREE", planRenewsAt: null },
        });
        break;
      }
      default:
        break;
    }
  } catch (e) {
    logger.error("stripe webhook handler error", { type: event.type, ...logger.err(e) });
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
