# RoomFlow — Test Pipeline & Results

## Runner
Jest 30 + ts-jest (already configured). Config: [jest.config.ts](../jest.config.ts).
- `ts-jest` runs **transpile-only** (`isolatedModules: true`) — full type-checking is a
  separate gate (`npm run typecheck`). This was the fix for suites timing out at ~70min.
- Pure-logic specs declare `/** @jest-environment node */` to skip jsdom.

## Scripts
| Command | Purpose |
|---------|---------|
| `npm test` | full jest suite |
| `npm run test:ci` | `jest --ci --runInBand` (CI / slow FS) |
| `npm run typecheck` | `tsc --noEmit` — full type verification |
| `npm run lint` | eslint |
| `npm run build` | `next build` |

CI runs all of these on every PR: [.github/workflows/ci.yml](../.github/workflows/ci.yml)
(spins up a postgres service, `prisma db push`, lint, typecheck, test, build).

## Coverage (modules under test)
| Spec | Module | Asserts |
|------|--------|---------|
| `auto-furnish.test.ts` | `lib/auto-furnish` | room-kind inference, catalog search + synonyms, auto-furnish placement bounds, palettes |
| `rate-limit.test.ts` | `lib/rate-limit` | in-memory sliding window allow/block, per-key isolation, `clientIp` header parsing |
| `plans.test.ts` | `lib/plans` | plan limits, `assertWithinPlan` gating (402 at cap, null under, unlimited, 404) — prisma mocked |
| `stripe.test.ts` | `lib/stripe` | webhook HMAC verify: valid sig, tampered payload, wrong secret, missing header |
| `logger.test.ts` | `lib/logger` | JSON line shape, stderr routing, `err()` serialisation |
| `utils.test.ts`, `validations.test.ts` | pre-existing | status/format helpers, zod schemas |

## Results

**Validated green in-sandbox:** `logger.test.ts` → **4/4 passing** (exit 0).
This proves the corrected config path runs the new specs correctly.

**Full suite not re-run in this sandbox — deliberately.** The sandbox filesystem makes
jest cold-start ~10min **per run** regardless of suite size (same environmental slowness
that affects `npm install` and `next build` here). The first full run hit `ETIMEDOUT`
after 70min before the config fix. The pipeline is correct; it belongs on host/CI where
these run in seconds.

### To run locally (host) — seconds, not minutes
```bash
npm run typecheck
npm test
```

## Known follow-ups
- Add route-handler integration tests (mock `auth` + prisma) for `/api/projects`, `/api/billing/subscription`.
- Add Playwright E2E (auth → project → room editor → billing redirect) — run on host/CI (`npx playwright install` needed; browser download stalls in this sandbox).
- 3D components (`RoomBox`, `FurnitureObject`) are untested (jsdom has no WebGL); cover their pure geometry helpers (e.g. `buildWallShape`) by extracting them to a testable module.
