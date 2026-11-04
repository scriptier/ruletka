# T8 Phone Settings UI exclusive — RESULT

## Status
**COMPLETE · ALIVE**

No invent PASS / Play GOAL_MET / multi smoke PASS / A/V scorecard PASS.

## OWN
- Exclusive adb phone UI: Pixel 9 Pro serial **45141FDAP0004F**
- Did **not** run device-smoke / friends concurrent / deploy / APK rebuild

## Package
| Field | Value |
|-------|--------|
| package | `me.ruletka.app` |
| versionName | **0.1.366** (`dumpsys package`) |
| versionCode | **374** |
| Activity | `me.ruletka.app/.MainActivity` |
| Intent | `VIEW dat=ruletka://settings` |
| pid after open + dump + scroll | **8432** (**ALIVE**) |

## Open method

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH
adb -s 45141FDAP0004F shell am force-stop me.ruletka.app
adb -s 45141FDAP0004F logcat -c
adb -s 45141FDAP0004F shell am start -a android.intent.action.VIEW \
  -d "ruletka://settings" me.ruletka.app
# dump + screencap; swipe scroll for version chip; logcat FATAL filter
```

- Device: `45141FDAP0004F` usb product:caiman model:Pixel_9_Pro state=`device`
- `am start` exit 0; cold start after force-stop → pid **8432**
- `topResumedActivity` = `me.ruletka.app/.MainActivity`
- Intent on task: `dat=ruletka://settings`

## Artifacts (UTC **20260812T023658Z**)

| Kind | Path |
|------|------|
| Screencap (top) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T023658Z-t8-settings.png` (960×2142) |
| UI dump (top) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T023658Z-t8-settings.xml` |
| Screencap (scrolled → About/version) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T023658Z-t8-settings-scrolled.png` |
| UI dump (scrolled) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T023658Z-t8-settings-scrolled.xml` |
| Screencap (about alias) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T023658Z-t8-settings-about.png` |
| UI dump (about alias) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T023658Z-t8-settings-about.xml` |
| logcat full | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T023658Z-t8-settings-logcat.txt` |
| FATAL filter | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T023658Z-t8-settings-logcat-fatal.txt` (**empty**) |

Earlier warm-start shot (pre force-stop): `20260812T023524Z-t8-settings.{png,xml}` also under same dir.

## Crash?
**No** (app process)

- FATAL filter file is **empty** after logcat clear + open + scroll
- Process **ALIVE** pid **8432** via `pidof me.ruletka.app` after dump/shot/scroll
- (Prior concurrent uiautomator dump race produced shell `UiAutomationService already registered` — tooling noise, not `me.ruletka.app`)

## UI / settings note
Settings screen **did open** (RU locale). Evidence from uiautomator + screencap:

### Top of screen
- Title **Настройки**
- **Профиль**: code `DABC741D`, name `anon`, ★77 / trust «Знакомый · 1»
- **Матч и язык**: language chips (Системный / English / **Русский** / …), gender prefs, «Скрыть мой IP» = **Выкл (P2P OK)**

### Scrolled (version chip) — DONE WHEN
- Collapsed rows: **Звуки и уведомления** · **Подключение к хабу** (`ruletka.vip · хаб онлайн`, ●) · **Блоки и жалобы** (0·0) · **Резервная копия** · **Безопасность и правовое**
- Section **О приложении**
- Build / version chip text: **`ruletka 0.1.366 (374)`** (uiautomator bounds `[70,1884][818,1920]`)
- Matches `dumpsys package`: versionName **0.1.366**, versionCode **374**

## Soft
- No force-push, no deploy, no APK rebuild, pool=0
- **No invent Play PASS** / multi GOAL_MET / A/V scorecard PASS
- Settings open + UI dump + scroll version chip + **ALIVE** only

## RESULT
**COMPLETE · ALIVE** — exclusive phone `45141FDAP0004F`; `ruletka://settings` cold-open; hierarchy + shots; version chip **0.1.366 (374)**; no app FATAL.
