# BLUR-F18 multi SoftBlur unlock-gate + device retry (honest)

## Goal
Re-attempt multi SoftBlur **device** evidence only if phone UI is unlocked. If still keyguard PIN → honest **BLOCKED COMPLETE** with dumpsys/screenshot evidence. **Never invent multi SoftBlur PASS.**

## OWN
- Phone exclusive one adb wireless serial **`192.168.1.94:43343`** (F17 rotated; do **not** use dead 42227)
- Optional partner helpers only: `scripts/multi-pair.mjs` / `phone-web-pair.mjs` (no product edits)
- RESULT: `tasks/grok-loop/done/BLUR-F18-multi-soft-unlock-retry-RESULT.md`
- Artifacts under `mobile/artifacts/device-smoke/f18-blur/`
- Read-only product code

## Work
1. `adb connect 192.168.1.94:43343` · exclusive `-s` · confirm package **0.1.374+** / vc382+
2. Gate: `dumpsys window` → `isKeyguardShowing` / `mDreamingLockscreen`
   - If **true**: capture state + 1 screenshot → RESULT **BLOCKED (keyguard)** · stop (do not thrash UI/PIN)
   - If **false**: Settings → Hold (`Jusqu'à ce que je touche` / `Until I tap`) → confirm `prefs_load mode=hold`
3. If unlocked: try true multi (prefer `MODE=web2phone FIND_THIRD=1` or multi-pair + phone as 3rd) until phone log shows `peers≥2` / multiRemote
4. If multiRemote + Hold: expect stage `softNative=1` + **≥N** `SoftBlurVideoView: Sink attached` for N remotes — only then multi SoftBlur device PASS candidate
5. Explicit table: peers · softNative · Sink · scaffold vs PASS · **no invent**

## Must not
Force-push; invent multi SoftBlur PASS without `peers≥2` + softNative/Sink evidence; invent MULTI_PASS from SCAFFOLD_DONE; APK rebuild/install; product code edits; thrash locksettings/PIN; dual adb product thrash; pool>0 ICE thrash
