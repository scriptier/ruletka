# RESULT — BRAND disk pin v=16 recheck

**Card:** `tasks/grok-loop/running/BRAND-disk-pin-16-recheck.md` → done  
**Date:** 2026-08-12  
**Mode:** read-only + optional plan residual stamp  
**GOAL_MET / spin PASS:** **not claimed** — human browser smoke still open

---

## Verdict

| Check | Result |
|-------|--------|
| Disk pin in `ui/live.html` | **`live-brand.css?v=16`** (line 396) |
| Plan table pin | **`live-brand.css?v=16`** (`BRAND-SPIN-IMPROVE-PLAN.md` Now table) |
| Pin vs plan | **OK — match** |
| `?v=` bump needed | **No** |
| Product CSS/JS thrash | **None** (report-only) |

---

## Evidence

### 1. Grep `live-brand.css` in `ui/live.html`

```text
396:  <link rel="stylesheet" href="live-brand.css?v=16" />
```

Only stylesheet pin; no other `?v=` variants of `live-brand.css` in `live.html`.

### 2. Plan table (`knowledge/specs/BRAND-SPIN-IMPROVE-PLAN.md`)

| Piece | Plan | Disk |
|-------|------|------|
| Pin | `live-brand.css?v=16` | `ui/live.html` L396 `?v=16` |
| Cycle | flourish 1s → loop **16.2s** (1.9s spin · mid 1.16 · hold breath · glass) | Matches CSS header + keyframes |
| Place | `.stage-brand-center` | Present in `live-brand.css` |
| Gate | `.stage.has-brand-live` | Wired; JS comments reference same (no thrash this hop) |

### 3. Brand CSS file presence

- Path: `/home/drakosik/freenet-roulette/ui/live-brand.css`
- Size: ~19 900 bytes · 627 lines
- Header documents: enter flourish ~1.0s, then soft 360° every ~15s (1.9s spin + hold = **16.2s** cycle)

---

## P0–P5 residual (stack state — not re-implemented)

| # | Intent | Disk residual (honest) | Human smoke |
|---|--------|------------------------|-------------|
| **P0** | Richer spin: mid scale ~1.14–1.18, spin ~1.8–2.0s, glow | Loop keyframes: **1.9s** spin, mid **scale 1.16**, glow peaks in keyframes | Open |
| **P1** | Idle breath/halo on hold | Hold-phase opacity/glow breath in `stage-brand-spin-360-loop` | Open |
| **P2** | Match-enter flourish then long cycle | `stage-brand-enter-flourish 1s` then `16.2s infinite 1s` delay | Open |
| **P3** | Glass + theme tint (matrix/saloon/etc.) | Theme blocks + brand-tint rims present | Open |
| **P4** | Layout (duo/trio/grid; no clip) | Prior layout audit RESULT exists; no re-audit this hop | Open |
| **P5** | a11y + pin + checklist | `prefers-reduced-motion: reduce` → static; pin **v=16**; checklist filed historically | **Human smoke open** — no invent PASS |

**DONE WHEN product checkboxes** in plan remain **unchecked** for human faces / GOAL_MET. This hop only reconfirms **ship pin matches disk**.

---

## Changes this hop

| File | Action |
|------|--------|
| `ui/live.html` | **unchanged** |
| `ui/live-brand.css` | **unchanged** |
| `ui/live.js` | **unchanged** (must not thrash) |
| `knowledge/specs/BRAND-SPIN-IMPROVE-PLAN.md` | Residual stamp only: pin row notes **reconfirm 2026-08-12** disk match; no bump |
| RESULT | this file |

---

## Must not (honored)

- No MediaSession / ICE / `live.js` product thrash  
- No invent GOAL_MET / spin PASS  
- No force-push, APK, adb  
- No dual-write `live-stage.css` (Claude 474 a11y polish owns that surface)  
- `iceCandidatePoolSize` / pool=0 not touched  

---

## Risks / next

1. **Prod CDN cache:** disk pin is v=16; if production HTML still serves an older `?v=`, hard-refresh / deploy UI may still be needed — **not verified against live host this hop**.  
2. **Human smoke still required** for DONE WHEN / GOAL_MET (center `ruletka.me`, ~15s soft 360°, reduced-motion static, noticeable spin).  
3. No further pin work until CSS changes ship — then bump `?v=` and re-grep.

---

## Merge advice

- Docs-only residual on plan; safe to keep with other docs.  
- No product merge risk from this hop (no CSS/JS product diff).
