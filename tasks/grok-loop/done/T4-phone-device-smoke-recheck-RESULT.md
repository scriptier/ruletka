# T4 Phone device-smoke recheck — RESULT

## Status
**COMPLETE**

## OWN
- Exclusive adb phone: Pixel 9 Pro serial **45141FDAP0004F**
- `SKIP_INSTALL=1` (no APK rebuild / no reinstall this hop)
- Headless PC Chromium pair via `WEB_PAIR=1` → `scripts/phone-web-pair.mjs`
- APK already on device / pointer: `mobile/artifacts/ruletka-latest.apk` (versionName **0.1.366**, versionCode **374**)
- **No invent multi PASS** — this is **1v1 device-smoke only**

## Goal
Re-run short `device-smoke` with `SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=30` while phone free; record honest verdict only.

## Run
```bash
export ANDROID_HOME=$HOME/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$PATH
cd /home/drakosik/freenet-roulette/mobile
SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=30 ./scripts/device-smoke.sh
cat artifacts/device-smoke/last-verdict.txt
```

| Field | Value |
|-------|--------|
| **When (ts)** | `20260812T022114Z` |
| **Device** | Pixel 9 Pro (`45141FDAP0004F`) |
| **SKIP_INSTALL** | **1** (no install; used installed app + `ruletka-latest.apk` meta) |
| **WEB_PAIR** | 1 (pid started; log below) |
| **WAIT_S** | 30 |
| **Exit code** | **0** |
| **Process** | ALIVE post-deeplink / final / exit-check — **pid=32444** |

## Verdict

| Item | Result |
|------|--------|
| **last-verdict.txt** | **MATCHED** |
| signals | `stop,next,report,timer` |
| device line | Pixel 9 Pro (45141FDAP0004F) |
| xml | `20260812T022114Z-ui-final.xml` |
| Script outcome | `device-smoke: OK (verdict=MATCHED)` |

### Classification path
1. force-stop `me.ruletka.app` → deeplink `ruletka://live?autostart=1`
2. ALIVE post-deeplink pid=32444
3. Idle Start check: **no idle Start in UI** (already searching/matched?)
4. Wait 30s settle → final classify → **MATCHED** (`stop,next,report,timer`)
5. No idle-retry path needed this run (first final classify was MATCHED)

### Package meta (from smoke)
- versionCode=**374**
- minSdk=24 targetSdk=35
- versionName=**0.1.366**

### Match evidence (phone UI = source of truth)
Final UI dump shows mid-call chrome, not multi:
- Buttons: `Стоп` / `Дальше` / `⚑ Жалоба` + timer **0:56**
- resource-ids: `live-stop-btn`, `live-next-btn`, `live-report-btn`, `live-partner-call-timer`
- Partner identity dock: **Драконов** · flag CA · **★ 204** · **Канада · Калгари**
- Gifts / chat dock present (1v1 live surface)
- **Not** 3-way / 4-way / find-third layout claims

## FATAL logcat
- Filter file: `mobile/artifacts/device-smoke/logcat-snippet.txt`
- **No app FATAL EXCEPTION** / no crash for `me.ruletka`
- `FATAL` string only appears in the **grep header comment** (`# grep: FATAL|ReactNative|AndroidRuntime`)
- AndroidRuntime lines are uiautomator tool process lifecycle only
- App ReactNativeJS: ongoing `rn-webrtc:pc:DEBUG … getStats` on pid **32444** through settle; ALIVE at exit-check

## Web partner (soft note — phone UI is source of truth)
- Log: `mobile/artifacts/device-smoke/web-pair-20260812T022114Z.log`
- URL `https://ruletka.vip/live.html`, budget ~70s, **DONE (budget elapsed)**
- Headless evaluate snapshots stayed `matched:false` / empty `pcs` for the full budget
- Online ~4 / Waiting ~1 seen in bodyHint — phone appears to have matched a **live peer** (Драконов), not necessarily the headless WebPair tab
- **Do not trust** web-pair evaluate snapshot over phone UI signals
- Soft only: web partner may not have painted match; phone device-smoke still **MATCHED** on UI signals

## Screenshots (this run)

| Shot | Path |
|------|------|
| after deeplink | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T022114Z-01-after-deeplink.png` |
| after start | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T022114Z-02-after-start.png` |
| final (**MATCHED**) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T022114Z-03-final.png` |
| web-pair (budget end) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/web-pair-1786501355561.png` |

## Artifacts dir
`/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/`
- `last-verdict.txt` → **MATCHED**
- `logcat-snippet.txt`
- `web-pair-20260812T022114Z.log`
- UI dumps: `20260812T022114Z-ui-*.xml`

## Explicit non-claims
- **Not** multi 3-way / 4-way PASS
- **Not** invent GOAL_MET or product A/V scorecard PASS
- **Not** APK rebuild / reinstall (SKIP_INSTALL=1)
- **Not** deploy / force-push / ICE thrash / pool>0 / dual MediaSession rewrite
- This is **1v1 phone device-smoke recheck** only (web pair assist soft)

## Connect risk
**Low** — smoke-only recheck; no product code change in this hop.

## Done criteria
- [x] Exclusive phone free + device online (Pixel 9 Pro 45141FDAP0004F)
- [x] `SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=30` device-smoke
- [x] Verdict **MATCHED**, exit **0**, no app FATAL
- [x] Screenshot / artifact paths recorded
- [x] RESULT written COMPLETE (no invent multi PASS; no APK rebuild)
- [x] Job card moved running → done

## COMPLETE or BLOCKED
**COMPLETE**
