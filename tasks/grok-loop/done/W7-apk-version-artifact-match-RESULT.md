# W7-apk-version-artifact-match — RESULT

**Status:** COMPLETE  
**OWN:** RESULT-only under `tasks/grok-loop/done/` (read-only audit of `mobile/app.json` + `mobile/artifacts/`)  
**Date:** 2026-08-12  
**Code change:** none  
**APK build:** none (card forbids)

## Goal
Honest match check: `app.json` **0.1.366 / vc374** vs `mobile/artifacts` APK names (and embedded package meta).

## Verdict
**MATCH** — `app.json` version + versionCode equal artifact filename, latest symlinks/copies, and aapt-embedded package fields.

| Source | versionName | versionCode | Notes |
|--------|-------------|-------------|-------|
| `mobile/app.json` `expo.version` | **0.1.366** | — | disk |
| `mobile/app.json` `expo.android.versionCode` | — | **374** | disk |
| Artifact filename | **0.1.366** | **374** | `ruletka-0.1.366-vc374.apk` |
| aapt `dump badging` (embedded) | **0.1.366** | **374** | `package: name='me.ruletka.app' versionCode='374' versionName='0.1.366'` |
| `ruletka-android-latest.apk` | same | same | symlink → `ruletka-0.1.366-vc374.apk` |
| `ruletka-latest.apk` | same | same | byte-identical copy (same md5) |

## Evidence

### 1. app.json (source of truth for next build)
```
version: 0.1.366
android.versionCode: 374
ios.buildNumber: 1   (iOS only; not part of APK name)
package: me.ruletka.app
```

Path: `/home/drakosik/freenet-roulette/mobile/app.json`

### 2. Artifact names
| Path | Size | mtime | Role |
|------|------|-------|------|
| `mobile/artifacts/ruletka-0.1.366-vc374.apk` | 61 422 004 B | 2026-08-11 19:49:08 -0600 | versioned ship APK |
| `mobile/artifacts/ruletka-android-latest.apk` | symlink | same hop | → `ruletka-0.1.366-vc374.apk` |
| `mobile/artifacts/ruletka-latest.apk` | 61 422 004 B | 2026-08-11 19:49:08 -0600 | copy of same APK |

Highest named `ruletka-0.1.*-vc*.apk` in artifacts is **0.1.366-vc374** (above 0.1.365-vc373).

### 3. Embedded package (aapt)
```
package: name='me.ruletka.app' versionCode='374' versionName='0.1.366'
sdkVersion:'24' targetSdkVersion:'35'
```

Filename is not lying: embedded versionName/versionCode match the `0.1.366-vc374` name and `app.json`.

### 4. Integrity cross-check
```
md5 78387174ae995af1ced68135db688330  ruletka-0.1.366-vc374.apk
md5 78387174ae995af1ced68135db688330  ruletka-latest.apk
```

## Mismatch?
**None** for versionName / versionCode / package / latest pointers.

Optional notes (not failures for this goal):
- iOS `buildNumber` remains `"1"` — not encoded in Android APK names.
- No `ui/download/ruletka-0.1.366*` mirror present at audit time (download publish out of OWN; not required for artifact match).

## Not done (by design)
- No APK/AAB rebuild
- No `app.json` bump
- No deploy / push / Play upload
- No invent device smoke PASS / GOAL_MET

## Files
- Read: `/home/drakosik/freenet-roulette/mobile/app.json`
- Read: `/home/drakosik/freenet-roulette/mobile/artifacts/ruletka-0.1.366-vc374.apk` (+ latest links)
- Card: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/W7-apk-version-artifact-match.md`
- This RESULT: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/W7-apk-version-artifact-match-RESULT.md`

## COMPLETE
**MATCH** app.json **0.1.366 / vc374** ↔ artifacts **ruletka-0.1.366-vc374.apk** (filename + aapt + latest pointers). No build.
