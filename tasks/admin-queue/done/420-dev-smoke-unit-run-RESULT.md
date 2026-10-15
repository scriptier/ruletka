# 420 — dev-smoke unit run

## Status
PASS — all unit tests green, no fix needed.

## Files touched
None.

## Verify commands run
- `./scripts/dev-smoke.sh --unit` — PASS (test-connect-ui, test-friend-invite, test-geo-localize, callMetrics, connectSteps, hubLobby, matchContinuity, matchPeers, partnerIdentityDisplay, stageStreams, blurMode, giftFxHold — all ok)
- `node mobile/src/media/offerSdpLooksPureRelay.test.mjs` — OK (not in dev-smoke's unit list; ran directly)
- `node mobile/src/identity/formatLocLine.test.mjs` — OK (not in dev-smoke's unit list; ran directly)
- `node mobile/src/media/mediasessionMultiSafety.test.mjs` — OK (not in dev-smoke's unit list; ran directly)

## Connect risk
none

COMPLETE
