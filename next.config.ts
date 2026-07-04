import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // On by default; set REACT_COMPILER=0 to disable for faster local dev startup.
  reactCompiler: process.env.REACT_COMPILER !== "0",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Transpile Three.js packages
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          // Next.js needs inline/eval in dev; WebGL/three is same-origin.
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "connect-src 'self' https: blob:",
          "worker-src 'self' blob:",
          "frame-ancestors 'self'",
          "object-src 'none'",
          "base-uri 'self'",
        ].join("; "),
      },
    ];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// withSentryConfig is a no-op wrapper unless SENTRY_AUTH_TOKEN/org/project are
// configured for source-map upload; safe to apply unconditionally.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: false,
});
