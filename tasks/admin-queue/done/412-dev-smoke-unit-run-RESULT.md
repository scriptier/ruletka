# 412 — Run mobile unit smoke

## Status
PASS — all unit tests green, nothing to fix.

## Files touched
None.

## Verify commands run
- `./scripts/dev-smoke.sh --unit` (root-level script, covers L0 unit layer)
  → test-connect-ui: ok; test-friend-invite: all passed; test-geo-localize: all passed;
    unit tests ok for callMetrics, connectSteps, hubLobby, matchContinuity, matchPeers,
    partnerIdentityDisplay, stageStreams, blurMode, giftFxHold
  → `=== dev-smoke PASS (unit only) ===`
- `node mobile/scripts/test-live-units.mjs` → live-units OK (10) (also covers src/media:
  connectUi.test.mjs, offerSdpLooksPureRelay.test.mjs)
- `node mobile/src/identity/formatLocLine.test.mjs` → OK

All `*.test.mjs` under mobile/src (live, prefs, stars, media, identity) plus the
mobile/scripts/test-*.mjs harness scripts pass. No failing test found, so no fix needed.

## Connect risk
none

COMPLETE
