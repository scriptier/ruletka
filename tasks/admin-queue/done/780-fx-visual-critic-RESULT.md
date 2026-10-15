# 780 — FX visual second critic (RESULT)

Status: **COMPLETE** (read-only review, no edits made)

Scope read: `ui/live-stage.css` (`.fx-*` only), `ui/live.js` (`ensure*Fx`, `playFireworksCanvasBurst`
and the other `ensure*` particle builders it calls alongside), `ui/live.html` fx-overlay markup
(both `remote-fx-*` and `local-fx-*` blocks).

## 1. Current cheap-now line per kind

- **heart** — pulsing hero emoji + emoji particles floating up; a sticker swarm, no per-item
  depth/light variance beyond a shared drop-shadow.
- **bars** — the most physically detailed CSS (rods, welded straps, rust, slam-in), but the metal
  sheen (`.fx-bars-mesh::after`) caps at `opacity: 0.65` on a slow 7.5s cycle, so it barely reads —
  net effect is a flat repeating stripe pattern.
- **fence** — a single repeating PNG texture (`fx-bars-fence.png`) plus a static rust radial
  gradient; no light interaction, reads as wallpaper.
- **flowers** — 80+ emoji glyphs placed along a heart-curve with one shared pulse keyframe; an
  emoji bouquet, not an illustrated bloom.
- **balloons** — genuine CSS shape work (gradient body + shine + knot + string) rising with sway,
  but every balloon is the same silhouette just recolored/rescaled.
- **confetti** — mixed flat-color CSS rects/circles/hearts + emoji; only the ribbon shape gets a
  gradient "foil" treatment, so the rest read slightly matte next to the emoji sparkle.
- **shooting_star** — one thin (3px) linear-gradient comet + a `✦` glyph tip; reads more like a
  moving line than a comet trail.
- **snow** — text glyphs (`❄ ❅ ✦ ·`) plus radial dots drifting straight down over a flat 2-stop sky
  wash; no twinkle or near/far depth cue.
- **spotlight** — best-structured overlay (dim + cone beam + iris + dust motes), but the beam is a
  hard-edged `clip-path` cone, so it looks like a vector cutout rather than a soft light shaft.
- **crown** — custom inline SVG with gradient fill + jewel dots, the most "designed" asset in the
  catalog, but the metal is static (no glint sweep) — painted-on rather than lit.
- **pass_mic** — emoji mic/hand + speech-bubble emoji choreographed through a handoff keyframe; cute
  motion, but the visual language is pure sticker/emoji like heart and flowers.
- **fireworks** — the outlier: real multi-wave canvas particle bursts (rockets, shell, gold rain,
  twinkles) via `playFireworksCanvasBurst`. It is also the *only* kind that fully no-ops under
  `isFxLite()` (early `return` at `ui/live.js:6815`), so lite/low-end viewers get nothing but the
  timer chip and the flat `.fx-fireworks::before` vignette.
- **please_stay** — emoji hero + floating emoji bits over a generic pink radial wash that's reused
  verbatim elsewhere; least differentiated kind, reads like a reskinned heart gift.

## 2. Recommended hop list (max 8, ranked by ROI)

1. **Fireworks fx-lite gap** — `ui/live.js` `ensureFireworks()` (~6796) / `triggerGiftImpact()`
   (~6620); CSS already exists and is currently dead: `.fx-fw-burst` / `.fx-fw-spark` /
   `.fx-fw-core` (`ui/live-stage.css:18325-18437`). Wire 2–3 `.fx-fw-burst` spans into the layer as
   the `isFxLite()` fallback so lite viewers see a CSS-only burst instead of an empty tile. The
   asset cost is zero — the keyframes are already shipped, just unused.
2. **Spotlight beam hard edge** — `ui/live-stage.css` `.fx-spotlight-beam` (~24048). The `clip-path`
   cone has a crisp vector edge; feather it with a `mask-image` linear gradient (or a second blurred
   copy underneath) so it reads as a light shaft instead of a cut-out triangle.
3. **Confetti flat fills** — `ui/live-stage.css` `.fx-confetti-bit` / `.fx-confetti-rect` /
   `.fx-confetti-circle` (~17451-17474). Only `.fx-confetti-ribbon` uses a two-tone gradient; give
   rect/circle the same `linear-gradient(var(--color) 60%-ish, lighter)` treatment for a foil glint
   — one property change, applies to every falling bit.
4. **Crown static metal** — `ui/live-stage.css` `.fx-crown-hero` / `.fx-crown-svg` (~24242-24260).
   Reuse the sheen-sweep technique already built for bars (`fx-bars-sheen`, ~16175) as a masked
   `::after` sweep across the crown SVG so the gold catches light instead of sitting flat.
5. **Snow lacks depth/twinkle** — `ui/live-stage.css` `.fx-snow-bit` (~23998). Borrow the existing
   `fx-sparkle` opacity-pulse keyframe (already defined for flowers, ~17191) for a subset of flakes,
   and add a 1px blur to the smallest dot flakes for a cheap near/far parallax read.
6. **Bars sheen too subtle** — `ui/live-stage.css` `.fx-bars-mesh::after` (~16148). Peak opacity is
   0.65 on a slow 7.5s loop against a low-contrast mid-stop (`rgba(232,210,170,0.16)`); bump the
   mid-stop brightness or add a faster secondary pass so the "welded iron" catch-light actually
   registers instead of disappearing into the stripes.
7. **Shooting-star comet too thin** — `ui/live-stage.css` `.fx-ss-comet` (~24143). Fixed `height: 3px`
   reads as a line, not a streak; stack an extra blurred `box-shadow` layer (or widen with a
   gradient taper) for a motion-blur core — no new elements needed.
8. **Dead `--fx-stack` custom property** — `ui/live-stage.css:18876-18877` sets `--fx-stack` on
   `.fx-lvl-2`/`.fx-lvl-3` but nothing reads it (grep confirms zero consumers). Either wire it into
   an existing scale/size var (balloon `--size`, confetti density) so L2/L3 stacking reads
   consistently across kinds, or delete it. Zero visual risk either way, but currently it's a no-op
   left behind from an earlier pass.

## 3. MUST NOT

- No edits made to `ui/live-stage.css`, `ui/live.js`, or `ui/live.html` — this is a read-only critic
  task; hops above are recommendations for whoever picks up the follow-up task.
- None of the hops touch `filter` / `transform` on `<video>` — all changes are confined to
  `.fx-overlay` children (canvas layers, pseudo-elements, particle spans) per the existing
  "never filter the live video" convention already documented inline at `ui/live-stage.css:16255`
  and `ui/live-stage.css:24220`.
- No MediaSession / ICE / connectivity / deploy / APK / push touched or implicated.
- No product.ok / GOAL_MET claimed — this is a critic opinion, not a verified fix.

## 4. Verify plan (for whoever implements the hops)

- **Preview**: open `ui/live.html` (or the live dev server) with two tabs/peers connected, or use
  the existing gift-strip / stars-sheet debug trigger to fire each of the 13 kinds
  (`heart, bars, fence, flowers, balloons, confetti, shooting_star, snow, spotlight, crown,
  pass_mic, fireworks, please_stay`) on both `local-fx-*` and `remote-fx-*` overlays.
- **Gift-kinds sweep**: trigger each kind at level 1/2/3 (`fx-lvl-1/2/3`) to confirm density/scale
  hops don't clip or overflow the tile, especially spotlight's feathered beam and the confetti
  gradient fills at high particle counts.
- **fx-lite path**: force `isFxLite()` true (small viewport / low-end flag) and re-fire `fireworks`
  specifically to confirm the new CSS-only fallback actually renders instead of the current empty
  tile.
- **No-video-filter check**: DevTools → computed style on the live `<video>` element while each FX
  is active — confirm `filter`/`transform` stay unset by any of the above hops (grep for `video {`
  rules already gates this at `ui/live-stage.css:18906+`).
- **Perf spot check**: with several FX stacked (combo ≥2), watch DevTools Performance/FPS meter —
  none of the 8 hops add new `requestAnimationFrame` loops beyond the existing fireworks/confetti
  canvas bursts, so no regression is expected, but confirm on a mid-tier Android before merge.

COMPLETE
