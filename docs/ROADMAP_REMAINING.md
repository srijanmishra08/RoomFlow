# RoomFlow — Remaining Feature Roadmap

_Last updated: 2026-07-04._ Status after Phases 1–12 (catalog, manipulation, 2D plan,
render, AI assist, hardening, infra, editor parity, collaboration, quality/ops).
Gap analysis vs Foyr Neo + SaaS production-readiness. `[x]` = built and reviewed
in this repo; a trailing "(host)" note means it needs a config/service the
developer runs, not more code.

## Phase 7 — Infra & scale (mostly done)
- [x] Redis-backed rate limiting (Upstash REST, fixed-window INCR+EXPIRE; in-memory fallback; fail-open). Zero new deps.
- [ ] Distributed session/cache layer
- [ ] Background job queue for renders (BullMQ / QStash) — deferred, needs a worker host
- [ ] CDN + signed URLs for blob assets
- [x] DB connection pooling tuned for serverless (PrismaPg adapter: max 5, 5s connect / 10s idle timeouts)
- [x] Health/readiness endpoints (/api/health liveness, /api/health/ready DB probe → 503) + structured JSON logger (lib/logger.ts)

## Phase 8 — Rendering depth (match Foyr 4K/360)
- [ ] Server GPU path-traced render queue (async, emailed when ready) — deferred, needs GPU worker infra
- [x] Resolution presets (1080p / 4K) — client-side high-res capture via off-screen resize + re-render, RoomViewer `CaptureFn`
- [x] 360° panorama capture — CubeCamera → 6-face equirectangular remap on canvas, `renderEquirect()` in RoomViewer.tsx
- [ ] Render history versioning per revision (renders currently tag by roomId only)

## Phase 9 — Editor UX parity (done)
- [x] Object rotation + scale gizmos (Move/Rotate/Scale toolbar, snap)
- [x] Undo stack (⌘Z) for move/transform
- [x] Redo (⌘⇧Z), inverse-snapshot stack invalidated on new edit
- [x] Doors & windows: real wall cutouts (THREE.Shape holes), glass/door-slab/frame trim, per-wall openings editor panel. Schema `Room.openings` Json, validated, persisted.
- [x] Doors & windows: drag-to-slide along the wall directly in the 2D FloorPlanEditor (not just numeric sliders)
- [x] Multi-floor projects: Room.level field, floor input on create, floor-switcher tabs (All / Ground / Floor N / Bn) filtering the room grid
- [x] Snapping (edge/center/wall, 🧲 toggle, lib/editor-tools.ts, unit-tested) + 📏 two-point floor measurement tool
- [x] Copy/paste (⌘C/⌘V), duplicate (⌘D) objects with full field clone + nudge
- [x] Multi-select (shift-click, ⌘A), group move via gizmo delta, arrow-key nudge (shift = 0.5m step), bulk delete/duplicate, Escape to clear
- [x] PBR material/texture library — procedural canvas maps (oak/walnut/herringbone/marble/tile/linen/concrete/brick) in lib/pbr-textures.ts, wired to floor/wall/ceiling with correct tiling

## Phase 10 — Catalog & content
- [ ] Expand catalog (hundreds of items, real GLB models) — current catalog is procedural mesh, 24 items/9 categories
- [ ] Catalog import from supplier feeds
- [ ] AI semantic search via embeddings (replace token match) — `auto-furnish.ts` currently does token/keyword matching
- [ ] User-uploaded model library mgmt + thumbnails

## Phase 11 — Collaboration & business (mostly done)
- [ ] Real-time multiplayer editing (presence, cursors) via WS/Liveblocks — deferred, needs WS infra
- [x] Client portal: approvals (`/api/client-portal/[projectId]/approvals`), comments, quotes (`/api/client-portal/[projectId]/quote`) — all built
- [x] Team roles & permissions: TeamMember model (ASSISTANT edit / VIEWER read), authz.ts team-aware, /api/settings/team CRUD + Settings UI. **Needs `prisma db push` (host).**
- [x] Billing: plan tiers (FREE/PRO/STUDIO) with server-side gating (lib/plans.ts: project/room limits enforced 402), dependency-free Stripe checkout + webhook (lib/stripe.ts, fetch + HMAC sig verify), Designer.plan/stripe fields. **Needs live Stripe keys to transact (host).**
- [x] Project duplication / templates: deep-clone (rooms + objects + materials/openings) in one transaction, plan-gated, ⧉ Duplicate button
- [x] New-designer onboarding: register now seeds a demo project + furnished Living Room so the dashboard isn't empty on first login

## Phase 12 — Quality & ops (mostly done)
- [x] Playwright E2E scaffold: `playwright.config.ts` + `e2e/core-flows.spec.ts` (register → login → sample project → room editor). **Needs `npx playwright install` (host) before running.**
- [x] Sentry error monitoring — instrumentation.ts (server) + instrumentation-client.ts (browser) + `withSentryConfig` in next.config.ts for source-map upload. All env-gated inert.
- [x] Analytics (PostHog server-side track()/flush helper, env-gated no-op, wired to project_created) — posthog-node installed
- [x] CI pipeline: `.github/workflows/ci.yml` — typecheck, lint, unit tests, Prisma db push + build against a Postgres service container
- [ ] Accessibility audit (WCAG 2.2)
- [ ] Load testing + autoscaling validation

## Phase 13 — Hardening (this session)
- [x] CSRF: same-site cookies (existing) + explicit origin/referer check on mutating `/api/*` requests in `src/middleware.ts` (Stripe webhook + NextAuth routes exempted)
- [x] Team-aware ownership checks: `lib/authz.ts` now resolves accessible designer ids (own studio + ASSISTANT/VIEWER memberships) instead of single-owner-only
- [x] Upload validation confirmed: server-side extension whitelist + 50MB size cap already enforced in `/api/upload`

## Priority order (remaining)
1. `prisma db push` + `next build` on host, run E2E, deploy — see `docs/DEPLOYMENT.md`.
2. Phase 10 catalog scale (real GLB models, supplier import, embeddings) — biggest remaining Foyr content gap.
3. Phase 8 GPU render queue + Phase 11 multiplayer — premium/collab differentiators, both need external infra.
4. Phase 12 a11y audit + load testing — ongoing hardening.
