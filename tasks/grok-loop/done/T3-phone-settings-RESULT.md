# T3 Phone Settings screen UI dump — RESULT

## Status
**COMPLETE**

## OWN
- Exclusive adb phone UI: Pixel 9 Pro serial **45141FDAP0004F**
- Did **not** run device-smoke / pair-smoke phone scripts
- Friends dump (T2) already done; this hop is Settings only

## Package
| Field | Value |
|-------|--------|
| package | `me.ruletka.app` (not bare `me.ruletka`) |
| versionName | **0.1.366** |
| versionCode | **374** |
| Activity | `me.ruletka.app/.MainActivity` |
| pid after open | **31587** (ALIVE) |

## Open method
Deep link (preferred), same pattern as Friends:

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH
adb -s 45141FDAP0004F logcat -c
adb -s 45141FDAP0004F shell am start -a android.intent.action.VIEW \
  -d 'ruletka://settings' -n me.ruletka.app/.MainActivity
```

- Scheme `ruletka` from `mobile/app.json` / `app.config.js`
- Router rewrite: `ruletka://settings` → `/settings` via `mobile/app/+native-intent.ts` (`RESERVED` host includes `settings`)
- Screen file: `mobile/app/settings.tsx`
- `am start` exit **0**; intent delivered to running top-most instance
- topResumedActivity = `me.ruletka.app/.MainActivity`

## Artifacts

| Kind | Path |
|------|------|
| UI dump (top) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/T3-settings-ui.xml` |
| Screencap (top) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/T3-settings.png` (960×2142 PNG) |
| UI dump (scrolled) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/T3-settings-ui-scrolled.xml` |
| Screencap (scrolled) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/T3-settings-scrolled.png` (960×2142 PNG) |
| logcat | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/T3-settings-logcat.txt` |
| FATAL/AR filter | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/T3-settings-logcat-fatal.txt` (empty) |

Timestamped copies: `20260812T021839Z-settings*.{xml,png,txt}` under same dir.

On-device dump path: `/sdcard/settings-ui.xml` then `adb pull`.

## Crash?
**No**

- No `FATAL EXCEPTION` in logcat window after clear + open
- FATAL filter file is empty
- Process **ALIVE** after dump/shot/scroll (pid **31587** unchanged)

## UI / settings note
Settings screen **did open** (RU locale). Visible chrome from uiautomator + screencap:

### Top of screen (first dump)
- Title **Настройки** (Settings)
- **Профиль** section: code `DABC741D`, name `anon`, ★72 / trust «Знакомый · 1»
- **Матч и язык**: language chips (Системный / English / **Русский** selected / …), gender prefs, «Скрыть мой IP» = **Выкл (P2P OK)**

### Scrolled (version chip)
- **Сохранять снимки** · **Сохранить**
- Collapsed rows: Звуки и уведомления · **Подключение к хабу** (`ruletka.vip · хаб онлайн`, green ●) · Блоки и жалобы (0·0) · Резервная копия · Безопасность и правовое
- **О приложении** subtitle / build chip: **`ruletka 0.1.366 (374)`**  
  (from `buildLabel()` in `settings.tsx` → `Constants.expoConfig.version` + `android.versionCode`)

Package dumpsys matches UI: versionName **0.1.366**, versionCode **374**.

## Soft
- No force-push, no deploy, no APK rebuild, pool=0
- No invent Play PASS / multi GOAL_MET / A/V scorecard PASS
- Settings open + UI dump + ALIVE only
