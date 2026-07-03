import crypto from "crypto";
import { logger } from "@/lib/logger";

// Dependency-free Stripe client over the REST API (no `stripe` npm package).
// Active only when STRIPE_SECRET_KEY is set; callers should check isStripeEnabled.

const SECRET = process.env["STRIPE_SECRET_KEY"] ?? "";
const WEBHOOK_SECRET = process.env["STRIPE_WEBHOOK_SECRET"] ?? "";
const API = "https://api.stripe.com/v1";

export const isStripeEnabled = Boolean(SECRET);

// Encode a nested object into Stripe's bracketed form-url-encoded format.
function encodeForm(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") parts.push(encodeForm(v as Record<string, unknown>, key));
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return parts.filter(Boolean).join("&");
}

async function stripePost(path: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeForm(body),
    signal: AbortSignal.timeout(8000),
  });
  const json = await res.json();
  if (!res.ok) {
    logger.error("stripe request failed", { path, status: res.status, error: json?.error?.message });
    throw new Error(json?.error?.message ?? "Stripe request failed");
  }
  return json;
}

export interface CheckoutArgs {
  priceId: string;
  customerEmail: string;
  designerId: string;
  successUrl: string;
  cancelUrl: string;
}

// Create a subscription Checkout Session; returns the hosted-checkout URL.
export async function createCheckoutSession(a: CheckoutArgs): Promise<string> {
  const session = await stripePost("/checkout/sessions", {
    mode: "subscription",
    "line_items": [{ price: a.priceId, quantity: 1 }],
    customer_email: a.customerEmail,
    success_url: a.successUrl,
    cancel_url: a.cancelUrl,
    client_reference_id: a.designerId,
    metadata: { designerId: a.designerId },
  });
  return session.url as string;
}

// Verify a Stripe webhook signature (t=,v1= scheme). Returns the parsed event
// or null when verification fails. No external dependency.
export function verifyWebhook(payload: string, sigHeader: string | null): any | null {
  if (!WEBHOOK_SECRET || !sigHeader) return null;
  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => p.split("=") as [string, string])
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return null;

  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
