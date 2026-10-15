# T2 Phone live idle Start screenshot — RESULT

## Status
**COMPLETE**

## OWN
- Exclusive adb phone UI: Pixel 9 Pro serial **45141FDAP0004F**
- **Waited for settings:** T3-phone-settings still running at claim → waited **90s**; T3 RESULT present before this shot (`T3-phone-settings-RESULT.md`, artifacts `20260812T021839Z-settings*`)
- Did **not** start a match (no Start tap, no long pair-smoke)
- Soft: no deploy / APK rebuild / force-push

## Package
| Field | Value |
|-------|--------|
| package | `me.ruletka.app` |
| versionName | **0.1.366** |
| versionCode | **374** |
| Activity | `me.ruletka.app/.MainActivity` (topResumed) |
| pid after open | **32110** (ALIVE) |

## Open method
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH
S=45141FDAP0004F
OUT=/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke
TS=20260812T021946Z

adb -s $S shell am force-stop me.ruletka.app
sleep 1
adb -s $S shell am start -a android.intent.action.VIEW -d "ruletka://live" me.ruletka.app
sleep 3
adb -s $S shell screencap -p /sdcard/live-idle.png
adb -s $S pull /sdcard/live-idle.png "$OUT/${TS}-live-idle.png"
adb -s $S shell uiautomator dump /sdcard/live-idle.xml
adb -s $S pull /sdcard/live-idle.xml "$OUT/${TS}-live-idle.xml"
```

- Deep link `ruletka://live` → exit OK (`Starting: Intent { act=android.intent.action.VIEW dat=ruletka://live/... pkg=me.ruletka.app }`)
- Monkey fallback **not** needed

## Artifacts

| Kind | Path |
|------|------|
| Screencap (ts) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T021946Z-live-idle.png` |
| Screencap (stable) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/T2-live-idle.png` |
| UI dump (ts) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T021946Z-live-idle.xml` |
| UI dump (stable) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/T2-live-idle.xml` |

- PNG **960×2142** RGBA (~1.3 MB)
- On-device: `/sdcard/live-idle.png`, `/sdcard/live-idle.xml`

## Idle / Start button?

**Yes — live idle with Start visible. No match started.**

| Control | resource-id | text / content-desc | bounds | clickable |
|---------|-------------|---------------------|--------|-----------|
| **Start** | `live-start-btn` | text **Старт**, content-desc **Старт** | `[36,1872][924,1980]` | true, enabled |
| Last-chat chip | (button, content-desc Старт) | «ПОСЛЕДНИЙ ЧАТ» / «CA Драконов · 2AFEE934» / «12s · тап — Start» | `[27,275][657,445]` | true |
| Mic | `live-mic-btn` | Мик вкл | `[36,1980][245,2088]` | true |
| Cam | `live-cam-btn` | Показать | `[263,1980][471,2088]` | true |
| Flip | `live-flip-btn` | Камера | `[489,1980][698,2088]` | true |
| Friends | `live-friends-btn` | Друзья | `[716,1980][924,2088]` | true |
| Brand loop | `live-brand-loading-loop` | (TextureView idle loop) | `[0,0][960,1872]` | false |

### Visible idle chrome (RU)
- **Ваша камера**
- **2 онлайн · нажмите Старт** ← idle CTA (not searching/matched)
- PiP hint: **Тяни · 2× тап смена**
- Bottom dock: **Старт** + mic/cam/flip/friends

### Not present (good for idle)
- No stop/next/report/timer match chrome
- No long match run (task: shot only)

## Crash?
**No** (app process ALIVE pid **32110**; MainActivity resumed; UI dump coherent with idle live)

## Soft notes
- Settings agent finished first; phone free after wait
- `grep -E 'live-start|Start|Начать'` hits: `live-start-btn`, content-desc/text **Старт**, last-chat «тап — Start», idle strip «нажмите Старт»
- No invent PASS / multi GOAL_MET
