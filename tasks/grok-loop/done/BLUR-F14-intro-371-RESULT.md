# BLUR-F14 Intro residual on tip 0.1.371 — RESULT

## Status
**PASS (Intro COMPLETE)** — Intro residual closed on **0.1.371-vc379** with soft product ON. Evidence: Settings Brief → match → `mode=intro` show → `hide why=intro_auto` + `softNative=1` + SoftBlur Sink. Multi SoftBlur **NOT claimed**. Hold=F11; Off=F12.

## Gate
| Check | Result |
|-------|--------|
| Device | Pixel 9 Pro serial **45141FDAP0004F** (hw); transport **wireless TLS** `192.168.1.94:42227` (USB node reattached but `no permissions` / missing udev group on `/dev/bus/usb/001/083` — wireless used as exclusive one-phone adb path; no dual-phone) |
| Package | versionName **0.1.371** versionCode **379** lastUpdateTime **2026-08-11 23:20:19** (F11 install; **no reinstall**) |
| Soft product / SoftBlur | yes — SoftBlurVideoViewManager register warn + stage `softNative=1` + Sink |
| Hold baseline | **PASS already in F11** — not re-run (`BLUR-F11-apk-resmoke-RESULT.md`) |
| Off baseline | **PASS already in F12** — not re-run (`BLUR-F12-off-intro-371-RESULT.md`) |
| Product code edits | **none** (read-only) |
| Force-push | **none** |

## OWN
- Phone exclusive one adb (wireless serial only for shell; USB listed no-permissions, not used)
- RESULT: this file; card `running/BLUR-F14-intro-371.md` → `done/`
- Read-only product
- No invent multi SoftBlur PASS

## Device reattach path
1. `adb devices` after kill/start: serial present but **USB no permissions** (udev: node `root:root` `crw-rw-r--`, user in `plugdev` but group not applied; no passwordless sudo to chmod).
2. mDNS `adb-tls-connect` → `adb connect 192.168.1.94:42227` → **device** online.
3. Exclusive phone operations via `-s 192.168.1.94:42227` only.

Capture: `mobile/artifacts/device-smoke/f14-blur/adb-devices-start.txt`, `meta-device.txt`.

## Package confirm
```
me.ruletka.app  versionName=0.1.371  versionCode=379
lastUpdateTime=2026-08-11 23:20:19
```
APK tip present (unused — version already correct): `mobile/artifacts/ruletka-0.1.371-vc379.apk`

## Prefs setup (Intro / Brief)
1. Deeplink `ruletka://settings`
2. Expand **Correspondance et langue** / scroll to privacy
3. Tap chip **Bref (~2,5 s)** (= Intro / Brief ~2.5s)
4. Toast: **Voile de confidentialité · Bref (~2,5 s) · prochain match inconnu**

Artifacts:
- `mobile/artifacts/device-smoke/f14-blur/intro-setup-04-after-tap.png` + `.xml`
- copy in run: `…/intro-retry-20260812T061220Z/settings-intro-toast.png`

## Smoke runs

### A) First scripted Intro smoke — incomplete stage (not authoritative)
| Field | Value |
|-------|--------|
| Bundle | `mobile/artifacts/device-smoke/f14-blur/intro-20260812T060853Z/` |
| Partner | WebPair (`peers=1`) |
| prefs_load | `mode=intro` |
| show | `why=match mode=intro` only |
| softNative / Sink / heal_matched / stage | **none** (WebPair ICE thrash; peel via `intro_timeout` only) |
| Note | Same class as F11 run A — not used for PASS |

### B) Authoritative Intro + SoftBlur (stranger match) — **PASS**
| Field | Value |
|-------|--------|
| **When (ts)** | `20260812T061220Z` (device wall ~00:14:48–00:14:57 local) |
| **Bundle** | `mobile/artifacts/device-smoke/f14-blur/intro-retry-20260812T061220Z/` |
| **Partner** | live stranger **Драконов** ★204 CA Calgary (`peers=1`; web-pair also up earlier) |
| **prefs_load** | **`mode=intro`** |
| **`[blur] show`** | `why=match mode=intro` · `why=heal_matched mode=intro` · `why=stage … softNative=1` · `why=veil_full` |
| **`[blur] hide`** | `why=veil_full` · `why=stage keepRtc=1` · **`why=intro_auto`** (+ later `intro_timeout` max-wait rearm — same F8/BM2b pattern) |
| **softNative** | **`softNative=1`** on stage show |
| **Native SoftBlur** | `SoftBlurVideoView: Sink attached for b5d211a8-…` |
| **Manager** | Registered (RN warn: no generated setter for SoftBlurVideoViewManager — expected without codegen) |
| **App FATAL** | none (UiAutomationService "already registered" noise only if concurrent dumps) |

#### Evidence chain (logcat — Intro authoritative)
```
08-12 00:14:48.419 [match] name=Драконов … peers=1
08-12 00:14:48.420 [blur] show why=match mode=intro
08-12 00:14:48.579 [blur] prefs_load mode=intro
08-12 00:14:50.252 [blur] show why=heal_matched mode=intro
08-12 00:14:50.280 [blur] show why=stage main=partner pip=self keepRtc=1 softNative=1
08-12 00:14:50.280 [blur] show why=veil_full
08-12 00:14:50.463 SoftBlurVideoView: Sink attached for b5d211a8-eb2a-db7c-e2fd-e19a0848bfe8
08-12 00:14:54.437 [blur] hide why=veil_full
08-12 00:14:54.438 [blur] hide why=stage keepRtc=1
08-12 00:14:54.443 [blur] hide why=intro_auto
08-12 00:14:57.171 [blur] intro max wait peel why=intro_timeout rearm=2 waited=8751ms
08-12 00:14:57.171 [blur] hide why=intro_timeout
```

Full: `…/intro-retry-20260812T061220Z/logcat-full.txt` + `logcat-dump-after.txt` (intro_auto window)  
Extract: `…/intro-retry-20260812T061220Z/logcat-blur.txt`  
Shots: `01-after-deeplink.png`, `02-searching.png`, `poll-*.png`, `03-final.png`, `follow-01.png`  
Settings toast: `settings-intro-toast.png`

**Notes:**
- Primary peel signal is **`intro_auto`** (~4s after soft stage). Subsequent `intro_timeout` rearm is expected max-wait path after peel (same as F8 Intro on 0.1.368).
- SoftBlur logged one `No video track` for a react tag while Sink attached on the live stream id — stage soft path still selected (`softNative=1` + Sink).
- WebPair-only matches earlier in the hop often peel via `intro_timeout` without stage softNative (ICE thrash); authoritative PASS uses live stranger match with full stage chain.

## Verdict table

| Claim | Result | Evidence |
|-------|--------|----------|
| Device reattached / usable adb | **PASS** | wireless `192.168.1.94:42227` device; hw serial 45141FDAP0004F |
| APK **0.1.371 / vc379** on device | **PASS** | dumpsys package (no reinstall) |
| Settings → Intro (Brief) applied | **PASS** | toast UI dump + `prefs_load mode=intro` |
| Intro: show then peel (`hide why=intro_auto`) | **PASS** | match→show mode=intro → hide intro_auto |
| Intro softNative during privacy | **PASS** | `softNative=1` + Sink attached |
| Hold mode on 0.1.371 | **PASS (F11 only)** | not re-run |
| Off mode on 0.1.371 | **PASS (F12 only)** | not re-run |
| Multi-party SoftBlur | **NOT claimed** | 1v1 only (`peers=1`) |
| Force-push / product edits | **none** | smoke + RESULT only |

## Paths

| Artifact | Path |
|----------|------|
| Settings Intro toast | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/f14-blur/intro-setup-04-after-tap.png` |
| Authoritative run B | `…/device-smoke/f14-blur/intro-retry-20260812T061220Z/` |
| Run B logcat extract | `…/intro-retry-20260812T061220Z/logcat-blur.txt` |
| Incomplete run A | `…/f14-blur/intro-20260812T060853Z/` |
| Device meta | `…/f14-blur/meta-device.txt` |
| Helper | `…/f14-blur/run-f14-intro-smoke.sh` |
| F11 Hold baseline | `tasks/grok-loop/done/BLUR-F11-apk-resmoke-RESULT.md` |
| F12 Off PASS + Intro residual | `tasks/grok-loop/done/BLUR-F12-off-intro-371-RESULT.md` |
| F13 BLOCKED no device | `tasks/grok-loop/done/BLUR-F13-intro-371-retry-RESULT.md` |

## Explicit non-claims
- **No multi SoftBlur PASS** (3-way / 4-way tiles not exercised)
- **No invent Hold PASS** this hop (Hold remains **F11** evidence on 0.1.371)
- **No invent Off PASS** this hop (Off remains **F12**)
- **No product code edits** / **no force-push**
- USB adb still needs udev fix (`plugdev` MODE on Google 18d1) for future cable-only hops; this hop used wireless exclusive path for the same physical Pixel

## Residual / next hop
1. Optional: fix udev so USB `45141FDAP0004F` is `device` without wireless (`GROUP="plugdev" MODE="0660"` for `idVendor=18d1`).
2. Multi SoftBlur device smoke still open if desired (F9 static only) — **not** claimed here.
3. Tip 0.1.371 residual blur modes: **Hold (F11) + Off (F12) + Intro (F14)** all device-evidenced.

## Done criteria
- [x] adb devices — phone usable (wireless after USB permission block)
- [x] Confirm package 0.1.371 / 379 (no reinstall)
- [x] Settings → Intro/Brief → match → logcat `mode=intro` show → `intro_auto` hide; softNative=1 + Sink
- [x] Artifacts under `mobile/artifacts/device-smoke/f14-blur/`
- [x] Multi SoftBlur NOT claimed
- [x] RESULT written; card → done
