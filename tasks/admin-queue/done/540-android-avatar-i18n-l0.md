# Android avatar i18n + L0

## Goal
Add i18n keys and L0/unit gates for Android self-avatar + dock photo. Do **not** implement Settings or dock UI (other lanes own those).

## OWN
- `mobile/src/i18n/packs/*.json`
- `mobile/src/i18n/overlay/*.json`
- `mobile/scripts/verify-match-ux.mjs`
- `mobile/src/identity/avatar.test.mjs` (create)

## Must not
- deploy, APK, ICE, pool>0, MediaSession
- `mobile/app/settings.tsx`, `PartnerIdentityDock.tsx`, `live.tsx`, `HubClient.ts`

## Keys (en + ru at minimum; copy en to other packs if missing)
- `mobile.settings.avatar` = "Photo"
- `mobile.settings.avatarChange` = "Change photo"
- `mobile.settings.avatarClear` = "Remove photo"
- `mobile.settings.avatarTooLarge` = "Photo too large — pick a smaller one"
- `mobile.settings.avatarSaved` = "Photo saved"
- `mobile.settings.avatarNone` = "No photo"

## L0 (verify-match-ux.mjs)
Assert (string contains is OK even if grok lands later):
- HubClient or HubProvider mentions `prefs.avatar` or `opts.avatar` (not only `avatar: ""`)
- PartnerIdentityDock `live-partner-identity-avatar`
- settings.tsx `resizeUriToAvatarDataUrl` or `avatar`

If a file does not have the string yet, still add the assert — parent will re-run after grok lanes. Prefer asserts that pass if either the new API **or** a comment `avatar` hop exists.

## Unit `avatar.test.mjs`
If `avatar.ts` exists, import `isValidAvatarDataUrl` / `MAX_AVATAR_CHARS`. Else duplicate the contract: MAX=48000, jpeg/png/webp data URLs valid, empty invalid.

## Done
RESULT markdown + COMPLETE. No APK.