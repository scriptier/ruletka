# BRAND: skill + pin recheck — RESULT

**Date:** 2026-08-12  
**Task:** `32-BRAND-skill-pin-recheck`  
**Skill:** `brand-stage`  
**Status:** **COMPLETE** (docs recheck only; **no CSS thrash**; **no invent human PASS / GOAL_MET**)  
**OWN:** READ `ui/live.html` pin · `ui/live-brand.css` header/body · skill stamp compare · RESULT  

## Goal

Confirm disk pin **`live-brand.css?v=16`** and brand-stage skill stamp match overnight **P0–P5**. Stamp skill only if lag. No CSS thrash unless pin wrong.

## Disk pin table (re-read)

| Check | Source | Value | Verdict |
|-------|--------|-------|---------|
| Brand CSS pin | `ui/live.html` L396 | **`live-brand.css?v=16`** | **match expect** |
| live.js (side) | L397 preload + L3034 defer | `live.js?v=572` | noted; not brand CSS OWN |
| live-stage.css (side) | L395 | `live-stage.css?v=395` | noted; not brand OWN |
| webrtc.js (side) | defer block | `webrtc.js?v=315` | noted |
| CSS body | `ui/live-brand.css` | **627 lines** · **19900 B** · md5 **`38c481dd026986b59846650a5c49c51e`** | present |
| CSS header feel | L1–13 | flourish · 1.9s spin / 16.2s cycle · hold breath · glass · themes · tile hide | present |
| Skill brand pin | `.grok/skills/brand-stage/SKILL.md` L32, L102–103 | **`live-brand.css?v=16`** | **match disk** |
| Skill live.js side | SKILL.md L32 | `live.js?v=571` | **side lag** (disk tip **572**) — not brand pin lag |

```text
ui/live.html L396:  <link rel="stylesheet" href="live-brand.css?v=16" />
```

## P0–P5 stack vs skill stamp

| Hop | Skill stamp | Disk CSS body evidence | Verdict |
|-----|-------------|------------------------|---------|
| **P0** spin | 1.9s · mid scale **1.16** · cycle **16.2s** · mid glow | header L6; keyframes L250–262, L276–291; anim L432 | **match** |
| **P1** breath | opacity **0.87↔0.97** + halo · ~3.2s breaths on hold | comments L258–264; keyframe stops L320–385 | **match** |
| **P2** flourish | `stage-brand-enter-flourish` **1s 1 both** then loop `16.2s infinite 1s` | `@keyframes` L207+; rule L430–432 | **match** |
| **P3** glass/themes | denser rim · light/pink · matrix/saloon | header L8–9; backdrop L156–157; theme blocks L538+ | **match** |
| **P4** layout | duo 50% · trio **33.333%** · grid keeps 50% | L461–473; narrow reaffirm L475–483 | **match** (no bug; no CSS write) |
| **P5** pin+smoke | pin checklist + human smoke path | pin **v=16**; smoke `knowledge/raw/2026-08-12-brand-spin-smoke.md`; prior `BRAND-P5-pin-checklist-RESULT` | **docs present** |
| Gate / a11y | `.stage.has-brand-live` only · reduced-motion static | L429–451 | **match** |

## Stamp action

| Action | Done? | Why |
|--------|-------|-----|
| Edit `ui/live-brand.css` | **no** | pin + body already correct for P0–P5 |
| Bump `live-brand.css?v=` | **no** | already **16** |
| Restamp `brand-stage/SKILL.md` brand pin | **no** | already **`?v=16`** + P0–P3 params — **no lag** |
| Restamp skill `live.js` side | **no this hop** | optional residual only (571→572); brand pin is OWN; avoid skill thrash |

## Not touched

- `ui/live-brand.css` (no dual-write)  
- `ui/live.html` pin  
- `ui/live.js` / MediaSession / WebRTC / deploy  
- Human browser smoke execution  
- Invented PASS / GOAL_MET / product.ok  

## Residual

| Item | Note |
|------|------|
| Skill side stamp `live.js?v=571` | Disk tip now **`?v=572`** — optional docs restamp on a later hop; not brand CSS lag |
| Human smoke | Open — `knowledge/raw/2026-08-12-brand-spin-smoke.md`; leave PASS blank |
| Prod/CDN == disk v=16 | Do **not** invent; re-curl after human deploy only |

## Status

**COMPLETE** — disk pin **`live-brand.css?v=16`** confirmed; skill brand stamp **already matches**; CSS body holds overnight **P0–P5** stack. **No CSS thrash. No invent human PASS.**
