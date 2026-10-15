# 425 — dev-smoke unit run

## Status
PASS — all mobile unit tests green, no fix needed.

## Files touched
None.

## Verify commands run
- `cd mobile && npm test` — PASS (test-friend-invite, test-geo-localize, test-live-units: callMetrics, connectSteps, hubLobby, matchContinuity, matchPeers, partnerIdentityDisplay, stageStreams, blurMode, connectUi, mediasessionMultiSafety, offerSdpLooksPureRelay)
- `node mobile/src/stars/giftFxHold.test.mjs` — PASS (not covered by test-live-units.mjs runner)
- `node mobile/src/identity/formatLocLine.test.mjs` — PASS (not covered by test-live-units.mjs runner)
- `./scripts/dev-smoke.sh --unit` — PASS (test-geo-localize + all `mobile/src/{live,prefs,stars}/*.test.mjs`)

## Connect risk
none

COMPLETE
