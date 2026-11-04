# BLUR-F8 Off + Intro residual device smoke — RESULT

## Status
**COMPLETE**

## Gate
| Check | Result |
|-------|--------|
| Device | Pixel 9 Pro serial **45141FDAP0004F** (USB exclusive; one adb) |
| Package | versionName **0.1.368** versionCode **376** lastUpdateTime **2026-08-11 22:24:14** (F6 install; no reinstall needed) |
| SoftBlur on disk / registered | yes (manager warn + runtime path on Intro) |
| Hold baseline | **PASS already in F6** — not re-invented here |

## OWN
- Phone exclusive one adb
- Settings prefs + logcat + screenshots only
- Read-only product code (no SoftBlur Java / live.tsx edits)

## Prefs setup

### Off
1. Deeplink `ruletka://settings`
2. Expand **Match & language**
3. Scroll to **Stranger privacy veil**
4. Tap chip **Off**
5. Toast: **Privacy veil · Off · next stranger match**

Artifacts: `mobile/artifacts/device-smoke/f8-blur/03-after-off.png`, `03-after-off.xml`

### Intro (Brief)
1. Same Settings path
2. Tap chip **Brief (~2.5s)**
3. Toast: **Privacy veil · Brief (~2.5s) · next stranger match**

Artifacts: `mobile/artifacts/device-smoke/f8-blur/04-after-intro.png`, `04-after-intro.xml`

## Smoke runs

### A) Off + match (authoritative logcat)
| Field | Value |
|-------|--------|
| **When (ts)** | `20260812T044534Z` |
| **Bundle** | `mobile/artifacts/device-smoke/f8-blur/off-20260812T044534Z/` |
| **Partner** | headless `phone-web-pair.mjs` → **WebPair** (`peers=1`) |
| **prefs_load** | **`mode=off`** (×2: cold start + post-match) |
| **`[blur] show`** | **none** (0) |
| **`[blur] hide`** | **none** (0) |
| **softNative=1** | **none** |
| **SoftBlur Sink attached** | **none** |
| **Match** | yes — `[match] name=WebPair … peers=1` |

#### Evidence chain (logcat — Off)
```
08-11 22:45:42.195 [blur] prefs_load mode=off
08-11 22:45:53.557 [match] name=WebPair … peers=1
08-11 22:45:53.799 [blur] prefs_load mode=off
# no [blur] show / hide / softNative=1 / Sink attached in capture
```

Full: `…/off-20260812T044534Z/logcat-full.txt`  
Extract: `…/off-20260812T044534Z/logcat-blur.txt`

**Screenshot note:** WebPair call was short (~3s ICE thrash / close); settle frames landed idle after disconnect. **Off PASS is logcat-primary** (mode=off + match + absence of privacy veil path), consistent with `applyMatchBlurVeil` early-return when mode is not intro/hold.

### B) Intro + match (authoritative logcat + peel visual)
| Field | Value |
|-------|--------|
| **When (ts)** | `20260812T044839Z` |
| **Bundle** | `mobile/artifacts/device-smoke/f8-blur/intro-20260812T044839Z/` |
| **Partner** | live stranger **Драконов** ★204 CA Calgary (`peers=1`; web-pair also up) |
| **prefs_load** | **`mode=intro`** (×2) |
| **`[blur] show`** | `why=match mode=intro` · `why=heal_matched mode=intro` · `why=stage … softNative=1` |
| **`[blur] hide`** | `why=intro_auto` (+ stage hide); later `why=intro_timeout` max-wait rearm peel |
| **softNative** | **`softNative=1`** on stage show |
| **Native SoftBlur** | `SoftBlurVideoView: Sink attached for 2ea3976d-…` |
| **Visual after peel** | Clear partner cam + toast **Partner video shown** (`shot-01.png`, `peel-01.png` …) |

#### Evidence chain (logcat — Intro)
```
08-11 22:48:47.354 [blur] prefs_load mode=intro
08-11 22:48:50.621 [match] name=Драконов … peers=1
08-11 22:48:50.621 [blur] show why=match mode=intro
08-11 22:48:52.068 [blur] show why=heal_matched mode=intro
08-11 22:48:52.102 [blur] show why=stage main=partner pip=self keepRtc=1 softNative=1
08-11 22:48:52.240 SoftBlurVideoView: Sink attached for 2ea3976d-…
08-11 22:48:55.910 [blur] hide why=stage keepRtc=1
08-11 22:48:55.914 [blur] hide why=intro_auto
08-11 22:48:58.741 [blur] intro max wait peel why=intro_timeout rearm=2 waited=8120ms
08-11 22:48:58.741 [blur] hide why=intro_timeout
```

Full: `…/intro-20260812T044839Z/logcat-full.txt`  
Extract: `…/intro-20260812T044839Z/logcat-blur.txt`  
Post-peel shots: `shot-01.png`, `peel-01.png` … `peel-12.png` (clear video; intro show window ~5s before first frame in poll — peel already done by first 1s peel shot)

## Verdict table

| Claim | Result | Evidence |
|-------|--------|----------|
| APK 0.1.368 / vc376 on device | **PASS** | dumpsys package |
| Settings → Off applied | **PASS** | toast UI dump + `prefs_load mode=off` |
| Off: no privacy veil path on match | **PASS** | match + **0×** `[blur] show` / softNative / Sink |
| Settings → Intro (Brief) applied | **PASS** | toast UI dump + `prefs_load mode=intro` |
| Intro: show then peel | **PASS** | `show … mode=intro` → `hide why=intro_auto` (+ softNative + Sink) |
| Intro softNative during privacy | **PASS** | `softNative=1` + Sink attached |
| Hold mode | **PASS (F6)** | not re-run; see `BLUR-F6-apk-smoke-RESULT.md` |
| Multi-party SoftBlur | **NOT claimed** | 1v1 only (`peers=1`) |
| Off long-hold matched screenshot | **N/A weak visual** | call dropped fast; logcat is authority |

## Paths

| Artifact | Path |
|----------|------|
| Settings Off toast | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/f8-blur/03-after-off.png` |
| Settings Intro toast | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/f8-blur/04-after-intro.png` |
| Off run | `…/device-smoke/f8-blur/off-20260812T044534Z/` |
| Intro run | `…/device-smoke/f8-blur/intro-20260812T044839Z/` |
| F6 Hold baseline | `tasks/grok-loop/done/BLUR-F6-apk-smoke-RESULT.md` |

## Explicit non-claims
- **No multi SoftBlur PASS** (3-way / 4-way tiles not exercised)
- **No invent Hold PASS** this hop (Hold remains F6 evidence)
- **No product code edits** (SoftBlur Java / live.tsx / Modal chrome)
- Off matched **mid-call soft-blur visual** not captured (short WebPair); Off verdict rests on **logcat absence of veil path** after confirmed `mode=off` match

## Residual / notes
- Intro peel is fast (~5s match→intro_auto); denser pre-peel screenshot timing needed if visual soft-blur during intro is required in a future hop.
- `intro_timeout` rearm peel after `intro_auto` is expected max-wait path (BM2b); primary product signal is **intro_auto**.
- dual adb avoided; single serial USB Pixel 9 Pro.
- Start `adb logcat` before force-stop/start; filter ReactNativeJS + SoftBlurVideoView.

## Done criteria
- [x] RESULT with Off + Intro evidence
- [x] Explicit: multi SoftBlur still NOT claimed; Hold already F6
- [x] COMPLETE; card → done
