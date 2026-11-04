# WIKI multi SoftBlur keyguard residual F45–F47 — RESULT

## Status
**COMPLETE** (wiki only)

## Goal
Append honest residual: multi SoftBlur device still blocked **F17–F47** (keyguard · serial **43343** · tip **0.1.374-vc382**). **F19s** static OK. Human unlock needed. **No invent multi PASS.**

## Gate
| Check | Result |
|-------|--------|
| Product code / deploy | **none** (wiki only) |
| Invent multi SoftBlur PASS / MULTI_PASS | **no** |
| SMOKE-NEXT / BLUR-MULTI-FINISH-PLAN / CONNECT-IMPROVE-PLAN | **not touched** |
| Sources read | F45 · F46 · F47 unlock-retry RESULTs + prior WIKI-keyguard-F39-note-RESULT |

## OWN touched
| Path | Change |
|------|--------|
| `knowledge/wiki/log.md` | New top entry: residual F17–F47 keyguard BLOCKED · F45/F46/F47 unlock-retry · F40–F44 continuity · F19s static OK · human unlock · no invent multi PASS |
| `knowledge/wiki/mobile-ux.md` | Multi SoftBlur table + F40–F47 rows; residual F17–F47; Hold tip line; Log line |
| `knowledge/wiki/multi-party.md` | Honest ship state → F17–F47 residual; F45/F46/F47 bullets; smoke unlock tip; Log line |
| `knowledge/wiki/index.md` | mobile-ux + multi-party one-liners → F17–F47 · F19s static OK |
| `tasks/grok-loop/done/WIKI-keyguard-F47-note-RESULT.md` | this file |
| card | `running/54-WIKI-keyguard-F47-note.md` → `done/` |

## Residual (honest — from sources)

| Hop | Outcome | Key facts |
|-----|---------|-----------|
| **F17** | BLOCKED / partial | keyguard PIN · serial **43343** · tip **0.1.374/vc382** · Hold setup fail · phone max_peers=0 · 0× softNative multi / Sink · web2phone **SCAFFOLD_DONE only** |
| **F18** | BLOCKED (keyguard) | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · gate stop · multi not attempted |
| **F19** | BLOCKED (keyguard) | same unlock-gate · AlternateBouncer / fingerprint · no Hold / multi / softNative / Sink |
| **F19s** | static OK only | `SOFT_BLUR_PRODUCT_ENABLED=true` · per-tile SoftBlur map + zOrder0 intact · hunt ≠ multi soft · verify-match-ux 30 ok · **static ≠ device PASS** |
| **F20** | BLOCKED (keyguard) | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · focus `AlternateBouncerView` · serial **43343** exclusive · tip **0.1.374/vc382** · gate stop · **0×** peers / softNative / Sink |
| **F21** | BLOCKED (keyguard) | same unlock-gate · AlternateBouncer / fingerprint · face auth pending · multi SoftBlur **not claimed** |
| **F22** | BLOCKED (keyguard) | continuity in F23–F47 tables · still keyguard · multi SoftBlur **not claimed** |
| **F23** | BLOCKED (keyguard) | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · `AlternateBouncerView` · serial **43343** · tip **0.1.374/vc382** · gate stop · **0×** peers / softNative / Sink · multi SoftBlur **not claimed** · artifacts `f23-blur/` · UTC ~08:07Z |
| **F24** | BLOCKED (keyguard) | same unlock-gate reconfirm (~08:16Z) · AlternateBouncer / fingerprint · **0×** peers / softNative / Sink · multi SoftBlur **not claimed** · artifacts `f24-blur/` |
| **F25** | BLOCKED (keyguard) | continuity unlock-retry · multi SoftBlur **not claimed** (L40 SMOKE SoftBlur stamp · F28/F29 continuity) |
| **F26** | BLOCKED (keyguard) | continuity unlock-retry · multi SoftBlur **not claimed** (L41 SMOKE SoftBlur stamp · F28/F29 continuity) |
| **F27** | BLOCKED (keyguard) | continuity unlock-retry · multi SoftBlur **not claimed** (`BLUR-F27` · L42) |
| **F28** | BLOCKED (keyguard) | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · `AlternateBouncerView` · serial **43343** · tip **0.1.374/vc382** · gate stop · **0×** peers / softNative / Sink · multi SoftBlur **not claimed** · artifacts `f28-blur/` · UTC ~08:56Z |
| **F29** | BLOCKED (keyguard) | same unlock-gate reconfirm (~09:06Z) · AlternateBouncer / fingerprint · trust `UNTRUSTED` · **0×** peers / softNative / Sink · multi SoftBlur **not claimed** · artifacts `f29-blur/` |
| **F30** | BLOCKED (keyguard) | continuity unlock-retry · multi SoftBlur **not claimed** (F37–F47 continuity) |
| **F31** | BLOCKED (keyguard) | continuity unlock-retry · multi SoftBlur **not claimed** (F37–F47 continuity) |
| **F32** | BLOCKED (keyguard) | continuity unlock-retry · multi SoftBlur **not claimed** (F37–F47 continuity) |
| **F33** | BLOCKED (keyguard) | continuity unlock-retry · multi SoftBlur **not claimed** (F37–F47 continuity) |
| **F34** | BLOCKED (keyguard) | continuity unlock-retry · multi SoftBlur **not claimed** (F37–F47 continuity) |
| **F35** | BLOCKED (keyguard) | continuity unlock-retry · multi SoftBlur **not claimed** (F37–F47 continuity) |
| **F36** | BLOCKED (keyguard) | continuity unlock-retry · multi SoftBlur **not claimed** (`BLUR-F36` · F37 continuity) |
| **F37** | BLOCKED (keyguard) | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · `AlternateBouncerView` · serial **43343** · tip **0.1.374/vc382** · gate stop · **0×** peers / softNative / Sink · multi SoftBlur **not claimed** · artifacts `f37-blur/` · UTC ~09:56Z |
| **F38** | BLOCKED (keyguard) | same unlock-gate reconfirm (~09:57Z) · AlternateBouncer / fingerprint · **0×** peers / softNative / Sink · multi SoftBlur **not claimed** · artifacts `f38-blur/` |
| **F39** | BLOCKED (keyguard) | same unlock-gate reconfirm (~10:06Z) · AlternateBouncer / fingerprint · **0×** peers / softNative / Sink · multi SoftBlur **not claimed** · artifacts `f39-blur/` |
| **F40** | BLOCKED (keyguard) | continuity unlock-retry · multi SoftBlur **not claimed** (F45–F47 continuity) |
| **F41** | BLOCKED (keyguard) | continuity unlock-retry · multi SoftBlur **not claimed** (F45–F47 continuity) |
| **F42** | BLOCKED (keyguard) | continuity unlock-retry · multi SoftBlur **not claimed** (F45–F47 continuity) |
| **F43** | BLOCKED (keyguard) | continuity unlock-retry · multi SoftBlur **not claimed** (F45–F47 continuity) |
| **F44** | BLOCKED (keyguard) | continuity unlock-retry · multi SoftBlur **not claimed** (`BLUR-F44` · F45 continuity) |
| **F45** | BLOCKED (keyguard) | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · `AlternateBouncerView` · serial **43343** · tip **0.1.374/vc382** · gate stop · **0×** peers / softNative / Sink · multi SoftBlur **not claimed** · artifacts `f45-blur/` · UTC ~10:36Z |
| **F46** | BLOCKED (keyguard) | same unlock-gate reconfirm (~10:47Z) · AlternateBouncer / fingerprint · trust `UNTRUSTED` · **0×** peers / softNative / Sink · multi SoftBlur **not claimed** · artifacts `f46-blur/` |
| **F47** | BLOCKED (keyguard) | same unlock-gate reconfirm (~10:49Z) · AlternateBouncer / fingerprint · trust `UNTRUSTED` · **0×** peers / softNative / Sink · multi SoftBlur **not claimed** · artifacts `f47-blur/` |

**Unblock:** human unlock PIN/fingerprint → Settings Hold → true multi `peers≥2` → softNative=1 + Sink per remote → only then multi SoftBlur device PASS candidate.

## Explicit non-claims
- **No multi SoftBlur PASS**
- **No MULTI_PASS**
- SCAFFOLD_DONE ≠ MULTI_PASS
- Soft 1v1 Sink ≠ multi-tile soft
- F19s static wiring OK ≠ device multi SoftBlur PASS
- F45/F46/F47 unlock-retry BLOCKED ≠ device progress

## Sources
- `tasks/grok-loop/done/BLUR-F45-multi-soft-unlock-retry-RESULT.md`
- `tasks/grok-loop/done/BLUR-F46-multi-soft-unlock-retry-RESULT.md`
- `tasks/grok-loop/done/BLUR-F47-multi-soft-unlock-retry-RESULT.md`
- `tasks/grok-loop/done/WIKI-keyguard-F39-note-RESULT.md`

## Must not (confirmed)
- No product code
- No invent multi PASS
- No deploy
- No SMOKE-NEXT / BLUR-MULTI-FINISH-PLAN / CONNECT-IMPROVE-PLAN touch

## Completed
- UTC: **2026-08-12** (wiki residual hop F45–F47)
- Outcome: **COMPLETE** — residual filed; multi SoftBlur device remains **OPEN / NOT claimed**
- Honesty: **never invent multi SoftBlur PASS**
