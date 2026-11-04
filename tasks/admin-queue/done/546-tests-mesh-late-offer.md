# Unit tests: mesh late-offer / extra stuck

## Goal
Add or extend unit tests so laptop 3rd late-offer (`armMeshLateOfferKicks`, stuckExtra ice=checking >5s, cap 4) cannot regress silently.

## OWN
- `ui/live-extra-ice.test.mjs` (create or extend)
- `ui/live-third-slot.test.mjs` only if you must import a helper — prefer extra-ice file

## Source
Grep `ui/live.js` for `armMeshLateOfferKicks`, `stuckExtra`, `meshEnsureCounts`. Assert strings exist (static source test is OK if functions aren't exported).

## Must not
- Change live.js / webrtc.js / MediaSession (Grok owns ICE)
- deploy, APK, pool>0

## Done
`node ui/live-extra-ice.test.mjs` passes. RESULT + COMPLETE
