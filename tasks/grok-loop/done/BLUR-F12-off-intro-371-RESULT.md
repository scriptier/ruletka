# BLUR-F12 Off+Intro residual on tip 0.1.371 — RESULT

## Status
**BLOCKED** (Intro residual) — USB device disconnected mid-hop after Off PASS. No invent Intro/Hold/multi.

## Gate
| Check | Result |
|-------|--------|
| Device (when present) | Pixel 9 Pro serial **45141FDAP0004F** (USB exclusive; one adb) |
| Package | versionName **0.1.371** versionCode **379** lastUpdateTime **2026-08-11 23:20:19** (F11 install; no reinstall) |
| Soft product flag / SoftBlur on APK | yes (manager register warn + F11 Hold softNative=1 baseline) |
| Hold baseline | **PASS already in F11** — not re-invented here (`BLUR-F11-apk-resmoke-RESULT.md`) |
| Device at end of hop | **absent** — `adb devices` empty; `lsusb` no Google/Android; dmesg `usb 1-12: USB disconnect` |

## OWN
- Phone exclusive one adb (when attached)
- RESULT: this file; card `running/` → `done/`
- Read-only product code (no SoftBlur Java / LiveStageVideo / SoftBlurRemote edits)
- No force-push

## Package confirm
```
me.ruletka.app  versionName=0.1.371  versionCode=379
lastUpdateTime=2026-08-11 23:20:19
```

## Prefs setup (Off)
1. Deeplink `ruletka://settings`
2. Expand **Correspondance et langue** / scroll to privacy
3. Tap chip **Désactivé (par défaut)** (= Off)
4. Toast: **Voile de confidentialité · Désactivé (par défaut) · prochain match inconnu**

Artifacts:
- `mobile/artifacts/device-smoke/f12-blur/02-privacy-visible.png` + `.xml`
- `mobile/artifacts/device-smoke/f12-blur/03-after-off.png` + `.xml` (toast present)

## Smoke runs

### A) Off + match (authoritative logcat) — **PASS**
| Field | Value |
|-------|--------|
| **When (ts)** | `20260812T053916Z` (device wall ~23:39 local) |
| **Bundle** | `mobile/artifacts/device-smoke/f12-blur/off-20260812T053916Z/` |
| **Partner** | headless `phone-web-pair.mjs` → **WebPair** (`peers=1`) |
| **prefs_load** | **`mode=off`** (×2: cold start + post-match) |
| **`[blur] show`** | **none (0)** |
| **`[blur] hide`** | **none (0)** |
| **softNative=1** | **none (0)** |
| **SoftBlur Sink attached** | **none (0)** |
| **Match** | yes — `[match] name=WebPair … peers=1` |
| **App FATAL** | none (UiAutomationService "already registered" noise from concurrent uiautomator dumps only) |

#### Evidence chain (logcat — Off)
```
08-11 23:39:19.272 SoftBlurVideoViewManager (ViewManagerPropertyUpdater warn — registered)
08-11 23:39:19.551 [blur] prefs_load mode=off
08-11 23:39:31.565 [match] name=WebPair … peers=1
08-11 23:39:31.694 [blur] prefs_load mode=off
# 0× [blur] show / hide / softNative=1 / Sink attached
```

Full: `…/off-20260812T053916Z/logcat-full.txt`  
Extract: `…/off-20260812T053916Z/logcat-blur.txt`  
Shots: `01-after-deeplink.png`, `03-final.png`

**Screenshot note:** WebPair stage was short (ICE thrash / close, same pattern as F8 Off). **Off PASS is logcat-primary** — confirmed `mode=off` + match + **absence of privacy veil path**, consistent with `applyMatchBlurVeil` early-return when mode is not intro/hold.

### B) Intro + match — **BLOCKED (no device)**
| Field | Value |
|-------|--------|
| Settings → **Bref (~2,5 s)** / Intro | **not applied this hop** — USB disconnect before Intro setup |
| Match / show→intro_auto / softNative | **not exercised on 0.1.371** |
| Note | F8 covered Intro on **0.1.368** pre-flag APK; F11 re-smoked Hold only on **0.1.371**. This hop was residual Off+Intro on tip — Off done, Intro needs phone re-attach. |

## Verdict table

| Claim | Result | Evidence |
|-------|--------|----------|
| APK **0.1.371 / vc379** on device | **PASS** | dumpsys package (pre-disconnect) |
| Settings → Off applied | **PASS** | toast UI dump `03-after-off` + `prefs_load mode=off` |
| Off: no privacy veil path on match | **PASS** | match + **0×** `[blur] show` / softNative / Sink |
| Settings → Intro (Brief) applied | **BLOCKED** | no device for Intro setup |
| Intro: show then peel (intro_auto) | **BLOCKED** | no device |
| Intro softNative during privacy | **BLOCKED** | no device |
| Hold mode | **PASS (F11)** | not re-run; see `BLUR-F11-apk-resmoke-RESULT.md` |
| Multi-party SoftBlur | **NOT claimed** | 1v1 only when Off ran (`peers=1`) |
| Force-push / product edits | **none** | smoke + RESULT only |

## Paths

| Artifact | Path |
|----------|------|
| Settings Off toast | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/f12-blur/03-after-off.png` |
| Off run | `…/device-smoke/f12-blur/off-20260812T053916Z/` |
| Off logcat extract | `…/off-20260812T053916Z/logcat-blur.txt` |
| F11 Hold baseline | `tasks/grok-loop/done/BLUR-F11-apk-resmoke-RESULT.md` |
| Helper script (unused for product) | `…/f12-blur/run-f12-smoke.sh` |

## Explicit non-claims
- **No multi SoftBlur PASS** (3-way / 4-way tiles not exercised)
- **No invent Hold PASS** this hop (Hold remains **F11** evidence on 0.1.371)
- **No invent Intro PASS** on 0.1.371 (device gone before Intro)
- **No product code edits** / **no force-push**
- Off matched mid-call soft-blur visual not required (logcat absence is authority, same as F8)

## Residual / next hop
1. Re-attach Pixel 9 Pro USB (serial `45141FDAP0004F`).
2. Settings → **Bref (~2,5 s)** → toast Intro.
3. Match + web-pair → require `prefs_load mode=intro` + `[blur] show … mode=intro` → `hide why=intro_auto` + `softNative=1` + Sink attached.
4. Artifacts under `mobile/artifacts/device-smoke/f12-blur/intro-*`.
5. Still do **not** invent multi SoftBlur.

## Done criteria
- [x] Confirm package 0.1.371/379
- [x] Off → match → logcat mode=off, 0× blur show
- [ ] Intro → match → show→intro_auto, softNative=1 if privacy — **BLOCKED no device**
- [x] Artifacts under `mobile/artifacts/device-smoke/f12-blur/` (Off + settings)
- [x] Multi SoftBlur NOT claimed; Hold not re-claimed
- [x] RESULT written; card → done with honest **BLOCKED** status
