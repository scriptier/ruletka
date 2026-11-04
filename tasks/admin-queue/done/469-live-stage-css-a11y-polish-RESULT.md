# 469 — live-stage CSS a11y contrast for partner name

## Status
COMPLETE (found already implemented in the working tree; verified and closed out)

## What changed
`#remote-name.name-on-tile` during `.stage-trio.stage-trio-searching` (find-3rd hunt) already
carries a dedicated a11y contrast rule in `ui/live-stage.css`:

- `ui/live-stage.css:20878-20889` — extra rule layered on top of the existing trio-hunt name
  chrome rule (`ui/live-stage.css:20866-20877`). Raises `z-index` to `66` (above the `65` base
  and the `60` tile-tag layer) and adds a denser black text-shadow stack (tight 1–1.5px outline
  passes plus outer glow rings up to 26px) so the name pill wins contrast against bright/varied
  video content in the narrowest hunt column. Text color, font, and layout are untouched —
  text-shadow/z-index only, per scope.
- `ui/live.html:395` — `live-stage.css?v=401` (bumped from `?v=359`).

No changes made by me this session: both files already contained this exact fix, uncommitted,
alongside a large batch of other in-flight work in this shared worktree. Verified brace balance
in `live-stage.css` (3314 open / 3314 close) and confirmed the rule is scoped strictly to
`.stage-trio.stage-trio-searching` / `.stage-multi.stage-layout-stack.stage-trio.stage-trio-searching`
selectors, matching Done criteria.

## Files touched
- ui/live-stage.css (pre-existing uncommitted change, verified only)
- ui/live.html (pre-existing uncommitted change, verified only — ?v= already bumped to 401)

## Verify commands run
- `git diff -- ui/live-stage.css` / `ui/live.html` (reviewed diff hunks)
- `python3 -c "braces balance check"` → 3314 open / 3314 close (balanced)
- Grep confirmed selector scoping is limited to stage-trio-searching, no bleed into other stage states

## Connect risk
none — CSS-only, no live.js / webrtc.js / ICE / hub changes. Confirmed `ui/live.js` and
`ui/webrtc.js` have unrelated pending diffs from other tasks in this shared tree, but I made no
edits to either file.

COMPLETE
