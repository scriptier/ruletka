# T10 Phone device-smoke (SKIP_INSTALL + WEB_PAIR) — RESULT

## Status
**COMPLETE**

## OWN
- Exclusive adb phone: Pixel 9 Pro serial **45141FDAP0004F**
- `SKIP_INSTALL=1` (no APK rebuild / no reinstall this hop)
- Headless PC Chromium pair via `WEB_PAIR=1` → `scripts/phone-web-pair.mjs`
- APK already on device / pointer: `mobile/artifacts/ruletka-latest.apk` (versionName **0.1.366**, versionCode **374**)
- **No invent multi PASS** — this is **1v1 device-smoke only**

## Goal
Run short exclusive-phone `device-smoke` with `SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=25`; record honest verdict only.

## Run
```bash
export ANDROID_HOME=$HOME/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$PATH
cd /home/drakosik/freenet-roulette/mobile
SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=25 ./scripts/device-smoke.sh
cat artifacts/device-smoke/last-verdict.txt
```

| Field | Value |
|-------|--------|
| **When (ts)** | `20260812T024025Z` |
| **Device** | Pixel 9 Pro (`45141FDAP0004F`) |
| **SKIP_INSTALL** | **1** (no install; used installed app + `ruletka-latest.apk` meta) |
| **WEB_PAIR** | 1 (pid=3623162; log below) |
| **WAIT_S** | 25 |
| **Exit code** | **0** |
| **Process** | ALIVE post-deeplink / final / exit-check — **pid=9420** |

## Verdict

| Item | Result |
|------|--------|
| **last-verdict.txt** | **MATCHED** |
| signals | `stop,next,report` |
| device line | Pixel 9 Pro (45141FDAP0004F) |
| xml | `20260812T024025Z-ui-final.xml` |
| Script outcome | `device-smoke: OK (verdict=MATCHED)` |

### Classification path
1. force-stop `me.ruletka.app` → deeplink `ruletka://live?autostart=1`
2. ALIVE post-deeplink pid=9420
3. Idle Start check: **no idle Start in UI** (already searching/matched?)
4. Wait 25s settle → final classify → **MATCHED** (`stop,next,report`)
5. No idle-retry path needed this run (first final classify was MATCHED)
6. ALIVE exit-check pid=9420

### Package meta (from smoke)
- versionCode=**374**
- minSdk=24 targetSdk=35
- versionName=**0.1.366**

### Match evidence (phone UI = source of truth)
Final UI dump mid-call chrome (1v1 surface), not multi:
- Buttons: `Стоп` / `Дальше` / `⚑ Жалоба` via `live-stop-btn` / `live-next-btn` / `live-report-btn`
- Partner dock present (`live-partner-identity-dock`); content-desc `Partner, ★ 0` at final dump
- Gifts / chat dock present
- Toast/status: **WebPair вышел из чата** (partner left after match paint)
- **No** `live-partner-call-timer` in final dump (signals = stop,next,report only — no timer this hop)
- **Not** 3-way / 4-way / find-third layout claims

### Match evidence (logcat, 1v1)
- `[match] name=WebPair … flag=CA country=Canada city=Calgary … peers=1`
- paint / geo-late / dock reassert to **WebPair**
- **peers=1** → 1v1 only

## FATAL logcat
- Filter file: `mobile/artifacts/device-smoke/logcat-snippet.txt` (also `logcat-snippet-20260812T024025Z.txt`)
- **No app FATAL EXCEPTION** / no crash for `me.ruletka`
- `FATAL` string only in the **grep header comment** (`# grep: FATAL|ReactNative|AndroidRuntime`)
- AndroidRuntime lines are uiautomator tool process lifecycle only
- App stayed ALIVE (pid **9420**) through exit-check

## Web partner (soft note — phone UI is source of truth)
- Log: `mobile/artifacts/device-smoke/web-pair-20260812T024025Z.log`
- URL `https://ruletka.vip/live.html`, budget elapsed → **DONE**
- Headless evaluate snapshots often stayed `matched:false` / empty `pcs` — **do not trust evaluate snapshot over phone UI signals**
- Console later showed queue churn + match traffic (bodyHint Online/Waiting; later “In a call” / Драконов); phone RN log matched **WebPair** with peers=1
- Soft only: web-side A/V path lines present in pair log; **not** claimed as product A/V scorecard PASS
- Non-blocking: `[nsfw] TypeError: Failed to fetch`
- No fresh web-pair PNG for this ts (last helper shot is older: `web-pair-1786502221591.png`)

## Screenshots (this run)

| Shot | Path |
|------|------|
| after deeplink | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T024025Z-01-after-deeplink.png` |
| after start | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T024025Z-02-after-start.png` |
| final (**MATCHED**) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T024025Z-03-final.png` |

Also mirrored without ts prefix: `01-after-deeplink.png` … `03-final.png` under same dir.

## Artifacts dir
`/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/`
- `last-verdict.txt` → **MATCHED**
- `logcat-snippet.txt` / `logcat-snippet-20260812T024025Z.txt`
- `web-pair-20260812T024025Z.log`
- UI dumps: `20260812T024025Z-ui-*.xml`

## Explicit non-claims
- **Not** multi 3-way / 4-way PASS
- **Not** invent GOAL_MET or product A/V scorecard PASS
- **Not** APK rebuild / reinstall (SKIP_INSTALL=1)
- **Not** deploy / force-push / ICE thrash / pool>0 / dual MediaSession rewrite
- This is **1v1 phone device-smoke** only (web pair assist soft)

## Connect risk
**Low** — smoke-only hop; no product code change.

## Done criteria
- [x] Exclusive phone free + device online (Pixel 9 Pro 45141FDAP0004F)
- [x] `SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=25` device-smoke
- [x] Verdict **MATCHED**, exit **0**, no app FATAL
- [x] Screenshot / artifact paths recorded
- [x] RESULT written COMPLETE (no invent multi PASS; no APK rebuild)
- [x] Job card moved running → done

## COMPLETE or BLOCKED
**COMPLETE**
