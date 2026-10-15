# T5b Phone Friends reopen (after settings) — RESULT

## Status
**COMPLETE · ALIVE**

No invent PASS / Play PASS / multi GOAL_MET / A/V scorecard PASS. Phone UI reopen dump only.

## OWN
- Exclusive adb phone UI: Pixel 9 Pro serial **45141FDAP0004F**
- Deep link `ruletka://friends` → uiautomator dump + screencap + pidof
- Did **not** run pair-smoke / device-smoke scripts, no deploy, no APK rebuild

## Package
| Field | Value |
|-------|--------|
| package | `me.ruletka.app` |
| versionName | **0.1.366** |
| versionCode | **374** |
| Activity | `me.ruletka.app/.MainActivity` |
| pid after open | **3533** (**ALIVE**) |
| topResumedActivity | `me.ruletka.app/.MainActivity` |

## Open method

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH
OUT=/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke
TS=$(date -u +%Y%m%dT%H%M%SZ)
adb -s 45141FDAP0004F shell am start -a android.intent.action.VIEW \
  -d "ruletka://friends" me.ruletka.app
sleep 2
adb -s 45141FDAP0004F shell uiautomator dump /sdcard/t5b-friends.xml
adb -s 45141FDAP0004F pull /sdcard/t5b-friends.xml $OUT/${TS}-t5b-friends.xml
adb -s 45141FDAP0004F shell screencap -p /sdcard/t5b-friends.png
adb -s 45141FDAP0004F pull /sdcard/t5b-friends.png $OUT/${TS}-t5b-friends.png
echo PID=$(adb -s 45141FDAP0004F shell pidof me.ruletka.app | tr -d '\r')
```

- Scheme `ruletka` → `/friends`
- `am start`: **Warning: Activity not started, intent has been delivered to currently running top-most instance.**
- Device state: `device` (usb Pixel 9 Pro / caiman)
- Timestamp UTC: **20260812T022815Z**

## Artifacts

| Kind | Path |
|------|------|
| UI dump | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T022815Z-t5b-friends.xml` (33645 bytes) |
| Screencap | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T022815Z-t5b-friends.png` (960×2142 PNG) |

On-device: `/sdcard/t5b-friends.xml`, `/sdcard/t5b-friends.png` then `adb pull`.

## Crash?
**No**

- Process **ALIVE** after open + dump + screencap (pid **3533** via `pidof me.ruletka.app`; still 3533 on re-check)
- Hierarchy package=`me.ruletka.app`
- No force-stop / no ANR observed during capture

## UI / friends note
Friends screen **did open** (RU locale) after deep-link delivery to running instance.

### Visible chrome (uiautomator non-empty texts + screencap)
- Title **Друзья** (`content-desc` **Друзья (0)**)
- **Ваш код** · **DABC741D**
- Hint: **Нажмите — поделиться · удержание — копировать**
- Buttons: **Поделиться** · **Копировать код**
- Stats: **Онлайн 0 · всего 0**
- Input: **Код друга** + **Добавить**
- Section **Недавние матчи** · **Очистить**
- Recent rows (4× **🇨🇦 Драконов** with durations/stars) and per-row actions:
  - **В друзья** · **Копировать код** · **Жалоба** · **Блок** · **Убрать**

### Sample `grep -oE 'text="[^"]{0,40}"' … | head -30` (non-empty of note)
```
text="Друзья"
text="Ваш код"
text="DABC741D"
text="Поделиться"
text="Копировать код"
```

## Soft
- Exclusive phone **45141FDAP0004F** only
- No force-push, no deploy, no APK rebuild, pool=0
- **No invent PASS** — status is reopen + UI evidence + **ALIVE** only
- Friends reopen after settings path: deep link delivered; screen rendered; process stayed up
