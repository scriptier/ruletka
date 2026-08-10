# 112 — Settings export/import a11y — RESULT

**Status:** COMPLETE

## Files touched
- `mobile/app/settings.tsx`

## Changes
- Backup section export Pressable: added `accessibilityLabel={t("mobile.settings.exportBtn")}` (already had `accessibilityRole="button"` and `accessibilityState`).
- Backup section import Pressable: added `accessibilityLabel={t("mobile.settings.importBtn")}` (already had `accessibilityRole="button"` and `accessibilityState`).
- No new strings added; reused existing i18n keys already displayed as button text.

## Verify commands run
- `npx tsc --noEmit -p .` (from `mobile/`) — pre-existing unrelated errors only (missing `expo-clipboard`/`expo-keep-awake` type declarations, `live.tsx` issues); no new errors introduced by this change and no errors in the touched lines.

## Connect risk
none — UI-only accessibility label addition in `settings.tsx`, no changes to `mobile/src/media/*`, `live.tsx`, WebRTC/offer/ICE/TURN, or prefs schema.

COMPLETE
