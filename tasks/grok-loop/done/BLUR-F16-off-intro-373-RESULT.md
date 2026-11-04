# BLUR-F16b Off+Intro reconfirm on tip 0.1.373+ — RESULT

## Status
**PASS (Off+Intro COMPLETE)** — Residual Off/Intro reconfirm on post-MX tip closed. Device package advanced past card floor: **0.1.374-vc382** (still ≥0.1.373+). Evidence: Off → match → `mode=off` + **0×** `[blur] show`; Intro → match → `mode=intro` show → `hide why=intro_auto` + `softNative=1` + SoftBlur Sink. Hold remains **F15** (not re-run). Multi SoftBlur **NOT claimed**. Read-only product; no force-push.

## Gate
| Check | Result |
|-------|--------|
| Device | Pixel 9 Pro; exclusive wireless adb **`192.168.1.94:42227`** (USB `45141FDAP0004F` **no permissions** / udev — not used; no dual adb) |
| Package | versionName **0.1.374** versionCode **382** lastUpdateTime **2026-08-12 00:34:14** (tip advanced vs card 0.1.373; F16 did **not** install/rebuild) |
| Soft product / SoftBlur | yes — SoftBlurVideoViewManager register warn + Intro stage `softNative=1` + Sink |
| Hold baseline | **PASS already in F15** — not re-run (`BLUR-F15-hold-soft-reconfirm-RESULT.md` on 0.1.373-vc381) |
| Product code edits | **none** (read-only) |
| Force-push | **none** |

## OWN
- Phone exclusive one adb (wireless serial only)
- RESULT: this file; card `running/BLUR-F16-off-intro-373.md` → `done/`
- Read-only product
- No invent multi SoftBlur PASS; no invent Hold PASS this hop

## Package confirm
```
me.ruletka.app  versionName=0.1.374  versionCode=382
lastUpdateTime=2026-08-12 00:34:14
```
Capture: `mobile/artifacts/device-smoke/f16-blur/meta-device.txt`

## Prefs setup

### Off
1. Deeplink `ruletka://settings`
2. Expand Match section / scroll to privacy
3. Tap chip **Désactivé (par défaut)** (= Off; FR locale at start of hop)
4. Toast: **Voile de confidentialité · Désactivé (par défaut) · prochain match inconnu**

Artifacts:
- `mobile/artifacts/device-smoke/f16-blur/off-setup-04-after-tap.png` + `.xml`

### Intro
1. Deeplink `ruletka://settings` (UI locale EN during Intro setup)
2. Scroll to **Stranger privacy veil** chips
3. Tap chip **Brief (~2.5s)** (= Intro)
4. Toast: **Privacy veil · Brief (~2.5s) · next stranger match**

Artifacts:
- `mobile/artifacts/device-smoke/f16-blur/intro-setup-04-after-tap.png` + `.xml`

## Smoke runs

### A) Off + match (authoritative logcat) — **PASS**
| Field | Value |
|-------|--------|
| **When (ts)** | `20260812T064717Z` (device wall ~00:47:22–00:48:15 local) |
| **Bundle** | `mobile/artifacts/device-smoke/f16-blur/off-20260812T064717Z/` |
| **Partner** | headless `phone-web-pair.mjs` → **WebPair** (`peers=1`) |
| **prefs_load** | **`mode=off`** (×4 across cold start + matches) |
| **`[blur] show`** | **none (0)** |
| **`[blur] hide`** | **none (0)** |
| **softNative=1** | **none (0)** |
| **SoftBlur Sink attached** | **none (0)** |
| **Match** | yes — `[match] name=WebPair … peers=1` (two match events) |
| **App FATAL** | none product |

#### Evidence chain (logcat — Off)
```
08-12 00:47:22.503 SoftBlurVideoViewManager (ViewManagerPropertyUpdater warn — registered)
08-12 00:47:22.773 [blur] prefs_load mode=off
08-12 00:47:55.596 [blur] prefs_load mode=off
08-12 00:47:58.794 [match] name=WebPair … peers=1
08-12 00:47:59.007 [blur] prefs_load mode=off
08-12 00:48:15.522 [match] name=WebPair … peers=1
08-12 00:48:15.655 [blur] prefs_load mode=off
# 0× [blur] show / hide / softNative=1 / Sink attached
```

Full: `…/off-20260812T064717Z/logcat-full.txt`  
Extract: `…/off-20260812T064717Z/logcat-blur.txt`  
Shots: `01-after-deeplink.png`, `matched.png`, `03-final.png`

**Screenshot note:** WebPair stage can be short (ICE thrash / rematch), same class as F8/F12 Off. **Off PASS is logcat-primary** — `mode=off` + match + **absence of privacy veil path**.

### B) Intro + match (authoritative logcat) — **PASS**
| Field | Value |
|-------|--------|
| **When (ts)** | `20260812T065627Z` (device wall ~00:56:30–00:56:45 local) |
| **Bundle** | `mobile/artifacts/device-smoke/f16-blur/intro-20260812T065627Z/` |
| **Partner** | live stranger **Драконов** ★204 CA Calgary (`peers=1`; web-pair also up) |
| **prefs_load** | **`mode=intro`** |
| **`[blur] show`** | `why=match mode=intro` · `why=heal_matched mode=intro` · `why=stage … softNative=1` |
| **`[blur] hide`** | `why=stage keepRtc=1` · **`why=intro_auto`** (+ later `intro_timeout` max-wait rearm — same F8/F14 pattern) |
| **softNative** | **`softNative=1`** on stage show |
| **Native SoftBlur** | `SoftBlurVideoView: Sink attached for d7e9dec7-7ddd-44f1-9939-c84c5710d669` |
| **Manager** | Registered (RN warn: no generated setter for SoftBlurVideoViewManager — expected without codegen) |
| **App FATAL** | none product; UiAutomationService "already registered" noise only (concurrent uiautomator dumps) |

#### Evidence chain (logcat — Intro authoritative)
```
08-12 00:56:30.897 [blur] prefs_load mode=intro
08-12 00:56:33.272 [blur] prefs_load mode=intro
08-12 00:56:36.467 [blur] show why=match mode=intro
08-12 00:56:36.467 [match] name=Драконов … peers=1
08-12 00:56:37.732 [blur] show why=heal_matched mode=intro
08-12 00:56:37.755 [blur] show why=stage main=partner pip=self keepRtc=1 softNative=1
08-12 00:56:37.882 SoftBlurVideoView: Sink attached for d7e9dec7-…
08-12 00:56:41.788 [blur] hide why=stage keepRtc=1
08-12 00:56:41.794 [blur] hide why=intro_auto
08-12 00:56:45.721 [blur] intro max wait peel why=intro_timeout rearm=2 waited=9254ms
```

Full: `…/intro-20260812T065627Z/logcat-full.txt`  
Extract: `…/intro-20260812T065627Z/logcat-blur.txt`  
Shots: `01-after-deeplink.png`, `peel-*.png`, `03-final.png`  
Settings toast: `intro-setup-04-after-tap.png`

**Notes:**
- Primary peel signal is **`intro_auto`** (~4s after soft stage). Subsequent `intro_timeout` rearm is expected max-wait path after peel (same as F8/F14).
- Soft product path selected on tip 374 (`softNative=1` + Sink) consistent with F14 (371) / F15 Hold (373).

## Verdict table

| Claim | Result | Evidence |
|-------|--------|----------|
| Device usable adb (wireless exclusive) | **PASS** | `192.168.1.94:42227` device; USB no-permissions unused |
| Package tip ≥ **0.1.373** | **PASS (0.1.374/vc382)** | dumpsys; advanced past 373 mid-nightly; F16 did not install |
| Settings → Off applied | **PASS** | toast UI dump + `prefs_load mode=off` |
| Off: no privacy veil path on match | **PASS** | match + **0×** `[blur] show` / softNative / Sink |
| Settings → Intro (Brief) applied | **PASS** | toast `Privacy veil · Brief (~2.5s)` + `prefs_load mode=intro` |
| Intro: show then peel (`hide why=intro_auto`) | **PASS** | match→show mode=intro → hide intro_auto |
| Intro softNative during privacy | **PASS** | `softNative=1` + Sink attached |
| Hold mode | **PASS (F15 only)** | not re-run; see `BLUR-F15-hold-soft-reconfirm-RESULT.md` |
| Multi-party SoftBlur | **NOT claimed** | 1v1 only (`peers=1`) |
| Force-push / product edits | **none** | smoke + RESULT only |

## Paths

| Artifact | Path |
|----------|------|
| Settings Off toast | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/f16-blur/off-setup-04-after-tap.png` |
| Settings Intro toast | `…/device-smoke/f16-blur/intro-setup-04-after-tap.png` |
| Off run | `…/device-smoke/f16-blur/off-20260812T064717Z/` |
| Off logcat extract | `…/off-20260812T064717Z/logcat-blur.txt` |
| Intro run | `…/device-smoke/f16-blur/intro-20260812T065627Z/` |
| Intro logcat extract | `…/intro-20260812T065627Z/logcat-blur.txt` |
| Smoke helper | `…/f16-blur/run-f16-smoke.sh` |
| Run log | `…/f16-blur/run-f16.log` |
| F15 Hold baseline | `tasks/grok-loop/done/BLUR-F15-hold-soft-reconfirm-RESULT.md` |

## Explicit non-claims
- **No multi SoftBlur PASS** (3-way / 4-way tiles not exercised; both smokes `peers=1`)
- **No invent Hold PASS** this hop (Hold remains **F15** on **0.1.373-vc381**)
- **No product code edits** / **no force-push** / **no APK install**
- Off matched mid-call soft-blur visual not required (logcat absence is authority, same as F8/F12)
- Does **not** close multi SoftBlur residual or invent MULTI_PASS

## Residual / next hop
1. Multi SoftBlur device (3-way tiles) still open — separate lane; do not invent.
2. Plan stamp optional: Off+Intro now reconfirmed on tip **0.1.374-vc382** (post-MX), Hold already F15 on 373.
3. Hold reconfirm not needed unless another multi MediaSession hop lands.

## Done criteria
- [x] Confirm package (0.1.374/382 ≥ 0.1.373+)
- [x] Off → match → logcat mode=off, 0× blur show
- [x] Intro → match → show→intro_auto, softNative=1 + Sink
- [x] Artifacts under `mobile/artifacts/device-smoke/f16-blur/`
- [x] Multi SoftBlur NOT claimed; Hold not re-claimed (F15)
- [x] RESULT written; card → done
