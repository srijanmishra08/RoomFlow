# RoomFlow — Production Deployment Guide

Target: Vercel (app) + Neon (Postgres) + Vercel Blob (files) + Upstash (rate limit)
+ Stripe (billing) + Sentry/PostHog (observability). All integrations are
env-gated: anything left unset degrades gracefully (no crash, feature inert).

## 1. One-time service setup (your side)

| Service | What to create | Env vars |
|---|---|---|
| **Neon** (neon.tech) | Project + database. Copy the *pooled* connection string. | `DATABASE_URL` |
| **Auth secret** | `openssl rand -base64 32` | `AUTH_SECRET` |
| **Google OAuth** (console.cloud.google.com) | OAuth client, redirect `https://<domain>/api/auth/callback/google` | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` |
| **Vercel Blob** | Add Blob store to the Vercel project (auto-injects token) | `BLOB_READ_WRITE_TOKEN` |
| **Upstash Redis** (upstash.com) | REST database | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **Stripe** (dashboard.stripe.com) | 2 products (Pro, Studio) with monthly prices; webhook endpoint `https://<domain>/api/billing/webhook` with `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_STUDIO` |
| **Sentry** (sentry.io) | Next.js project | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`; optional source maps: `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` |
| **PostHog** (posthog.com) | Project API key | `POSTHOG_KEY`, `POSTHOG_HOST` |
| **Email** | Resend API key (or SMTP) | `RESEND_API_KEY` (or `SMTP_*`), `EMAIL_PROVIDER` |

Also set `NEXTAUTH_URL=https://<your-domain>`.

## 2. Deploy steps

```bash
# 0. Push the repo to GitHub (CI at .github/workflows/ci.yml runs typecheck/lint/test/build)
# 1. Import repo into Vercel; framework auto-detected (Next.js 16)
# 2. Add all env vars above in Vercel → Settings → Environment Variables
# 3. Apply schema to Neon (from your machine):
DATABASE_URL="<neon-url>" npx prisma db push
# 4. Deploy (first push to main). Vercel builds with `npm run build`.
# 5. Smoke-check:
curl https://<domain>/api/health          # {"status":"ok"}
curl https://<domain>/api/health/ready    # DB probe, 200
```

### Stripe live-mode test
1. Register an account → Dashboard → Billing → Upgrade to Pro.
2. Complete checkout with a live card (or 100%-off promo code).
3. Verify webhook: Stripe dashboard → webhook deliveries → 200; Designer.plan flips to PRO.

## 3. Post-deploy checklist

- [ ] `prisma db push` ran against Neon (includes `TeamMember` table)
- [ ] Health endpoints green
- [ ] Register → sample project seeded → room editor loads (WebGL)
- [ ] Upload a GLB (validates type/size server-side, stores in Blob)
- [ ] 📸 Render (snapshot / 1080p / 4K / 360°) saves to gallery
- [ ] Stripe checkout → webhook → plan upgrade
- [ ] Sentry receives a test error (`/api/does-not-exist` 404s are fine; throw in a route to verify)
- [ ] PostHog shows `project_created` events
- [ ] Rate limiting live (Upstash) — hammer `/api/auth/register` → 429

## 4. E2E on host

```bash
npx playwright install          # one-time browser download
npm run test:e2e                # runs e2e/core-flows.spec.ts against dev server
E2E_BASE_URL=https://<domain> npm run test:e2e   # against prod
```

## 5. Known deferred items (need infra beyond this repo)

- GPU path-traced render farm (client-side 4K/360° capture ships now; queue + worker later — QStash/BullMQ + a GPU host like Modal/Replicate)
- Real-time multiplayer (Liveblocks/y-websocket; needs WS infra)
- Catalog GLB assets at Foyr scale (supplier feeds / asset licensing)
- Embedding-based semantic catalog search (pgvector + embeddings API key)

## 6. Security posture (implemented)

- Session auth on every API route; per-resource ownership (`lib/authz.ts`), team-aware (ASSISTANT write / VIEWER read)
- Zod validation on all mutating routes; server-side upload type/size whitelist
- Redis-backed rate limits (fail-open, in-memory fallback)
- CSP + HSTS + X-Frame-Options etc. in `next.config.ts`
- CSRF: same-site cookies + explicit origin check on mutating `/api/*` (middleware); Stripe webhook exempt (HMAC-verified instead)
- Secrets only via env; `.env` git-ignored
