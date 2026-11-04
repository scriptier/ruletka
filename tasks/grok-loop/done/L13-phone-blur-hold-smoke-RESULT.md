# L13 Phone blur Hold smoke — RESULT

## Status
**COMPLETE**

## OWN
- Exclusive adb phone: Pixel 9 Pro serial **45141FDAP0004F**
- `SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=28` device-smoke
- APK on device: **0.1.367** / versionCode **375** (`me.ruletka.app`)
- **No invent multi PASS** — 1v1 MATCHED only
- **No product rewrite** this hop

## Goal (task)
APK 0.1.367-vc375: Settings blur **Hold** → match → `veil_visible` + `[blur] show` in logcat.

## Package confirm
| Field | Value |
|-------|--------|
| package | `me.ruletka.app` |
| versionName | **0.1.367** |
| versionCode | **375** |
| lastUpdateTime | 2026-08-11 21:11:38 |
| APK pointer | `mobile/artifacts/ruletka-latest.apk` (= `ruletka-0.1.367-vc375.apk`) |
| app.json | version **0.1.367** · versionCode **375** |

## Run
```bash
export ANDROID_HOME=$HOME/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$PATH
S=45141FDAP0004F
adb -s $S logcat -c
cd /home/drakosik/freenet-roulette/mobile
SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=28 ./scripts/device-smoke.sh
```

| Field | Value |
|-------|--------|
| **When (ts)** | `20260812T031336Z` |
| **Device** | Pixel 9 Pro (`45141FDAP0004F`) |
| **SKIP_INSTALL** | **1** |
| **WEB_PAIR** | 1 (pid=3650545; log `web-pair-20260812T031336Z.log`) |
| **WAIT_S** | **28** |
| **Exit code** | **0** |
| **Process** | ALIVE pid=**20684** post-deeplink / final / exit-check |
| **last-verdict.txt** | **MATCHED** signals=`stop,next,report,timer` |

## Prefs (actual — Hold may not be set)
| Item | Result |
|------|--------|
| **`[blur] prefs_load`** | **`mode=intro`** (one line @ 21:14:17) |
| **Hold set in prefs?** | **no** — load reports **intro**, not `hold` |
| Implication | Hold path **not exercised** this hop; intro auto-peel path observed |

## Verdict: veil + blur show

| Item | Result |
|------|--------|
| **prefs_load** | **intro** (not hold) |
| **`[blur] show` logs** | **yes** — 5 show lines (match / heal_matched / veil_full×2 / stage) |
| **`[blur] hide` logs** | **yes** — veil_full / stage / intro_auto / intro_timeout |
| **veil_visible (early / after-deeplink)** | **yes** — full privacy modal «Шторка приватности» + «Показать — готово»; `live-blur-fullscreen` + `live-blur-show-video` |
| **veil_visible (mid-match settle: after-start + final)** | **no** — partner stage clear green WebPair; eye = «Скрыть видео»; no fullscreen veil nodes |
| **Show video / Privacy modal mid-match** | **absent** in after-start + final dumps |
| **live-blur-btn mid-match** | content-desc **«Скрыть видео»** → veil **down** |

### Evidence chain (1v1 MATCHED)
1. Device-smoke classified **MATCHED** (`stop,next,report,timer`); partner **WebPair** (`peers=1`).
2. Screencap **after-deeplink**: frosted mosaic + modal «Шторка приватности» / CTA «Показать — готово» → **veil_visible=yes** (early).
3. Screencap **after-start** timer **~0:08**: bright green partner stage fully visible; no frosted veil / no «Показать» CTA → **veil_visible=no**.
4. Screencap **final** timer **~0:10**: stage **green** WebPair; clear video; still no veil card → **veil_visible=no**.
5. UI dumps:
   - after-deeplink: `live-blur-fullscreen`, `live-blur-show-video`, `live-blur-eye-modal`; text privacy curtain
   - after-start / final: only `live-blur-btn` desc=**«Скрыть видео»**; **no** `live-blur-fullscreen` / show-video
6. Logcat (smoke snippet + RN filter `[blur]|PartnerBlur|veil`):

```
08-11 21:14:12.366 [blur] intro max wait peel why=intro_timeout rearm=2 waited=10558ms
08-11 21:14:12.366 [blur] hide why=intro_timeout
08-11 21:14:16.953 [blur] show why=match mode=intro
08-11 21:14:17.034 [blur] prefs_load mode=intro
08-11 21:14:18.162 [blur] show why=heal_matched mode=intro
08-11 21:14:18.184 [blur] show why=veil_full
08-11 21:14:18.184 [blur] show why=stage main=partner pip=self keepRtc=1
08-11 21:14:18.184 [blur] show why=veil_full
08-11 21:14:23.128 [blur] hide why=veil_full
08-11 21:14:23.129 [blur] hide why=veil_full
08-11 21:14:23.130 [blur] hide why=stage keepRtc=1
08-11 21:14:23.135 [blur] hide why=intro_auto
08-11 21:14:28.983 [blur] intro max wait peel why=intro_timeout rearm=2 waited=12030ms
08-11 21:14:28.983 [blur] hide why=intro_timeout
```

| Metric | Count (smoke logcat-snippet) |
|--------|------------------------------|
| `[blur] prefs_load` | **1** (`mode=intro`) |
| `[blur] show` | **5** |
| `[blur] hide` | **6** (incl. intro peels) |
| PartnerBlur string | **0** |
| veil_full show/hide | present |

7. Match paint same hop: `[match] name=WebPair … peers=1` @ 21:14:16; ICE path 1v1 only.

### Interpretation
- **Hold was not active** (`prefs_load mode=intro`). Do not claim Hold path PASS.
- On **intro**, veil **did mount** mid-match (`show why=match|heal_matched|veil_full|stage`) and **auto-peeled** ~5s later (`hide why=intro_auto`), so settle screenshots (after-start / final) show clear partner video.
- Early after-deeplink still captured the privacy curtain UI (**veil_visible=yes** at that frame).
- Mid-match settle: **veil_visible=no** (intro peeled). **`[blur] show` logs=yes**.

## Paths (shots + dumps)

| Artifact | Path |
|----------|------|
| after deeplink (**veil yes**) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T031336Z-01-after-deeplink.png` |
| after start (**MATCHED**, clear ~0:08) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T031336Z-02-after-start.png` |
| final (**MATCHED**, clear ~0:10) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T031336Z-03-final.png` |
| UI final | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T031336Z-ui-final.xml` |
| UI after-start | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T031336Z-ui-after-start.xml` |
| UI after-deeplink | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T031336Z-ui-after-deeplink.xml` |
| logcat snippet | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/logcat-snippet.txt` (+ `logcat-snippet-20260812T031336Z.txt` if copied) |
| last-verdict | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/last-verdict.txt` → **MATCHED** |
| forensics bundle | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/l13-blur-hold-20260812T031336Z/` |
| blur RN-only | `…/l13-blur-hold-20260812T031336Z/logcat-blur-rn-only.txt` |
| blur from snippet | `…/l13-blur-hold-20260812T031336Z/logcat-snippet-blur.txt` |
| web-pair log | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/web-pair-20260812T031336Z.log` |

## Multi
**Not claimed.** 1v1 MATCHED only (`peers=1`). No invent multi PASS.

## Explicit non-claims
- **Not** Settings blur **Hold** verified (prefs loaded **intro**)
- **Not** multi 3-way / 4-way PASS
- **Not** APK rebuild / reinstall (SKIP_INSTALL=1)
- **Not** product rewrite this hop
- Post-smoke live screencap / uiautomator: web-pair already stopped; uiautomator idle dump failed non-blocking — smoke-time dumps are authoritative

## Connect risk
**Low** — smoke/forensics only; no product code change.

## Done criteria
- [x] Exclusive phone free + device online (Pixel 9 Pro 45141FDAP0004F)
- [x] Confirm versionName **0.1.367** versionCode **375**
- [x] `SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=28` device-smoke → **MATCHED** exit **0**
- [x] logcat `[blur]|PartnerBlur|veil` + UI dump + screencap matched
- [x] RESULT: veil_visible (early yes / settle no), blur show logs yes, prefs_load **intro** (not hold)
- [x] COMPLETE — no invent multi PASS
