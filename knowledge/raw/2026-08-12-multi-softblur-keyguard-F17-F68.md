# Raw dump — multi SoftBlur keyguard chain F17–F68 (immutable)

**Date:** 2026-08-12  
**Kind:** residual / device-gate block (docs compound source)  
**Device:** Pixel 9 Pro (caiman) · wireless adb serial **`192.168.1.94:43343`**  
**Package tip:** **0.1.374 / vc382** (`me.ruletka.app`)

## Verdict (honest)

| Signal | Value |
|--------|--------|
| Multi SoftBlur **device** | **OPEN / NOT claimed** |
| Chain | **F17–F68 all BLOCKED (keyguard)** |
| F19s | static OK only (wiring + product flag · **≠** device PASS) |
| multi SoftBlur PASS / MULTI_PASS | **NOT claimed** · **do not invent** |
| product.ok / GOAL_MET invent from this residual | **no** |

## Chain summary

| Hop range | Status | Notes |
|-----------|--------|--------|
| **F17** | BLOCKED / partial | keyguard · phone peers=0 · 0× softNative multi / Sink · web2phone SCAFFOLD only · SCAFFOLD_DONE ≠ MULTI_PASS |
| **F18–F67** | BLOCKED (keyguard) | unlock-retry continuity · Hold / multi / softNative / Sink not reached · serial 43343 · tip 0.1.374-vc382 |
| **F68** | **BLOCKED COMPLETE (keyguard)** | gate still true · see F68 detail |

## F68 gate (primary evidence)

From `BLUR-F68-multi-soft-unlock-retry-RESULT`:

- `isKeyguardShowing=true`
- `mDreamingLockscreen=true`
- focus `NotificationShade`
- power **Dozing/AOD** (`mWakefulness=Dozing`)
- trust `UNTRUSTED` · `deviceLocked=1`
- focused app under keyguard: `com.brave.browser` Main
- first connect **20260812T140657Z** · samples **140659 / 140701 / 140703** · multipoll reconfirm **140726–140733Z** · trust/focus **140752Z**
- **no** Settings→Hold · **no** multi-pair · **0×** softNative / Sink
- artifacts: `mobile/artifacts/device-smoke/f68-blur/`
- product code / APK / pool edits this hop: **none** · pool=0

## Unblock (human only)

human unlock PIN/fingerprint → keyguard false → Settings Hold → true multi `peers≥2` → softNative=1 + Sink per remote → only then multi SoftBlur **device** PASS candidate.

## Sources (cite only)

- `tasks/grok-loop/done/BLUR-F68-multi-soft-unlock-retry-RESULT.md` (primary)
- `tasks/grok-loop/done/WIKI-keyguard-F68-note-RESULT.md` (wiki residual already compounded F17–F68)
- Prior F17–F67 continuity via those RESULT files / wiki residual (not re-invented here)

## Explicit non-claims

- No multi SoftBlur device PASS
- No MULTI_PASS
- No invent product.ok / GOAL_MET from keyguard residual
- Soft 1v1 Sink ≠ multi-tile soft
- F19s static OK ≠ device multi SoftBlur PASS
- F68 unlock-retry BLOCKED ≠ device progress
