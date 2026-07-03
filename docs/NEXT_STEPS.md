# RoomFlow — Next Steps (post-install session)

State as of this session: network/installs unblocked, observability + Stripe SDK in,
schema extended (openings, level, plan). This doc is the plan for the next dev session.

## Status snapshot

**Done (code present, see ROADMAP_REMAINING.md for full list):**
- Editor: redo, doors/windows (real wall cutouts), copy/paste/duplicate, multi-floor switcher, gizmos.
- Infra: Redis rate limiting, pooling, health/ready endpoints, structured logger.
- SaaS: plan tiers + server-side gating, Stripe checkout+webhook, project duplication.
- Observability: Sentry instrumentation, PostHog server analytics (env-gated).

**Verified this session:** see TEST_RESULTS.md (unit tests + typecheck).

## Blockers resolved
- npm installs: `.npmrc` (legacy-peer-deps). Batched installs complete in ~7min in-sandbox.
- Prisma client regenerated for new fields.

## Blockers remaining (need host / external services)
| Item | Why blocked | Resolution |
|------|-------------|------------|
| `@pascal-app/core` runtime import error | extensionless ESM imports, bundler-only | use only inside Next bundler & test; or port the `wall`/`material-library` logic instead of depending |
| Playwright browsers | postinstall downloads ~150MB, stalls in sandbox | install on host: `npx playwright install` |
| `next build` full verify | reactCompiler very slow in sandbox | run build on host/CI |
| GPU path-traced render | needs GPU worker infra | external service (e.g. modal/replicate) |

## Priority queue — next session

### P0 — make it provably runnable
1. Run `prisma db push` + `next build` on host; fix any type/build errors surfaced. (db push still pending — TeamMember table added 2026-07-03)
2. ~~Wire Sentry into `next.config.ts` via `withSentryConfig`~~ DONE (src-map upload env-gated via SENTRY_ORG/PROJECT/AUTH_TOKEN).
3. ~~Add `instrumentation-client.ts` for browser-side Sentry~~ DONE (NEXT_PUBLIC_SENTRY_DSN-gated, replay on error only).

### P1 — finish editor parity (Foyr gap)
4. ~~Group / multi-select objects~~ DONE (shift-click, ⌘A, group gizmo move via delta, arrow nudge, bulk delete/duplicate).
5. ~~PBR material library~~ DONE (lib/pbr-textures.ts procedural canvas maps; 8 materials; RoomBox map/bump/roughness).
6. ~~3D snapping + measurement~~ DONE (lib/editor-tools.ts snapToNeighbours edges/centers/walls + unit tests; 📏 two-point measure overlay; 🧲 toggle).
7. Doors/windows: 2D plan editing of openings (drag along wall in FloorPlanEditor), not just panel sliders. (remaining)

### P2 — collaboration & content
8. ~~Team roles & permissions~~ DONE (TeamMember model + team-aware authz.ts + /api/settings/team + Settings UI). Read-only routes may opt in viewers via `{ write: false }`.
9. Real-time multiplayer (presence + cursors). Evaluate Liveblocks vs y-websocket. Needs WS infra.
10. Catalog scale: real GLB models, supplier import, embedding-based search (pgvector + OpenAI/embeddings).

### P3 — render depth & ops
11. Background render queue (QStash or BullMQ+Redis) → async high-res render, email when ready.
12. Resolution presets (1080p/4K), 360° panorama capture, render versioning per revision.
13. CI pipeline (GitHub Actions): typecheck + lint + vitest + build + Playwright.
14. Playwright E2E across core flows (auth, project CRUD, room editor, billing redirect).
15. a11y audit (WCAG 2.2), load testing.

## Architecture decisions to make next session
- Adopt `@pascal-app/viewer` wholesale vs keep custom RoomViewer? (peer: three@0.184 pin). Lean: keep custom, cherry-pick logic.
- Splat capture (supersplat / `@playcanvas/splat-transform`) for real-room scan import — separate viewer route, PlayCanvas engine. Defer unless prioritized.
- Render queue host: serverless (QStash) vs dedicated worker.

## Definition of done for "v1 launchable"
- [ ] Host build green + deployed to Vercel
- [ ] Stripe live mode tested end-to-end (checkout → webhook → plan upgrade)
- [ ] E2E green on core flows
- [ ] Sentry + PostHog receiving events in prod
- [ ] Seed/onboarding flow for a new designer
