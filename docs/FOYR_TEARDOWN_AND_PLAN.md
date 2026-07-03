# RoomFlow vs Foyr Neo — Reverse-Engineering Teardown & Dev Plan

_Last updated: 2026-06-24_

## 1. What Foyr Neo actually is

Foyr Neo is a **browser-based interior-design platform**. Its pitch: do in minutes
what CAD tools take months for, with no local install. Reverse-engineered feature set:

| Pillar | Foyr Neo capability | Notes |
|---|---|---|
| Floor planning | Draw 2D walls/rooms, import a blueprint/sketch/CAD and trace over it | Snap-to-grid, dimensions |
| 2D → 3D | One-click switch from 2D plan to a walkable 3D model | Auto-extrude walls |
| Furniture catalog | 60,000+ render-ready 3D models, drag-and-drop, AI search | The core moat |
| Materials | Apply colors, textures, finishes to floor/wall/ceiling and objects | Live preview |
| Rendering | Cloud photorealistic 4K renders + 360° walkthroughs in minutes | GPU render farm |
| AI | 2D image → 3D model, AI room suggestions, AI restyle of renders | LLM + diffusion |
| Collaboration | Share, client review | Lighter than RoomFlow's portal |
| Pricing | ~$49/mo single seat | SaaS subscription |

## 2. What RoomFlow already has (this repo)

RoomFlow is **further along than a clone-from-scratch** and in some areas *beyond*
Foyr (full client-portal / studio-ops layer Foyr lacks):

- **Stack:** Next.js 16 (App Router) + React 19, Prisma 7 + PostgreSQL, Auth.js v5
  (credentials + Google), Vercel Blob storage, Three.js via `@react-three/fiber`.
- **Domain model:** Designer / Client / Project / Room / RoomObject / Revision /
  Asset / Quotation / Invoice / Task / DriveItem / SavedView / Approval / Activity.
- **3D room editor:** polygon & preset floor shapes, floor/wall/ceiling materials,
  object inspector (move/rotate/scale/status/cost), saved camera views, revisions
  (3D upload, floor-plan→3D, render→3D pipelines), GLB import.
- **Studio ops Foyr doesn't have:** client portal with approvals & comments,
  quotations, invoices/billing, task board, project drive, activity timeline,
  notifications, email.

## 3. The real gap vs Foyr (priority order)

1. **Built-in furniture catalog + drag/drop** — Foyr's headline. RoomFlow required
   you to upload your own GLBs; un-modeled objects were a grey box.
   → **DONE tonight:** `lib/furniture-catalog.ts` (24 items, 9 categories) +
   `components/three/ProceduralFurniture.tsx` (real grouped-mesh models, no GLB) +
   a Catalog browser in the room editor (click-to-place, auto-priced).
2. **2D floor-plan drawing canvas** — draw walls by clicking, snap to grid, set
   dimensions, then extrude to 3D. (Presets exist; freehand draw is the next build.)
3. **In-scene gizmo manipulation** — drag furniture in the 3D view (currently
   numeric inspector). `@react-three/drei` `<TransformControls>` / `<PivotControls>`.
4. **Photorealistic render** — Foyr's cloud 4K. MVP: high-quality client-side
   render (drei `<AccumulativeShadows>` + env lighting + `gl.render` to PNG); later
   a real GPU path-tracer (three-gpu-pathtracer) or a render queue worker.
5. **AI features** — AI furniture search (semantic over catalog), AI "design this
   room" (auto-place a sensible layout), 2D photo → 3D (already stubbed in revisions).

## 4. Architecture for scale & security (target state)

- **Frontend:** Next.js App Router, RSC for data pages, client islands for the 3D
  canvas. Code-split the Three viewer (already `dynamic({ ssr:false })`).
- **API:** Route handlers today; extract heavy/async work (render, AI, 2D→3D) to a
  **queue + worker** (e.g. Vercel Queue / BullMQ + Redis) so requests stay fast.
- **DB:** Postgres (Neon for serverless). Add indexes on hot paths (done for most
  models). Use row-level ownership checks on every handler (see §5).
- **Storage:** Vercel Blob for GLB/renders/uploads; signed URLs.
- **Caching/CDN:** static catalog + thumbnails on CDN; render outputs immutable.
- **Observability:** structured logs + error boundary (present) + add Sentry.

## 5. Security checklist (must-hold invariants)

- [x] Auth on every API route (`auth()` guard present).
- [ ] **Ownership authorization** — verify the signed-in user owns the
  project/room/object before read/write (some routes check session but not
  ownership). _Highest-priority hardening item._
- [x] Zod validation on all mutating routes.
- [ ] Rate-limit auth + upload + AI endpoints.
- [ ] Validate uploaded file type/size server-side; scan/whitelist GLB.
- [x] Secrets in env, not committed (`.env` git-ignored; `.env.example` provided).
- [ ] CSRF: rely on same-site cookies + Auth.js; add explicit checks on mutations.
- [ ] Set security headers (CSP allowing blob: and the 3D worker, HSTS) in
  `next.config.ts`.

## 6. Build roadmap (sequenced)

**Phase 1 — Catalog (DONE):** procedural furniture library + browser + click-place.

**Phase 2 — Direct manipulation:** drag/rotate gizmos in 3D; grid snap; collision
with walls; keyboard nudge; multi-select.

**Phase 3 — 2D plan editor:** click-to-draw walls, dimensions, doors/windows,
extrude to 3D; import blueprint image as a trace underlay.

**Phase 4 — Rendering:** client high-quality render to PNG; saved render gallery;
later GPU path-tracer + async render queue.

**Phase 5 — AI:** semantic catalog search; "auto-furnish this room" layout; restyle.

**Phase 6 — Hardening:** ownership checks everywhere, rate limits, CSP headers,
upload validation, Sentry, E2E tests (Playwright) on the critical flow.

## 7. How to run

```bash
cd roomflow
cp .env.example .env          # set DATABASE_URL (Neon/local PG) + AUTH_SECRET
npm install
npm run db:push               # create schema
npm run db:seed               # demo data (if seed present)
npm run dev                   # http://localhost:3000
```
Open a project → room → **🛋️ Catalog** → click furniture to place it in 3D.
