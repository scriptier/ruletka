# 426 — dev-smoke unit run

## Status
PASS — all mobile unit tests green, no fix needed.

## Files touched
None.

## Verify commands run
- `./scripts/dev-smoke.sh --unit` — PASS (test-connect-ui, test-friend-invite, test-geo-localize, and all `mobile/src/{live,prefs,stars}/*.test.mjs`: callMetrics, connectSteps, hubLobby, matchContinuity, matchPeers, partnerIdentityDisplay, stageStreams, blurMode, giftFxHold)
- `node mobile/src/media/mediasessionMultiSafety.test.mjs` — PASS
- `node mobile/src/media/connectUi.test.mjs` — PASS
- `node mobile/src/media/offerSdpLooksPureRelay.test.mjs` — PASS
- `node mobile/src/identity/formatLocLine.test.mjs` — PASS

## Connect risk
none

COMPLETE
