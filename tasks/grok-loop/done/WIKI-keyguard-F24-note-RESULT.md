# WIKI multi SoftBlur keyguard residual F23–F24 — RESULT

## Status
**COMPLETE** (wiki only)

## Goal
Append honest residual: multi SoftBlur device still blocked **F17–F24** (keyguard · serial **43343** · tip **0.1.374-vc382**). **F19s** static OK. Human unlock needed. **No invent multi PASS.**

## Gate
| Check | Result |
|-------|--------|
| Product code / deploy | **none** (wiki only) |
| Invent multi SoftBlur PASS / MULTI_PASS | **no** |
| SMOKE-NEXT / BLUR-MULTI-FINISH-PLAN | **not touched** |
| Sources read | F23 · F24 unlock-retry RESULTs + prior WIKI-keyguard-F21-note-RESULT |

## OWN touched
| Path | Change |
|------|--------|
| `knowledge/wiki/log.md` | New top entry: residual F17–F24 keyguard BLOCKED · F23/F24 unlock-retry · F19s static OK · human unlock · no invent multi PASS |
| `knowledge/wiki/mobile-ux.md` | Multi SoftBlur table + F22/F23/F24 rows; residual F17–F24; Hold tip line; Log line |
| `knowledge/wiki/multi-party.md` | Honest ship state → F17–F24 residual; F23/F24 bullets; smoke unlock tip; Log line |
| `knowledge/wiki/index.md` | mobile-ux + multi-party one-liners → F17–F24 · F19s static OK |
| `tasks/grok-loop/done/WIKI-keyguard-F24-note-RESULT.md` | this file |
| card | `running/36-WIKI-keyguard-F24-note.md` → `done/` |

## Residual (honest — from sources)

| Hop | Outcome | Key facts |
|-----|---------|-----------|
| **F17** | BLOCKED / partial | keyguard PIN · serial **43343** · tip **0.1.374/vc382** · Hold setup fail · phone max_peers=0 · 0× softNative multi / Sink · web2phone **SCAFFOLD_DONE only** |
| **F18** | BLOCKED (keyguard) | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · gate stop · multi not attempted |
| **F19** | BLOCKED (keyguard) | same unlock-gate · AlternateBouncer / fingerprint · no Hold / multi / softNative / Sink |
| **F19s** | static OK only | `SOFT_BLUR_PRODUCT_ENABLED=true` · per-tile SoftBlur map + zOrder0 intact · hunt ≠ multi soft · verify-match-ux 30 ok · **static ≠ device PASS** |
| **F20** | BLOCKED (keyguard) | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · focus `AlternateBouncerView` · serial **43343** exclusive · tip **0.1.374/vc382** · gate stop · **0×** peers / softNative / Sink |
| **F21** | BLOCKED (keyguard) | same unlock-gate · AlternateBouncer / fingerprint · face auth pending · multi SoftBlur **not claimed** |
| **F22** | BLOCKED (keyguard) | continuity in F23/F24 tables · still keyguard · multi SoftBlur **not claimed** |
| **F23** | BLOCKED (keyguard) | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · `AlternateBouncerView` · serial **43343** · tip **0.1.374/vc382** · gate stop · **0×** peers / softNative / Sink · multi SoftBlur **not claimed** · artifacts `f23-blur/` · UTC ~08:07Z |
| **F24** | BLOCKED (keyguard) | same unlock-gate reconfirm (~08:16Z) · AlternateBouncer / fingerprint · **0×** peers / softNative / Sink · multi SoftBlur **not claimed** · artifacts `f24-blur/` |

**Unblock:** human unlock PIN/fingerprint → Settings Hold → true multi `peers≥2` → softNative=1 + Sink per remote → only then multi SoftBlur device PASS candidate.

## Explicit non-claims
- **No multi SoftBlur PASS**
- **No MULTI_PASS**
- SCAFFOLD_DONE ≠ MULTI_PASS
- Soft 1v1 Sink ≠ multi-tile soft
- F19s static wiring OK ≠ device multi SoftBlur PASS
- F23/F24 unlock-retry BLOCKED ≠ device progress

## Sources
- `tasks/grok-loop/done/BLUR-F23-multi-soft-unlock-retry-RESULT.md`
- `tasks/grok-loop/done/BLUR-F24-multi-soft-unlock-retry-RESULT.md`
- `tasks/grok-loop/done/WIKI-keyguard-F21-note-RESULT.md`

## Must not (confirmed)
- No product code
- No invent multi PASS
- No deploy
- No SMOKE-NEXT / BLUR-MULTI-FINISH-PLAN touch

## Completed
- UTC: **2026-08-12** (wiki residual hop F23–F24)
- Outcome: **COMPLETE** — residual filed; multi SoftBlur device remains **OPEN / NOT claimed**
- Honesty: **never invent multi SoftBlur PASS**
