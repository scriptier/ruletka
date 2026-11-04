# RESULT: Unit: matchContinuity keep-primary when extra drops

Status: COMPLETE

## What changed
Added a test case to `matchContinuity.test.mjs` covering the scenario where
the extra/secondary peer drops (no `secondaryPeerId`, no `hasMedia2`) while
the primary peer is unchanged. `computeMatchContinuity` correctly reports
`keepPrimary: true`, `keepSecondary: false`, `promoteSecondary: false` in
this case, since `keepPrimary` only compares `prevPrimary`/`primaryPeerId`
and is independent of secondary state. Also added a `shouldSoftRematch`
assertion confirming it stays `true` when `keepPrimary` is true but
`extrasCount` is 0 (extra gone).

No changes to `matchContinuity.ts` were needed — existing `keepPrimary`
logic already handles this correctly, so this is a pure test-coverage
addition.

## Files touched
- mobile/src/live/matchContinuity.test.mjs

## Verify commands run
- `node mobile/src/live/matchContinuity.test.mjs` → `matchContinuity.test.mjs ok`

## Connect risk
none — test-only change, no production/source code modified.

COMPLETE
