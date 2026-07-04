# RoomFlow — Industrial-Scale Completion Plan

_2026-07-04. Owner: Fable (orchestrator) + Sonnet sub-agents (execution)._

## A. Not done yet (gap list)

### Needs code (this session, agent-assignable)
1. **UI/UX professionalization** — emoji icons everywhere (🛋️📐📸🖼️⧉↶↷🧲📏 + sidebar), childish look. Replace with a professional inline-SVG icon system, consistent toolbar, spacing/typography pass.
2. **Bug: revision "Current" restore is a no-op** — viewing a revision overwrites `room.modelUrl`; clicking Current/deleting revision runs `setRoom(prev=>({...prev}))` which restores nothing.
3. **Bug: double undo entries per gizmo drag** — commit fires `onMove` (history push) then `onTransform` (second push) → ⌘Z needs two presses.
4. **Bug: nudge/group-follower moves skip the undo stack** — arrow-key nudges and multi-select follower moves are not undoable.
5. **Bug: render menu doesn't close on outside click.**
6. **Next 16 deprecation** — `middleware.ts` convention deprecated in favor of `proxy.ts` (build warning).
7. **Landing page + dashboard visual polish** — feature cards, stat cards, empty states.
8. Sentry `disableLogger` deprecation warning in next.config.

### Needs external services (browser/cowork — user must be logged in)
9. **Upstash Redis** (rate limiting multi-node) → env: UPSTASH_REDIS_REST_URL/TOKEN
10. **Sentry project** → SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN
11. **PostHog** → POSTHOG_KEY
12. **Stripe live/test keys + products + webhook** → STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO/STUDIO
13. **Google OAuth client** → AUTH_GOOGLE_ID/SECRET
14. **Custom domain** on Vercel

### Needs infra beyond this repo (roadmap, not this session)
15. GPU path-traced render queue (Modal/Replicate worker + QStash)
16. Real-time multiplayer (Liveblocks / y-websocket)
17. Real GLB furniture catalog at scale (asset licensing/supplier feeds)
18. Embedding-based semantic search (pgvector + embeddings API)
19. Load testing, WCAG audit, SOC2-style ops hardening

## B. Step-by-step to "sellable"

**Phase S1 (now, agents):** bugs #2–#6 fixed + UI overhaul #1/#7 → push → Vercel green → smoke test.
**Phase S2 (now, browser):** service setups #9–#12 where user is logged in; write env vars to Vercel; redeploy.
**Phase S3 (user, ~30min):** Google OAuth + domain + Stripe live-mode checkout test.
**Phase S4 (post-launch roadmap):** #15–#19 in revenue order: catalog scale → render queue → multiplayer.

## C. Execution protocol
- Sonnet agents; bounded file scopes; no `tsc`/`jest` locally (sandbox stalls) — type discipline + Vercel build is the gate.
- Agent 1 (bugs): `src/app/dashboard/projects/[id]/rooms/[roomId]/page.tsx`, `src/components/three/FurnitureObject.tsx`, `src/middleware.ts→proxy.ts`, `next.config.ts`.
- Agent 2 (UI, non-editor): `src/components/Sidebar.tsx`, `src/app/page.tsx`, `src/app/dashboard/page.tsx`, projects list/detail, settings, new `src/components/icons.tsx`.
- Agent 3 (UI, editor toolbar) after Agent 1 lands (same file).
- Fable reviews diffs, commits, pushes, verifies Vercel build + live smoke.
