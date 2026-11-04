# 478 — Mobile identity unit polish — RESULT

## Status
COMPLETE

## Summary
`mobile/src/live/matchPeers.test.mjs` and `mobile/src/live/partnerIdentityDisplay.test.mjs`
already contained very extensive poison-payload coverage for
`displayPartnerStars`, `resolvePartnerDisplayName(WithSource)`, `normalizePeer`,
`extraPeersFromMatch`, `pickPeer`, `mergePartnerStars`/`mergePartnerTrust`, and
`readPeerStars`/`readPeerTrust`/`readPeerGeo` (empty/anon/ellipsis/hex names,
NaN/Infinity/boolean/array/object numeric poison, bidi override chars,
surrogate-pair peer ids, etc.). Verified the suite still passes, then extended
it with two more genuine gaps not previously locked in:

1. **Hex/exponent numeric-string poison** — `Number("0x10")` / `Number("1e2")`
   silently parse as 16 / 100. Neither `readNonNegInt` nor the bare `Number()`
   coercion in `displayPartnerStars` guards against this; added assertions
   documenting the known gap (`readNonNegInt`, `readPeerStars`,
   `displayPartnerStars`).
2. **Duplicate non-primary peer ids in `extraPeersFromMatch`** — dedup only
   checks against `primary`, never between extras themselves, so a poisoned
   `peers[]` with two rows sharing the same non-primary `peer_id` currently
   surfaces both rows. Added a test locking in this documented behavior.

No changes to `matchPeers.ts` itself — its pure exports already covered
everything needed; only tests were extended, per OWN scope.

## Files touched
- `mobile/src/live/matchPeers.test.mjs` (added 2 test blocks, ~35 lines)

## Verify commands run
- `node mobile/src/live/matchPeers.test.mjs` → `matchPeers.test.mjs OK`
- `node mobile/src/live/partnerIdentityDisplay.test.mjs` → `partnerIdentityDisplay.test.mjs OK`
- `npx tsc --noEmit -p .` (mobile) → no errors touching matchPeers.ts / live/*

## Connect risk
none — pure unit tests only, no MediaSession/ICE/offer/hub-client changes,
no APK build, no deploy.

COMPLETE
