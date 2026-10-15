# BLUR-F19 multi SoftBlur unlock-gate + device retry (honest)

## Goal
Re-check phone unlock. If keyguard still on → **BLOCKED COMPLETE** with dumpsys+screenshot (short hop). If unlocked → Settings Hold + true multi (`peers≥2`) SoftBlur evidence attempt. **Never invent multi SoftBlur PASS.**

## OWN
- Phone exclusive one adb wireless **`192.168.1.94:43343`** (not dead 42227)
- Optional helpers only: `scripts/multi-pair.mjs` / `phone-web-pair.mjs`
- RESULT: `tasks/grok-loop/done/BLUR-F19-multi-soft-unlock-retry-RESULT.md`
- Artifacts: `mobile/artifacts/device-smoke/f19-blur/`
- Read-only product code

## Work
1. `export PATH="$HOME/Android/Sdk/platform-tools:$PATH"` · connect · exclusive `-s 192.168.1.94:43343` · package **0.1.374+**
2. Gate: `isKeyguardShowing` / `mDreamingLockscreen`
   - **true** → state+screenshot → RESULT BLOCKED · stop (no PIN thrash)
   - **false** → Hold (`Jusqu'à ce que je touche` / `Until I tap`) → `prefs_load mode=hold`
3. If unlocked: multi path (`MODE=web2phone FIND_THIRD=1` preferred) until phone `peers≥2`
4. multi SoftBlur PASS only if `peers≥2` + `softNative=1` + ≥N Sink for N remotes
5. Explicit non-claims table

## Must not
Force-push; invent multi SoftBlur PASS / MULTI_PASS; APK rebuild; product edits; thrash locksettings; pool>0 ICE thrash
