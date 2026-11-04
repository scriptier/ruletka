# L14-phone-friends RESULT

**Status:** COMPLETE · ALIVE  
**Task:** freenet-roulette exclusive phone — `ruletka://friends` shot + pid + dumpsys version  
**Timestamp:** 2026-08-12T03:17:10Z UTC  
**Device:** `45141FDAP0004F` Pixel 9 Pro (caiman)

## Package confirm

| Field | Value |
|-------|--------|
| package | `me.ruletka.app` |
| versionName | **0.1.367** |
| versionCode | **375** |
| lastUpdateTime | 2026-08-11 21:11:38 |
| process | **ALIVE** pid=**20684** |

## Outcome

- warm `am start -a android.intent.action.VIEW -d "ruletka://friends" me.ruletka.app` → exit 0  
  (Warning: Activity not started, intent has been delivered to currently running top-most instance)
- pid **20684** ALIVE after screencap (`pidof me.ruletka.app`)
- dumpsys package: **versionName=0.1.367** · **versionCode=375**
- topResumedActivity: `me.ruletka.app/.MainActivity` (task visible, focused)
- UI title **Друзья**; code **DABC741D**; recent matches list visible (Драконов · WebPair · ★204)
- Online 0 · total 0; add-friend field + share/copy code actions present
- No invent PASS

## Commands

```bash
export ANDROID_HOME=$HOME/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$PATH
S=45141FDAP0004F OUT=mobile/artifacts/device-smoke
TS=$(date -u +%Y%m%dT%H%M%SZ)
adb -s $S shell am start -a android.intent.action.VIEW -d "ruletka://friends" me.ruletka.app
sleep 2
adb -s $S shell screencap -p /sdcard/l14f.png && adb -s $S pull /sdcard/l14f.png $OUT/${TS}-l14-friends.png
echo PID=$(adb -s $S shell pidof me.ruletka.app | tr -d '\r')
adb -s $S shell dumpsys package me.ruletka.app | grep -E 'versionName|versionCode'
```

## Artifacts

| Artifact | Path |
|----------|------|
| screencap | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T031710Z-l14-friends.png` |
| workspace copy | `/home/drakosik/mobile/artifacts/device-smoke/20260812T031710Z-l14-friends.png` |

Canonical writeup: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L14-phone-friends-RESULT.md`
