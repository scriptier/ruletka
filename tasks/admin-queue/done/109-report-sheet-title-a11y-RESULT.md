# 109 — ReportSheet header a11y — RESULT

## Status
COMPLETE

## Changes
- `mobile/src/safety/ReportSheet.tsx`:
  - Added `accessibilityRole="header"` to the sheet title (`t("mobile.live.reportTitle")`), which was missing it.
  - Audited the quick-explicit button's busy state: it already disables and shows an `ActivityIndicator` while `busy`, but was missing `accessibilityState`. Added `accessibilityState={{ disabled: busy || capturing, busy }}` to match the pattern used on the submit button, so screen readers announce disabled/busy state during submission.

## Files touched
- `mobile/src/safety/ReportSheet.tsx`

## Verify commands run
- `npx tsc --noEmit -p .` (from `mobile/`) — no new errors introduced. Pre-existing unrelated errors remain in other files (missing `expo-clipboard`/`expo-keep-awake`/etc. type declarations, `app/live.tsx` issues). `ReportSheet.tsx` itself is clean.

## Connect risk
none — UI-only accessibility attributes, no changes to media/signaling/connect logic.

COMPLETE
