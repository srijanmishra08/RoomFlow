import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Use the edge-compatible auth config (no Prisma/pg/bcrypt).
// Route protection logic lives in authConfig.callbacks.authorized.
const { auth } = NextAuth(authConfig);

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// Endpoints that legitimately receive cross-origin/serverless POSTs.
// Stripe signs its webhook (HMAC verified in-route); Auth.js has its own CSRF.
const CSRF_EXEMPT = [/^\/api\/billing\/webhook/, /^\/api\/auth\//, /^\/api\/health/];

export default auth((req) => {
  // CSRF hardening: same-site cookies are the primary defence; this adds an
  // explicit origin check on state-changing API calls as belt-and-braces.
  if (req.nextUrl.pathname.startsWith("/api/") && MUTATING.has(req.method)) {
    if (!CSRF_EXEMPT.some((re) => re.test(req.nextUrl.pathname))) {
      const origin = req.headers.get("origin") ?? req.headers.get("referer");
      if (origin) {
        try {
          if (new URL(origin).host !== req.nextUrl.host) {
            return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
          }
        } catch {
          return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
        }
      }
    }
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public|uploads).*)"],
};
