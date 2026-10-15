# T2 Phone Friends screen UI dump — RESULT

## Status
**COMPLETE**

## OWN
- Exclusive adb phone UI: Pixel 9 Pro serial **45141FDAP0004F**
- Did **not** run device-smoke / pair-smoke phone scripts
- (PC-only `pair-smoke.mjs` for T2 rematch was unrelated; no shared adb UI)

## Package
| Field | Value |
|-------|--------|
| package | `me.ruletka.app` (not bare `me.ruletka`) |
| versionName | **0.1.366** |
| versionCode | **374** |
| Activity | `me.ruletka.app/.MainActivity` |
| pid after open | **31587** (ALIVE) |

## Open method
Deep link (preferred):

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH
adb -s 45141FDAP0004F shell am force-stop me.ruletka.app
adb -s 45141FDAP0004F logcat -c
adb -s 45141FDAP0004F shell am start -a android.intent.action.VIEW \
  -d 'ruletka://friends' -n me.ruletka.app/.MainActivity
```

- Scheme `ruletka` from `mobile/app.json` / `app.config.js`
- Router rewrite: `ruletka://friends` → `/friends` via `mobile/app/+native-intent.ts` (`RESERVED` host)
- `am start` exit **0**; topResumedActivity = `me.ruletka.app/.MainActivity`

## Artifacts

| Kind | Path |
|------|------|
| UI dump | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/T2-friends-ui.xml` |
| Screencap | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/T2-friends-ui.png` (960×2142 PNG) |
| logcat filter | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/T2-friends-logcat.txt` |
| FATAL/AR/RN | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/T2-friends-logcat-fatal.txt` |

On-device dump path used: `/sdcard/friends-ui.xml` then `adb pull`.

## Crash?
**No**

- No `FATAL EXCEPTION` in logcat window (~15s after clear + open)
- `AndroidRuntime` lines are **uiautomator** tool lifecycle only (`com.android.commands.uiautomator.Launcher`)
- `ReactNativeJS: Running "main"` — normal boot, not a crash
- Process **ALIVE** after dump/shot

## UI / empty-state note
Friends screen **did open** (RU locale). Visible chrome from uiautomator text:

- Title **Друзья** (Friends); a11y `Друзья (0)`
- **Ваш код** `DABC741D` — share / copy
- Strip **Онлайн 0 · всего 0** → friend graph empty (0 online / 0 total)
- **Код друга** + **Добавить** input row present
- **Недавние матчи** list populated (not a blank friends empty-only screen): recent rows e.g. «Драконов» with duration/time/★ actions **В друзья / Копировать код / Жалоба / Блок / Убрать**

Empty-state for *friendships* is the **0 · 0** online strip; recent-match history still shows prior partners.

## Soft
- No force-push, no deploy, no APK rebuild, pool=0
- No invent PASS / multi GOAL_MET
