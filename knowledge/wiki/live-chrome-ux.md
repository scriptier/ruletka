# Live chrome UX (PC browser rails / autohide / brand)

Desktop live stage: partner + local side rails and floor trays hide after idle so video is full-bleed; hover/move shows them again. Mid-match brand lives on the **center seam**, not tile corners.

## Target artifacts (on disk 2026-08-12 — re-read `ui/live.html`)

| Piece | Version / path |
|-------|----------------|
| JS (chrome) | `ui/live.js` — `wireTileChromeAutohide()`, `CHROME_AUTOHIDE_MS = 2200` · star unlock easter egg |
| JS pin | **`live.js?v=572`** (`ui/live.html` preload + defer) |
| Stage CSS | **`live-stage.css?v=393`** — clean mid-match + partner rail restore (morning re-read; overnight-2 had **392**) |
| Brand CSS | **`live-brand.css?v=17`** — P0–P3 + seam CB fix + 30s cycle (re-read `ui/live.html`) |
| HTML | `ui/live.html` links stage `?v=436`, brand `?v=17`, `live.js?v=619` |

**Pins tip:** always re-read `ui/live.html` for live.js / stage / brand — do not invent VIP==disk. Historical: chrome autohide first restore ~`live.js?v=542` / stage `?v=374`; identity ship ~`?v=551`; overnight-1 wiki stamp was 571/391/15; overnight-2 was 572/392/16.

## Brand watermark (PC mid-match)

Contract skill: `brand-stage`. Source: `ui/live-brand.css`, `#stage-brand-center` in `live.html`. Pin checklist: `BRAND-P5-pin-checklist-RESULT` · human smoke open: `knowledge/raw/2026-08-12-brand-spin-smoke.md`.

| Rule | Detail |
|------|--------|
| Place | **Center seam** vertical wordmark between partner \| you (`.stage-brand-center` / `.stage-brand-spin`) |
| Gate | only under `.stage.has-brand-live` |
| Enter (P2) | **`stage-brand-enter-flourish` 1.0s** once (mid scale ~1.18) then long loop · pin after **v=15** |
| Loop (P0) | Soft **360°** in **~1.9s** every **30s** upright (`stage-brand-spin-360-loop` **30s**, delayed **1s** after enter); mid scale **1.16** + soft glow · pin **v=17** |
| Hold (P1) | upright breath opacity **0.87↔0.97** + soft halo (~3.2s period) — not a second spin · pin after **v=14** |
| Glass (P3) | denser glass · light/pink · matrix/saloon rims · pin **v=16** |
| P4 | layout audit duo/trio/grid (separate hop — not re-owned here) |
| P5 | pin checklist + skill stamp · **no invent human PASS** · pin **v=17** (seam + 30s) |
| Tile marks | `.stage-wm` / `.stage-wm-local` **hidden** on match-live (center seam owns brand) |
| Wordmark | Full **`ruletka.me`** — never clip |
| Clicks | `pointer-events: none` |
| Reduced motion | static upright; no flourish / loop |
| Not this page | Android `BrandWatermark` bottom-middle → [mobile-ux](mobile-ux.md) |

**MUST NOT:** move PC mark to partner tile bottom; dual seam + tile visible; thrash MediaSession for brand-only. **No invent human brand PASS** until hard-refresh smoke.

## Clean mid-match chrome (2026-08-12)

| What | Mid-match behavior |
|------|--------------------|
| LIVE badge / compact chip / `#arch-pill` | **hidden** under `html.match-live` |
| ★ unlock bar | **default off**; dblclick local/remote ★ → peek ~14s with `.is-easter-egg` only |
| Tile-inline 💧 (`#btn-blur-remote-main` etc.) | **hidden** (noise) |
| Multi tile volume chips | **hidden** |
| 1v1 identity `.tile-vol` | **hidden** — duplicate of left-rail volume (disk **stage 562+**) |
| Conversationalist friend code | `#remote-friend-code` under name/loc; **autohides** with chrome (name/flag stay). Never paint code as the name. |
| **Left partner rail** | **restored:** mute · **volume** · **blur** (`#btn-blur-remote` + `.side-vol`) when chrome open |
| Rails | still **autohide** (idle **2.2s**); not always-on |

CSS block: `ui/live-stage.css` *Clean mid-match chrome (… rev: restore partner rail)*. Static verify: `CLEAN-chrome-verify-RESULT` (pre-restore pins 570/390) + disk tip now **572/393** (brand **16**). **Human mid-match smoke still open.**

## Intended behavior (chrome autohide)

1. **Fine pointer (mouse):** `html.chrome-autohide` on; rails/floors start hidden.
2. **Enter / move on tile:** JS adds `.is-chrome-open` → CSS shows that tile’s chrome.
3. **~2.2s idle:** `scheduleHide` removes `.is-chrome-open` unless a flyout/sheet is open (`CHROME_AUTOHIDE_MS = 2200`).
4. **Coarse / touch:** `html.chrome-always` (no autohide) — CSS media keeps controls visible.
5. **Settings / flyouts open:** keep **local** right rail (or partner floor) visible while sheet/flyout open — do not force permanent always-on.

CSS sides under autohide (all hide when not open):

| Tile | Hidden when idle |
|------|------------------|
| Remote | left rail, floor-partner, layout btn |
| Local | right rail (Flip/Mic/Hide/Settings), floor-local |

Identity / stars badges stay visible (z-index forced; not part of autohide rails). Fullscreen btn stays available under autohide.

## Bug restored (2026-08-11)

| | |
|--|--|
| **Symptom** | Local rail (Settings etc.) never hid; chrome felt “always on” forever |
| **Root** | `wireTileChromeAutohide` forced **chrome-always + pin every 2s** (workaround for “settings vanished”); CSS never applied hide to local rail under autohide |
| **Fix** | Idle **3s** `scheduleHide`; CSS hides **all sides** under `html.chrome-autohide`; show only with `.is-chrome-open` or open settings/flyout selectors |

## MUST NOT (gotcha)

- **Do not** disable chrome-autohide / force `chrome-always` forever because Settings “vanished.”
- Keep local rail visible **only while** `.is-chrome-open` **or** settings sheet / flyout is open (`sheet-settings-open`, `#settings-sheet.is-open`, `.is-flyout-open`, etc.).
- Identity vanishing under video is a **z-index** problem (badges ≥45 over `#local`), not a reason to pin rails forever.

## Related

- Android match chrome (SurfaceView / dock / BrandWatermark): [mobile-ux](mobile-ux.md)
- Identity dual-id / who-sub: [gotchas](gotchas.md) §17 · skill `mobile-match-identity`
- Brand place: [gotchas](gotchas.md) §19 · skill `brand-stage`
- Ship UX smoke checklist still human-gated: `../specs/SMOKE-NEXT.md`, `../specs/current-mobile-ux.md`
- Anti-patterns: [gotchas](gotchas.md) §15

## Browser live top panel (2026-08-16)

Entire `header.stage-top` is **gone** (not just YOU / language). Brand, pool, Mesh, conn-strip, name chip, lang switch — all hidden. Stage fills the window.

| Keep | Why |
|------|-----|
| `#display-name-top` / `#sel-lang` in DOM | JS name + i18n sync |
| `#btn-settings` on local tile rail | Settings / name / language live there |
| `hidden` + CSS `display:none !important` | Theme copies of `.stage-top { display:flex }` must not resurrect it |

Pin: **`live-stage.css?v=453`** (header hide). Tip now **stage 458** · **live.js 674**. Human: feels cleaner. **Do not put the bar back** unless asked. **Not MULTI_PASS.**

## Gift FX lock: canvas rAF, not CSS top+transform

Every gift effect (`playBalloonsCanvasRise`, `playFlowersCanvasDrift`,
`playSpotlightCanvasSweep`, `playDiscoCanvasClub`, `playSnowCanvasFall`,
`playConfettiCanvasFall`, `playFireworksCanvasBurst` — `ui/live.js` ~7238–8555)
draws to a `<canvas>` via `requestAnimationFrame` tick loops. **Do not**
reintroduce CSS `top` + `transform` particle sprites for these — canvas rAF
is the locked approach after human PC PASS. Canvas hops landed **855–859**.

Timer lives under `#tile-remote` (bottom-left), not `#tile-local` —
`#match-timer` is a remote-tile child (`ui/live.html`). Conversationalist
friend code (`#remote-friend-code`) is `order: 4 !important`, below the
trust chip, inside `.tile-remote-id`.

### Log

- 2026-08-20 human PC PASS: disco better, snow/confetti/flowers good,
  spotlight works, Please stay works; balloons + tap-★ already smoked.
  All gift FX effects now human-verified on canvas rAF. Disk tip
  **`live.js?v=862`** / stage **`?v=578`**. Timer confirmed under
  `#tile-remote`; friend code confirmed `order: 4` below Trusted chip.
  Re-read `ui/live.html`. **No invent GOAL_MET / product.ok** beyond this
  chrome/gift-FX scope.
- 2026-08-20 eve: prod **`live.js?v=858`** / stage **`571`**. Gift FX **canvas rAF** (never `top`+`transform`): balloons smoked; snow/confetti/flowers/disco/spotlight **unverified**. Please stay tap-face. Tap-★ 3→+1 smoked. Re-read `ui/live.html`. **No invent GOAL_MET.**
- 2026-08-20: disk tip **`live.js?v=846`** / stage **`?v=563`**. Identity: hide 1v1 tile-vol; friend code autohides (**843**). Gift FX balloons/confetti/snow/disco **transform-only** (**845/563**, **unverified** smoke). Please stay moved to tap-face Partner actions (**846**). Friend call 1v1 until Find 3rd (**844**). Re-read `ui/live.html` — do not invent VIP==disk.
- 2026-08-16: mute mark on **who muted** (stage **457–458**, APK **0.1.416**). Human: PC mutes you → icon on **PC**; PiP stays. **Not MULTI_PASS.**
- 2026-08-16: `#btn-fs-remote` hidden 1v1 + 3-way (stage **456**). F key stays. **Not MULTI_PASS.**
- 2026-08-16: mid-tile ★ top-right, no `⋯` / inline vol (stage **454**); name/loc clip + `#third-side-rail` autohide (stage **455**). Left rail + tap-face stay. **Not MULTI_PASS.**
- 2026-08-16: entire `header.stage-top` hidden (stage **453**). Settings on tile rail. **Not MULTI_PASS.**
- 2026-08-12 morning compound: re-read tip **`live.js?v=572`** / stage **`?v=393`** / brand **`?v=16`** · brand **P0–P5** still pin **v=16** · **no invent human chrome/brand PASS**.
- 2026-08-12 overnight-2 compound: re-read tip **`live.js?v=572`** / stage **`?v=392`** / brand **`?v=16`** · brand **P0–P5** pin locked at **v=16** (P5 checklist; human smoke open) · **no invent human chrome/brand PASS**.
- 2026-08-12 overnight compound: tip then **`live.js?v=571`** / stage **`?v=391`** / brand **`?v=15`** · clean mid-match + **partner rail restore (vol+blur)** · brand **P0/P1/P2** on disk · star unlock easter egg + i18n keys · autohide **2200ms** · **no human chrome/brand PASS invent**.
- 2026-08-11: page created — PC chrome autohide restored (`live.js?v=542`, `live-stage.css?v=374`). Code-on-disk compound; **human smoke still pending** (no agent PASS claim).
- 2026-08-11: brand contract filed — PC **center seam** 360°/15s; `.stage-wm` hidden; artifacts `live-brand.css?v=10`, ship `live.js?v=551` / stage `?v=379`.
