# 127 — LiveMoreSheet menu role audit — RESULT

## Status
COMPLETE

## Summary
Audited `LiveMoreSheet.tsx` accessibility roles. The sheet container already had
`accessibilityRole="menu"`, but every row inside it (the shared `row()` helper plus
the inline debate / add-friend / report `Pressable`s) used `accessibilityRole="button"`
instead of `"menuitem"`. Mixing `menu` with `button` children is invalid ARIA/RN
semantics — screen readers won't announce them as menu items or navigate them with
menu semantics. Confirmed `"menuitem"` is a supported RN `AccessibilityRole`
(`react-native/Libraries/Components/View/ViewAccessibility.js`).

Fix: changed all 6 row `accessibilityRole="button"` occurrences in this file to
`accessibilityRole="menuitem"`. No other props, structure, or logic touched.

## Files touched
- `mobile/src/live/LiveMoreSheet.tsx`

## Verify commands run
- `npx tsc --noEmit -p .` (mobile/) — no new errors introduced; all reported errors
  are pre-existing and unrelated (missing native modules in node_modules, other files
  like `app/live.tsx`, `src/media/MediaSession.ts`). No errors on `LiveMoreSheet.tsx`.
- Grepped repo for other consumers/tests of `LiveMoreSheet` — only `app/live.tsx`
  (renders it) and `src/live/index.ts` (re-export); no tests assert on
  `accessibilityRole="button"` for these rows.

## Connect risk
none — UI-only accessibility attribute change, no logic/props/behavior touched, not
in the connect/offer/ICE/TURN path.
