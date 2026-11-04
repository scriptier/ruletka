# 456 — Mobile identity unit polish RESULT

## Status
Done. Existing coverage in `matchPeers.test.mjs` / `partnerIdentityDisplay.test.mjs` already had
an extensive "poison" section for display-name resolution and `displayPartnerStars` (emoji-only
names, `null`/`undefined`/control-char strings, NaN/Infinity/object/array numeric poison, etc.).
Extended it with the one gap that wasn't covered: bidi-override / text-direction-isolate poison
in partner names, plus extreme numeric magnitudes for `displayPartnerStars`.

## Files touched
- `mobile/src/live/matchPeers.test.mjs` — added bidi override (U+202E) / isolate (U+2066-2069)
  poison-name assertions for `resolvePartnerDisplayName` + `normalizePeer`, and extreme-magnitude
  (`MAX_SAFE_INTEGER`, `1e21`, `-0`) assertions for `displayPartnerStars`. Documents current
  pass-through behavior (bidi controls are not stripped by `cleanPartnerLabel`) as a locked-in
  known gap, matching the existing "poison" test style in this file.
- `mobile/src/live/partnerIdentityDisplay.test.mjs` — mirrored the bidi-override assertion for
  the dock-facing `resolvePartnerDisplayName` wrapper.

No changes to `mobile/src/live/matchPeers.ts` — read-only, no new export was needed (existing
`resolvePartnerDisplayName`, `normalizePeer`, `displayPartnerStars` fully sufficient for the new
assertions).

## Verify commands run
```
node mobile/src/live/matchPeers.test.mjs        # matchPeers.test.mjs OK
node mobile/src/live/partnerIdentityDisplay.test.mjs  # partnerIdentityDisplay.test.mjs OK
```
Both exit 0.

## Connect risk
none — pure test-file additions only, no runtime/MediaSession/ICE/offer code touched.

COMPLETE
