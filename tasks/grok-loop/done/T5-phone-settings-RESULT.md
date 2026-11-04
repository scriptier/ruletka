# T5 Phone Settings screen UI dump — RESULT

## Status
**COMPLETE**

## OWN
- Exclusive adb phone UI: Pixel 9 Pro serial **45141FDAP0004F**
- Did **not** run device-smoke / pair-smoke phone scripts
- Settings deep-link dump + scroll to version chip only

## Package
| Field | Value |
|-------|--------|
| package | `me.ruletka.app` (not bare `me.ruletka`) |
| versionName | **0.1.366** |
| versionCode | **374** |
| Activity | `me.ruletka.app/.MainActivity` |
| pid after open | **32444** (**ALIVE**) |

## Open method
Deep link (preferred):

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH
adb -s 45141FDAP0004F shell am start -a android.intent.action.VIEW \
  -d "ruletka://settings" me.ruletka.app
```

- Scheme `ruletka` → `/settings`
- `am start`: intent delivered to currently running top-most instance
- `topResumedActivity` = `me.ruletka.app/.MainActivity`
- Device: `45141FDAP0004F` usb product:caiman model:Pixel_9_Pro

## Artifacts

| Kind | Path |
|------|------|
| UI dump (top) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/T5-settings-ui.xml` |
| Screencap (top) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/T5-settings.png` (960×2142 PNG) |
| UI dump (scrolled → About/version) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/T5-settings-ui-scrolled.xml` |
| Screencap (scrolled → About/version) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/T5-settings-scrolled.png` (960×2142 PNG) |
| About alias dump/shot | `T5-settings-ui-about.xml` / `T5-settings-about.png` |

Timestamped copies (UTC **20260812T022626Z**):

- `20260812T022626Z-t5-settings.xml` / `.png`
- `20260812T022626Z-t5-settings-scrolled.xml` / `.png` (version chip view)
- `20260812T022626Z-t5-settings-about.xml` / `.png`

On-device dump paths: `/sdcard/t5-settings.xml`, `/sdcard/t5-settings2.xml`, `/sdcard/t5-settings3.xml` then `adb pull`.

## Crash?
**No**

- Process **ALIVE** after open + dump + multi-scroll (pid **32444** via `pidof me.ruletka.app`)
- Settings chrome rendered; hierarchy package=`me.ruletka.app`

## UI / settings note
Settings screen **did open** (RU locale). Visible chrome from uiautomator:

### Top of screen (first dump)
- Title **Настройки**
- **Профиль**: code `DABC741D`, name `anon`, ★72 / trust «Знакомый · 1»
- **Матч и язык**: language chips (Системный / English / **Русский** / Українська / Deutsch / Español / …)

### Mid-scroll
- **Последнее соединение** timing line present
- **Шторка для незнакомцев** · **Сохранять снимки** · **Сохранить**
- Collapsed rows: **Звуки и уведомления** · **Подключение к хабу** (`ruletka.vip · хаб онлайн`, ●) · **Блоки и жалобы** (0·0) · **Резервная копия** · **Безопасность и правовое**

### Scrolled (version chip) — DONE WHEN
- Section **О приложении**
- Build / version chip text: **`ruletka 0.1.366 (374)`**
- Matches `dumpsys package`: versionName **0.1.366**, versionCode **374**

## Soft
- No force-push, no deploy, no APK rebuild, pool=0
- **No invent Play PASS** / multi GOAL_MET / A/V scorecard PASS
- Settings open + UI dump + **ALIVE** + version chip only
