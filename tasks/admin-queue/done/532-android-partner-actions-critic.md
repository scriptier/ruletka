# Second critic: Android tap-face partner actions

## Goal
Read-only review of Android tap-a-face hop vs spec `knowledge/specs/2026-08-15-android-partner-actions.md`.

## OWN
- `tasks/admin-queue/done/532-android-partner-actions-critic-RESULT.md` only (write RESULT)

## Must not
- Edit any product code. No APK. No deploy. No ICE.

## Check
1. 1v1 tap opens sheet without remounting first RTCView
2. 3-way extra tap targets extra, not only focus toggle
3. extra report does not tear primary
4. Dual-write / hunt remount / MediaSession thrash

## Done
RESULT COMPLETE. Verdict: SHIP / FIX (list files). No MULTI_PASS invent.
