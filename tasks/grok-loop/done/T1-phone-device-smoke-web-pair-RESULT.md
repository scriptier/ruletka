# T1 Phone device-smoke + PC browser web partner — RESULT

## Status
**COMPLETE**

## OWN
- Exclusive adb phone: Pixel 9 Pro serial **45141FDAP0004F**
- Headless PC Chromium pair via `WEB_PAIR=1` → `scripts/phone-web-pair.mjs`
- APK: `mobile/artifacts/ruletka-0.1.366-vc374.apk` (versionName **0.1.366**, versionCode **374**)
- No multi 3-way claim; this is **1v1 device smoke only**

## Goal
Install/smoke APK 0.1.366-vc374 on Pixel 9 Pro with headless PC Chromium partner; record verdict.

## Run
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH="$ANDROID_HOME/platform-tools:$PATH"
adb devices -l
cd /home/drakosik/freenet-roulette/mobile
WEB_PAIR=1 WAIT_S=40 ./scripts/device-smoke.sh artifacts/ruletka-0.1.366-vc374.apk
```

| Field | Value |
|-------|--------|
| **When (ts)** | `20260812T021127Z` |
| **Device** | Pixel 9 Pro (`45141FDAP0004F`) — **online** at start |
| **APK** | `artifacts/ruletka-0.1.366-vc374.apk` — install `-r` **Success** |
| **WEB_PAIR** | 1 (pid started; log below) |
| **WAIT_S** | 40 |
| **Exit code** | **0** |
| **Process** | ALIVE post-deeplink / final / exit-check — **pid=28815** |

## Verdict

| Item | Result |
|------|--------|
| **last-verdict.txt** | **MATCHED** |
| signals | `stop,next,report,timer` |
| device line | Pixel 9 Pro (45141FDAP0004F) |
| xml | `20260812T021127Z-ui-idle-retry.xml` |
| Script outcome | `device-smoke: OK (verdict=MATCHED)` |

### Classification path
1. After deeplink autostart: no idle Start in UI (already searching/matched?).
2. After 40s settle: first classify **IDLE** → script taps Start once more, wait 8s, reclassify.
3. Idle-retry reclassify → **MATCHED** (`stop,next,report,timer`).

### Package meta (from smoke)
- versionCode=**374**
- minSdk=24 targetSdk=35
- versionName=**0.1.366**

## FATAL logcat
- Filter file: `mobile/artifacts/device-smoke/logcat-snippet.txt`
- **No app FATAL EXCEPTION** / no `Process: me.ruletka` crash.
- The single `FATAL` hit is the **grep header comment** (`# grep: FATAL|ReactNative|AndroidRuntime`), not a crash.
- AndroidRuntime lines are uiautomator tool process lifecycle only (Shutting down VM / RuntimeInit).
- App stayed ALIVE (pid 28815) through exit-check.

### Match evidence (logcat, not multi)
Phone RN log shows 1v1 match to web partner:
- `[match] name=WebPair … flag=CA country=Canada city=Calgary … peers=1`
- offer recv / ICE path exercised after match paint

## Web partner (soft note — phone UI is source of truth)
- Log: `mobile/artifacts/device-smoke/web-pair-20260812T021127Z.log`
- URL `https://ruletka.vip/live.html`, budget ~80s, **DONE (budget elapsed)**
- Console saw queue/match traffic (including other live peers); phone side matched **WebPair**
- Snapshot helper often `matched:false` with empty `pcs` — **do not trust evaluate snapshot over phone UI signals**
- Non-blocking: `[nsfw] TypeError: Failed to fetch`

## Screenshots (this run)

| Shot | Path |
|------|------|
| after deeplink | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T021127Z-01-after-deeplink.png` |
| after start | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T021127Z-02-after-start.png` |
| final (pre idle-retry) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T021127Z-03-final.png` |
| idle-retry (**MATCHED**) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T021127Z-04-idle-retry.png` |
| web-pair (budget end) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/web-pair-1786500778569.png` |

Also mirrored without ts prefix: `01-after-deeplink.png` … `04-idle-retry.png` under same dir.

## Artifacts dir
`/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/`
- `last-verdict.txt` → **MATCHED**
- `logcat-snippet.txt`
- `web-pair-20260812T021127Z.log`
- UI dumps: `20260812T021127Z-ui-*.xml`

## Explicit non-claims
- **Not** multi 3-way / 4-way PASS
- **Not** invent GOAL_MET or product A/V scorecard PASS
- **Not** deploy / force-push / ICE thrash / pool>0 / dual MediaSession rewrite
- This is **1v1 phone device-smoke + one web pair** only

## Connect risk
**Low** — install + smoke only; no product policy code change in this hop.

## Done criteria
- [x] Device online (Pixel 9 Pro 45141FDAP0004F)
- [x] `WEB_PAIR=1 WAIT_S=40` device-smoke on 0.1.366-vc374
- [x] Verdict **MATCHED**, exit **0**, no app FATAL
- [x] Screenshot paths recorded
- [x] RESULT written COMPLETE
- [x] Job card moved running → done

## COMPLETE or BLOCKED
**COMPLETE**
