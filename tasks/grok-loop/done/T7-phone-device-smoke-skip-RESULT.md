# T7 Phone device-smoke SKIP_INSTALL — RESULT

## Status
**COMPLETE**

## OWN
- Exclusive adb phone: Pixel 9 Pro serial **45141FDAP0004F**
- `SKIP_INSTALL=1` (no APK rebuild / no reinstall this hop)
- Headless PC Chromium pair via `WEB_PAIR=1` → `scripts/phone-web-pair.mjs`
- APK already on device / pointer: `mobile/artifacts/ruletka-latest.apk` (versionName **0.1.366**, versionCode **374**)
- **No invent multi PASS** — this is **1v1 device-smoke only**

## Goal
Run short `device-smoke` with `SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=25` while phone exclusive; record honest verdict only.

## Run
```bash
export ANDROID_HOME=$HOME/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$PATH
cd /home/drakosik/freenet-roulette/mobile
SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=25 ./scripts/device-smoke.sh
cat artifacts/device-smoke/last-verdict.txt
```

| Field | Value |
|-------|--------|
| **When (ts)** | `20260812T023145Z` |
| **Device** | Pixel 9 Pro (`45141FDAP0004F`) |
| **SKIP_INSTALL** | **1** (no install; used installed app + `ruletka-latest.apk` meta) |
| **WEB_PAIR** | 1 (pid **3615146**; log below) |
| **WAIT_S** | 25 |
| **Exit code** | **0** |
| **Process** | ALIVE post-deeplink / final / exit-check — **pid=4204** |

## Verdict

| Item | Result |
|------|--------|
| **last-verdict.txt** | **MATCHED** |
| signals | `stop,next,report` |
| device line | Pixel 9 Pro (45141FDAP0004F) |
| xml | `20260812T023145Z-ui-final.xml` |
| Script outcome | `device-smoke: OK (verdict=MATCHED)` |

### last-verdict.txt (exact)
```
MATCHED
ts=20260812T023145Z
signals=stop,next,report
device=Pixel 9 Pro (45141FDAP0004F)
xml=/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T023145Z-ui-final.xml
```

### Classification path
1. force-stop `me.ruletka.app` → deeplink `ruletka://live?autostart=1`
2. ALIVE post-deeplink pid=4204
3. Idle Start check: **no idle Start in UI** (already searching/matched?)
4. Wait 25s settle → final classify → **MATCHED** (`stop,next,report`)
5. No idle-retry path needed this run (first final classify was MATCHED)
6. ALIVE exit-check pid=4204

### Package meta (from smoke)
- versionCode=**374**
- minSdk=24 targetSdk=35
- versionName=**0.1.366**

### Match evidence (phone UI = source of truth)
Final UI dump shows 1v1 live chrome (not multi):
- Buttons: `Стоп` / `Дальше` / `⚑ Жалоба` — resource-ids `live-stop-btn`, `live-next-btn`, `live-report-btn`
- Partner identity dock present (`live-partner-identity-dock`)
- Gifts / chat dock present (1v1 live surface)
- Mid-settle logcat: partner **WebPair** · flag **CA** · **Канада · Калгари** · code `8934C29E` · identity poll done
- Final dump toast: **«WebPair вышел из чата»** (web partner left after match; classify still MATCHED on stop/next/report)
- **Not** 3-way / 4-way / find-third layout claims

## FATAL logcat
- Filter file: `mobile/artifacts/device-smoke/logcat-snippet.txt`
- **No app FATAL EXCEPTION** / no crash for `me.ruletka` (**0** `FATAL EXCEPTION` hits)
- `FATAL` string only appears in the **grep header comment** (`# grep: FATAL|ReactNative|AndroidRuntime`)
- AndroidRuntime lines are uiautomator tool process lifecycle only
- App ReactNativeJS: `rn-webrtc:pc:DEBUG … getStats` on pid **4204** through settle; ALIVE at exit-check

## Web partner (soft note — phone UI is source of truth)
- Log: `mobile/artifacts/device-smoke/web-pair-20260812T023145Z.log`
- URL `https://ruletka.vip/live.html`, budget ~65s, **DONE (budget elapsed)**
- Early path: `matched with 2762a5d4 · solo` → `first frame +3932ms` → `match connected (frames)` · relay→relay `ok=1` with fin/fout rising
- Headless evaluate snapshots stayed `matched:false` / empty `pcs` for much of the budget (instrumentation lag); bodyHint did show **«In a call»** during the good window
- Later: reclick start churn + detached Frame near budget end; phone final toast shows partner left
- Soft only: do **not** invent product A/V scorecard PASS from web-pair log; device-smoke verdict is phone UI **MATCHED**

## Screenshots (this run)

| Shot | Path |
|------|------|
| after deeplink | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T023145Z-01-after-deeplink.png` |
| after start | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T023145Z-02-after-start.png` |
| final (**MATCHED**) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T023145Z-03-final.png` |

## Artifacts dir
`/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/`
- `last-verdict.txt` → **MATCHED**
- `logcat-snippet.txt`
- `web-pair-20260812T023145Z.log`
- UI dumps: `20260812T023145Z-ui-*.xml`

## Explicit non-claims
- **Not** multi 3-way / 4-way PASS
- **Not** invent GOAL_MET or product A/V scorecard PASS
- **Not** APK rebuild / reinstall (SKIP_INSTALL=1)
- **Not** deploy / force-push / ICE thrash / pool>0 / dual MediaSession rewrite
- This is **1v1 phone device-smoke SKIP_INSTALL** only (web pair assist soft)

## Connect risk
**Low** — smoke-only; no product code change in this hop.

## Done criteria
- [x] Exclusive phone free + device online (Pixel 9 Pro 45141FDAP0004F)
- [x] `SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=25` device-smoke
- [x] Verdict **MATCHED**, exit **0**, no app FATAL
- [x] Screenshot / artifact paths recorded
- [x] RESULT written COMPLETE (no invent multi PASS; no APK rebuild)
- [x] Job card moved running → done

## COMPLETE or BLOCKED
**COMPLETE**
