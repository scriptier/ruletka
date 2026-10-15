# UNIT: verify-match-ux + SoftBlur product flag

## Goal
Run match-ux unit harness; confirm `SOFT_BLUR_PRODUCT_ENABLED = true` still on disk post F10. **No adb/APK** — F11 owns phone exclusive.

## OWN
- RUN: `node mobile/scripts/verify-match-ux.mjs` (and any quick related unit if cheap)
- READ: `mobile/src/live/SoftBlurRemote.tsx` flag line only
- RESULT: `tasks/grok-loop/done/UNIT-overnight-match-ux-RESULT.md`

## Must not
- adb / APK install (F11 exclusive)
- MediaSession thrash / invent multi or blur device PASS
- deploy / force-push

## Done
RESULT with exit codes, ok/fail counts, flag = true evidence
