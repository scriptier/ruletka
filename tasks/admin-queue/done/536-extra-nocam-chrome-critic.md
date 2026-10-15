# Android extra no-cam chrome — critic (read-only)

## Goal
Read-only review after herd `20260815T220529Z`. Spec: `knowledge/specs/2026-08-15-android-extra-nocam-chrome.md`.

## OWN
- write only `tasks/admin-queue/done/536-extra-nocam-chrome-critic-RESULT.md`

## Must not
- edit product files, APK, deploy, MediaSession, invent MULTI_PASS

## Check
1. ExtraRemoteTile paints StageTileChrome when tileNoCam / advertisedNoCam.
2. Name · ★ · loc · one flag over NoCamPortrait (elevation/zIndex). Loc omitFlag.
3. First VideoView key="live-first-remote" stays.
4. Run `node mobile/scripts/verify-match-ux.mjs` and `node mobile/src/live/stageStreams.test.mjs`.

## Done
Verdict SHIP or FIX. RESULT + COMPLETE.
