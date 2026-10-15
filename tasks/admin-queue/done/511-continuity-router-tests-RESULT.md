# 511 — matchContinuity router tests (Android-as-3rd) — RESULT

## Status
COMPLETE

## What changed
`mobile/src/live/matchContinuity.test.mjs` already contained the required coverage for
`routeInboundSignalTarget` / `latchThirdJoinerPeerIds` locking a second `from=` away from
primary; verified the file in place (no further edits needed under this OWN):

- **Cold 3rd, two `from=`**: first `from=` with primary empty → `"primary"`; second
  `from=` with primary already latched → `"secondary"` (never re-steals `"primary"`).
- **`extrasCount>=1` foreign → secondary**: peer not matching primary routes to
  `"secondary"` once `extrasCount >= 1`, even with `secondaryId` still empty; same for
  `listedPeerIds` showing 2+ remotes.
- **Primary loose match**: `fed/sess/deadbeefcafebabe` vs bare hex `deadbeefcafebabe`
  still resolves to `"primary"` via `peerIdsLooseMatch`/`idMatch`.
- Explicit secondary/tertiary slot routing, empty `from=` (legacy 1v1) staying on
  primary, and `latchThirdJoinerPeerIds` cold-latch / already-latched-extra cases are
  also covered.
- Trailing source-contract lock block reads `matchContinuity.ts`, `matchPeers.ts`, and
  `../../app/live.tsx` from disk and asserts the required exports/wiring exist (incl.
  that `live.tsx` calls `latchThirdJoinerPeerIds` before `startCall EARLY`, and that no
  `extrasCount`-gated block re-applies a foreign offer to media1) — this is a read-only
  assertion inside the test file itself, not an edit to those files.

No changes were made to `matchContinuity.ts`, `live.tsx`, `MediaSession`, or `live.js`,
per Must-not.

## Files touched
- `mobile/src/live/matchContinuity.test.mjs` only (already staged/modified prior to this
  task's execution; verified content and passing status)

## Verify commands run
```
node mobile/src/live/matchContinuity.test.mjs
```
Output: `matchContinuity.test.mjs ok`, exit code 0.

## Risks / merge advice
None. Test-only file, no runtime code paths touched. Safe to merge alongside the
`matchContinuity.ts` / `live.tsx` changes it mirrors.
