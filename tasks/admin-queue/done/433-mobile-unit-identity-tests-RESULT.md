# 433 — mobile unit identity tests RESULT

Status: DONE

## Context
This task duplicates the intent of #432 (already DONE — see
`432-mobile-unit-identity-tests-RESULT.md`), which had already added a
substantial poison-name / `displayPartnerStars` edge-case block to
`matchPeers.test.mjs` (NaN/Infinity/emoji/sentinel-string/embedded-NUL
cases). I read that prior work first, then extended coverage further with
cases #432 didn't touch: non-primitive (object/array/boolean) poison
inputs, and the dock-side wrapper (`partnerIdentityDisplay.test.mjs`).

## What changed
`mobile/src/live/matchPeers.test.mjs` — new assertions, appended after the
existing poison block:
- `displayPartnerStars` with object `{}`, empty array `[]`, single-element
  array `[3]`, multi-element array `[1,2]`, and booleans — confirms `Number()`
  coercion behavior (arrays/objects → `NaN`/element value) never throws and
  never yields a garbage badge.
- `mergePartnerStars` / `mergePartnerTrust` with object/array `prev` —
  same coercion guarantee on the "keep previous badge" thrash-guard path.
- `resolvePartnerDisplayName` with a plain object as `name` (coerces to the
  literal `"[object Object]"` string and is *not* treated as a placeholder
  — documents a real gap: a non-string hub payload would paint garbage
  text rather than falling back, since `cleanPartnerLabel` blindly
  `String()`s), an object with a custom `toString()` (indistinguishable
  from a real name — same underlying gap), and a numeric `name` (`42`).
- `normalizePeer({}, msg)` — fully empty peer row must not throw, must
  default `peerId` to `"legacy"`, and must fall back to `msg.partner_short`
  for the name.

`mobile/src/live/partnerIdentityDisplay.test.mjs` — mirrors the same class
of poison inputs through the dock's 3-arg wrapper
(`resolvePartnerDisplayName(name, nameFallback, friendCode)`): numeric `0`,
`NaN`, numeric `friendCode`, a 300-char name, and an embedded NUL byte.

No changes to `mobile/src/live/matchPeers.ts` — read-only per task scope;
no new export was needed.

## Files touched
- `mobile/src/live/matchPeers.test.mjs` (test-only additions)
- `mobile/src/live/partnerIdentityDisplay.test.mjs` (test-only additions)

Note: both files (and most of `mobile/src/live/*`) were already
untracked/modified in this worktree before I started (large pre-existing
diff from the dual-agent factory state) — my changes are purely additive
blocks at the end of each file.

## Verify commands run
- `node mobile/src/live/matchPeers.test.mjs` — OK
- `node mobile/src/live/partnerIdentityDisplay.test.mjs` — OK
- `node scripts/test-live-units.mjs` (from `mobile/`) — `live-units OK (11)`,
  covering all live unit suites including `mediasessionMultiSafety.test.mjs`
  and `offerSdpLooksPureRelay.test.mjs` (untouched, still green — confirms
  no MediaSession/ICE thrash from this change).

## Connect risk
none — test-only diff, no production code touched.

COMPLETE
