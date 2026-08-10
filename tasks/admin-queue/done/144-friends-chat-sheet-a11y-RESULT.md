# 144 — Friends DM chat sheet a11y

## Status
COMPLETE

## Audit
Reviewed `mobile/src/friends/FriendChatSheet.tsx` (the mutual-friend DM modal opened
from `mobile/app/friends.tsx`). Compared against the a11y conventions already used
elsewhere in `friends.tsx` (accessibilityRole/Label/Hint on every interactive row).
The DM sheet had none of that: close button, message bubbles, compose input, and
send button were all missing accessibility roles/labels, and the send button was
only visually (not semantically) disabled while offline.

Gaps found and fixed, minimal diff, no new copy/keys:
- Close button (header): no `accessibilityRole`/`accessibilityLabel` — screen
  readers had no reliable way to identify it as a button. Added
  `accessibilityRole="button"` + `accessibilityLabel={t("mobile.common.ok")}`
  (existing key, matches visible label).
- Friend name header: added `accessibilityRole="header"` for correct heading
  navigation, matching the pattern used in `friends.tsx`.
- Message bubbles (`Pressable` with long-press-to-copy): no role/label, so
  screen readers announced only fragmented nested `Text` children. Added
  `accessibilityRole="button"` + `accessibilityLabel={item.body}`.
- Compose `TextInput`: relied on `placeholder` alone, which disappears as a
  label source once text is entered on some screen readers. Added
  `accessibilityLabel={t("mobile.friends.chatPlaceholder")}` (existing key).
- Send button: no role/label, and was only visually dimmed (`sendDisabled`
  style) while offline — screen readers had no indication it was inert. Added
  `accessibilityRole="button"`, `accessibilityLabel={t("mobile.common.send")}`,
  `accessibilityState={{ disabled: !connected }}`, and the actual `disabled`
  prop (the `send()` handler already no-op'd when offline, so this just makes
  the existing behavior legible to AT and prevents a dead tap target).

No new i18n keys added — all labels reuse existing `mobile.common.*` /
`mobile.friends.*` keys already present in `en.json` and all 14 overlay locales.

## Files touched
- `mobile/src/friends/FriendChatSheet.tsx`

## Verify commands run
- `cd mobile && npx tsc --noEmit -p .` — no new errors introduced by this
  change (pre-existing repo-wide `expo-clipboard`/`expo-keep-awake` module
  resolution errors and unrelated `live.tsx`/`MediaSession.ts` errors were
  already present before this edit; none reference the touched lines).

## Connect risk
none — chat-sheet-only UI/a11y change, no touches to MediaSession, offer/ICE/
TURN, or CONNECTIVITY_LOCK paths.

COMPLETE
