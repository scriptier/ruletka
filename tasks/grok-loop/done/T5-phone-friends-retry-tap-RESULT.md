# T5 Phone Friends empty + Retry soft tap — RESULT

**Status:** COMPLETE  
**Device:** Pixel 9 Pro `45141FDAP0004F` (exclusive)  
**Package:** `me.ruletka.app`  
**When:** 2026-08-11 ~20:27–20:28 local  

## Work done

1. `am force-stop me.ruletka.app`
2. `logcat -c`
3. `am start -a android.intent.action.VIEW -d 'ruletka://friends' -n me.ruletka.app/.MainActivity` → started OK
4. Wait ~4s → uiautomator dump + screencap
5. Retry / Повторить search → **not present** → **no tap**
6. Re-dump + second screencap
7. logcat FATAL watch ~10s

## Observations

| Check | Result |
|-------|--------|
| Deep link friends | Opened `MainActivity`; UI title **Друзья** |
| Friends content | Code `DABC741D`, «Онлайн 0 · всего 0», recent matches list (Драконов …) |
| Retry / Повторить | **Absent** on dump1 and dump2 — soft-tap skipped |
| Crash | **No** `FATAL EXCEPTION`; pid `me.ruletka.app` alive (3533) |
| Resumed activity | `me.ruletka.app/.MainActivity` |
| Long match | Not started |

Note: logcat matches for `AndroidRuntime` were uiautomator shell launcher (uid 2000), not app fatals. `STRICT_FATAL_EXCEPTION_COUNT=0`.

## Artifacts

- `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/t5-friends-ui-1.xml`
- `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/t5-friends-1.png`
- `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/t5-friends-ui-2.xml`
- `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/t5-friends-2.png`
- `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/t5-friends-fatal.txt`

## Verdict

**RESULT COMPLETE** — friends deep link opened without crash; Retry not visible so no soft-tap; dumps + shots saved. No PASS / multi GOAL_MET claimed.
