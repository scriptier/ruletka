# PC brand spin improve plan (`ruletka.me` center)

**Status:** active · nightly backlog  
**Skill:** `brand-stage`  
**MUST NOT:** MediaSession / ICE thrash · invent human PASS without browser smoke

## Now (disk)

| Piece | State |
|-------|--------|
| Place | Center seam `.stage-brand-center` (partner \| you) |
| Pill | `.stage-brand-spin` whole-pill glass |
| Wordmark | vertical-rl **`ruletka.me`** full string |
| Gate | `.stage.has-brand-live` via `setStageBrandLive` |
| Cycle | P0–P3: flourish 1s → loop **30s** (1.9s spin · mid 1.16 · hold breath · glass) |
| Pin | `live-brand.css?v=19` + `live.js?v=620` — `data-brand-seam` duo/trio/quad |
| Tile marks | `.stage-wm` hidden on match-live |
| P5 | skill stamp + smoke checklist filed — human smoke open (no invent PASS) |

## Improvement stack (P0→P5)

| # | Idea | Why | OWN | Risk |
|---|------|-----|-----|------|
| **P0** | **Richer spin feel** — mid-spin scale **1.14–1.18**, slightly longer spin phase **1.8–2.0s**, ease-out settle; optional soft **box-shadow / glow pulse** at 180° | Current 1.55s / 1.12 is easy to miss on busy video | `ui/live-brand.css` only | Low |
| **P1** | **Idle life between spins** — subtle **breath/opacity** or **halo pulse** on hold phase (not constant full spin) | Pill looks dead for ~14s | `live-brand.css` keyframes | Low |
| **P2** | **Match-enter flourish** — one **faster intro 360°** (0.9–1.1s) when `has-brand-live` turns on, then join long cycle | Feels intentional at “linked” moment | CSS anim + optional one-shot class from `setStageBrandLive` in `live.js` | Low–med if JS class thrash |
| **P3** | **Depth / glass polish** — slightly stronger glass, brand-tint rim (`rgba` brand blue/rose), theme matrix/saloon variants | Reads as product, not generic chip | `live-brand.css` themes | Low |
| **P4** | **Layout audit** — duo 50%, trio **33.3%** seam, grid 2×2 center; narrow mobile; no clip | Multi layout regresses place | `live-brand.css` + live.html smoke notes | Low |
| **P5** | **a11y + ship** — keep `prefers-reduced-motion: none`; bump `live-brand.css?v=`; hard-refresh smoke checklist | Pin lag invents “spin dead” | `live.html` pin + wiki skill stamp | None |

## DONE WHEN (product)

- [ ] Mid-match PC: center seam mark visible; **full** `ruletka.me` readable  
- [ ] Soft **360°** still about every **30s** (not constant spin)  
- [ ] Spin **noticeable** without looking cheap/dizzy  
- [ ] Reduced motion: static upright  
- [ ] Ship pin `live-brand.css?v=` matches disk after CSS ship  
- [ ] **GOAL_MET** only after human browser smoke (or screenshots) — no invent  

## Nightly task IDs

| ID | Focus |
|----|--------|
| 500 | P0 spin feel CSS |
| 501 | P1 idle breath/glow |
| 502 | P2 enter flourish |
| 503 | P3 glass/theme polish |
| 504 | P4 multi layout audit (read-only RESULT if no fix) |
| 505 | P5 pin + skill stamp + smoke checklist |

## Loop rules

- One writer on `live-brand.css` per hop  
- No MediaSession / webrtc for brand  
- Deploy UI only with human **proceed** (or director when authorized)  
- Android brand is separate (`BrandWatermark`) — do not dual-edit unless task says so  
