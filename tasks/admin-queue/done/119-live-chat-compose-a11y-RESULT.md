# 119 — Live chat compose field a11y

## Status
COMPLETE

## What changed
Added `accessibilityLabel` to the two chat compose `TextInput` fields in
`mobile/app/live.tsx` (the portrait chat row and the browser-layout docked
chat compose). Both use the existing `mobile.chat.placeholder` i18n key
(already localized in all 14 supported langs), so no new translation keys
were needed. The send `Pressable` buttons next to each input already had
`accessibilityLabel={t("mobile.common.send")}` — no change needed there.

## Files touched
- `mobile/app/live.tsx` (2 edits, lines ~4366 and ~4469)

## Verify commands run
- `npx tsc --noEmit -p .` (mobile/) — pre-existing unrelated errors only
  (missing native modules like `expo-clipboard`, `expo-keep-awake`,
  `react-native-gesture-handler`, dynamic-import module flag, unrelated
  `readyState`/`pointerEvents` type errors). No new errors on the edited
  lines.
- `grep -n accessibilityLabel mobile/app/live.tsx` — confirms label present.

## Connect risk
none — no changes to connect/offer/ICE/TURN logic, only added an a11y
prop to two existing `TextInput` elements.

COMPLETE
