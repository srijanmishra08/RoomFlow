# RoomFlow Build Checklist

Tracking remaining phases to close Foyr gap. Check off as landed.

## Phase 1 — Furniture catalog (DONE)
- [x] Built-in catalog `furniture-catalog.ts` (24 items, 9 categories)
- [x] Procedural 3D furniture meshes (no GLB needed)
- [x] Catalog panel + add-from-catalog in editor

## Phase 2 — In-scene manipulation (DONE)
- [x] Drag-to-move furniture (drei TransformControls)
- [x] Optimistic move + PATCH persistence

## Phase 3 — 2D floor-plan editor (DONE)
- [x] Interactive SVG floor-plan editor (drag/add/delete vertices)
- [x] Edge dimensions + area, snap, presets
- [x] Writes floorPoints → live 3D extrude

## Phase 4 — Rendering (DONE)
- [x] Capture 3D canvas → PNG (preserveDrawingBuffer + CaptureBridge)
- [x] "📸 Render" button in viewer toolbar
- [x] POST render to gallery (uploaded as Asset, category=render, tag=roomId)
- [x] Render gallery thumbnails + download
- [x] Instant download + antialias on capture

## Phase 5 — AI assist (DONE)
- [x] Semantic catalog search (synonym-expanded token scoring)
- [x] "✨ Auto-furnish" (room-kind recipes, bounds-clamped placement)
- [x] Restyle (5 palettes, kind→role colour mapping, bulk PATCH)

## Phase 6 — Hardening (DONE)
- [x] Ownership authz helper `lib/authz.ts` (assertProject/Room/ObjectOwner)
- [x] Applied to objects PATCH/DELETE, object comments, room objects GET/POST (closed IDOR)
- [x] Rate limiting `lib/rate-limit.ts` → upload, register, object-create
- [x] CSP + security headers (next.config.ts headers())
- [x] Upload validation (size 50MB + extension allowlist, pre-existing)
- [x] Routes Zod-validated (existing schemas)

## Verification notes
- Build not run in sandbox (network-blocked). All edits strict-TS coded.
- In-memory rate limiter is per-instance; swap for Redis on multi-node.
- CSP allows 'unsafe-eval' (Next dev + three). Tighten with nonces later.
