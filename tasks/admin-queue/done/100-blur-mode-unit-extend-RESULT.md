# 100-blur-mode-unit-extend RESULT

Status: COMPLETE

## What changed
Extended `mobile/src/prefs/blurMode.test.mjs` with more edge-case coverage for
the existing pure `normalizeBlurMode` / `wantStrangerBlur` reimplementations,
and added a new pure `introTimerDecision` helper (extracted decision core of
`scheduleIntroUnblur`'s poll loop in `mobile/app/live.tsx`, kept in sync via
comment referencing the `INTRO_*` constants there) with its own assertions.

- `normalizeBlurMode`: nullish/non-string `blurStrangersMode` (null,
  undefined, `0`), case-sensitivity (`"Off"`), whitespace variants
  (`" off"`, `"off "`), and precedence of a valid mode string over a
  disagreeing legacy `blurStrangers` boolean.
- `wantStrangerBlur`: nullish/non-string mode, case-sensitivity (`"HOLD"`),
  isFriend short-circuit before mode is read, and two composed
  `normalizeBlurMode` → `wantStrangerBlur` pipeline cases.
- `introTimerDecision` (new pure function, test-file only): reveal when
  frames are available even late; rearm while under both the rearm-count cap
  (3) and wall-clock cap (8000ms); peel-timeout exactly at either cap.

## Files touched
- `mobile/src/prefs/blurMode.test.mjs` (only file in scope)

## Verify commands run
- `node src/prefs/blurMode.test.mjs` → `blurMode.test.mjs OK`

## Connect risk
none — test-only change, no app/runtime code touched, no adb/device use.

COMPLETE
