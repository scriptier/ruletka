# RESULT: 136-unit-match-continuity-edge

## Status
COMPLETE

## Audit
`mobile/src/live/matchContinuity.test.mjs` mirrors `computeMatchContinuity` from
`mobile/src/live/matchContinuity.ts` (repo convention for pure-logic tests, see
sibling `*.test.mjs` files under `src/live`/`src/prefs` — no ts-node in this
project, so `.ts` logic is hand-mirrored into plain `.mjs`). Verified the
mirrored function body is character-for-character equivalent to the source.

Existing coverage only hit the happy paths (fresh match, keep primary, promote
secondary, no-promote-without-media2). Two gaps found:
1. The `"legacy"` sentinel guards on `prevPrimary`/`prevSecondary`/`secondId`
   were untested.
2. `shouldSoftRematch` (also exported from `matchContinuity.ts`) had zero
   test coverage.

No bugs found in the implementation — added tests only.

## Fix
Added edge-case assertions to `matchContinuity.test.mjs`:
- `"legacy"` prevPrimary never satisfies `keepPrimary`, even if equal to `primaryPeerId`.
- `"legacy"` secondaryPeerId never satisfies `keepSecondary`.
- `"legacy"` prevSecondary blocks `promoteSecondary` even when `primaryPeerId` matches it.
- `keepPrimary` and `promoteSecondary` are mutually exclusive (promotion never fires once primary is kept).
- `undefined` secondaryPeerId behaves the same as `null`/missing.
- `wasMatched: false` yields no continuity flags regardless of matching ids.
- Mirrored `shouldSoftRematch` into the test file and covered its 4 branches (keepPrimary, promoteSecondary, extrasCount>0, none).

No changes to `matchContinuity.ts` (implementation was already correct) or any t() / i18n keys — none apply to this pure-logic file.

## Files touched
- `mobile/src/live/matchContinuity.test.mjs` (test-only, additive)

## Verify commands run
- `node src/live/matchContinuity.test.mjs` → `matchContinuity.test.mjs ok`
- `node scripts/test-live-units.mjs` → `live-units OK (6)` (all 6 unit suites pass)

## Connect risk
none — test-only change, no runtime/production code touched, no CONNECTIVITY_LOCK/MediaSession/ICE/TURN paths involved.

COMPLETE
