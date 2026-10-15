# 782 — FX cooler second critic (read-only)

## Status
COMPLETE

## Method
Independent read-only pass over `ui/live-stage.css` (`.fx-*`) and `ui/live.js` (`ensure*Fx` /
`triggerGiftImpact` / particle builders) for all 13 kinds. No edits made — critique-only per scope.
A prior pass already sits in this same file; this run re-derived the ranking from scratch and found
one cross-cutting gap the prior pass missed (#1 below), so it supersedes rather than just repeats it.

## Finding that drives the ranking
Some kinds already got the "premium" treatment: a crafted CSS shape/gradient standing in for an
emoji, plus a glow/bloom layer — `.fx-balloon-body` (gradient + shine + knot), `.fx-confetti-bit`
(gradient + box-shadow glow), `.fx-crown-svg` (hand-built SVG + gradients + sheen sweep),
`.fx-spotlight-iris`/`.fx-spot-mote`, `.fx-bars-mesh`, and `playFireworksCanvasBurst` (full canvas
particle work). Those read as designed assets.

The rest are raw system emoji glyphs with nothing behind them but `filter: drop-shadow(...)` — no
gradient disc, no glow puck, sometimes mixing clashing glyph families in one burst. Those are the
"emoji toy" moments:

- **`.fx-impact-hero`** (`ui/live-stage.css:15665`, filled by `triggerGiftImpact()` in
  `ui/live.js:6556`) — this is the TikTok-style money-shot glyph that pops center-stage on *every
  single gift of every kind* (it just renders `meta.ico`, a raw emoji, at 3.4–5.8rem). Because it's
  shared infrastructure for all 13 kinds, it's the widest-reach naked-emoji surface in the whole
  system, and neither of the two prior critique passes on this file called it out — they both
  focused on per-kind repeating particles instead of the one shared impact element every gift routes
  through.
- `.fx-heart-bit` (heart — cheapest/most-triggered gift, so second-widest reach)
- `.fx-petal`/`.fx-petal-lg/md/sm` + `.fx-sparkle` (flowers)
- `.fx-please-stay-bit` (please_stay — 4 mismatched glyph families: 🙏💛✨🤝)
- `.fx-pass-mic-mic` hero (pass_mic — a 5★ gift whose hero glyph gets a *weaker* treatment than the
  1★ heart's hero)
- `ensureSnowFlakes` (2 of every 3 snow particles are bare glyphs; the other third, `.fx-snow-dot`,
  already has the glow treatment right next to it in the same function)

The fix pattern is already proven in-file in three places (`.fx-impact-flash`'s accent radial-gradient,
`.fx-heart-hero`'s two-layer drop-shadow, `.fx-crown`'s gradient/glow build) — it just wasn't
propagated to the glyphs above.

## Ranked hops (max 6, smallest → still high ROI)

1. **`.fx-impact-hero`** (`ui/live-stage.css:15665`; populated in `ui/live.js:6556` `triggerGiftImpact()`)
   — highest ROI in the file: one selector, fires for all 13 kinds. Add a radial-gradient glow-puck
   `::before` sized to the glyph box, reusing the accent-colored gradient technique already sitting
   right above it on `.fx-impact-flash` (`--fx-accent` custom prop is already threaded through). Zero
   new elements, one CSS block, fixes the single most-seen FX moment in the product.

2. **`.fx-heart-bit`** (`ui/live-stage.css:18270`) — heart is the cheapest/most-triggered gift, so
   this is the single biggest per-kind exposure fix for the least CSS: add the same glow-puck
   `box-shadow`/`::before` trick `.fx-confetti-bit` already uses, and narrow the 6-glyph mix
   (💖🩷🤍💛💗💕) to 2–3 palette-consistent hearts so the burst doesn't read as random emoji soup.

3. **`.fx-petal` / `.fx-sparkle`** (`ui/live-stage.css:17147`, `17187`) — same glow-puck treatment.
   Flowers already has a nice heart-curve layout and frame (`.fx-flowers::before`); the only thing
   missing is that each individual glyph is naked.

4. **`.fx-pass-mic-mic`** (`ui/live-stage.css:15329`) — this is the hero focal point of a 5★ gift and
   currently gets only a single drop-shadow, weaker than what `.fx-heart-hero` gets for a 1★ gift.
   Add a second warm-glow drop-shadow layer (or a radial-gradient disc matching `.fx-pass-mic-glow`'s
   palette) so the priciest gift's hero doesn't read cheaper than the cheapest one's.

5. **`.fx-please-stay-bit`** (`ui/live-stage.css:15209`) — same glow-puck fix as #2/#3, plus trim the
   4 mismatched glyph families (🙏💛✨🤝) down to 1–2 so the burst reads as one gift, not a sticker
   grab-bag. Lower priority than the paid gifts above since please_stay is a utility nudge, not a
   purchase.

6. **`ensureSnowFlakes` glyph ratio** (`ui/live.js:7241-7263`) — `.fx-snow-dot` (1-in-3 particles)
   already looks premium (radial-gradient + glow, no glyph); tilt the split further toward `"dot"` or
   give `.fx-snow-flake` the same glow treatment. Smallest-impact hop: snow is ambient/thematic, not
   a flexed gift, and the glyphs chosen (❄ ❅) are visually thin so the "toy" risk is low to begin with.

## Files touched
None — read-only review as scoped. Only this RESULT file was written.

## Verify commands run
None applicable (no code changed; task scope forbids editing product CSS/JS).

## Connect risk
none — no product files touched, no ICE/offer/TURN/CONNECTIVITY_LOCK code read or referenced.

COMPLETE
