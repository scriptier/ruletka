# 504: PC brand place multi layout audit RESULT

**Date:** 2026-08-12
**Skill:** `brand-stage`
**Spec:** `BRAND-SPIN-IMPROVE-PLAN` P4
**Status:** COMPLETE (read-only audit — no CSS write; no multi product PASS)
**OWN:** READ `ui/live-brand.css`, `ui/live.html` `#stage-brand-center` · WRITE this RESULT only

## Goal
Confirm center-seam place for 1v1 / trio / grid; document residual; fix CSS only if place is clearly wrong.

## Method
Re-read current disk `ui/live-brand.css` (627 lines, pin `live-brand.css?v=16` in `ui/live.html:396`) and cross-checked stage geometry in `ui/live-stage.css` + class wiring in `ui/live.js` (`enableTrioLayout`, `applyStageLayoutMode`, `isMultiPartyStage`). Compared against the prior nightly audit (`tasks/grok-loop/done/BRAND-P4-layout-audit-RESULT.md`, 2026-08-11) to see if anything regressed since. Repo history for `ui/live-brand.css` is a single squashed feat commit (`ec89c5b`, 2026-08-11) — no incremental diffs to review; verified by reading current file content directly instead.

## 1) Layout class → left % expected

| # | Layout | Stage geometry (live-stage) | Expected place | CSS `left` (live-brand) | Status |
|---|--------|------------------------------|-----------------|--------------------------|--------|
| A | 1v1 duo (desktop/wide) | `grid-template-columns: 1fr 1fr` | partner\|you seam **50%** | default `left:50%` | OK |
| B | 1v1 duo, narrow ≤720px | brand MQ restates | **50%** | `left:50%` (media block) | OK |
| C | Trio 3-col legacy (no stack/grid) | `1fr 1fr 1fr` | first seam partner↔middle **~33.3%** | `left:33.333%` via `.stage-trio:not(.stage-layout-grid)` | OK |
| D | Trio hunt (`stage-trio-searching`) | same 3-col / stack | **~33.3%** | `left:33.333%` via `.stage-trio-searching:not(.stage-layout-grid)` | OK |
| E | Trio + stack (default multi layout) | flex row, equal `flex:1 1 0` cols | **~33.3%** | `33.333%` (stack ≠ grid, trio rule still applies) | OK |
| F | Trio/multi + grid 2×2 (count 2/3/4) | `1fr 1fr` × `1fr 1fr` | stage cross-**center 50%** (no equal first-third seam) | `left:50%` (`:not(.stage-layout-grid)` drops trio override) | OK by design |
| G | Grid count-2 | side-by-side `1fr 1fr` | **50%** | **50%** | OK |
| H | Grid count-3 (partner\|third top, local full bottom) | 2×2 cells, bottom spans | **50%** (T-junction above local) | **50%** | OK |
| I | Grid count-4 (true 2×2 matrix) | remote spans top row split, third BL, local BR | cross-**center 50%** | **50%** | OK |
| J | Narrow ≤720px trio/hunt reaffirm | — | **33.333%** (no regress to 50%) | `left:33.333%` restated in media block | OK |

Placement math (pill): `left: X%` + `transform: translate(-50%, -50%)` → visual pill center sits **on** the X% vertical line of `.stage`.

## 2) 4-way grid vs trio seam

- **Trio 3-col / stack:** 3 equal vertical columns → first boundary at **33.333%** = partner↔middle seam. Selector: `.stage-trio:not(.stage-layout-grid)`.
- **4-way / 2×2 grid:** vertical + horizontal mid both at **50%** — the cross-center, not a per-tile seam. Grid class deliberately drops the trio override (comment at `ui/live-brand.css:461-469`), so the mark stays a single "center" mark rather than trying to sit on every tile boundary. Confirmed intentional, not a bug.
- Grid count-3 specifically has an asymmetric cell layout (bottom row spans full width for "you" so there's no dead black cell — `ui/live-stage.css:18700-18720`), but the 50%/50% crossing point still lands exactly on the real row/column boundaries that exist (partner↔third above, local below), so no fix needed there either.

## 3) Residual (documented, not fixed)

Same class-gap flagged in the prior nightly audit (**R2**, 2026-08-11) still exists on disk and was re-verified this pass:

- The trio-seam override keys only on `.stage-trio` / `.stage-trio-searching`, not on `.stage-multi.stage-layout-stack.stage-count-3` directly.
- Traced all call sites that can produce a 3-column stack layout (`isMultiPartyStage()` in `ui/live.js:11612`, party_browse handling at `ui/live.js:25800-25834`): every path that populates the third tile (`stranger hunt` and `party_browse` friend calls) routes through `enableTrioLayout(true, …)` (`ui/live.js:11877`), which always sets `.stage-trio`. No live code path was found that reaches `stage-count-3` + `stage-layout-stack` without also carrying `.stage-trio`.
- Conclusion: still a theoretical gap, not a reproducible bug. Leaving as-is per "fix only if clearly wrong" — adding a defensive `.stage-multi.stage-layout-stack.stage-count-3:not(.stage-trio):not(.stage-layout-grid)` selector would be low-risk if a future code path breaks this invariant, but there is no evidence it's reachable today, so no CSS change made.
- Portrait-phone duo residual (R1 from 2026-08-11: `top:50%` vs. true ~57.5% horizontal seam on `1.15fr/0.85fr` stacked rows) also still present on disk, still low severity, still not touched.

## 4) Static verify checklist

```
✓ #stage-brand-center in live.html (main.stage child, before tiles) — live.html:638
✓ default left:50% top:50% + translate(-50%,-50%) — live-brand.css:81-109
✓ trio/hunt left:33.333% with :not(.stage-layout-grid) — live-brand.css:470-473
✓ narrow ≤720 reaffirms duo 50% + trio 33.333% — live-brand.css:475-484
✓ grid 2×2 / count-3 / count-4 stay 50% (grid excluded) — verified against live-stage.css cell placements
✓ no stage-brand* place rules in live-stage.css (place owned solely by live-brand.css)
✓ pin live-brand.css?v=16 in live.html:396
✓ no CSS edits made this hop
```

## Files touched

| Path | Action |
|------|--------|
| `tasks/admin-queue/done/504-brand-layout-multi-audit-RESULT.md` | WRITE (this file) |
| `ui/live-brand.css` | NOT written (no clear bug found) |
| `ui/live.html` / `live.js` / `live-stage.css` | NOT written (read only) |

## Verify commands run
Static/manual code read only — no build/test scripts exist for this CSS-placement audit. No `node`/`tsc`/dev-smoke commands applicable.

## Connect risk
none — no code changed, no ICE/offer/MediaSession touched.

## RESULT COMPLETE
