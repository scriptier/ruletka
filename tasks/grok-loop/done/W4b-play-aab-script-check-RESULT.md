# W4b build-aab-local.sh path check — RESULT

**Status:** COMPLETE  
**Date:** 2026-08-11  
**Connect risk:** none  
**Build run:** **no** (task: path check only)

## OWN

- RESULT-only (docs already honest)
- No edit to `docs/PLAY_UPLOAD.md` / `knowledge/specs/FINISH-PLAY-MULTI.md` — both already say **AAB for tip 0.1.366 MISSING**

## Verified

| Item | Result |
|------|--------|
| Script | **`mobile/scripts/build-aab-local.sh`** exists, executable (`-rwx`, 2146 bytes). **No** root `scripts/build-aab-local.sh` — must `cd mobile` first. |
| Runnable (preflight) | **Yes** — early checks the script enforces all pass: JDK 17 javac at `~/.local/jdk-17`, Android SDK platform 35 at `~/Android/Sdk`, keystore files present, `android/gradlew` present. |
| Keystore | `mobile/secrets/ruletka-upload.jks` (mode 600, 2194 bytes) + `keystore.properties` (mode 600, storeFile/storePassword/keyAlias/keyPassword set). Optional `credentials.json` present. |
| Tip version | `mobile/app.json` **0.1.366** / versionCode **374** — matches `android/app/build.gradle` |
| Sideload APK | **Present:** `mobile/artifacts/ruletka-0.1.366-vc374.apk` (+ `ruletka-latest.apk`, `ruletka-android-latest.apk` → same) |
| AAB for tip | **MISSING** — no `mobile/artifacts/ruletka-0.1.366-vc374.aab` |
| Stale AABs only | `mobile/artifacts/ruletka-0.1.0-vc{3,4,5,6}.aab` … `0.1.3-vc11.aab` (≤0.1.3, Aug 4–5). Do **not** upload as tip. |
| Gradle leftover | `mobile/android/app/build/outputs/bundle/release/app-release.aab` exists (56M, Aug 10) — **not** version-named tip artifact; do not invent path as tip AAB. |
| `play-status.sh` | FAIL only on tip AAB; OK on APK + keystore + listing/legal/docs (18 pass / 1 warn google-play.json / 1 fail AAB) |

## How to build when human asks

```bash
cd /home/drakosik/freenet-roulette/mobile

# Confirm tip
# app.json: 0.1.366 / versionCode 374
./scripts/play-status.sh
./scripts/play-status.sh --notes

# Play-uploadable AAB (no EAS free-tier queue)
./scripts/build-aab-local.sh
# optional one-shot versionCode override (patches android/app/build.gradle for that run):
# ./scripts/build-aab-local.sh 375

# Expected output after success:
#   android/app/build/outputs/bundle/release/app-release.aab
#   → artifacts/ruletka-0.1.366-vc374.aab   (VER/CODE from build.gradle)
```

**Prereqs (script-enforced):**

- `ANDROID_HOME` or `~/Android/Sdk` with `platforms/android-35`
- `JAVA_HOME` or `~/.local/jdk-17` with `javac`
- `mobile/secrets/ruletka-upload.jks` + `keystore.properties`

**Script steps (honest):**

1. Export `ANDROID_HOME` / `JAVA_HOME` / PATH defaults  
2. Exit if JDK, platform 35, or keystore missing  
3. Write `android/local.properties` (`sdk.dir`)  
4. Optional arg: patch `versionCode` in `android/app/build.gradle` for this run  
5. `./gradlew :app:bundleRelease --no-daemon`  
6. Copy to `mobile/artifacts/ruletka-<versionName>-vc<versionCode>.aab`

**Human only after build:** Play Console → **me.ruletka.app** → Testing → Internal testing → upload AAB; versionCode must be **>** last published on Play. Agents do not claim Console PASS.

## Tip still MISSING (0.1.366)

| Binary | Path | Status |
|--------|------|--------|
| APK tip | `mobile/artifacts/ruletka-0.1.366-vc374.apk` | **present** |
| AAB tip | `mobile/artifacts/ruletka-0.1.366-vc374.aab` | **MISSING** — build when human asks |

Do **not** invent tip AAB filename. Ancient AABs ≤0.1.3 are not substitutes.

## Docs

No doc edit this hop — already accurate:

- `docs/PLAY_UPLOAD.md` — tip 0.1.366/vc374; AAB MISSING; `cd mobile && ./scripts/build-aab-local.sh`
- `knowledge/specs/FINISH-PLAY-MULTI.md` — D1 partial; AAB tip MISSING

## Out of scope (honored)

- Full AAB / gradle build  
- Play Console upload  
- Secret push / git push  
- APK bump  

## Connect risk

**None** — filesystem / script preflight only.
