# BLUR-F11 APK rebuild + soft re-smoke after enable — RESULT

## Status
**COMPLETE**

## Gate
| Check | Result |
|-------|--------|
| F10 RESULT COMPLETE | **yes** — `tasks/grok-loop/done/BLUR-F10-soft-enable-RESULT.md` |
| `SOFT_BLUR_PRODUCT_ENABLED = true` on disk | **yes** — `mobile/src/live/SoftBlurRemote.tsx` L37 |
| Device | Pixel 9 Pro serial **45141FDAP0004F** (USB exclusive; one adb) |
| Product code race with F10 | none — F10 already COMPLETE before build |

## OWN
- Phone exclusive one adb
- APK build via `mobile/scripts/build-apk-local.sh`
- Device Hold re-smoke after F10 flag enable
- Read-only SoftBlur Java / LiveStageVideo / SoftBlurRemote (no product edits)
- RESULT: this file; card `running/` → `done/`

## APK build
| Field | Value |
|-------|--------|
| Script | `SKIP_VERIFY=1 ./scripts/build-apk-local.sh --no-bump --no-push` |
| Version | **0.1.371** / versionCode **379** (tip was 0.1.370-vc378; tree already at 371/379) |
| Artifact | `/home/drakosik/freenet-roulette/mobile/artifacts/ruletka-0.1.371-vc379.apk` |
| Latest pointer | `mobile/artifacts/ruletka-latest.apk` → same |
| Build log | `mobile/artifacts/apk-hook-f11.log` |
| Gradle | **BUILD SUCCESSFUL** (~6m 43s resume; JS bundle recreated with F10 flag) |
| SoftBlur in DEX | **yes** — `SoftBlurVideoView`, `SoftBlurVideoViewManager`, `SoftBlurVideoViewPackage` |
| JS product flag in release bundle | **yes** — `SOFT_BLUR_PRODUCT_ENABLED` string present in `assets/index.android.bundle` |
| Install | `adb -s 45141FDAP0004F install -r …/ruletka-0.1.371-vc379.apk` → **Success** |
| Device package | versionName **0.1.371** versionCode **379** lastUpdateTime **2026-08-11 23:20:19** |

## Prefs setup (Hold)
UI automation (French locale on device; not invent):
1. Deeplink `ruletka://settings`
2. Expand **Correspondance et langue** (Match & language)
3. Scroll to **Voile de confidentialité pour les inconnus**
4. Tap chip **Jusqu'à ce que je touche** (= Until I tap / Hold)
5. Toast: **Voile de confidentialité · Jusqu'à ce que je touche · prochain match inconnu**

Artifacts: `mobile/artifacts/device-smoke/f11-blur/04-hold.png`, `04-hold.xml`, `03e-found.png`.

## Smoke runs

### A) First attempt (short WebPair — stage not reached)
| Field | Value |
|-------|--------|
| Bundle | `…/f11-blur/20260812T052358Z/` |
| Outcome | `prefs_load mode=hold` + `[blur] show why=match mode=hold` + SoftBlur manager registered |
| softNative / Sink | **none** (ICE thrash; WebPair closed before stage path) |
| Note | Not used for PASS — incomplete stage attach |

### B) Authoritative Hold + SoftBlur (post-F10 APK)
| Field | Value |
|-------|--------|
| **When (ts)** | `20260812T052621Z` (device wall ~23:26–23:27 local) |
| **Bundle** | `mobile/artifacts/device-smoke/f11-blur/hold-20260812T052621Z/` |
| **Partner** | headless `phone-web-pair.mjs` → **WebPair** (`peers=1`) |
| **prefs_load** | **`mode=hold`** (×3) |
| **`[blur] show`** | `why=match mode=hold` · `why=heal_matched mode=hold` · `why=stage … softNative=1` · `why=veil_full` |
| **`[blur] hide` / intro peel** | **none** in capture (Hold stay) |
| **softNative** | **`softNative=1`** on stage show |
| **Native SoftBlur** | `SoftBlurVideoView: Sink attached for e7df3107-…` |
| **Manager** | Registered (RN warn: no generated setter for `SoftBlurVideoViewManager` — expected without codegen; runtime OK) |
| **Hold stay visual** | Privacy modal chrome + soft/blocky stage under veil; **Afficher la vidéo – prêt** (Show video — ready) |

#### Evidence chain (logcat — run B)
```
08-11 23:26:50.895 SoftBlurVideoViewManager (ViewManagerPropertyUpdater warn — registered)
08-11 23:26:51.159 [blur] prefs_load mode=hold
08-11 23:27:06.157 [match] name=WebPair … peers=1
08-11 23:27:06.157 [blur] show why=match mode=hold
08-11 23:27:21.345 [match] name=WebPair … peers=1
08-11 23:27:21.345 [blur] show why=match mode=hold
08-11 23:27:23.027 [blur] show why=heal_matched mode=hold
08-11 23:27:23.056 [blur] show why=stage main=partner pip=self keepRtc=1 softNative=1
08-11 23:27:23.056 [blur] show why=veil_full
08-11 23:27:23.228 SoftBlurVideoView: Sink attached for e7df3107-fa45-480f-9e10-47a470c37f39
```

Full log: `mobile/artifacts/device-smoke/f11-blur/hold-20260812T052621Z/logcat-full.txt`  
Extract: `…/logcat-blur.txt`  
Shots: `03-final.png`, `hold-stay.png` (veil stayed; Show video ready)

### Intro (optional)
**Not re-smoked this hop** (Hold path was the F11 gate; F8 already covered Intro on pre-flag APK). No invent Intro PASS.

## Verdict table

| Claim | Result | Evidence |
|-------|--------|----------|
| F10 gate + product flag true | **PASS** | F10 RESULT COMPLETE; disk `SOFT_BLUR_PRODUCT_ENABLED = true` |
| APK 0.1.371 builds with SoftBlur native + flag | **PASS** | assembleRelease SUCCESS + DEX class strings + bundle flag string + install vc379 |
| SoftBlur manager registered at runtime | **PASS** | ViewManagerPropertyUpdater line + `softNative=1` + Sink attached |
| Soft live blur path after F10 enable (Hold) | **PASS** | logcat `softNative=1` + `Sink attached` + stage show |
| Hold mode active | **PASS** | `prefs_load mode=hold` + `show … mode=hold` + Settings toast |
| Veil stayed until Show video (Hold) | **PASS** (window observed) | No intro hide; UI still privacy modal + Show video after settle |
| Multi-party SoftBlur | **NOT claimed** | 1v1 only (`peers=1`) |
| Off / Intro re-smoke on 0.1.371 | **NOT claimed** | Hold only this hop |
| Force-push / product edits | **none** | build+install+smoke only |

## Paths

| Artifact | Path |
|----------|------|
| APK | `/home/drakosik/freenet-roulette/mobile/artifacts/ruletka-0.1.371-vc379.apk` |
| Build log | `/home/drakosik/freenet-roulette/mobile/artifacts/apk-hook-f11.log` |
| Settings Hold | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/f11-blur/04-hold.png` |
| Authoritative run B | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/f11-blur/hold-20260812T052621Z/` |
| Run B logcat | `…/hold-20260812T052621Z/logcat-full.txt` |
| Run B hold-stay | `…/hold-20260812T052621Z/hold-stay.png` |
| Incomplete run A | `…/f11-blur/20260812T052358Z/` (match only; no stage softNative) |

## Explicit non-claims
- **No multi PASS** (3-way / 4-way SoftBlur tiles not exercised)
- **No Off/Intro product PASS** on 0.1.371 this hop
- **No force-push**
- SoftBlur Java / LiveStageVideo / SoftBlurRemote **not edited** (F10 already flipped flag)
- WebPair short thrash on run A is **not** a product fail; run B is authoritative

## Residual / notes
- Device UI language was French during Settings; Hold chip = **Jusqu'à ce que je touche**.
- Soft stage under WebPair fake media paints as large soft color blocks (downscale path); logcat `softNative=1` + Sink is the hard evidence for native SoftBlur path selection after F10 enable.
- `ViewManagerPropertyUpdater: Could not find generated setter for SoftBlurVideoViewManager` — harmless without RN codegen.
- Dual serial avoided (USB only).

## Done criteria
- [x] Gate F10 COMPLETE + flag true (or honest BLOCKED — not needed)
- [x] APK rebuild/install tip **0.1.371-vc379**
- [x] Hold match logcat `softNative=1` + Sink attached
- [x] Artifacts under `mobile/artifacts/device-smoke/f11-blur/`
- [x] Explicit non-claims (multi / Off / Intro)
- [x] COMPLETE
- [x] Card → `tasks/grok-loop/done/BLUR-F11-apk-resmoke.md`
