# 414 — Run mobile unit smoke, fix one broken test if any

## Status
PASS — all unit tests green already; nothing broken, no fix needed.

## Verify commands run
- `cd mobile && npm test` (test-friend-invite + test-geo-localize + test-live-units) → all passed
- `./scripts/dev-smoke.sh --unit` (repo root) → `=== dev-smoke PASS (unit only) ===`
  (covers test-connect-ui, test-friend-invite, test-geo-localize, and every
  `*.test.mjs` under `mobile/src/live`, `mobile/src/prefs`, `mobile/src/stars`)
- `node mobile/src/identity/formatLocLine.test.mjs` → OK (not wired into dev-smoke's
  glob list, ran directly for completeness)

## Files touched
None — no failing test found, nothing to fix.

## Connect risk
none — no code changes.

COMPLETE
