/** @jest-environment node */
import crypto from "crypto";

// stripe.ts reads env at import time, so configure before requiring it.
describe("stripe.verifyWebhook", () => {
  const SECRET = "whsec_test_secret";

  function load() {
    let mod!: typeof import("@/lib/stripe");
    jest.isolateModules(() => {
      process.env.STRIPE_WEBHOOK_SECRET = SECRET;
      mod = require("@/lib/stripe");
    });
    return mod;
  }

  function sign(payload: string, secret = SECRET, t = 1700000000) {
    const sig = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
    return `t=${t},v1=${sig}`;
  }

  it("returns the parsed event for a valid signature", () => {
    const { verifyWebhook } = load();
    const payload = JSON.stringify({ type: "checkout.session.completed", id: "evt_1" });
    const event = verifyWebhook(payload, sign(payload));
    expect(event).not.toBeNull();
    expect(event.type).toBe("checkout.session.completed");
  });

  it("rejects a tampered payload", () => {
    const { verifyWebhook } = load();
    const payload = JSON.stringify({ type: "x" });
    const header = sign(payload);
    expect(verifyWebhook(payload + "tampered", header)).toBeNull();
  });

  it("rejects a signature made with the wrong secret", () => {
    const { verifyWebhook } = load();
    const payload = JSON.stringify({ type: "x" });
    expect(verifyWebhook(payload, sign(payload, "whsec_wrong"))).toBeNull();
  });

  it("rejects a missing signature header", () => {
    const { verifyWebhook } = load();
    expect(verifyWebhook("{}", null)).toBeNull();
  });
});
