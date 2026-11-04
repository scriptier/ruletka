# BLUR-F59 multi SoftBlur unlock-gate + device retry (honest)

## Goal
Re-check phone unlock. If keyguard still on → **BLOCKED COMPLETE** (dumpsys+screenshot; short hop). If unlocked → Settings Hold + true multi SoftBlur evidence. **Never invent multi SoftBlur PASS.**

## OWN
- Phone exclusive adb **`192.168.1.94:43343`** only
- Optional helpers: multi-pair / phone-web-pair only
- RESULT: `tasks/grok-loop/done/BLUR-F59-multi-soft-unlock-retry-RESULT.md`
- Artifacts: `mobile/artifacts/device-smoke/f59-blur/`
- Read-only product
- Card → `done/` when COMPLETE

## Work
1. PATH: `export PATH="$HOME/Android/Sdk/platform-tools:$PATH"`. `adb connect 192.168.1.94:43343` + exclusive `-s 192.168.1.94:43343` · package **0.1.374+**
2. Gate `isKeyguardShowing` / `mDreamingLockscreen`
   - true → state+shot → BLOCKED · stop (no PIN thrash)
   - false → Hold → `prefs_load mode=hold` → multi until `peers≥2`
3. multi SoftBlur PASS only if peers≥2 + softNative=1 + ≥N Sink
4. Explicit non-claims table

## Must not
Force-push; invent multi SoftBlur PASS / MULTI_PASS; APK; product edits; locksettings thrash; pool>0; dual adb
