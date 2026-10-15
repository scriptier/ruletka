# 447 — live-stage CSS a11y contrast for partner name

## Status
COMPLETE

## What changed
Strengthened the `#remote-name` text-shadow used during `stage-trio` / `stage-trio-searching`
(trio hunt) so the partner's name chip stays readable regardless of the video content behind it.
Previous shadow was a soft glow only (`0 1px 3px`, `0 0 6px`, `0 0 14px` black); added a tight
4-direction stroke (±1px offsets, 2px blur, 0.9 alpha) around the existing glow to give the text
a crisp dark outline on any background (bright skin tones, light clothing, etc.), not just uniformly
dark video. Applied to both occurrences of the rule (there are two near-duplicate `#remote-name`
blocks in the trio/hunt cascade — one early in the file, one later that wins on cascade order — kept
them in sync so behavior doesn't depend on which one currently "wins").

z-index was already correct (62, above the tile-tag at 60 and video at 5) — left untouched, no
z-index change needed.

## Files touched
- `ui/live-stage.css` — text-shadow polish on `#remote-name.name-on-tile` in stage-trio /
  stage-trio-searching rules (2 occurrences, ~line 2311 and ~line 20864)
- `ui/live.html` — bumped `live-stage.css?v=395` → `?v=396`

## Verify commands run
- `grep -n "text-shadow: -1px -1px 2px rgba(0, 0, 0, 0.9)" ui/live-stage.css` — confirmed both
  rule blocks updated
- Visual/manual browser smoke not run (no dev server started in this pass); change is CSS-only
  (text-shadow + version bump), no JS/markup touched.

## Note on repo state
`ui/live-stage.css` and `ui/live.html` had pre-existing large uncommitted diffs from another
agent when I started (visible via `git diff --stat`). Per factory rules I only touched the two
`#remote-name` rule blocks and the version line — did not review, revert, or "clean up" any of
the surrounding pre-existing changes.

## Connect risk
none — CSS-only contrast tweak (text-shadow), no live.js, no webrtc.js, no ICE/offer/TURN paths
touched.

COMPLETE
