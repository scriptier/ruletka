# 540 — Android avatar i18n + L0

## Status
COMPLETE

## What changed
- Added 6 `mobile.settings.avatar*` i18n keys (`avatar`, `avatarChange`, `avatarClear`,
  `avatarTooLarge`, `avatarSaved`, `avatarNone`) to all 14 language packs and overlays.
  Real translations for `en` and `ru`; other 12 languages copy the `en` text verbatim
  (per task instructions — no existing translations to draw from).
- Added `mobile/src/identity/avatar.test.mjs`. `avatar.ts` already existed (owned by
  another lane) exporting `MAX_AVATAR_CHARS` / `isValidAvatarDataUrl`, so the test
  asserts those exports are present in source, then duplicates the pure contract
  (data-URL scheme jpeg/jpg/png/webp, ≤48000 chars) and exercises it — same pattern as
  the existing `CallPeerAvatar.test.mjs` (avatar.ts imports `expo-image-manipulator`,
  which is RN-only and can't be required under plain node).
- Added an L0 block to `mobile/scripts/verify-match-ux.mjs` ("Self-avatar wiring —
  task 540") asserting:
  - `HubClient.ts` or `HubProvider.tsx` contains `prefs.avatar` or `opts.avatar`
    (not just the existing `avatar: ""` placeholders)
  - `PartnerIdentityDock.tsx` has `testID="live-partner-identity-avatar"` — **already
    present**, passes now
  - `app/settings.tsx` mentions `resizeUriToAvatarDataUrl` or `avatar`

## Files touched
- `mobile/src/i18n/packs/*.json` (14 files)
- `mobile/src/i18n/overlay/*.json` (14 files)
- `mobile/scripts/verify-match-ux.mjs`
- `mobile/src/identity/avatar.test.mjs` (new)

## Verify commands run
- `node src/identity/avatar.test.mjs` → `avatar.test.mjs OK`
- `node -e "JSON.parse(...)"` over all 28 touched JSON files → all parse
- `node scripts/verify-match-ux.mjs` → `L0 done: 110 ok, 2 fail`

## Known/expected L0 fails (not a regression)
The 2 new fails are **by design** per the task spec ("If a file does not have the
string yet, still add the assert — parent will re-run after grok lanes"):
- `settings.tsx` doesn't yet wire the avatar photo picker (`resizeUriToAvatarDataUrl`)
  — that's the Settings-UI lane, explicitly out of scope here (task said don't touch
  `settings.tsx`).
- `HubClient.ts` / `HubProvider.tsx` don't yet send `prefs.avatar` / `opts.avatar` to
  the hub — also out of scope here (task said don't touch `HubClient.ts`).
Confirmed baseline (script with the new block removed) is `109 ok, 0 fail`, so nothing
pre-existing broke.

Note: `avatar.test.mjs` is not yet wired into any test runner (`test-live-units.mjs`
only scans `src/live`, `src/prefs`, `src/media`, `src/friends`; `src/identity` tests
like `formatLocLine.test.mjs` are invoked by name from `verify-before-apk.sh`). Adding
a line there is outside this task's OWN scope (`verify-match-ux.mjs` only) — left for
Grok/whoever wires the sibling lanes to also add
`check "avatar.test.mjs" run_node src/identity/avatar.test.mjs` to
`scripts/verify-before-apk.sh`.

## Connect risk
none — no ICE/pool/MediaSession/Settings/dock/live.tsx/HubClient changes. i18n JSON
and a new pure unit test only; the verify-match-ux.mjs edit only adds assertions
(gated behind sibling lanes), it doesn't touch any connectivity logic.

COMPLETE
