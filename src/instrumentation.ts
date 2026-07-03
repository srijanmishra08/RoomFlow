// Next.js instrumentation hook. Sentry initialises here for server + edge
// runtimes, but only when SENTRY_DSN is set — otherwise it's fully inert so
// local/dev and unconfigured deploys pay no cost.

export async function register() {
  if (!process.env["SENTRY_DSN"]) return;

  const Sentry = await import("@sentry/nextjs");
  const common = {
    dsn: process.env["SENTRY_DSN"],
    tracesSampleRate: Number(process.env["SENTRY_TRACES_SAMPLE_RATE"] ?? 0.1),
    environment: process.env["NODE_ENV"],
  };

  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    Sentry.init(common);
  }
  if (process.env["NEXT_RUNTIME"] === "edge") {
    Sentry.init(common);
  }
}

// Captures errors thrown in App Router server components / route handlers.
export async function onRequestError(...args: unknown[]) {
  if (!process.env["SENTRY_DSN"]) return;
  const Sentry = await import("@sentry/nextjs");
  const capture = (Sentry as { captureRequestError?: (...a: unknown[]) => unknown })
    .captureRequestError;
  return capture?.(...args);
}
