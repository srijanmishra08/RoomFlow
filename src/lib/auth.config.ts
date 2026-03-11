import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible auth config — no Node.js-only imports (no Prisma, pg, bcrypt).
 * Used by middleware. The full config with adapter + providers is in auth.ts.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [], // Populated in auth.ts
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      const isOnPortal = pathname.startsWith("/portal");
      const isOnClientPortalApi = pathname.startsWith("/api/client-portal");
      const isAuthRoute =
        pathname.startsWith("/login") ||
        pathname.startsWith("/register") ||
        pathname.startsWith("/api/auth");

      // Allow public routes
      if (isOnPortal || isOnClientPortalApi || isAuthRoute) {
        return true;
      }

      // Protect dashboard
      if (pathname.startsWith("/dashboard") && !isLoggedIn) {
        return false; // Redirects to pages.signIn
      }

      // Protect API (except auth + client portal)
      if (pathname.startsWith("/api") && !isLoggedIn) {
        return false;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
