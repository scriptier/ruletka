# 419 — dev-smoke unit run

## Status
PASS — all unit tests green, no fix needed.

## Verify commands run
- `./scripts/dev-smoke.sh --unit` → `=== dev-smoke PASS (unit only) ===`
  (test-connect-ui, test-friend-invite, test-geo-localize, + all `src/live`,
  `src/prefs`, `src/stars` `*.test.mjs`)
- `node mobile/src/media/mediasessionMultiSafety.test.mjs` → ok
- `node mobile/src/media/connectUi.test.mjs` → OK
- `node mobile/src/media/offerSdpLooksPureRelay.test.mjs` → OK
- `node mobile/src/identity/formatLocLine.test.mjs` → OK
- `node mobile/scripts/test-live-units.mjs` → `live-units OK (11)`

(dev-smoke.sh's `--unit` list doesn't glob `src/media/` or `src/identity/`;
ran those directly as a supplement — all pass. `test-live-units.mjs` does
cover `src/media`, confirmed OK there too.)

## Files touched
None — no failing tests found.

## Connect risk
none

COMPLETE
