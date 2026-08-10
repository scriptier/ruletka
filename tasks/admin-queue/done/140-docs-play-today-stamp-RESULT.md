# 140 — docs/PLAY_TODAY.md version stamp — RESULT

## Status
Done

## Audit
`docs/PLAY_TODAY.md` is an untracked scratch doc (not in git history). It was
stamped **0.1.230 (236)**, stale against the working tree's actual build
identity. Cross-checked the source of truth:
- `mobile/app.json` → `version: 0.1.252`, `android.versionCode: 260`
- `mobile/android/app/build.gradle` → `versionCode 260`, `versionName "0.1.252"`

Both agree, so `0.1.252 / 260` is the correct current stamp.

## Fix
Minimal fix — updated only the version/versionCode/APK-path references in
`docs/PLAY_TODAY.md` (title, Package table, Smoke `adb install` command, badge
line). Left the Fixes list and Smoke script commands untouched since they're
still accurate and out of scope for a version-stamp task. No `t()` i18n keys
apply — this file is a plain internal ops doc, not app-facing UI copy.

## Files touched
- `docs/PLAY_TODAY.md`

## Verify commands run
- `grep -n "versionCode\|versionName" mobile/android/app/build.gradle`
- `grep -n '"version"\|versionCode' mobile/app.json`
- Manual diff review of `docs/PLAY_TODAY.md` after edit

## Connect risk
none — docs-only change, no code/runtime paths touched.

COMPLETE
