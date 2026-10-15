# T8b Phone Friends exclusive — RESULT

## Status
**COMPLETE · ALIVE**

No invent Play PASS / multi PASS / blur PASS / GOAL_MET / A/V scorecard PASS.

## OWN
- Exclusive **one adb** phone UI this tick: Pixel 9 Pro serial **45141FDAP0004F**
- Did **not** dual-adb, force-push, MediaSession thrash, deploy, or APK rebuild

## Package
| Field | Value |
|-------|--------|
| package | `me.ruletka.app` |
| versionName | **0.1.368** (`dumpsys package`) |
| versionCode | **376** |
| lastUpdateTime | 2026-08-11 22:24:14 |
| tip note | Tip **0.1.370-vc378** **not** installed; device has **0.1.368-vc376** (current on-device) |
| Activity | `me.ruletka.app/.MainActivity` |
| Intent | `VIEW dat=ruletka://friends` |
| pid after open + screencap + dump | **17435** (**ALIVE**) |

## Device
```
45141FDAP0004F  device  usb product:caiman model:Pixel_9_Pro  state=device
```
One serial only (adb devices listed this single device).

## Open method

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH
SERIAL=45141FDAP0004F
adb -s $SERIAL logcat -c
adb -s $SERIAL shell am start -a android.intent.action.VIEW \
  -d "ruletka://friends" me.ruletka.app
sleep 3
adb -s $SERIAL shell screencap -p /sdcard/t8b-friends.png
adb -s $SERIAL shell uiautomator dump /sdcard/t8b-friends.xml
# pull + logcat FATAL scan; pidof me.ruletka.app
```

- `am start` exit 0; warm deliver:
  ```
  Starting: Intent { act=android.intent.action.VIEW dat=ruletka://friends/... pkg=me.ruletka.app }
  Warning: Activity not started, intent has been delivered to currently running top-most instance.
  ```
- `topResumedActivity` = `me.ruletka.app/.MainActivity`
- Process **ALIVE** pid **17435** via `pidof me.ruletka.app` after open/shot/dump

## Artifacts (UTC **20260812T045818Z**)

| Kind | Path |
|------|------|
| Screencap | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T045818Z-t8b-friends.png` (165109 bytes) |
| UI dump | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T045818Z-t8b-friends.xml` |
| logcat full | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T045818Z-t8b-friends-logcat.txt` |
| FATAL filter | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T045818Z-t8b-friends-logcat-fatal.txt` (**empty** — 0 bytes) |

## Crash?
**No** (app process)

- FATAL EXCEPTION / `Process: me.ruletka.app` filter **empty** after logcat clear + open + dump
- Process **ALIVE** pid **17435** after deeplink + screencap + uiautomator
- Screencap shows intact Friends UI (no crash dialog)
- Minor system noise only: `AppOps attributionTag not declared` (not app crash)

## UI / friends note
Friends screen **did open** (EN locale). Evidence from screencap + uiautomator:

### Empty friends (not blank spinner / not error)
- Title **Friends**
- **Your code** `DABC741D` with **Share invite** / **Copy code**
- Counts: **0 online · 0 friends** (empty friends list state)
- Add: **Friend code** input + **Add**
- Accessibility: `Friends (0)`

### Recent matches list (list path, not empty-only)
- Section **Recent matches** + **Clear**
- Multiple rows (e.g. **Драконов**, 🇨🇦 **Драконов** · ★204) with row CTAs:
  **Add friend** · **Copy code** · **Report** · **Block** · **Dismiss**

### Error path
- **Not observed** this tick (no network-error / offline banner on shot; friends empty counts rendered clean)

## Soft
- No force-push, no deploy, no APK rebuild
- **No invent Play PASS** / multi PASS / blur PASS / GOAL_MET
- Friends deeplink + empty(0·0) + recent list + **ALIVE** only
- Tip 0.1.370-vc378 not on device — honest stamp is **0.1.368-vc376**

## RESULT
**COMPLETE · ALIVE** — exclusive phone `45141FDAP0004F`; package **0.1.368 (376)**; `ruletka://friends` delivered; pid **17435**; empty friends 0·0 + recent matches list; no FATAL; shot+dump under `mobile/artifacts/device-smoke/20260812T045818Z-t8b-friends.*`.
