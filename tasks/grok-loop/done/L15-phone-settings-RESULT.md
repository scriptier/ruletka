# L15-phone-settings RESULT

**Status:** COMPLETE · ALIVE  
**Task:** freenet-roulette exclusive phone — `ruletka://settings` dump + shot + version chip  
**Timestamp:** 2026-08-12T03:23:39Z UTC  
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

- warm `am start -a android.intent.action.VIEW -d "ruletka://settings" me.ruletka.app` → exit 0  
  (Warning: Activity not started, intent has been delivered to currently running top-most instance)
- pid **20684** ALIVE after screencap / uiautomator dump (`pidof me.ruletka.app`)
- dumpsys package: **versionName=0.1.367** · **versionCode=375**
- topResumedActivity: `me.ruletka.app/.MainActivity` (task visible, focused)
- UI title **Настройки**; code **DABC741D**; name **anon**; wallet **★97 · trust 1 · Знакомый**
- Language selected: **Русский**
- Me / seek: **Не указано** / **Всех**
- Hide IP: **Выкл (P2P OK)** selected
- Traffic save: **Выкл · полное**; Live layout: **Нативный звонок**
- Stranger curtain (blur hold): **Кратко (~2.5 с)** selected (options: Выкл / Кратко / Пока не нажму)
- Hub: **ruletka.vip · хаб онлайн**
- Bottom chip **`ruletka 0.1.367 (375)`** under «О приложении»
- No invent multi PASS

## UI texts (top + scrolled highlights)

```
Настройки
Профиль · ★97 · Ваш код DABC741D · Имя anon
Матч и язык · Язык Русский · Я Не указано · Ищу Всех
Скрыть мой IP · Выкл (P2P OK)
Экономия трафика · Выкл · полное
Макет Live · Нативный звонок
Шторка для незнакомцев · Кратко (~2.5 с)
Сохранять снимки · Вкл.
Подключение к хабу · ruletka.vip · хаб онлайн
О приложении · ruletka 0.1.367 (375)
```

## Commands

```bash
export ANDROID_HOME=$HOME/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$PATH
S=45141FDAP0004F OUT=mobile/artifacts/device-smoke
TS=$(date -u +%Y%m%dT%H%M%SZ)
adb -s $S shell am start -a android.intent.action.VIEW -d "ruletka://settings" me.ruletka.app
sleep 2
adb -s $S shell screencap -p /sdcard/l15s.png && adb -s $S pull /sdcard/l15s.png $OUT/${TS}-l15-settings.png
adb -s $S shell dumpsys package me.ruletka.app | grep -E 'versionName|versionCode' | head -4
adb -s $S shell uiautomator dump /sdcard/l15s.xml; adb -s $S pull /sdcard/l15s.xml $OUT/${TS}-l15-settings.xml
grep -oE 'text="[^"]{0,40}"' $OUT/${TS}-l15-settings.xml | head -40
```

## Artifacts

| File | Path |
|------|------|
| top screenshot | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T032339Z-l15-settings.png` |
| top UI xml | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T032339Z-l15-settings.xml` |
| mid scrolled shot | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T032339Z-l15-settings-scrolled.png` |
| mid UI xml | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T032339Z-l15-settings-scrolled.xml` |
| bottom shot (version chip) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T032339Z-l15-settings-bottom.png` |
| bottom UI xml | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T032339Z-l15-settings-bottom.xml` |

Canonical writeup: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L15-phone-settings-RESULT.md`
