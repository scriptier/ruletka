# 059 — Home offline / reconnect soft copy — RESULT

## Status
COMPLETE

## Summary
Audited `mobile/app/index.tsx`'s hub-offline / reconnect UX. It already uses a
soft, non-blocking pattern (no `Alert.alert` anywhere in this file):

- Status row shows `mobile.home.hubOfflineTap` ("Hub offline · tap to
  reconnect") when disconnected, `mobile.home.hubOnline` when connected.
- Tapping the status row while offline calls `reconnectHub()` and shows a
  `showToast(t("mobile.settings.hubReconnecting"))` toast — no hard alert.
- Long-press copies the hub URL and shows `mobile.home.hubCopied` toast.

All required EN + RU keys already existed
(`mobile.home.hubOfflineTap/hubOnline/hubCopied`,
`mobile.settings.hubReconnecting`), so no new keys were needed and
`index.tsx` required no code changes.

One copy fix applied: the RU string for `mobile.home.hubOfflineTap` mixed
English mid-sentence ("нажмите для reconnect"), which isn't soft/natural
Russian. Changed to "Хаб офлайн · нажмите для переподключения".

## Files touched
- `mobile/src/i18n/overlay/ru.json` — fixed `mobile.home.hubOfflineTap` copy
  (removed English "reconnect" word-mix, now fully Russian).

No changes to `mobile/app/index.tsx` (already correct — no hard Alert for
soft offline, toast-based reconnect already in place) or `en.json` (existing
copy was already short/clear).

## Verify commands run
- `node -e "JSON.parse(...ru.json); JSON.parse(...en.json)"` → both valid JSON.
- `npx tsc --noEmit -p .` → only pre-existing unrelated error
  (`Cannot find module 'expo-clipboard'`, missing node_modules in this
  worktree, not caused by this change).
- Manual read-through of `mobile/app/index.tsx` status row / reconnect
  handler (lines 162–202) and `mobile/src/hub/HubProvider.tsx` `reconnectHub`
  (unchanged, out of scope).

## Connect risk
none — copy-only change, no hub/WebRTC/protocol code touched.

COMPLETE
