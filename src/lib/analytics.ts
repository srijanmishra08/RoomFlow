import { PostHog } from "posthog-node";
import { logger } from "@/lib/logger";

// Server-side product analytics. Inert (no-op) unless POSTHOG_KEY is set, so
// dev and unconfigured deploys never block on a network call.

const KEY = process.env["POSTHOG_KEY"] ?? "";
const HOST = process.env["POSTHOG_HOST"] ?? "https://us.i.posthog.com";

let client: PostHog | null = null;
function getClient(): PostHog | null {
  if (!KEY) return null;
  if (!client) {
    client = new PostHog(KEY, { host: HOST, flushAt: 1, flushInterval: 0 });
  }
  return client;
}

/** Fire-and-forget event capture. Failures are logged, never thrown. */
export function track(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): void {
  const c = getClient();
  if (!c) return;
  try {
    c.capture({ distinctId, event, properties });
  } catch (e) {
    logger.warn("analytics capture failed", { event, ...logger.err(e) });
  }
}

/** Flush pending events — call before a serverless function returns. */
export async function flushAnalytics(): Promise<void> {
  if (!client) return;
  try {
    await client.flush();
  } catch {
    /* best-effort */
  }
}
