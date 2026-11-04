# W7-multi-css-orphan-static — RESULT

**Status:** COMPLETE  
**OWN:** `ui/live-stage.css` **read-only** (no edits)  
**Date:** 2026-08-12T02:09Z  
**Code change:** none  

## Goal
Read-only audit of **stage-count-4 orphan black** rules in `ui/live-stage.css`.  
No invent product PASS / GOAL_MET. No deploy / live.js / APK.

## Disk stamps (observed)

| Surface | On disk |
|---------|---------|
| `ui/live-stage.css` | brace balance **3302 / 3302** |
| `ui/live.html` link | `live-stage.css?v=385` |
| `stage-count-4` selector lines | **78** |
| Hunt caption floor `max(0.95rem, 15px)` | **absent** (W5 RESULT claimed v=386; disk still 385) |

## How stage-count-4 is armed

`ui/live.js` `applyStageLayoutMode` (L11470–11487):

- `stage-count-4` when `multi && total >= 4` (`countVisibleStagePanes`)
- So class means **four panes expected visible** (you + 3 remotes, or equivalent visible count)
- `#remote2-wrap` is `class="remote-b-wrap" id="remote2-wrap"` (`live.html` L651); JS sets `wrap.hidden` with `setSplitRemote` / multi bind paths

Orphan black = unused remote2 / third still **takes layout footprint** as a solid black half-cell.

## Audit method

1. Grep / parse all `stage-count-4`, `remote-b-wrap`, `[hidden]`, `display: block !important` blocks.  
2. Classify **show-block without `:not([hidden])`** (orphan risk) vs **protected show** vs **hide zero-footprint**.  
3. Compare cascade specificity vs `#remote2-wrap[hidden]` / `#tile-third[hidden]`.  
4. No CSS mutation.

## Defenses present (cascade order matters)

### A) Zero-footprint hide (multi polish block ~L20277+)

| Selector | Effect |
|----------|--------|
| `#tile-third[hidden]`, `.tile.tile-third[hidden]` | `display:none` + width/height/flex **0** + opacity 0 |
| `.remote-b-wrap[hidden]`, **`#remote2-wrap[hidden]`** | `display:none !important` + flex 0 + zero box |
| `#remote2[hidden]`, `.vid.remote-b[hidden]`, `#remote-third[hidden]` | `display:none !important` |
| `#third-empty[hidden]` / `:has(#remote-third:not([hidden]))` | empty looking chrome off when third live |
| `.stage.stage-multi .tile .vid` / trio | **`background: transparent !important`** (no solid black walls) |

Earlier mirrors: `.remote-b-wrap[hidden]` L18053; trio-only L2399–2402.

### B) stage-count-4 show paths that **guard** unused slots

| Lines | Rule | Guard |
|-------|------|-------|
| L20399–20410 | grid-4 `.remote-b-wrap:not([hidden])` → `display:block` | **yes** |
| L20422–20428 | grid-4 `.tile-third:not([hidden])` | **yes** |
| L20568–20577 | stack-4 `.remote-b-wrap:not([hidden])` (+ stack split `:not([hidden])`) | **yes** |
| L20588–20597 | stack-4 `.remote-b-wrap .vid.remote-b` + split `.vid.remote-b:not([hidden])` | wrap + partial vid |
| L20604–20607 | stack-4 `.tile-third:not([hidden])` | **yes** |
| L20636–20641 | portrait stack-4 third | **yes** |

Layout intent (no empty cell thrash while all four live):

- Grid-4: 2×2 — remote stack top row (`#remote` | remote2), third | local bottom (L20357–20438)
- Stack-4: equal flex columns; remotes row-split when both live (L20561–20607)
- Portrait stack-4: force 2×2 grid (L20609–20652)

Comment at L20274: *“no black orphan panes”*.

### C) Specificity: does hide beat legacy unguarded show?

| Show rule (legacy / residual) | Approx spec | Applies when `[hidden]`? | Beats `#remote2-wrap[hidden]` **(1,1,0)**? |
|------------------------------|-------------|---------------------------|---------------------------------------------|
| L18756 stack `.remote-stack.split .remote-b-wrap` `{ display:block !important }` | (0,6,0) | **yes** (no `:not`) | **No** — ID hide wins |
| L18772–75 stack.trio `.remote-b-wrap` block | (0,5,0) | **yes** | **No** |
| L18839–42 grid.trio `.remote-b-wrap` block | (0,5,0) | **yes** | **No** |
| L20399 grid-4 wrap `:not([hidden])` | (0,6,0) | no | n/a |
| L20568 stack-4 wrap `:not([hidden])` | (0,6,0) | no | n/a |
| L20569 stack split wrap `:not([hidden])` | (0,7,0) | no | n/a |

Bare `.remote-b-wrap[hidden]` alone is only **(0,2,0)** and would **lose** to L18756 — the **`#remote2-wrap[hidden]`** half of the L20297 rule is the real belt. HTML always uses that id.

Vid-level: L20411 grid-4 forces `.remote-b-wrap .vid.remote-b` / `#remote2` `display:block` without `:not([hidden])` on the wrap, but:

- Parent wrap hide removes footprint even if child wants block  
- `#remote2[hidden]` **(1,1,0)** still beats class-only show on the video element  

## Residual risk inventory (static — not product FAIL claim)

| # | Location | Issue | Severity (static) |
|---|----------|-------|-------------------|
| 1 | L18756–18775, L18839–42 | Legacy **unguarded** `display:block !important` on remote-b wrap/vid under multi stack/grid trio | **Low** while `#remote2-wrap[hidden]` remains; would regress if id removed or hide rule dropped |
| 2 | L20411–20421 | grid-4 shows `#remote2` without `:not([hidden])` on wrap selector | **Low** (parent hide + id hide) |
| 3 | L18706–18711 | grid **count-3** `.tile-third` `display:block` unguarded | Out of stage-count-4 scope; later L20464+ `:has` paths are guarded |
| 4 | No string **“FINAL LOCK 2”** | P0 RESULT named it; on disk it is the multi polish block L20268+ + FINAL LOCK hunt L20822+ | Doc label only — rules present under other comments |
| 5 | Cache `?v=385` | W5/W6 text mentioned 386; disk **385**, no hunt caption floor | Unrelated to orphan-black cascade; note only |

## What stage-count-4 is **not** doing wrong (static)

- Does **not** force remote2 wrap visible when `[hidden]` under the later multi polish / count-4 rules (guards use `:not([hidden])`).  
- Hidden third / remote2 get **zero grid/flex footprint** via L20277–20320.  
- Multi tile videos forced **transparent** background (avoids solid black slab as “dead” paint).  
- 4-way grid always 2×2 when count-4 class is on — orphan risk is **unused slot still shown**, not missing grid cells; unused slots are `[hidden]` + zeroed.

## Fix

**None this hop** (read-only card). Optional future (not done):

- Add `:not([hidden])` to L18756 / L18772–75 / L18839–42 so class-only hide is safe without relying on `#remote2-wrap`  
- Add `:not([hidden])` on L20411 wrap chain for symmetry  
- Only then bump `live-stage.css?v=`

## Verify (static only)

| Check | Result |
|-------|--------|
| CSS brace balance | **3302 / 3302** |
| `#remote2-wrap[hidden]` zero-footprint | **present** L20297+ |
| stage-count-4 wrap show uses `:not([hidden])` | **present** L20399, L20568 |
| Legacy unguarded show still on disk | **yes** L18756 / L18772 / L18839 — cascade **lost** to id hide |
| Human 4-way smoke / product.ok | **not claimed** |
| `live.js` / deploy / APK edits | **none** |

## Must-not confirmed

- No ICE thrash / pool>0  
- No dual MediaSession  
- No force-push / deploy  

## Job complete

Running → done; RESULT filed. **COMPLETE** = static audit finished.  
**Not** claimed: “no black orphan in human 4-way smoke” / GOAL_MET.
