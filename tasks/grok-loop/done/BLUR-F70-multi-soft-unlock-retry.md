# BLUR-F70 multi SoftBlur unlock-gate + device retry (honest)

## Goal
Once-hourly unlock recheck (STOP gate ≥ ~10:14 MDT **passed**). If keyguard still on → **BLOCKED COMPLETE** (dumpsys+screenshot; short hop). If unlocked → Settings Hold + true multi SoftBlur evidence. **Never invent multi SoftBlur PASS.**

## OWN
- Phone exclusive adb **`192.168.1.94:43343`** only (sole phone lane this hop)
- Optional helpers: multi-pair / phone-web-pair only if unlocked
- RESULT: `tasks/grok-loop/done/BLUR-F70-multi-soft-unlock-retry-RESULT.md`
- Artifacts: `mobile/artifacts/device-smoke/f70-blur/`
- Read-only product
- Card → `done/` when COMPLETE

## Work
1. PATH: `export PATH="$HOME/Android/Sdk/platform-tools:$PATH"`. `adb connect 192.168.1.94:43343` + exclusive `-s 192.168.1.94:43343` · package **0.1.374+**
2. Gate `isKeyguardShowing` / `mDreamingLockscreen`
   - true → state+shot → **BLOCKED COMPLETE** · stop (no PIN thrash; KEYCODE_WAKEUP only OK)
   - false → Hold → `prefs_load mode=hold` → multi until `peers≥2`
3. multi SoftBlur PASS only if peers≥2 + softNative=1 + ≥N Sink
4. Explicit non-claims table (Hold / multi / softNative / Sink / MULTI_PASS)

## Must not
Force-push; invent multi SoftBlur PASS / MULTI_PASS; APK; product edits; locksettings thrash; pool>0; dual adb
