# T12 device-smoke (SKIP_INSTALL + WEB_PAIR WAIT_S=20) — RESULT

## Status
**COMPLETE**

## OWN
- Exclusive adb phone: Pixel 9 Pro serial **45141FDAP0004F** (after T12-phone-friends done; 60s exclusive wait)
- `SKIP_INSTALL=1` (no APK rebuild / no reinstall this hop)
- Headless PC Chromium pair via `WEB_PAIR=1` → `scripts/phone-web-pair.mjs`
- APK already on device / pointer: `mobile/artifacts/ruletka-latest.apk` (versionName **0.1.366**, versionCode **374**)
- **No invent multi PASS** — this is **1v1 device-smoke only**; final UI verdict is **SEARCHING**, not MATCHED

## Goal
Run exclusive-phone `device-smoke` with `SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=20`; record honest verdict only.

## Run
```bash
export ANDROID_HOME=$HOME/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$PATH
cd /home/drakosik/freenet-roulette/mobile
SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=20 ./scripts/device-smoke.sh
cat artifacts/device-smoke/last-verdict.txt
```

| Field | Value |
|-------|--------|
| **When (ts)** | `20260812T024632Z` |
| **Device** | Pixel 9 Pro (`45141FDAP0004F`) |
| **SKIP_INSTALL** | **1** (no install; used installed app + `ruletka-latest.apk` meta) |
| **WEB_PAIR** | 1 (pid=3627174; log below) |
| **WAIT_S** | 20 |
| **Exit code** | **0** |
| **Process** | ALIVE post-deeplink / final / exit-check — **pid=13485** |

## Verdict

| Item | Result |
|------|--------|
| **last-verdict.txt** | **SEARCHING** |
| signals | `stop,next` |
| device line | Pixel 9 Pro (45141FDAP0004F) |
| xml | `20260812T024632Z-ui-final.xml` |
| Script outcome | `device-smoke: OK (verdict=SEARCHING)` |

### Classification path
1. force-stop `me.ruletka.app` → deeplink `ruletka://live?autostart=1`
2. ALIVE post-deeplink pid=13485
3. Idle Start check: **tap Start @ 480,1926** (idle Start present)
4. Wait 20s settle → final classify → **SEARCHING** (`stop,next` — no `report`)
5. No idle-retry path (verdict was SEARCHING, not IDLE)
6. ALIVE exit-check pid=13485

### Package meta (from smoke / dumpsys)
- versionCode=**374**
- minSdk=24 targetSdk=35
- versionName=**0.1.366**
- lastUpdateTime=2026-08-11 20:11:36

### Final UI evidence (phone UI = source of truth)
Final dump is **queue / hub confirm** surface, **not** mid-call chrome:
- Texts: **Присоединяемся к очереди…** / **Подтверждаем с хабом…**
- Progress labels: Очередь › Связь › Картинка (Очередь selected)
- Buttons: `Стоп` / `Дальше` via `live-stop-btn` / `live-next-btn`
- **No** `live-report-btn`, **no** `live-partner-identity-dock`, **no** call timer
- `live-brand-loading-loop` present
- Mic/cam/flip/friends chrome present (search chrome, not match chrome)
- **Not** MATCHED; **not** 3-way / 4-way / find-third claims

### Logcat note (soft — does not override final UI verdict)
- Brief 1v1 match paint during settle window:
  - `[match] name=WebPair … flag=CA country=Canada city=Calgary … peers=1`
  - paint / geo-late; later dock `name=Partner`
- PC churn / ice closed after paint; **final UI re-settled to searching**
- **peers=1** only if match held — **do not claim MATCHED** from logcat alone
- **No invent multi PASS**

## FATAL logcat
- Filter file: `mobile/artifacts/device-smoke/logcat-snippet.txt` (also `logcat-snippet-20260812T024632Z.txt`)
- **No app FATAL EXCEPTION** / no crash for `me.ruletka`
- `FATAL` string only in the **grep header comment** (`# grep: FATAL|ReactNative|AndroidRuntime`)
- AndroidRuntime lines are uiautomator tool process lifecycle only
- App stayed ALIVE (pid **13485**) through exit-check

## Web partner (soft note — phone UI is source of truth)
- Log: `mobile/artifacts/device-smoke/web-pair-20260812T024632Z.log`
- URL `https://ruletka.vip/live.html`, budget elapsed → **DONE**
- Headless evaluate snapshots mostly `matched:false` / empty `pcs` — **do not trust evaluate snapshot over phone UI signals**
- Console: CONNECT / late video / first frame / `matched with WebPair · solo` at points; later page churn detached Frame
- Soft only: web-side A/V path lines present; **not** claimed as product A/V scorecard PASS
- Non-blocking: `[nsfw] TypeError: Failed to fetch`
- Pair stopped by smoke after phone classify

## Screenshots (this run)

| Shot | Path |
|------|------|
| after deeplink | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T024632Z-01-after-deeplink.png` |
| after start | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T024632Z-02-after-start.png` |
| final (**SEARCHING**) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T024632Z-03-final.png` |

Also mirrored without ts prefix: `01-after-deeplink.png` … `03-final.png` under same dir.

## Artifacts dir
`/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/`
- `last-verdict.txt` → **SEARCHING**
- `logcat-snippet.txt` / `logcat-snippet-20260812T024632Z.txt`
- `web-pair-20260812T024632Z.log`
- `20260812T024632Z-ui-final.xml` (+ after-deeplink / after-start / pre-start / onboard)

## Honest summary
- Smoke **ran clean** (exit 0, app ALIVE, no FATAL).
- Official verdict file: **SEARCHING** (signals `stop,next`).
- Transient WebPair 1v1 paint in logcat **does not** upgrade this to MATCHED — final UI stayed in hub-confirm queue.
- **No multi PASS invented.**
