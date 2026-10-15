# BLUR-F14 Intro on 0.1.371 (device reattach)

## Goal
Pixel may be reattached after F12/F13 USB absence. Complete **Intro** residual on tip **0.1.371-vc379** with soft product ON. Hold=F11; Off=F12.

## OWN
- Phone exclusive **one adb**
- RESULT: tasks/grok-loop/done/BLUR-F14-intro-371-RESULT.md
- Read-only product code

## Work
1. adb devices — if empty after short wait/kill-server → BLOCKED honest
2. Confirm package 0.1.371 / 379 (reinstall latest APK only if wrong version)
3. Settings → Intro/Brief → match → logcat `mode=intro` show → intro_auto hide; softNative=1 + Sink
4. Artifacts mobile/artifacts/device-smoke/f14-blur/
5. Multi SoftBlur NOT claimed

## Must not
Force-push, invent multi/Intro PASS without evidence, dual adb
