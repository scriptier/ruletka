# L15b-friends RESULT

**Status:** COMPLETE · ALIVE  
**Task:** freenet-roulette exclusive phone — `ruletka://friends` shot + pid  
**Timestamp:** 2026-08-12T03:36:29Z UTC  
**Device:** `45141FDAP0004F` Pixel 9 Pro (caiman) via wireless ADB `192.168.1.94:34179`  
(USB serial offline; mDNS `_adb-tls-connect` used)

## Package confirm

| Field | Value |
|-------|--------|
| package | `me.ruletka.app` |
| versionName | **0.1.367** |
| versionCode | **375** |
| lastUpdateTime | 2026-08-11 21:11:38 |
| process | **ALIVE** pid=**20684** |

## Outcome

- `am start -n me.ruletka.app/.MainActivity -a android.intent.action.VIEW -d "ruletka://friends"` → exit 0  
  (Activity brought to front / intent delivered)
- pid **20684** ALIVE after screencap (`pidof me.ruletka.app`)
- dumpsys package: **versionName=0.1.367** · **versionCode=375**
- topResumedActivity / mCurrentFocus: `me.ruletka.app/.MainActivity`
- UI title **Друзья**; code **DABC741D**; share/copy code actions present
- Online **0** · total **0**; add-friend field **Код друга** + **Добавить**
- Recent matches: **Драконов** (★204) · **Драконов** · **Драконов** (★204) · **WebPair** (★5)
- Per-row actions: В друзья · Копировать код · Жалоба · Блок · Убрать
- No invent PASS

## Notes

- Settings agent had finished; phone was briefly unreachable (USB absent, wireless doze) then reconnected on port **34179**.
- Notification shade / lock / DoorDash briefly stole focus; recovered via `KEYCODE_HOME` + force-stop DoorDash + component+data friends start.
- Earlier partial shot while shade up discarded; canonical artifact is friends title shot below.

## Commands

```bash
export ANDROID_HOME=$HOME/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$PATH
# wireless (USB serial not present this run)
S=192.168.1.94:34179   # or: adb connect $(adb mdns services | awk '/adb-tls/{print $NF}')
OUT=/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke
TS=$(date -u +%Y%m%dT%H%M%SZ)
adb -s $S shell am start -n me.ruletka.app/.MainActivity \
  -a android.intent.action.VIEW -d "ruletka://friends"
sleep 2
adb -s $S shell screencap -p /sdcard/l15bf.png && adb -s $S pull /sdcard/l15bf.png $OUT/${TS}-l15b-friends.png
echo PID=$(adb -s $S shell pidof me.ruletka.app | tr -d '\r')
adb -s $S shell dumpsys package me.ruletka.app | grep -E 'versionName|versionCode'
```

## Artifacts

| Artifact | Path |
|----------|------|
| screencap | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T033629Z-l15b-friends.png` |
| UI xml | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T033629Z-l15b-friends.xml` |
| workspace copy | `/home/drakosik/mobile/artifacts/device-smoke/20260812T033629Z-l15b-friends.png` |

Canonical writeup: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L15b-friends-RESULT.md`
