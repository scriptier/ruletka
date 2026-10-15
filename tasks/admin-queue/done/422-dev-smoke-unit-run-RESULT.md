# 422 — dev-smoke unit run

## Status
PASS — all mobile unit tests green, no fix needed.

## Files touched
None.

## Verify commands run
- `./scripts/dev-smoke.sh --unit` — PASS (test-connect-ui, test-friend-invite, test-geo-localize, and all `mobile/src/{live,prefs,stars}/*.test.mjs`)
- Also ran the mobile unit tests outside dev-smoke's L0 glob for completeness (all OK):
  - `node mobile/src/media/mediasessionMultiSafety.test.mjs`
  - `node mobile/src/media/connectUi.test.mjs`
  - `node mobile/src/media/offerSdpLooksPureRelay.test.mjs`
  - `node mobile/src/identity/formatLocLine.test.mjs`

## Connect risk
none

COMPLETE
