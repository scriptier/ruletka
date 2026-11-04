# BLUR-F11 APK rebuild + soft re-smoke after enable

## Goal
After F10 enables soft product flag: build/install tip APK (expect **0.1.371+** or rebuild 370 tree), device-smoke Hold (and quick Intro if cheap) — require logcat `softNative=1` + Sink attached. No invent multi PASS.

## OWN
- Phone exclusive **one adb**
- APK build via repo script (F11 card = proceed)
- RESULT: `tasks/grok-loop/done/BLUR-F11-apk-resmoke-RESULT.md`
- Read-only SoftBlur Java / LiveStageVideo; do not race-edit SoftBlurRemote if F10 still writing — **wait for F10 RESULT COMPLETE** (~3–5 min poll)

## Gate
1. Wait for `tasks/grok-loop/done/BLUR-F10-soft-enable-RESULT.md` COMPLETE and `SOFT_BLUR_PRODUCT_ENABLED = true` on disk
2. If F10 missing after wait: BLOCKED (not invent PASS)
3. Build APK → install → Settings Hold → match → logcat softNative=1
4. Artifacts under mobile/artifacts/device-smoke/f11-blur/

## Must not
Force-push, invent multi/blur PASS without evidence, dual adb

## Factory
Director tick · F residual after kill-switch
