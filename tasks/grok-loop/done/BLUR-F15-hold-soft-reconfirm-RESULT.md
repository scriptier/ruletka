# BLUR-F15 Hold soft reconfirm after MX multi code — RESULT

## Status
**PASS (Hold soft reconfirm COMPLETE)** — After MX multi MediaSession/live tip install, Hold privacy path still selects native SoftBlur: Settings Hold → WebPair match → `softNative=1` + SoftBlur Sink. Multi SoftBlur **NOT claimed**. Read-only product; no force-push.

## Gate
| Check | Result |
|-------|--------|
| Device | Pixel 9 Pro; exclusive wireless adb **`192.168.1.94:42227`** (USB `45141FDAP0004F` **no permissions** / udev — not used) |
| Package (authoritative smoke) | versionName **0.1.373** versionCode **381** lastUpdateTime **2026-08-12 00:28:59** |
| Package note vs card | Card said tip **0.1.371/379**; device had advanced (MX): start-of-hop **0.1.372/380**, then **0.1.373/381** installed mid-hop (~00:28:59) before retry B. Smoke reconfirm is on **post-MX tip 0.1.373-vc381** |
| Soft product / SoftBlur | yes — SoftBlurVideoViewManager register warn + stage `softNative=1` + Sink |
| Product code edits | **none** (read-only SoftBlurRemote / MediaSession) |
| Force-push | **none** |

## OWN
- Phone exclusive one adb (wireless serial only)
- RESULT: this file; card `running/BLUR-F15-hold-soft-reconfirm.md` → `done/`
- Read-only product
- No invent multi SoftBlur PASS

## Package confirm
```
me.ruletka.app  versionName=0.1.373  versionCode=381
lastUpdateTime=2026-08-12 00:28:59
```
APK tip: `mobile/artifacts/ruletka-0.1.373-vc381.apk` (F15 did **not** install; another hop/build did).

Camera open during smoke also logged `versionCode 381`.

## Prefs setup (Hold)
1. Deeplink `ruletka://settings`
2. Expand **Correspondance et langue** / scroll to privacy
3. Tap chip **Jusqu'à ce que je touche** (= Until I tap / Hold)
4. Toast: **Voile de confidentialité · Jusqu'à ce que je touche · prochain match inconnu**
5. Chip `selected="true"`

Artifacts:
- `mobile/artifacts/device-smoke/f15-blur/hold-setup-04-after-tap.png` + `.xml`
- setup shots: `hold-setup-01-settings.png`, `hold-setup-03-before-tap.png`

## Smoke runs

### A) First scripted Hold smoke — incomplete stage (not authoritative)
| Field | Value |
|-------|--------|
| Bundle | `mobile/artifacts/device-smoke/f15-blur/hold-20260812T062758Z/` |
| Partner | WebPair (`peers=1`) brief match then ICE thrash / disconnect |
| prefs_load | `mode=hold` |
| show | `why=match mode=hold` only (×2) |
| softNative / Sink / heal_matched / stage | **none** |
| Note | Same class as F11 run A / F14 WebPair thrash — not used for PASS. Concurrent install of 0.1.373 may have interrupted. |

### B) Authoritative Hold + SoftBlur (WebPair) — **PASS**
| Field | Value |
|-------|--------|
| **When (ts)** | `20260812T063112Z` (device wall ~00:31:19–00:31:43 local) |
| **Bundle** | `mobile/artifacts/device-smoke/f15-blur/hold-retry-20260812T063112Z/` |
| **Partner** | headless `phone-web-pair.mjs` → **WebPair** (`peers=1`) |
| **prefs_load** | **`mode=hold`** (×3) |
| **`[blur] show`** | `why=match mode=hold` · `why=heal_matched mode=hold` · `why=stage … softNative=1` |
| **`[blur] hide` / intro peel** | **none** in capture (Hold stay) |
| **softNative** | **`softNative=1`** on stage show |
| **Native SoftBlur** | `SoftBlurVideoView: Sink attached for ab89f42a-…` |
| **Manager** | Registered (RN warn: no generated setter for SoftBlurVideoViewManager — expected without codegen) |
| **Hold stay visual** | Privacy modal + **Afficher la vidéo – prêt** (Show video — ready); copy “Partner video is hidden. Tap anywhere to show.” |
| **App FATAL** | none product; UiAutomationService “already registered” noise only when dumps concurrent |

#### Evidence chain (logcat — Hold authoritative)
```
08-12 00:31:19.200 SoftBlurVideoViewManager (ViewManagerPropertyUpdater warn — registered)
08-12 00:31:19.447 [blur] prefs_load mode=hold
08-12 00:31:26.577 [match] name=WebPair … peers=1
08-12 00:31:26.577 [blur] show why=match mode=hold
08-12 00:31:41.854 [match] name=WebPair … peers=1
08-12 00:31:41.854 [blur] show why=match mode=hold
08-12 00:31:43.538 [blur] show why=heal_matched mode=hold
08-12 00:31:43.556 [blur] show why=stage main=partner pip=self keepRtc=1 softNative=1
08-12 00:31:43.695 SoftBlurVideoView: Sink attached for ab89f42a-ff82-4043-9489-0c30c264ea28
```

Full: `…/hold-retry-20260812T063112Z/logcat-full.txt`  
Extract: `…/hold-retry-20260812T063112Z/logcat-blur.txt`  
Shots: `01-after-deeplink.png`, `02-after-start.png`, `poll-01..03.png`, `hold-stay.png`, `hold-stay-2.png`, `03-final.png`  
UI stay: `hold-stay.xml` (Afficher la vidéo – prêt)

## Verdict table

| Claim | Result | Evidence |
|-------|--------|----------|
| Device usable adb (wireless exclusive) | **PASS** | `192.168.1.94:42227` device; USB no-permissions unused |
| Package on device for reconfirm | **PASS (0.1.373/vc381)** | dumpsys + camera `versionCode 381`; not card’s 0.1.371/379 (tip advanced post-MX) |
| Settings → Hold applied | **PASS** | toast UI + `prefs_load mode=hold` + chip selected |
| Hold match show `mode=hold` | **PASS** | match→show mode=hold → heal_matched mode=hold |
| softNative during privacy | **PASS** | `softNative=1` on stage show |
| SoftBlur Sink attached | **PASS** | `SoftBlurVideoView: Sink attached for ab89f42a-…` |
| Hold stays (no intro peel) | **PASS** (window observed) | no `intro_auto` / blur hide; UI still Show video ready |
| Multi-party SoftBlur | **NOT claimed** | 1v1 only (`peers=1`) |
| Force-push / product edits | **none** | smoke + RESULT only |

## Paths

| Artifact | Path |
|----------|------|
| Settings Hold toast | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/f15-blur/hold-setup-04-after-tap.png` |
| Authoritative run B | `…/device-smoke/f15-blur/hold-retry-20260812T063112Z/` |
| Run B logcat extract | `…/hold-retry-20260812T063112Z/logcat-blur.txt` |
| Incomplete run A | `…/f15-blur/hold-20260812T062758Z/` |
| Device meta | `…/f15-blur/meta-device.txt` |
| Helper | `…/f15-blur/run-f15-hold-smoke.sh` |
| F11 Hold baseline (0.1.371) | `tasks/grok-loop/done/BLUR-F11-apk-resmoke-RESULT.md` |
| F14 Intro (0.1.371) | `tasks/grok-loop/done/BLUR-F14-intro-371-RESULT.md` |

## Explicit non-claims
- **No multi SoftBlur PASS** (3-way / 4-way tiles not exercised)
- **No invent softNative on incomplete WebPair thrash** (run A not PASS)
- **No Off/Intro re-smoke this hop** (Hold only; Off=F12, Intro=F14 on prior tip)
- **No product code edits** / **no force-push**
- Card’s “confirm 0.1.371/379” is **honestly superseded** by device tip **0.1.373/381** after MX multi APK install; reconfirm target was post-MX Hold soft path, not freeze to 371

## Residual / next hop
1. Optional: Off/Intro reconfirm on **0.1.373** if MX multi changed privacy paths beyond Hold (F12/F14 were 0.1.371).
2. Multi SoftBlur device smoke still open (F9 static only) — **not** claimed here.
3. USB adb still needs udev fix for cable-only hops.

## Done criteria
- [x] adb devices — phone usable (wireless exclusive)
- [x] Confirm package on device (documented **0.1.373/381** post-MX; not 371)
- [x] Settings → Hold → match → logcat softNative=1 + Sink
- [x] Artifacts under `mobile/artifacts/device-smoke/f15-blur/`
- [x] Multi SoftBlur NOT claimed
- [x] RESULT written; card → done
