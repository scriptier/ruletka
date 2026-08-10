# 063 — Expand blurMode unit tests — RESULT

## Status
COMPLETE

## Files touched
- `mobile/src/prefs/blurMode.test.mjs`

## What changed
Added edge-case assertions to the existing pure-function tests (kept in sync with
`store.ts` `normalizeBlurMode`):
- `normalizeBlurMode({ blurStrangersMode: "" })` → `"intro"` (empty string is not a
  valid mode, falls through to default).
- `normalizeBlurMode({ blurStrangersMode: "bogus", blurStrangers: false })` → `"off"`
  (unknown mode string falls through to the legacy boolean fallback, not treated as
  valid — verifies fallthrough order).
- `wantStrangerBlur("off", true)`, `wantStrangerBlur("bogus", true)`,
  `wantStrangerBlur("", true)` → all `false` (friend never auto-blurs regardless of
  mode, including invalid/off modes — the `isFriend` short-circuit is unconditional).

No changes to `mobile/src/prefs/store.ts` or any runtime code — pure function test
file only.

## Verify commands run
- `node mobile/src/prefs/blurMode.test.mjs` → `blurMode.test.mjs OK`

## Connect risk
none — test-only change, no runtime/prefs/store code touched.

COMPLETE
