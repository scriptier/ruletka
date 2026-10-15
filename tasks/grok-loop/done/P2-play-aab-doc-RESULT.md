# P2 AAB build path verify — RESULT

## Status
**COMPLETE**

## OWN
- `docs/PLAY_UPLOAD.md` (short update)
- `docs/PLAY_INTERNAL_TEST_CHECKLIST.md` (version stamps)
- No AAB build, no Play upload

## Verified

| Item | Result |
|------|--------|
| `mobile/scripts/build-aab-local.sh` | **Exists**, executable (`-rwx`, 2146 bytes) |
| Version source `mobile/app.json` | **0.1.365** / `android.versionCode` **373** |
| `android/app/build.gradle` | Matches: `versionName "0.1.365"`, `versionCode 373` |
| Keystore | `secrets/ruletka-upload.jks` + `keystore.properties` present |
| Current AAB for tip | **Missing** — `play-status` FAIL on `artifacts/ruletka-0.1.365-vc373.aab` (stale AABs only up to ~0.1.3) |
| Latest sideload APK | `ruletka-0.1.364-vc372.apk` → `ruletka-android-latest.apk` (app.json one ahead) |
| Upload | **Not done** (task constraint) |

## Exact AAB steps (for Play internal test)

```bash
cd /home/drakosik/freenet-roulette/mobile

# Confirm stamps
# app.json: expo.version = 0.1.365, expo.android.versionCode = 373
./scripts/play-status.sh
./scripts/play-status.sh --notes

# One-time machine deps (script enforces)
#   ANDROID_HOME or ~/Android/Sdk  (platform android-35)
#   JAVA_HOME or ~/.local/jdk-17   (javac)
#   secrets/ruletka-upload.jks + secrets/keystore.properties

# Build Play-uploadable AAB (no EAS)
./scripts/build-aab-local.sh
# optional versionCode override for this build only:
# ./scripts/build-aab-local.sh 374

# Output
#   android/app/build/outputs/bundle/release/app-release.aab
#   → artifacts/ruletka-0.1.365-vc373.aab   (VER/CODE read from build.gradle)

# Human only: Play Console → Testing → Internal testing → upload AAB
# versionCode must be > last published on Play
```

Script behavior (honest):
1. Sets `ANDROID_HOME` / `JAVA_HOME` / PATH defaults  
2. Fails if JDK, SDK platform 35, or keystore missing  
3. Writes `android/local.properties` (`sdk.dir`)  
4. Optional arg patches `versionCode` in `android/app/build.gradle` for that run  
5. Runs `./gradlew :app:bundleRelease`  
6. Copies release AAB to `mobile/artifacts/ruletka-<versionName>-vc<versionCode>.aab`

## Docs updated

- [`docs/PLAY_UPLOAD.md`](../../../docs/PLAY_UPLOAD.md) — ship tip **0.1.365 / 373**; rebuild section with full `build-aab-local.sh` steps; agent no-upload wall  
- [`docs/PLAY_INTERNAL_TEST_CHECKLIST.md`](../../../docs/PLAY_INTERNAL_TEST_CHECKLIST.md) — version stamps **0.1.365 / vc373**; preflight AAB steps; internal track release name

## Out of scope
- Running `build-aab-local.sh` / producing new AAB  
- Play Console upload  
- APK bump / sideload  
- `PLAY_OPS.md` / `PLAY_TODAY.md` (not OWN)

## Connect risk
**None** — docs only.
