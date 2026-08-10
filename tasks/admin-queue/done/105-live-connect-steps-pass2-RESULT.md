# 105 — LiveConnectSteps second pass

## Status
COMPLETE

## Gap found
Task 072's RESULT claimed "added a11y state on chips," but the only a11y
prop actually present was `accessibilityRole="summary"` on the outer row.
The three step chips (`queue`/`media`/`video`) had no `accessible`,
`accessibilityLabel`, or `accessibilityState`, so a screen reader landing
on a chip just read the wrapping `View` (nothing, since it wasn't
`accessible`) and fell through to the raw `Text` label with no indication
of whether that step was todo/active/done. The `›` separator glyphs were
also exposed to assistive tech as stray characters between chips.

Compared against sibling live-chrome components
(`LiveBottomBar.tsx`, `LiveMoreSheet.tsx`, `ReportSheet.tsx`,
`LiveDebateChrome.tsx`), which consistently pair
`accessibilityLabel` + `accessibilityState={{ selected, disabled }}`
on stateful chips/buttons.

## Fix
`mobile/src/live/LiveConnectSteps.tsx`:
- Each step chip `View` is now `accessible`, `accessibilityRole="text"`,
  with `accessibilityLabel={s.label}` and
  `accessibilityState={{ selected: st === "active", disabled: st === "todo" }}`
  — mirrors the selected/disabled convention used elsewhere in `live/`.
  `done` chips are reported as neither selected nor disabled (distinct
  from the pending/active states) without needing new copy.
- The `›` separator `Text` is now hidden from assistive tech
  (`importantForAccessibility="no"` + `accessibilityElementsHidden`) so
  it isn't announced between chips.

No new i18n strings added — task scope is this one file only, and a
localized "done/in progress/pending" announcement would require touching
14 overlay files, which is out of scope for this pass.

## Files touched
- mobile/src/live/LiveConnectSteps.tsx

## Verify commands run
- `npx tsc --noEmit` (from `mobile/`) — no errors in this file (pre-existing
  unrelated errors elsewhere: missing native modules, `app/live.tsx`, `src/media/MediaSession.ts`)
- `node scripts/test-live-units.mjs` (from `mobile/`) — `live-units OK (6)`, includes `connectSteps.test.mjs`

## Connect risk
none — presentational a11y-only change, no touch to phase/conn/ICE logic or `connectSteps.ts`.

COMPLETE
