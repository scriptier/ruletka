# WIKI multi SoftBlur keyguard residual note — RESULT

## Status
**COMPLETE** (wiki only)

## Goal
Append honest residual: multi SoftBlur device blocked **F17–F19** (keyguard PIN · serial **43343** · tip **0.1.374**). Static wiring **OK** (**F19s**). Human unlock needed. **No invent multi PASS.**

## Gate
| Check | Result |
|-------|--------|
| Product code / deploy | **none** (wiki only) |
| Invent multi SoftBlur PASS / MULTI_PASS | **no** |
| Sources read | F17 · F18 · F19 unlock-retry RESULTs + F19s static reconfirm |

## OWN touched
| Path | Change |
|------|--------|
| `knowledge/wiki/log.md` | New top entry: residual F17–F19 keyguard BLOCKED · F19s static OK · human unlock · no invent multi PASS |
| `knowledge/wiki/mobile-ux.md` | Multi SoftBlur table + F19 / F19s rows; residual human unlock; Log line |
| `knowledge/wiki/multi-party.md` | Honest ship state → F17–F19 residual; F19s static note; Log line; unlock residual tip |
| `knowledge/wiki/index.md` | mobile-ux + multi-party one-liners → F17–F19 · F19s static OK |
| `tasks/grok-loop/done/WIKI-keyguard-multi-note-RESULT.md` | this file |
| card | `running/29-WIKI-keyguard-multi-note.md` → `done/` |

## Residual (honest — from sources)

| Hop | Outcome | Key facts |
|-----|---------|-----------|
| **F17** | BLOCKED / partial | keyguard PIN · serial **43343** (42227 refused) · tip **0.1.374/vc382** · Hold setup fail · phone max_peers=0 · 0× softNative multi / Sink · web2phone **SCAFFOLD_DONE only** |
| **F18** | BLOCKED (keyguard) | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · gate stop · multi not attempted |
| **F19** | BLOCKED (keyguard) | same unlock-gate · AlternateBouncer / fingerprint · no Hold / multi / softNative / Sink |
| **F19s** | static OK only | `SOFT_BLUR_PRODUCT_ENABLED=true` · per-tile SoftBlur map + zOrder0 intact · hunt ≠ multi soft · verify-match-ux 30 ok · **static ≠ device PASS** |

**Unblock:** human unlock PIN/fingerprint → Settings Hold → true multi `peers≥2` → softNative=1 + Sink per remote → only then multi SoftBlur device PASS candidate.

## Explicit non-claims
- **No multi SoftBlur PASS**
- **No MULTI_PASS**
- SCAFFOLD_DONE ≠ MULTI_PASS
- Soft 1v1 Sink ≠ multi-tile soft
- F19s static wiring OK ≠ device multi SoftBlur PASS

## Sources
- `tasks/grok-loop/done/BLUR-F17-multi-soft-device-attempt-RESULT.md`
- `tasks/grok-loop/done/BLUR-F18-multi-soft-unlock-retry-RESULT.md`
- `tasks/grok-loop/done/BLUR-F19-multi-soft-unlock-retry-RESULT.md`
- `tasks/grok-loop/done/BLUR-F19s-multi-soft-static-reconfirm-RESULT.md`

## Must not (confirmed)
- No product code
- No invent multi PASS
- No deploy

## Completed
- UTC: **2026-08-12** (wiki residual hop)
- Outcome: **COMPLETE** — residual filed; multi SoftBlur device remains **OPEN / NOT claimed**
- Honesty: **never invent multi SoftBlur PASS**
