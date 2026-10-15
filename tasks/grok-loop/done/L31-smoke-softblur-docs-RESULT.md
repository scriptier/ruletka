# L31 SMOKE softblur F16 matrix notes — RESULT

## Status
**COMPLETE**

## OWN
- `knowledge/specs/SMOKE-NEXT.md` only
- RESULT: `tasks/grok-loop/done/L31-smoke-softblur-docs-RESULT.md`
- **Did not** touch product code, APK, adb, MediaSession, force-push
- **Did not** invent multi PASS / MULTI_PASS / human GOAL_MET
- **Did not** check any human `[x]` boxes

## Goal
Stamp agent SoftBlur F16 matrix notes into SMOKE-NEXT from RESULT sources only:
- **F16** multi SoftBlur **static only** post-MX
- **F16b** Off+Intro agent reconfirm on tip **0.1.374-vc382**
- Hold remains **F15** on **0.1.373-vc381** (not re-run)
- Multi SoftBlur device still **open**
- No human GOAL_MET checkboxes

## Sources (RESULT-only; no free invent)

| Hop | RESULT | Used for |
|-----|--------|----------|
| F15 | `BLUR-F15-hold-soft-reconfirm-RESULT.md` | Hold soft reconfirm on post-MX tip **0.1.373-vc381** · `softNative=1` · Sink · Hold stay; multi **NOT claimed** |
| F16 multi static | `BLUR-F16-multi-soft-static-RESULT.md` | Multi SoftBlur **static only** post-MX · product flag **true** · per-tile wire intact · multi device **NOT claimed** · **SCAFFOLD_DONE ≠ MULTI_PASS** |
| F16b Off+Intro | `BLUR-F16-off-intro-373-RESULT.md` | Off+Intro agent reconfirm on tip **0.1.374-vc382** · Off: `mode=off` + **0×** show · Intro: `softNative=1` + Sink + `intro_auto` · Hold remains **F15** on **373** · multi **NOT claimed** |

## Work done

### `knowledge/specs/SMOKE-NEXT.md`
1. Header SoftBlur stamp: **F16** multi SoftBlur **static only** post-MX (flag **true**); **F16b** Off+Intro agent reconfirm on tip **0.1.374-vc382**; Hold stays **F15** on **373**; multi SoftBlur device **open**.
2. Prod body / SoftBlur summary: F16b Off+Intro agent on **374** (1v1 only · not human GOAL_MET); multi SoftBlur **open** (F16 static only).
3. **Agent SoftBlur notes** expanded to **F2–F16b**:
   - **F16** multi SoftBlur static post-MX (product flag ON + per-tile wire) — not multi device PASS
   - **F16b** Off+Intro on **0.1.374-vc382**: Off `mode=off` + 0× blur show; Intro `softNative=1` + Sink + `hide why=intro_auto` — agent evidence only
   - Hold **F15** on **373** not re-run in F16b
4. Residual table: Off/Intro on tip **374** as **F16b** agent evidence; Hold held on **373**; post-MX matrix = Hold F15 on 373 + Off/Intro F16b on 374; multi SoftBlur still **open**.
5. Sources list adds `BLUR-F16-off-intro-373-RESULT.md` + this L31 RESULT.
6. §A / §C / §D / §E / Hard rules: tip notes for F16b Off/Intro on **374**; F16 multi static only; multi SoftBlur open; agent evidence ≠ human GOAL_MET.
7. **All human checkboxes remain `- [ ]`.** No GOAL_MET invent.

## Explicit non-claims
| Claim | Verdict |
|-------|---------|
| Human local_blur / blur_persist GOAL_MET | **NOT checked** |
| Multi SoftBlur / 3-way / 4-way PASS | **NOT claimed** |
| MULTI_PASS from harness scaffold | **NOT claimed** (SCAFFOLD_DONE ≠ MULTI_PASS) |
| Blur product GOAL_MET from F11/F12/F14/F15/F16b alone | **NOT claimed** (agent evidence only) |
| Hold agent evidence on tip **374** | **NOT claimed** (Hold remains **F15** on **373** only) |
| Multi SoftBlur device PASS from F16 static | **NOT claimed** |
| Product code / APK / adb this hop | **NOT done** |

## Files

| Path | Change |
|------|--------|
| `knowledge/specs/SMOKE-NEXT.md` | F16 multi static post-MX + F16b Off+Intro tip-374 agent notes; Hold F15 on 373; multi open; human boxes untouched |
| `tasks/grok-loop/done/L31-smoke-softblur-docs-RESULT.md` | this RESULT |
| Card | `running/L31-smoke-softblur-docs.md` → `done/` |

## COMPLETE
**COMPLETE.** SoftBlur agent notes stamped from F16 multi-static + F16b Off/Intro + F15 Hold RESULT only. Multi SoftBlur **static only** post-MX (flag **true**); Off+Intro agent reconfirm on tip **0.1.374-vc382**; Hold remains **F15** on **0.1.373-vc381**; multi SoftBlur device still **open**; SCAFFOLD_DONE ≠ MULTI_PASS. No human GOAL_MET boxes checked.
