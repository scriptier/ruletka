# T9 Phone Friends exclusive — RESULT

## Status
**COMPLETE · ALIVE**

No invent PASS / Play GOAL_MET / multi smoke PASS / A/V scorecard PASS.

## OWN
- Exclusive adb phone UI: Pixel 9 Pro serial **45141FDAP0004F**
- Did **not** run device-smoke suite concurrent / deploy / APK rebuild / settings

## Package
| Field | Value |
|-------|--------|
| package | `me.ruletka.app` |
| Activity | `me.ruletka.app/.MainActivity` |
| Intent | `VIEW dat=ruletka://friends` |
| pid after open + screencap | **8432** (**ALIVE**) |

## Open method

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH
adb -s 45141FDAP0004F shell am start -a android.intent.action.VIEW \
  -d "ruletka://friends" me.ruletka.app
sleep 2
adb -s 45141FDAP0004F shell screencap -p /sdcard/t9f.png
adb -s 45141FDAP0004F pull /sdcard/t9f.png $OUT/${TS}-t9-friends.png
echo PID=$(adb -s 45141FDAP0004F shell pidof me.ruletka.app | tr -d '\r')
```

- Device: `45141FDAP0004F` usb product:caiman model:Pixel_9_Pro state=`device`
- `am start` exit 0; warm deliver:
  ```
  Starting: Intent { act=android.intent.action.VIEW dat=ruletka://friends/... pkg=me.ruletka.app }
  Warning: Activity not started, intent has been delivered to currently running top-most instance.
  ```
- Process **ALIVE** pid **8432** via `pidof me.ruletka.app`

## Artifacts (UTC **20260812T023911Z**)

| Kind | Path |
|------|------|
| Screencap | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T023911Z-t9-friends.png` (173055 bytes) |

## Crash?
**No** (app process)

- Process **ALIVE** pid **8432** after deep link + screencap
- Screencap shows intact Friends UI (no crash dialog)

## UI / friends note
Friends screen **did open** (RU locale). Evidence from screencap:

- Title **Друзья**
- **Ваш код** `DABC741D` with **Поделиться** / **Копировать код**
- Online/total: **Онлайн 0 · всего 0**
- Add friend: **Код друга** input + **Добавить**
- Section **Недавние матчи** with recent rows (e.g. 🇨🇦 Драконов) + actions **В друзья** / **Копировать код** / **Жалоба** / **Блок** / **Убрать**

## Soft
- No force-push, no deploy, no APK rebuild, pool=0
- **No invent Play PASS** / multi GOAL_MET / A/V scorecard PASS
- Friends deep link + screencap + **ALIVE** only

## RESULT
**COMPLETE · ALIVE** — exclusive phone `45141FDAP0004F`; `ruletka://friends` delivered; pid **8432**; friends UI shot saved.
