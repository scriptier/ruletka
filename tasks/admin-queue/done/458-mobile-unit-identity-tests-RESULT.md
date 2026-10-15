# 458 — Mobile identity unit polish

## Status
COMPLETE

## What changed
`matchPeers.test.mjs` already had extensive poison-name / `displayPartnerStars`
coverage (emoji, NaN, bidi overrides, object/array coercion, etc). Reviewed it
against `matchPeers.ts` to find real gaps and added 6 new focused blocks:

1. `mergePartnerTrust` object/array-poison `prev` (parity gap — only
   `mergePartnerStars` had this case before).
2. `readPeerStars`/`readPeerTrust`/`normalizePeer` reject non-finite magnitudes
   (`Infinity` as both a number and the literal string `"Infinity"`) as
   "field absent" rather than "known value" — contrasted with the existing
   documented gap that raw `displayPartnerStars(Infinity, …)` lets Infinity
   through untouched. Locks in that a poisoned `MatchPeer.stars = Infinity`
   from a broken bridge can never latch an infinite badge end-to-end.
3. `cleanPartnerLabel` BOM-only / ZWSP-only strings collapse to `""`.
4. Astral (surrogate-pair) `peer_id` — slicing the first 8 UTF-16 code units
   can land mid-pair and produce a lone surrogate; confirmed this is a valid
   non-throwing string compare, not a crash, in both the "real name wins" and
   "name equals lone-surrogate id prefix" cases.
5. Pathologically long `friend_code` (2000 chars) — uppercased in full, never
   truncated, never throws (documents current no-cap behavior).
6. `HEX_ID_LIKE` length-boundary poison: 5-char and 13-char hex strings are
   correctly *not* treated as id-clone placeholders (paint through as real
   labels), while the 6-char and 12-char boundary values are.

No changes to `matchPeers.ts` itself — read-only, no new pure export was
needed (all helpers exercised were already exported / already mirrored in the
test file's local copies, per the file's existing no-import pattern).

## Files touched
- `mobile/src/live/matchPeers.test.mjs` (extended only)

## Verify commands run
- `node mobile/src/live/matchPeers.test.mjs` → `matchPeers.test.mjs OK`
- `node mobile/src/live/partnerIdentityDisplay.test.mjs` → OK (unchanged, sanity check)
- `node mobile/scripts/test-live-units.mjs` → `live-units OK (11)` (all 11 suites green, incl. media/prefs)

## Connect risk
none — pure identity-label/star-math unit tests only, no MediaSession/ICE/offer
touched, no APK build, no deploy, no push.

COMPLETE
