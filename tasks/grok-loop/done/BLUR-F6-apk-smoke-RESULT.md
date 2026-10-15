# BLUR-F6 APK rebuild + Hold smoke — RESULT

## Status
**COMPLETE**

## Gate
| Check | Result |
|-------|--------|
| `SoftBlurVideoViewManager` on disk | **yes** — `mobile/android/app/src/main/java/com/oney/WebRTCModule/SoftBlurVideoViewManager.java` |
| F2 RESULT COMPLETE | **yes** — `tasks/grok-loop/done/BLUR-F2-native-softblur-RESULT.md` |
| Package registration | **yes** — `MainApplication.kt` `packages.add(SoftBlurVideoViewPackage())` + `patch-android-native.sh` |
| Device | Pixel 9 Pro serial **45141FDAP0004F** (USB exclusive this hop; wireless twin disconnected) |

## OWN
- Phone exclusive one adb
- APK build via `mobile/scripts/build-apk-local.sh`
- Device smoke Hold + SoftBlur path evidence
- **Read-only** SoftBlur Java / SoftBlurRemote / LiveStageVideo / live.tsx Modal (no F2/F4/F5 edits)

## APK build
| Field | Value |
|-------|--------|
| Script | `SKIP_VERIFY=1 ./scripts/build-apk-local.sh --no-bump --no-push` (verify green earlier this hop; version already bumped) |
| Version | **0.1.368** / versionCode **376** |
| Artifact | `/home/drakosik/freenet-roulette/mobile/artifacts/ruletka-0.1.368-vc376.apk` |
| Latest pointer | `mobile/artifacts/ruletka-latest.apk` → same |
| Build log | `mobile/artifacts/apk-hook-f6.log` |
| Gradle | **BUILD SUCCESSFUL** (~11m 41s) |
| SoftBlur in DEX | **yes** — `SoftBlurVideoView`, `SoftBlurVideoViewManager`, `SoftBlurVideoViewPackage` strings present |
| Install | `adb -s 45141FDAP0004F install -r …/ruletka-0.1.368-vc376.apk` → **Success** |
| Device package | versionName **0.1.368** versionCode **376** lastUpdateTime **2026-08-11 22:24:14** |

Pre-APK verify (first attempt): L0 30 ok · L1 units ok · L2 hub soft WARN only · BUILD allowed. Bump path: **0.1.367/375 → 0.1.368/376**.

## Prefs setup (Hold)
UI automation (not invent):
1. Deeplink `ruletka://settings`
2. Expand **Match & language**
3. Scroll to **Stranger privacy veil**
4. Tap chip **Until I tap (default)**
5. Toast observed: **Privacy veil · Until I tap (default) · next stranger match**

Artifacts: `mobile/artifacts/device-smoke/f6-blur/04-hold.png`, `04f-hold.xml`.

## Smoke runs

### A) device-smoke.sh (WEB_PAIR, SKIP_INSTALL)
```bash
export ANDROID_HOME=$HOME/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$PATH
SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=35 PHONE_MODEL_PREFER="Pixel 9 Pro" \
  ./scripts/device-smoke.sh
```
| Field | Value |
|-------|--------|
| **When (ts)** | `20260812T042747Z` |
| **Device** | Pixel 9 Pro (`45141FDAP0004F`) |
| **SKIP_INSTALL** | **1** (APK already installed 0.1.368) |
| **WEB_PAIR** | 1 (partner stayed unmatched; phone matched **live stranger**) |
| **WAIT_S** | 35 |
| **Script verdict** | **UNKNOWN** (uiautomator only saw Modal chrome — no `live-report-btn` in dump under Modal; **false negative**) |
| **Visual / identity** | Partner **Драконов** ★204 CA Calgary; PiP self; **Privacy veil** + **Show video — ready** |

Screenshots (all three settle frames still veiled — Hold-like):
- `…/20260812T042747Z-01-after-deeplink.png` — soft-blur stage + modal chrome
- `…/20260812T042747Z-02-after-start.png` — same, veil stayed
- `…/20260812T042747Z-03-final.png` — same after 35s, still **Show video** (no auto-peel)

UI dumps: `live-blur-fullscreen` + `live-blur-show-video` present on all three.

**Logcat gap (run A):** smoke filter is `FATAL|ReactNative|AndroidRuntime` only; continuous capture was not running from cold start — first snippet missed early `[blur]` (buffer / timing). **Do not use run A alone for mode=hold PASS.**

### B) Focused Hold + SoftBlur recapture (authoritative logcat)
Cold start with continuous `adb logcat` after `logcat -c`:

| Field | Value |
|-------|--------|
| **When** | ~`20260812T043010Z` (device wall 22:30 local) |
| **Bundle** | `mobile/artifacts/device-smoke/f6-blur/20260812T043010Z/` |
| **prefs_load** | **`mode=hold`** (×2) |
| **`[blur] show`** | `why=match mode=hold` · `why=heal_matched mode=hold` · `why=stage … softNative=1` |
| **`[blur] hide` / intro peel** | **none** in capture window (no `intro_auto` / `intro_timeout`) |
| **softNative** | **`softNative=1`** on stage show |
| **Native SoftBlur** | `SoftBlurVideoView: Sink attached for …` **×2** |
| **Manager** | Registered (RN warn: no generated setter for `SoftBlurVideoViewManager` — expected without codegen; runtime OK) |
| **Hold stay** | `hold-stay.png` / `hold-stay.xml` still Privacy veil + Show video after +12s |

#### Evidence chain (logcat — run B)
```
08-11 22:30:21.899 SoftBlurVideoViewManager (ViewManagerPropertyUpdater warn — registered)
08-11 22:30:22.146 [blur] prefs_load mode=hold
08-11 22:30:25.383 [match] name=Драконов … peers=1
08-11 22:30:25.384 [blur] show why=match mode=hold
08-11 22:30:25.619 [blur] prefs_load mode=hold
08-11 22:30:27.819 [blur] show why=heal_matched mode=hold
08-11 22:30:27.847 [blur] show why=stage main=partner pip=self keepRtc=1 softNative=1
08-11 22:30:28.053 SoftBlurVideoView: Sink attached for 4185e7ed-…
08-11 22:30:32.696 SoftBlurVideoView: Sink attached for 82338f1e-…
```

Full log: `mobile/artifacts/device-smoke/f6-blur/20260812T043010Z/logcat-live.txt`

## Verdict table

| Claim | Result | Evidence |
|-------|--------|----------|
| APK 0.1.368 builds with SoftBlur native | **PASS** | assembleRelease SUCCESS + DEX class strings + install 376 |
| SoftBlur manager registered at runtime | **PASS** | ViewManagerPropertyUpdater line + `softNative=1` + Sink attached |
| Soft live blur under chrome (Hold) | **PASS** (visual + softNative + sink) | Screenshots soft pixelated partner under transparent Modal chrome; native sink |
| Hold mode active | **PASS** | `prefs_load mode=hold` + `show … mode=hold` |
| Veil stayed until Show video (Hold) | **PASS** (window observed) | No intro hide; UI still `live-blur-show-video` after 12s+ and run-A 35s settle |
| Multi-party SoftBlur | **NOT claimed** | 1v1 only (`peers=1`) |
| Off / Intro full matrix | **NOT claimed** | Settings set to Hold; Off/Intro not re-smoked this hop |
| device-smoke.sh auto-verdict MATCHED | **N/A fail-open** | Modal hides report/timer nodes → UNKNOWN; human/screenshot override |

## Paths

| Artifact | Path |
|----------|------|
| APK | `/home/drakosik/freenet-roulette/mobile/artifacts/ruletka-0.1.368-vc376.apk` |
| Build log | `/home/drakosik/freenet-roulette/mobile/artifacts/apk-hook-f6.log` |
| Hold settings shot | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/f6-blur/04-hold.png` |
| Run A shots | `…/device-smoke/20260812T042747Z-0{1,2,3}-*.png` |
| Run A UI | `…/device-smoke/20260812T042747Z-ui-*.xml` |
| Run B logcat | `…/device-smoke/f6-blur/20260812T043010Z/logcat-live.txt` |
| Run B hold-stay | `…/device-smoke/f6-blur/20260812T043010Z/hold-stay.png` |

## Explicit non-claims
- **No multi PASS** (3-way / 4-way SoftBlur tiles not exercised)
- **No Off/Intro product PASS** this hop
- **No force-push / product edits** to SoftBlur Java or F4/F5 files
- device-smoke auto-classifier **UNKNOWN** is **not** a product fail when Modal chrome occludes matched bar nodes

## Residual / notes
- `ViewManagerPropertyUpdater: Could not find generated setter for SoftBlurVideoViewManager` — harmless without RN codegen; props still applied.
- dual serial (USB + wireless) avoided by disconnecting wireless during smoke.
- For future smoke: start `adb logcat` **before** force-stop/start; filter should include `SoftBlurVideoView` and `ReactNativeJS` (not only FATAL).

## Done criteria
- [x] RESULT with device evidence (logcat `mode=hold` + `softNative=1` + Sink attached + screenshots)
- [x] Explicit non-claims (multi / Off / Intro)
- [x] Hold PASS only with `mode=hold` + veil stayed (no invent)
- [x] COMPLETE
- [x] Card → `tasks/grok-loop/done/BLUR-F6-apk-smoke.md`
