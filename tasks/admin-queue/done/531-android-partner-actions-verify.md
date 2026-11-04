# Android partner-actions verify-match-ux

## Goal
Static L0 asserts for tap-a-face partner actions.

## OWN
- `mobile/scripts/verify-match-ux.mjs` only

## Must not
- live.tsx, MediaSession, APK, deploy

## Assert
- LiveStageVideo has `onSelectPartner`
- first VideoView still `key="live-first-remote"`
- LiveMoreSheet has `actionSlot`
- live.tsx has `actionSlot`

If siblings not landed yet, add asserts anyway; note FAIL if missing.

## Done
RESULT + COMPLETE. Run `node mobile/scripts/verify-match-ux.mjs`.
