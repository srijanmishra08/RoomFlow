# RoomFlow — Manual Setup & API Keys

Everything you must do **by hand** (accounts, keys, one-off commands) to run RoomFlow
fully. Code is in place for all of these; they stay inert until the env vars are set.

> Copy `.env.example` → `.env` and fill the values below. `.env` is git-ignored.

---

## 1. Required to boot at all

### Database — PostgreSQL (Neon recommended)
1. Create a project at https://neon.tech (free tier fine).
2. Copy the **pooled** connection string.
3. Set `DATABASE_URL="postgresql://...?sslmode=require"`.
4. Push schema + generate client:
   ```bash
   npx prisma db push       # creates tables incl. openings, level, plan, stripe fields
   npx prisma generate
   npm run seed             # optional: demo designer + sample data
   ```
- Demo login after seed: `designer@roomflow.app` / `password123`.

### Auth — NextAuth
- `AUTH_SECRET` — generate: `openssl rand -base64 32`
- `NEXTAUTH_URL` — `http://localhost:3000` (dev) or your prod URL.

---

## 2. Optional integrations (each fully degrades when unset)

### Google OAuth — social login
- Console: https://console.cloud.google.com/apis/credentials → OAuth client (Web).
- Authorized redirect URI: `${NEXTAUTH_URL}/api/auth/callback/google`.
- Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- **Unset →** Google button hidden; credentials login still works.

### Vercel Blob — file uploads (models, renders, assets)
- Vercel dashboard → Storage → Blob → create store. Token auto-injected on Vercel.
- Local: copy `BLOB_READ_WRITE_TOKEN`.
- **Unset →** falls back to local `/uploads` filesystem (dev only).

### Upstash Redis — distributed rate limiting (multinode)
- https://upstash.com → create Redis DB → REST API section.
- Set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- **Unset →** per-instance in-memory rate limiting (fine for single node).

### Stripe — SaaS subscriptions (FREE / PRO / STUDIO)
1. https://dashboard.stripe.com → Developers → API keys → copy **secret** key → `STRIPE_SECRET_KEY`.
2. Products → create "Pro" and "Studio" recurring prices → copy each **price id** (`price_...`):
   - `STRIPE_PRICE_PRO`, `STRIPE_PRICE_STUDIO`.
3. Webhook: Developers → Webhooks → add endpoint `${NEXTAUTH_URL}/api/billing/webhook`,
   events: `checkout.session.completed`, `customer.subscription.created|updated|deleted`.
   Copy the **signing secret** → `STRIPE_WEBHOOK_SECRET`.
4. Local testing: `stripe listen --forward-to localhost:3000/api/billing/webhook`.
- **Unset →** `/api/billing/subscription` returns 503; everyone stays on FREE (plan gating still enforced).

### Email — transactional (invites, notifications)
- `EMAIL_PROVIDER` = `console` (default, logs to stdout) | `resend` | `smtp`.
- Resend: https://resend.com → API key → `RESEND_API_KEY`, verify sending domain, set `EMAIL_FROM`.
- SMTP: set `SMTP_HOST/PORT/SECURE/USER/PASS`.

### Sentry — error monitoring
- https://sentry.io → create project (Next.js) → copy DSN → `SENTRY_DSN`.
- Optional `SENTRY_TRACES_SAMPLE_RATE` (default 0.1).
- **Unset →** `instrumentation.ts` is a no-op; zero overhead.

### PostHog — product analytics
- https://posthog.com → Project Settings → Project API Key → `POSTHOG_KEY`.
- `POSTHOG_HOST` default `https://us.i.posthog.com` (use EU host if applicable).
- **Unset →** `track()` is a no-op.

---

## 3. One-time commands recap

```bash
cp .env.example .env            # then fill values above
npm install                     # .npmrc sets legacy-peer-deps (React 19 peers)
npx prisma db push
npx prisma generate
npm run seed                    # optional demo data
npm run dev                     # http://localhost:3000
```

## 4. Deploy (Vercel)
- Import repo, add all env vars in Project Settings → Environment Variables.
- Build command `next build`, install command `npm install` (`.npmrc` handles peers).
- Add Stripe webhook + Google redirect URIs pointing at the production domain.
- Run `npx prisma db push` against the production DB once (or wire a migration step).

---

## Env var quick reference

| Var | Required | Unset behaviour |
|-----|----------|-----------------|
| `DATABASE_URL` | ✅ | app cannot start |
| `AUTH_SECRET`, `NEXTAUTH_URL` | ✅ | auth broken |
| `GOOGLE_CLIENT_ID/SECRET` | — | Google login hidden |
| `BLOB_READ_WRITE_TOKEN` | — | local FS uploads |
| `UPSTASH_REDIS_REST_URL/TOKEN` | — | in-memory rate limit |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_*`, `STRIPE_WEBHOOK_SECRET` | — | billing 503, FREE only |
| `RESEND_API_KEY` / `SMTP_*` | — | email to console |
| `SENTRY_DSN` | — | no error reporting |
| `POSTHOG_KEY` | — | no analytics |
