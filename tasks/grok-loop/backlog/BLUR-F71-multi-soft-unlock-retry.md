# BLUR-F71 multi SoftBlur unlock-gate + device retry (honest)

## Goal
Next once-hourly unlock recheck after F70. If keyguard still on → **BLOCKED COMPLETE**. If unlocked → Hold + multi SoftBlur evidence. **Never invent multi SoftBlur PASS.**

## OWN
- Phone exclusive adb **`192.168.1.94:43343`** only
- RESULT: `tasks/grok-loop/done/BLUR-F71-multi-soft-unlock-retry-RESULT.md`
- Artifacts: `mobile/artifacts/device-smoke/f71-blur/`
- Read-only product

## Gate
Respect STOP-KEYGUARD-SPAM — promote only after **≥ ~1h from F70 burn** or `isKeyguardShowing=false`.

## Must not
Force-push; invent multi SoftBlur PASS; APK; locksettings thrash; pool>0; dual adb
