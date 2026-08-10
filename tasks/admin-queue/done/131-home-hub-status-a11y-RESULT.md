# 131 — Home hub status row a11y

## Status
COMPLETE

## Audit
`mobile/app/index.tsx` — the hub status `Pressable` (statusRow, ~line 162) had `onPress` (reconnect when offline) and `onLongPress` (copy hub URL) but no `accessibilityRole` or `accessibilityLabel`. Screen readers would not announce it as an interactive control, unlike the other Pressables in this file (brand/start button, friends-online strip, settings/legal links) which already set both props.

## Fix
Added to the statusRow Pressable:
- `accessibilityRole="button"`
- `accessibilityLabel` — reuses existing `t("mobile.home.hubOnline")` / `t("mobile.home.hubOfflineTap")` keys (same strings already rendered visibly), no new i18n keys added.

Minimal diff, no behavior change to press/long-press handlers.

## Files touched
- `mobile/app/index.tsx`

## Verify commands run
- `npx tsc --noEmit -p .` (from `mobile/`) — pre-existing errors only (missing native modules like `expo-clipboard`, `react-native-gesture-handler`, and unrelated `live.tsx` issues); no new errors introduced by this change.

## Connect risk
none — UI-only accessibility attributes on the home screen status row, no changes to MediaSession, hub connect logic, or CONNECTIVITY_LOCK paths.

COMPLETE
