# Raw dump — multi SoftBlur keyguard chain F17–F70 (immutable)

**Date:** 2026-08-12  
**Kind:** residual / device-gate block (docs compound source)  
**Device:** Pixel 9 Pro (caiman) · wireless adb serial **`192.168.1.94:43343`**  
**Package tip:** **0.1.374 / vc382** (`me.ruletka.app`)

## Verdict (honest)

| Signal | Value |
|--------|--------|
| Multi SoftBlur **device** | **OPEN / NOT claimed** |
| Chain | **F17–F70 all BLOCKED (keyguard)** |
| F19s | static OK only (wiring + product flag · **≠** device PASS) |
| multi SoftBlur PASS / MULTI_PASS | **NOT claimed** · **do not invent** |
| product.ok / GOAL_MET invent from this residual | **no** |

## Chain summary

| Hop range | Status | Notes |
|-----------|--------|--------|
| **F17** | BLOCKED / partial | keyguard · phone peers=0 · 0× softNative multi / Sink · web2phone SCAFFOLD only · SCAFFOLD_DONE ≠ MULTI_PASS |
| **F18–F69** | BLOCKED (keyguard) | unlock-retry continuity · Hold / multi / softNative / Sink not reached · serial 43343 · tip 0.1.374-vc382 |
| **F70** | **BLOCKED COMPLETE (keyguard)** | gate still true · ~10:16 MDT · see F70 detail |

## F70 gate (primary evidence)

From `BLUR-F70-multi-soft-unlock-retry-RESULT`:

- `isKeyguardShowing=true` (initial + after KEYCODE_WAKEUP + multipoll + reconfirm)
- `mDreamingLockscreen=true`
- focus `NotificationShade` · focused app under keyguard: `com.brave.browser` Main
- power initial **Dozing** (`mWakefulness=Dozing` · `mScreenOn=false`); after WAKEUP only → Awake + screen on · **keyguard still showing** (no PIN)
- trust `UNTRUSTED` · `deviceLocked=1`
- first connect **20260812T161616Z** (~10:16 MDT) · multipoll reconfirm **161622–161624Z** · final reconfirm **161626Z**
- **no** Settings→Hold · **no** multi-pair · **0×** softNative / Sink
- artifacts: `mobile/artifacts/device-smoke/f70-blur/`
- product code / APK / pool edits this hop: **none** · pool=0
- **no** locksettings / PIN / swipe unlock thrash (WAKEUP keyevent only)
- STOP gate ≥ ~10:14 MDT satisfied as once-hourly unlock recheck after F69

## F71 gate (STOP)

Next unlock recheck **≥ ~11:14 MDT** (STOP-KEYGUARD-SPAM · once-hourly after F70 ~10:16 MDT) or human unlock. Do not thrash unlock-retry before the window. **No invent multi SoftBlur PASS.**

## Unblock (human only)

human unlock PIN/fingerprint → keyguard false → Settings Hold → true multi `peers≥2` → softNative=1 + Sink per remote → only then multi SoftBlur **device** PASS candidate.

## Sources (cite only)

- `tasks/grok-loop/done/BLUR-F70-multi-soft-unlock-retry-RESULT.md` (primary)
- Prior F17–F69 continuity via `knowledge/raw/2026-08-12-multi-softblur-keyguard-F17-F69.md` + wiki residual (not re-invented here)

## Explicit non-claims

- No multi SoftBlur device PASS
- No MULTI_PASS
- No invent product.ok / GOAL_MET from keyguard residual
- Soft 1v1 Sink ≠ multi-tile soft
- F19s static OK ≠ device multi SoftBlur PASS
- F70 unlock-retry BLOCKED ≠ device progress
