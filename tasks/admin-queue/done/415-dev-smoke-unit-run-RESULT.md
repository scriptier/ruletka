# 415 — Run mobile unit smoke, fix one broken test if any

## Status
PASS — all unit tests green already; nothing broken, no fix needed.

## Verify commands run
- `cd mobile && npm test` (test-friend-invite + test-geo-localize + test-live-units) → all passed
- `./scripts/dev-smoke.sh --unit` (repo root) → `=== dev-smoke PASS (unit only) ===`
  (covers test-friend-invite, test-geo-localize, and every `*.test.mjs` unit
  step wired into dev-smoke, including giftFxHold.test.mjs)

## Files touched
None — no failing test found, nothing to fix.

## Connect risk
none — no code changes.

COMPLETE
