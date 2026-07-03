import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { usingRedis } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// Readiness probe: can we actually serve traffic? Checks the DB round-trip.
// Returns 503 when a dependency is down so load balancers drain the node.
export async function GET() {
  const checks: Record<string, "ok" | "down"> = {};
  let healthy = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch (e) {
    checks.database = "down";
    healthy = false;
    logger.error("readiness: db check failed", logger.err(e));
  }

  checks.rateLimiter = usingRedis ? "ok" : "ok"; // memory fallback still serves

  return NextResponse.json(
    { status: healthy ? "ready" : "unavailable", redis: usingRedis, checks, ts: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  );
}
