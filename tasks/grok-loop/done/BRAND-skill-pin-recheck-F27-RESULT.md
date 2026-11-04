# BRAND: skill + pin recheck F27 — RESULT

**Date:** 2026-08-12T08:46Z  
**Task:** `38-BRAND-skill-pin-recheck`  
**Skill:** `brand-stage`  
**Status:** **COMPLETE** (docs recheck only; **no CSS thrash**; **no invent human PASS / GOAL_MET**)  
**OWN:** READ `ui/live.html` pin · `ui/live-brand.css` header/body · skill stamp compare · optional skill lag fix · RESULT  

## Goal

Confirm disk pin **`live-brand.css?v=`** matches brand-stage skill + overnight **P0–P5**. No CSS thrash unless pin wrong. No invent human PASS.

## Disk pin table (re-read this hop)

| Check | Source | Value | Verdict |
|-------|--------|-------|---------|
| Brand CSS pin | `ui/live.html` L396 | **`live-brand.css?v=16`** | **match expect** |
| live.js (side) | L397 preload + L3034 defer | **`live.js?v=572`** | noted; has-brand-live wire |
| live-stage (side, not brand OWN) | L395 | **`live-stage.css?v=395`** | noted only (advanced vs older wiki 393) |
| Match SFX (side) | skill + disk convention | `sounds/match.mp3?v=1` | skill stamp present |
| CSS body | `ui/live-brand.css` | **627 lines** · **19900 B** · md5 **`38c481dd026986b59846650a5c49c51e`** | **unchanged** vs F23 / prior recheck |
| CSS header feel | L1–13 | flourish · 1.9s spin / 16.2s cycle · hold breath · glass · themes · tile hide | present |
| Skill brand pin | `.grok/skills/brand-stage/SKILL.md` L32, L102–103 | **`live-brand.css?v=16`** | **match disk** |
| Skill live.js side | SKILL.md L32 | **`live.js?v=572`** | **match disk** |
| Skill SFX side | SKILL.md L32 | `sounds/match.mp3?v=1` | **match** |
| Skill P0–P3 feel | SKILL.md L33–39 | 1.9s · 1.16 · 16.2s · breath · flourish · glass | **match CSS body** |

```text
ui/live.html L395:  <link rel="stylesheet" href="live-stage.css?v=395" />
ui/live.html L396:  <link rel="stylesheet" href="live-brand.css?v=16" />
ui/live.html L397:  <link rel="preload" href="live.js?v=572" as="script" />
ui/live.html L3034: <script src="live.js?v=572" defer></script>
```

## P0–P5 stack vs skill stamp

| Hop | Skill / plan stamp | Disk CSS body evidence | Verdict |
|-----|--------------------|------------------------|---------|
| **P0** spin | 1.9s · mid scale **1.16** · cycle **16.2s** · mid glow | header L6; keyframes ~L250–291; anim L432 | **match** |
| **P1** breath | opacity **0.87↔0.97** + halo · ~3.2s breaths on hold | comments ~L258–264; keyframe stops L320–385 | **match** |
| **P2** flourish | `stage-brand-enter-flourish` **1s 1 both** then loop `16.2s infinite 1s` | `@keyframes` L207+; rule L430–432 | **match** |
| **P3** glass/themes | denser rim · light/pink · matrix/saloon | header L8–9; theme blocks ~L567+ | **match** |
| **P4** layout | duo **50%** · trio **33.333%** | default center L85; trio L470–473 / narrow L481–483 | **match** (no bug; no CSS write) |
| **P5** pin+smoke | pin checklist + human smoke path | pin **v=16**; smoke `knowledge/raw/2026-08-12-brand-spin-smoke.md`; plan `knowledge/specs/BRAND-SPIN-IMPROVE-PLAN.md` pin **v=16** | **docs present** |
| Gate / a11y | `.stage.has-brand-live` only · reduced-motion static | CSS L429–448; skill L38–39 | **match** |

## Stamp action

| Action | Done? | Why |
|--------|-------|-----|
| Edit `ui/live-brand.css` | **no** | pin + body already correct for P0–P5 |
| Bump `live-brand.css?v=` | **no** | already **16**; no CSS change |
| Restamp `brand-stage` brand pin | **no** | already **`?v=16`** — **no brand-pin lag** |
| Restamp skill `live.js` side | **no** | already **`?v=572`** (F23 cleared 571 lag) |

## Not touched

- `ui/live-brand.css` (no dual-write / no thrash)  
- `ui/live.html` pin  
- `ui/live.js` / MediaSession / WebRTC / deploy  
- `BLUR-MULTI-FINISH-PLAN` / `SMOKE-NEXT`  
- Human browser smoke execution  
- Invented PASS / GOAL_MET / product.ok  

## Residual

| Item | Note |
|------|------|
| Human smoke | Open — `knowledge/raw/2026-08-12-brand-spin-smoke.md`; leave PASS blank |
| Prod/CDN == disk v=16 | Do **not** invent; re-curl after human deploy only |
| GOAL_MET | Only after human browser smoke — not this hop |
| Stage pin side-note | Disk tip stage is **`live-stage.css?v=395`** (not brand OWN; brand remains **v=16**) |

## Status

**COMPLETE** — disk pin **`live-brand.css?v=16`** confirmed; skill brand stamp **matches**; CSS body holds overnight **P0–P5** stack (md5 **`38c481dd…`** unchanged). **No CSS thrash. No skill restamp. No invent human PASS.**
