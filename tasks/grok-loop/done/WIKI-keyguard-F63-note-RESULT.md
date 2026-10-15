# WIKI multi SoftBlur keyguard residual F63 — RESULT

## Status
**COMPLETE** (wiki only)

## Goal
Append honest residual: multi SoftBlur device still **OPEN / NOT claimed** — keyguard chain **F17–F63** (latest **F63 BLOCKED** on serial **43343**, package **0.1.374-vc382**). **F19s** static OK. Human unlock needed. **No invent multi PASS / GOAL_MET / product.ok.**

## Gate
| Check | Result |
|-------|--------|
| Product code / deploy / adb | **none** (wiki only) |
| Invent multi SoftBlur PASS / MULTI_PASS / product.ok / GOAL_MET | **no** |
| SMOKE-NEXT / BLUR-MULTI-FINISH-PLAN / CONNECT-IMPROVE-PLAN | **not touched** |
| Sources read | `BLUR-F63-multi-soft-unlock-retry-RESULT` (primary) + prior wiki F17–F62 residual (`WIKI-keyguard-F62-note-RESULT`) |

## OWN touched
| Path | Change |
|------|--------|
| `knowledge/wiki/log.md` | New top entry: residual F17–F63 keyguard BLOCKED · F17–F62 continuity · F63 unlock-retry detail (Dozing/AOD · NotificationShade · ~13:16Z) · F19s static OK · human unlock · no invent multi PASS / product.ok |
| `knowledge/wiki/mobile-ux.md` | Multi SoftBlur table + F63 row; residual F17–F63; Hold tip line; Log line |
| `knowledge/wiki/multi-party.md` | Honest ship state → F17–F63 residual; F63 bullet; smoke unlock tip; Log line |
| `knowledge/wiki/index.md` | mobile-ux + multi-party one-liners → F17–F63 · F19s static OK |
| `tasks/grok-loop/done/WIKI-keyguard-F63-note-RESULT.md` | this file |
| card | `running/WIKI-keyguard-F63-note.md` → `done/` |

## Residual (honest — from sources)

| Hop | Outcome | Key facts |
|-----|---------|-----------|
| **F17–F62** | BLOCKED (keyguard) | Prior wiki residual (`WIKI-keyguard-F62-note`); serial **43343** · tip **0.1.374/vc382** · F19s static OK · SCAFFOLD only on F17 · unlock-retry chain |
| **F63** | **BLOCKED COMPLETE (keyguard)** | `isKeyguardShowing=true` · `mDreamingLockscreen=true` · focus `NotificationShade` · power **Dozing/AOD** (`AodShowing=true` · `mWakefulness=Dozing`) · trust `UNTRUSTED` · deviceLocked=1 · serial **`192.168.1.94:43343`** exclusive · package **0.1.374 / vc382** · multipoll 13:16:19–13:16:23Z + reconfirm 13:16:51–13:16:53Z · samples 13:16:41–13:16:45Z · final 13:16:50Z / 13:16:55Z · **no** Hold / multi-pair / softNative / Sink · multi SoftBlur **device NOT claimed** · artifacts `f63-blur/` · Delta vs F62: still Dozing/AOD + NotificationShade; gate still **true** |

**Unblock:** human unlock PIN/fingerprint → Settings Hold → true multi `peers≥2` → softNative=1 + Sink per remote → only then multi SoftBlur device PASS candidate.

## Explicit non-claims
- **No multi SoftBlur PASS**
- **No MULTI_PASS**
- **No product.ok invent** from this residual hop
- **No GOAL_MET invent**
- SCAFFOLD_DONE ≠ MULTI_PASS
- Soft 1v1 Sink ≠ multi-tile soft
- F19s static wiring OK ≠ device multi SoftBlur PASS
- F63 unlock-retry BLOCKED ≠ device progress

## Sources
- `tasks/grok-loop/done/BLUR-F63-multi-soft-unlock-retry-RESULT.md` (primary)
- Prior F17–F62 keyguard BLOCKED continuity via F63 RESULT + existing wiki residual (`WIKI-keyguard-F62-note-RESULT`)

## Must not (confirmed)
- No product code
- No invent multi PASS / product.ok / GOAL_MET
- No adb thrash / APK / force-push
- No MediaSession / live.js
- No SMOKE-NEXT / BLUR-MULTI-FINISH-PLAN / CONNECT-IMPROVE-PLAN touch

## Completed
- UTC: **2026-08-12** (wiki residual hop F63)
- Outcome: **COMPLETE** — residual filed; multi SoftBlur device remains **OPEN / NOT claimed**
- Honesty: **never invent multi SoftBlur PASS**
