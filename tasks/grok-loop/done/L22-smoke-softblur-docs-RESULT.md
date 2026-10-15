# L22 SMOKE soft-blur agent notes — RESULT

## Status
**COMPLETE**

## OWN
- `knowledge/specs/SMOKE-NEXT.md` only
- RESULT: `tasks/grok-loop/done/L22-smoke-softblur-docs-RESULT.md`
- **Did not** touch product code, APK, adb, MediaSession, force-push
- **Did not** invent multi PASS / MULTI_PASS / human GOAL_MET
- **Did not** check any human `[x]` boxes

## Goal
Stamp agent notes from F2–F6 RESULTs (+ F7 default hold) into SMOKE-NEXT: SoftBlur native code-shipped + registered; tip APK **0.1.368-vc376**; Hold agent evidence (`mode=hold`, `softNative=1`, Sink attached); Off/Intro residual open; multi SoftBlur open; SCAFFOLD_DONE ≠ MULTI_PASS.

## Sources (RESULT-only; no free invent)

| Hop | RESULT | Used for |
|-----|--------|----------|
| F2 | `BLUR-F2-native-softblur-RESULT.md` | SoftBlurVideoView + Manager + Package registered |
| F3 | `BLUR-F3-rn-wrapper-RESULT.md` | SoftBlurRemote / isSoftBlurNativeAvailable |
| F4 | `BLUR-F4-stage-integrate-RESULT.md` | LiveStageVideo soft path; multi per-tile wire code-shipped |
| F5 | `BLUR-F5-modal-chrome-RESULT.md` | transparent Modal chrome |
| F6 | `BLUR-F6-apk-smoke-RESULT.md` | APK 0.1.368-vc376; Hold logcat evidence |
| F7 | `BLUR-F7-default-hold-RESULT.md` | DEFAULTS/normalize → hold (prefs; no device PASS alone) |

## Work done

### `knowledge/specs/SMOKE-NEXT.md`
1. **Tip APK** stamp → **0.1.368-vc376** (header, Install, C0/C1, §D, §E, report pastes).
2. New **### Agent SoftBlur notes (not human PASS) — 2026-08-12 F2–F7** table:
   - F2–F5 **code-shipped + registered**
   - F6 **Hold agent evidence** only: `prefs_load mode=hold` · `softNative=1` · `SoftBlurVideoView: Sink attached` ×2 · veil stayed · 1v1 `peers=1`
   - F7 default hold on disk
   - Explicit residual: Off/Intro open (F8 may be concurrent); multi SoftBlur open; blur GOAL_MET not claimed
3. Agent device notes row for SoftBlur; multi row stresses **SCAFFOLD_DONE ≠ MULTI_PASS**.
4. §D multi notes: SoftBlur multi tiles **open**; SCAFFOLD_DONE ≠ MULTI_PASS reinforced.
5. **All human checkboxes remain `- [ ]`.** No GOAL_MET invent.

## Explicit non-claims
| Claim | Verdict |
|-------|---------|
| Human local_blur / blur_persist GOAL_MET | **NOT checked** |
| Multi SoftBlur / 3-way / 4-way PASS | **NOT claimed** |
| MULTI_PASS from harness scaffold | **NOT claimed** (SCAFFOLD_DONE ≠ MULTI_PASS) |
| Off / Intro SoftBlur product PASS | **NOT claimed** (residual open) |
| Product code / APK / adb this hop | **NOT done** |

## Files

| Path | Change |
|------|--------|
| `knowledge/specs/SMOKE-NEXT.md` | SoftBlur agent notes + tip APK 0.1.368-vc376; human boxes untouched |
| `tasks/grok-loop/done/L22-smoke-softblur-docs-RESULT.md` | this RESULT |
| Card | `running/L22-smoke-softblur-docs.md` → `done/` |

## COMPLETE
**COMPLETE.** Agent SoftBlur notes stamped from F2–F7 RESULTs only. Tip APK **0.1.368-vc376**. Hold evidence documented as **agent evidence**, not human GOAL_MET. Off/Intro + multi SoftBlur remain open. SCAFFOLD_DONE ≠ MULTI_PASS.
