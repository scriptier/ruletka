# BRAND-P4: multi layout place audit RESULT

**Date:** 2026-08-11  
**Skill:** `brand-stage`  
**Spec:** `knowledge/specs/BRAND-SPIN-IMPROVE-PLAN.md` **P4**  
**Status:** COMPLETE (read-only audit — **no CSS write**, **no multi product PASS**)  
**OWN:** READ `ui/live-brand.css`, `ui/live.html` `#stage-brand-center` / layout classes · WRITE this RESULT only

---

## Goal

Confirm center-seam place for **1v1 / trio / grid**; document residual. P3 owns concurrent `live-brand.css` glass/theme writes — this hop does **not** edit CSS.

---

## Sources (disk)

| Path | Role |
|------|------|
| `/home/drakosik/freenet-roulette/ui/live-brand.css` | Place rules: default `left:50%`; trio/hunt `left:33.333%`; grid excluded |
| `/home/drakosik/freenet-roulette/ui/live.html` | DOM `#stage-brand-center` > `#stage-brand-spin` > `.stage-brand-wordmark`; pin `live-brand.css?v=15` |
| `/home/drakosik/freenet-roulette/ui/live-stage.css` | Stage geometry: duo 1fr 1fr; trio 1fr 1fr 1fr; stack equal flex cols; grid 2×2; narrow ≤900 portrait vertical duo |
| `/home/drakosik/freenet-roulette/ui/live.js` | Classes: `stage-trio`, `stage-trio-searching`, `stage-multi`, `stage-layout-stack` / `stage-layout-grid`, `stage-count-2|3|4` via `enableTrioLayout` + `applyStageLayoutMode` |

**Math contract (pill):** `left: X%` + `transform: translate(-50%, -50%)` → visual center of pill sits **on** the X% vertical line of `.stage`.

**No `stage-brand*` rules in `live-stage.css`** — place is owned solely by `live-brand.css`.

---

## 1) Layout class → left % / place expected

| # | Layout / mode | Stage classes (typical) | Stage geometry (live-stage) | Expected place (P4 contract) | CSS `left` (live-brand) | Status |
|---|---------------|-------------------------|-----------------------------|------------------------------|-------------------------|--------|
| A | **1v1 duo** (desktop / wide) | `.stage` · `has-brand-live` | `grid-template-columns: 1fr 1fr` | partner \| you **50%** vertical seam | **50%** (default `.stage-brand-center`) | **OK** |
| B | **1v1 duo** (narrow ≤720 brand MQ) | same | brand media restates 50% | duo stays **50%** | **50%** | **OK** (brand) |
| C | **1v1 portrait phone** (≤900, not landscape) | same | `grid-template-columns: 1fr`; rows `1.15fr / 0.85fr` (partner top · you bottom) | true partner\|you seam is **horizontal** (~57.5% from top), not a vertical mid line | `left:50%; top:50%` | **Residual** — stage-center, not horizontal seam |
| D | **1v1 landscape phone** (≤900 landscape) | same | `1fr 1fr` side-by-side | **50%** | **50%** | **OK** |
| E | **Trio 3-col legacy** (no stack/grid) | `.stage.stage-trio` | `grid-template-columns: 1fr 1fr 1fr` | first seam partner↔middle **~33.3%** | **33.333%** via `.stage.stage-trio:not(.stage-layout-grid)` | **OK** |
| F | **Trio hunt** (find-3rd looking) | `.stage.stage-trio` + `.stage-trio-searching` | same 3-col (or stack — see G) | first seam **~33.3%** | **33.333%** via `.stage-trio-searching:not(.stage-layout-grid)` | **OK** |
| G | **Trio + stack** (default multi layout) | `.stage-trio` · `.stage-multi` · `.stage-layout-stack` · often `.stage-count-3` | flex row, equal `flex: 1 1 0` cols (partner \| 3rd \| you) | first seam **~33.3%** | **33.333%** (stack is **not** grid → trio rule applies) | **OK** |
| H | **Trio / multi + grid 2×2** | `.stage-layout-grid` (+ trio and/or multi, count 3/4) | `1fr 1fr` × `1fr 1fr` | **stage center 50%** (no equal first-third vertical seam) | **50%** (`:not(.stage-layout-grid)` excludes trio override) | **OK by design** |
| I | **Grid count-2** | `.stage-layout-grid.stage-count-2` | side-by-side 1fr 1fr | **50%** like duo | **50%** | **OK** |
| J | **Grid count-3** | `.stage-layout-grid.stage-count-3` | 2×2 cells (placements vary remote/third/local) | **center 50%** | **50%** | **OK by design** |
| K | **Grid count-4 (4-way)** | `.stage-layout-grid.stage-count-4` | true 2×2 matrix | **cross-center 50%** | **50%** | **OK** |
| L | **Stack count-4 (4-way)** | `.stage-multi.stage-layout-stack.stage-count-4` (usually **no** `stage-trio`) | 4 equal flex columns | seams 25% / **50%** / 75%; center line **50%** | **50%** (no trio class → default) | **OK** for “center” |
| M | **Stack multi 3-col without `stage-trio`** | `.stage-multi.stage-layout-stack.stage-count-3` only | 3 equal flex cols | should be **~33.3%** | **50%** (trio selectors miss) | **Flag** if this class combo can appear live |

### CSS selectors (authoritative place)

```text
/* default duo / grid / non-trio */
.stage-brand-center { left: 50%; top: 50%; transform: translate(-50%, -50%) … }

/* trio 3-col + hunt — first vertical seam; grid excluded */
.stage.stage-trio:not(.stage-layout-grid) .stage-brand-center,
.stage.stage-trio-searching:not(.stage-layout-grid) .stage-brand-center {
  left: 33.333%;
}

/* narrow ≤720px: duo 50%; trio/hunt reaffirmed 33.333% (no regress) */
@media (max-width: 720px) {
  .stage-brand-center { left: 50%; top: 50%; }
  .stage.stage-trio:not(.stage-layout-grid) .stage-brand-center,
  .stage.stage-trio-searching:not(.stage-layout-grid) .stage-brand-center {
    left: 33.333%;
  }
}
```

### Placement math (trio contract)

```text
3 equal columns: [0──33.3%] [33.3──66.7%] [66.7──100%]
                  partner     looking/3rd    you
left: 33.333% + translateX(-50%) → pill center ON partner ↔ middle seam
```

Not mid-looking (would be 50%). Grid keeps 50% deliberately (comment in CSS L434–441).

---

## 2) 4-way grid vs trio seam + narrow mobile

### 4-way grid vs trio seam

| | Trio 3-col / stack | 4-way / 2×2 grid |
|--|--------------------|------------------|
| Geometry | 3 equal **vertical** columns | 2×2 cells; vertical mid at **50%**, horizontal mid at **50%** |
| Brand `left` | **33.333%** (first column boundary) | **50%** (stage / cross center) |
| Selector mechanism | `.stage-trio:not(.stage-layout-grid)` | grid class **drops** trio override |
| Contract | partner\|looking seam | “grid center” — **not** first-third |

**Conclusion:** 4-way grid place is intentionally different from trio seam. Not a bug; residual is product choice (one mark at cross, not on every tile seam).

Stack 4-way without `stage-trio` also lands at **50%** (middle of four equal columns) — consistent “center,” not trio ⅓.

### Narrow mobile

| Viewport | Duo | Trio stack (default multi) | Trio legacy (no stack/grid) | Grid |
|----------|-----|----------------------------|-----------------------------|------|
| Brand MQ ≤720 | left **50%** | left **33.333%** reaffirmed | left **33.333%** | left **50%** |
| Stage ≤900 portrait | vertical stack partner/you (1 col) | stack forces **row** of equal tiles (`flex-direction: row !important`) | portrait legacy → **2-col** grid (`1fr 1fr`) + local PiP hide | still 2×2 |
| Stage ≤900 landscape | side-by-side 50% | 3 equal cols / stack row | 3-col legacy | 2×2 |

**Narrow findings:**

1. **Trio + stack on phone** keeps horizontal equal columns → **33.333% first seam is correct**.
2. **Duo portrait** brand sits at stage dead-center (`top:50%`) while the partner\|you **horizontal** seam is ~**57.5%** down (1.15fr vs 0.85fr) — place language is still “center,” not “on the split.”
3. **Brand MQ (720) ≠ stage MQ (900)** — between 721–900px brand still uses base rules (duo 50% / trio 33%); stage may already be phone geometry. Low risk for trio stack; duo portrait mismatch starts at 900 not 720.
4. **Legacy portrait trio** (no stack/grid): stage is 2-col but brand still **33.333%** — slightly off 2-col mid. Rare: default `stageLayoutMode = "stack"` and multi always applies stack/grid classes when multi.

---

## 3) Clear place bugs / residuals for a later fix hop

**Do not fix in this hop** (P3 concurrent on `live-brand.css`). Flags only:

| ID | Severity | Issue | Suggested later fix (not done) |
|----|----------|-------|--------------------------------|
| **R1** | Low–med (phone 1v1) | Portrait duo: brand at `top:50%` not on horizontal partner\|you seam (~57%) | Optional `top` / orientation-aware place under narrow MQ; or accept “stage center” product language |
| **R2** | Low (class gap) | Place override keys **only** `stage-trio` / `stage-trio-searching`, not `stage-count-3` + stack | If multi 3-col can appear without `stage-trio`, add `.stage-multi.stage-layout-stack.stage-count-3:not(.stage-layout-grid)` → 33.333% |
| **R3** | Low (legacy) | Portrait legacy trio 2-col still forces 33.333% | Either force stack always in multi, or drop trio left override when legacy 2-col MQ matches |
| **R4** | Info | Grid 3/4 stays 50% while trio seam is 33% — intentional | Document in skill; no CSS change required unless product wants multi marks |
| **R5** | Info | Clip: wordmark `overflow: visible`, vertical-rl, narrow font 0.72rem — no static clip bug found | Human smoke on short stack heights only |

### Not place bugs (verified OK)

- Duo desktop / landscape **50%** ✓  
- Trio + hunt 3-col / stack **33.333%** ✓  
- Grid exclusion keeps **50%** ✓  
- Narrow trio reaffirm prevents 50% regress ✓  
- Spin gate remains `.stage.has-brand-live .stage-brand-spin` only (layout classes do not kill 360°) ✓  
- Tile `.stage-wm` still hidden when seam owns brand ✓  
- `live-stage.css` has **zero** `stage-brand*` overrides ✓  

---

## 4) Static verify checklist

```text
✓ #stage-brand-center in live.html (main.stage child, before tiles)
✓ default left:50% top:50% + translate(-50%,-50%)
✓ trio/hunt left:33.333% with :not(.stage-layout-grid)
✓ narrow ≤720 reaffirms duo 50% + trio 33.333%
✓ grid 2×2 / count-3 / count-4 → 50% (grid excluded)
✓ stack trio → still 33.333% (not excluded)
✓ no live-stage brand place kill
✓ pin live-brand.css?v=15 (disk live.html) — pin/feel owned by other hops
✓ no MediaSession / multi PASS / deploy / CSS write this hop
```

---

## Files touched

| Path | Action |
|------|--------|
| `tasks/grok-loop/done/BRAND-P4-layout-audit-RESULT.md` | **WRITE** (this file) |
| `tasks/grok-loop/running/10-BRAND-P4-layout-audit.md` | move → done (COMPLETE) |
| `ui/live-brand.css` | **NOT written** (P3 concurrent) |
| `ui/live.html` / `live.js` / `live-stage.css` | **NOT written** |

---

## Residual for human / next brand hop

1. Optional browser smoke (not claimed PASS): 1v1 → find-3rd hunt → settled trio stack → toggle grid → hangup. Expect seam 50 → 33 → 33 → 50 → clear.  
2. Fix hop (if product cares about R1/R2): brand place CSS only, after P3 ships glass — bump `live-brand.css?v=`.  
3. **No multi product PASS** invented. GOAL_MET for place requires human eyes on real multi layouts.

---

## RESULT COMPLETE

Layout table §1 filled; 4-way grid vs trio + narrow mobile §2 documented; place bugs flagged §3 without CSS edit.
