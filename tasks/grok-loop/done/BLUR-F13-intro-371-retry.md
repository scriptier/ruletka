# BLUR-F13 Intro residual retry on 0.1.371

## Goal
F12 got Off PASS then USB disconnect before Intro. Retry **Intro only** on tip **0.1.371-vc379** if device reattached. Hold=F11; Off=F12.

## OWN
- Phone exclusive one adb
- RESULT: tasks/grok-loop/done/BLUR-F13-intro-371-retry-RESULT.md
- Read-only product

## Work
1. adb devices — if empty → BLOCKED honest COMPLETE (do not invent)
2. Confirm 0.1.371/379
3. Settings Intro/Brief → match → logcat show→intro_auto, softNative=1 + Sink
4. Artifacts mobile/artifacts/device-smoke/f13-blur/
5. Multi SoftBlur NOT claimed

## Must not
Force-push, invent multi/Intro PASS without evidence, dual adb
