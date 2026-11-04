# 423 — dev-smoke unit run

## Status
PASS — all mobile unit tests green, no fix needed.

## Files touched
None.

## Verify commands run
- `cd mobile && npm test` — PASS (test-friend-invite, test-geo-localize, test-live-units)
- `./scripts/dev-smoke.sh --unit` — PASS (test-connect-ui, test-friend-invite, test-geo-localize, and all `mobile/src/{live,prefs,stars}/*.test.mjs`: callMetrics, connectSteps, hubLobby, matchContinuity, matchPeers, partnerIdentityDisplay, stageStreams, blurMode, giftFxHold)

## Connect risk
none

COMPLETE
