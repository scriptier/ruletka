# 115 — LiveBottomBar cam-off hint a11y — RESULT

## Status
COMPLETE

## Findings
- The standalone cam-off hint `Text` (bottom of the bar, `mobile/src/live/LiveBottomBar.tsx:392-405`) already has `accessibilityLiveRegion="polite"` — confirmed present.
- However it **was** double-announced with the cam button: the cam `Pressable` (`mobile/src/live/LiveBottomBar.tsx:270-289`) also set `accessibilityHint={!camOn && L.camOffHint ? L.camOffHint : undefined}`, i.e. the exact same string (`L.camOffHint`) as the live-region `Text`. On Android/TalkBack this meant toggling cam off could fire two announcements of the same phrase: the live-region text appearing, and the button's hint when focused/pressed.

## Fix
- Removed the duplicate `accessibilityHint` from the cam `Pressable` in `LiveBottomBar.tsx`. The live-region `Text` is now the single source of truth for announcing "hidden from partner" when cam is off; the button itself still announces its label/state (`camOn`/`camOff`) normally.

## Files touched
- `mobile/src/live/LiveBottomBar.tsx` (removed redundant `accessibilityHint` on cam button, 5 lines removed)

## Verify commands run
- `npx tsc --noEmit -p .` from `mobile/` — pre-existing unrelated errors only (missing native modules like `expo-clipboard`, `react-native-gesture-handler`, and unrelated `live.tsx`/`MediaSession.ts` errors); no errors in `LiveBottomBar.tsx`.

## Connect risk
none — UI-only accessibility change in `LiveBottomBar.tsx`, no media/connect/ICE/TURN code touched.

COMPLETE
