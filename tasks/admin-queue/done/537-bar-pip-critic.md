# Android bar vs PiP — critic (read-only)

## Goal
Read-only review after herd `20260815T225522Z`. Spec: `knowledge/specs/2026-08-15-android-bar-pip.md`.

## OWN
- write only `tasks/admin-queue/done/537-bar-pip-critic-RESULT.md`

## Must not
- edit product files, APK, deploy, MediaSession, invent MULTI_PASS

## Check
1. LiveBottomBar has no live-report-btn / live-friends-btn.
2. Stop/Next/icons left-aligned with paddingRight >= PIP_W (108).
3. LiveMoreSheet still has report.
4. Run `node mobile/scripts/verify-match-ux.mjs`.

## Done
Verdict SHIP or FIX. RESULT + COMPLETE.
