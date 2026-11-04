# Android tap-face — remaining pack i18n

## Goal
Add `mobile.live.partnerActions`, `mobile.live.actionsFor`, `mobile.live.tapPartnerHint` to every `mobile/src/i18n/packs/*.json` that already uses flat `"mobile.*"` keys (or add only if the pack is a flat key map like `en.json`). Overlay files already have all 14 langs — do not rewrite overlays unless a key is missing.

## OWN
- `mobile/src/i18n/packs/*.json` (not overlay)

## Must not
- live.tsx, LiveStageVideo, MediaSession, deploy, APK, ICE
- overlay files unless a key is actually missing

## Keys (single-brace `{name}` — this codebase does not use `{{name}}`)
- `mobile.live.partnerActions` = Partner actions
- `mobile.live.actionsFor` = Actions · {name}
- `mobile.live.tapPartnerHint` = Tap a face for their actions

Translate if you can; else copy English. Keep JSON valid and keys alphabetically near other `mobile.live.*` if present.

## Done
RESULT + COMPLETE. List files touched. No MULTI_PASS.
