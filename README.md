# RoomFlow

Browser-based interior-design platform — a Foyr Neo–style competitor. Draw floor
plans, drop in furniture, apply real-time materials, render photorealistic
stills and 360° panoramas, and run a full studio: client portal, quotes,
invoices, tasks, team roles, and billing — all in the browser.

## Stack

- **Next.js 16** (App Router) + **React 19**, TypeScript
- **Prisma 7** + **PostgreSQL** (Neon in production)
- **Auth.js v5** (credentials + Google OAuth)
- **Three.js** via `@react-three/fiber` / `@react-three/drei` for the 3D editor
- **Vercel Blob** for file storage, **Upstash Redis** for rate limiting
- **Stripe** for billing, **Sentry** + **PostHog** for observability

## Features

- **3D room editor** — polygon & preset floor shapes, drag/rotate/scale gizmos,
  multi-select + group move, undo/redo, copy/paste, edge/wall snapping,
  measurement tool
- **Furniture catalog** — procedural mesh furniture (no GLB required),
  category browser, AI-assisted auto-furnish, style restyle
- **Materials** — procedural PBR texture library (wood, marble, tile, brick,
  concrete, fabric) for floor/wall/ceiling, plus flat color
- **Doors & windows** — real wall cutouts with glass/frame trim, draggable
  directly on the 2D floor plan
- **Rendering** — snapshot / 1080p / 4K stills, 360° equirectangular panorama
  capture, saved render gallery
- **Revisions** — 3D file upload, floor-plan-image → 3D, render-image → 3D
- **Studio ops** — client portal (approvals, comments, quotes), invoices,
  task board, project drive, activity timeline, saved camera views
- **Team & billing** — Assistant/Viewer roles per studio, FREE/PRO/STUDIO plan
  tiers with server-side gating, Stripe checkout + webhook
- **Hardening** — per-resource ownership authz, CSRF origin checks, Redis rate
  limiting, CSP/HSTS headers, Sentry + PostHog, CI (typecheck/lint/test/build)

## Local development

```bash
cp .env.example .env      # set DATABASE_URL + AUTH_SECRET at minimum
npm install
npm run db:push           # create schema
npm run db:seed           # optional demo data
npm run dev                # http://localhost:3000
```

Registering a new account seeds a sample project + furnished room automatically.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` / `npm run test:ci` | Jest unit tests |
| `npm run test:e2e` | Playwright E2E (`npx playwright install` first) |
| `npm run db:push` / `db:migrate` / `db:studio` / `db:seed` | Prisma workflows |

## Docs

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — full production deployment guide (services, env vars, checklist)
- [`docs/ROADMAP_REMAINING.md`](docs/ROADMAP_REMAINING.md) — feature status vs Foyr Neo, what's left
- [`docs/FOYR_TEARDOWN_AND_PLAN.md`](docs/FOYR_TEARDOWN_AND_PLAN.md) — competitive teardown that shaped this build
