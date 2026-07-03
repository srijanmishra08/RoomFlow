// Browser-side Sentry. Loaded by Next.js on client bootstrap. Inert unless
// NEXT_PUBLIC_SENTRY_DSN is set, mirroring the server-side gate in
// instrumentation.ts.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    environment: process.env.NODE_ENV,
    // Session replay only on errors; keeps quota + privacy cost low.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5,
  });
}

// Instruments client-side navigations (App Router).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
