# Task: Expand blurMode unit tests

## Goal
Add edge cases to `mobile/src/prefs/blurMode.test.mjs` (unknown mode string, friend never auto-blur already covered — add wantStrangerBlur intro+friend, empty mode).

## Scope
- `mobile/src/prefs/blurMode.test.mjs` only

## Done criteria
- [ ] `node mobile/src/prefs/blurMode.test.mjs` passes
- [ ] RESULT + COMPLETE

## Do not
- Runtime prefs store changes unless test requires pure fn only
