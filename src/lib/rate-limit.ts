// Rate limiting that works on multinode/serverless.
//
// Backend selection:
//   - If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, uses a
//     shared Redis fixed-window counter (INCR + EXPIRE) — correct across many
//     instances behind a load balancer.
//   - Otherwise falls back to a per-instance in-memory sliding window. Fine for
//     a single node / local dev; NOT correct across replicas.
//
// Redis access uses the Upstash REST API directly via fetch — no TCP client,
// no connection pool, no extra dependency. Works in edge & node runtimes.

import { NextRequest, NextResponse } from "next/server";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
export const usingRedis = Boolean(REDIS_URL && REDIS_TOKEN);

// ─── Upstash REST pipeline ────────────────────────────────────
// One round-trip: INCR the window key, and EXPIRE it on first hit.
async function redisFixedWindow(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const windowSec = Math.ceil(windowMs / 1000);
  const bucket = Math.floor(Date.now() / windowMs); // discrete window id
  const redisKey = `rl:${key}:${bucket}`;

  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, windowSec, "NX"],
    ]),
    // Never let a limiter outage wedge a request for long.
    signal: AbortSignal.timeout(1500),
  });

  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const data = (await res.json()) as Array<{ result: number }>;
  const count = data[0]?.result ?? 0;

  if (count > limit) {
    const elapsed = Date.now() - bucket * windowMs;
    return { ok: false, remaining: 0, retryAfterMs: windowMs - elapsed };
  }
  return { ok: true, remaining: Math.max(0, limit - count), retryAfterMs: 0 };
}

// ─── In-memory sliding window (fallback) ──────────────────────
const buckets = new Map<string, number[]>();

function memorySlidingWindow(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const arr = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return { ok: false, remaining: 0, retryAfterMs: arr[0] + windowMs - now };
  }
  arr.push(now);
  buckets.set(key, arr);
  maybeCleanup(windowMs);
  return { ok: true, remaining: limit - arr.length, retryAfterMs: 0 };
}

let cleanupCounter = 0;
function maybeCleanup(windowMs: number) {
  if (++cleanupCounter % 500 !== 0) return;
  const cutoff = Date.now() - windowMs;
  for (const [k, v] of buckets) {
    const kept = v.filter((t) => t > cutoff);
    if (kept.length) buckets.set(k, kept);
    else buckets.delete(k);
  }
}

// ─── Public API ───────────────────────────────────────────────

/** Allow `limit` requests per `windowMs` for `key`. Async (Redis when configured). */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (usingRedis) {
    try {
      return await redisFixedWindow(key, limit, windowMs);
    } catch {
      // Fail open to in-memory rather than blocking all traffic on a Redis blip.
      return memorySlidingWindow(key, limit, windowMs);
    }
  }
  return memorySlidingWindow(key, limit, windowMs);
}

/** Best-effort client IP from proxy headers. */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Guard a route. Returns a 429 NextResponse when the limit is exceeded, else null.
 *   const limited = await enforceRateLimit(req, "upload", 30, 60_000);
 *   if (limited) return limited;
 */
export async function enforceRateLimit(
  req: NextRequest,
  scope: string,
  limit: number,
  windowMs: number
): Promise<NextResponse | null> {
  const { ok, retryAfterMs, remaining } = await rateLimit(`${scope}:${clientIp(req)}`, limit, windowMs);
  if (ok) return null;
  return NextResponse.json(
    { error: "Too many requests. Slow down." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
        "X-RateLimit-Remaining": String(remaining),
      },
    }
  );
}
