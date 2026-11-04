# T1 Phone device-smoke + PC browser web partner

## Goal
Pixel 9 Pro (serial 45141FDAP0004F) smoke with headless PC Chromium partner.

## OWN (exclusive phone + one browser pair)
- Run: `export ANDROID_HOME=$HOME/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$PATH`
- `cd mobile && WEB_PAIR=1 WAIT_S=35 ./scripts/device-smoke.sh artifacts/ruletka-0.1.366-vc374.apk`
- Or from repo: `cd mobile && WEB_PAIR=1 WAIT_S=35 ./scripts/device-smoke.sh`
- Serial prefer Pixel 9 Pro already in script

## Work
1. Confirm adb device online.
2. Run device-smoke with WEB_PAIR=1 (install latest 0.1.366 if needed).
3. Capture verdict from artifacts/device-smoke/last-verdict.txt + final screenshots paths.
4. RESULT with MATCHED|SEARCHING|IDLE|UNKNOWN + exit code + FATAL logcat note.
5. **Do not claim multi 3-way PASS** — this is 1v1 pair smoke.

## Done
- RESULT: tasks/grok-loop/done/T1-phone-device-smoke-web-pair-RESULT.md COMPLETE or BLOCKED
- Connect risk: low (smoke only)

## Must not
- Deploy, force-push, ICE thrash, dual phone UI with other agents
- GOAL_MET invent
