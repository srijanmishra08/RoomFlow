/** @jest-environment node */
import { rateLimit, clientIp, usingRedis } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

// No Upstash env in tests → exercises the in-memory sliding-window path.
describe("rate-limit (in-memory)", () => {
  it("uses the memory fallback when Redis is unconfigured", () => {
    expect(usingRedis).toBe(false);
  });

  it("allows up to the limit then blocks", async () => {
    const key = `test-${Math.random()}`;
    const a = await rateLimit(key, 2, 1000);
    const b = await rateLimit(key, 2, 1000);
    const c = await rateLimit(key, 2, 1000);
    expect(a.ok).toBe(true);
    expect(a.remaining).toBe(1);
    expect(b.ok).toBe(true);
    expect(b.remaining).toBe(0);
    expect(c.ok).toBe(false);
    expect(c.remaining).toBe(0);
    expect(c.retryAfterMs).toBeGreaterThan(0);
  });

  it("keeps separate counters per key", async () => {
    const k1 = `k1-${Math.random()}`;
    const k2 = `k2-${Math.random()}`;
    await rateLimit(k1, 1, 1000);
    const second = await rateLimit(k2, 1, 1000);
    expect(second.ok).toBe(true);
  });

  describe("clientIp", () => {
    const reqWith = (headers: Record<string, string>) =>
      ({ headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } } as unknown as NextRequest);

    it("takes the first x-forwarded-for entry", () => {
      expect(clientIp(reqWith({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
    });

    it("falls back to x-real-ip then unknown", () => {
      expect(clientIp(reqWith({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
      expect(clientIp(reqWith({}))).toBe("unknown");
    });
  });
});
