# 470 — live-stage CSS a11y contrast for partner name — RESULT

## Status
COMPLETE (verified pre-existing implementation; no additional diff needed)

## Findings
`ui/live-stage.css` already contains a full contrast treatment for `#remote-name`
during `.stage-trio.stage-trio-searching` (PC find-3rd hunt), landed as part of
earlier uncommitted work already sitting in this worktree:

- `#remote-name.name-on-tile` base pill (line ~12205): off-white text `#eef2f7`
  on a near-opaque dark pill `rgba(8, 12, 20, 0.88)` with a subtle white border
  and drop shadow — already >12:1 text-vs-pill contrast regardless of the video
  behind it.
- Trio/hunt-specific override (line ~20866): `z-index: 65 !important` +
  8-direction black text-shadow stack.
- Final a11y layer (line ~20880, comment: "a11y: trio hunt column is the
  narrowest/brightest tile — win the pill's contrast fight with an extra crisp
  black outline layer + top z-index"): `z-index: 66 !important` with a denser
  1.5px 8-direction outline plus glow (`0 0 8/16/26px rgba(0,0,0,...)`), sized
  to keep the name legible against the brightest/most exposed hunt column.
- This is the last rule in the file touching `#remote-name` (confirmed via
  `grep -n "remote-name" ui/live-stage.css`), so it wins the cascade — nothing
  downstream reduces its opacity/visibility or strips the shadow.
- Only `text-shadow` / `z-index` are used for the trio-searching-specific
  polish, matching the task's OWN scope (no background/opacity/layout changes).
- `ui/live.html` already references `live-stage.css?v=401` (bumped from the
  prior `?v=359` baseline), so the cache-bust requirement is satisfied.

Given this already meets every Done criterion, I did not add a duplicate rule
block — doing so would only add cascade noise to an already very large
stylesheet and risk fighting the existing `!important` chain.

## Files touched
None (verification only — `ui/live-stage.css` and `ui/live.html` changes were
already present in the worktree before this task ran).

## Verify commands run
- `grep -n "remote-name" ui/live-stage.css` — confirmed the trio-searching a11y
  rule (line ~20880) is the last selector touching `#remote-name`, i.e. it wins.
- `git diff -- ui/live-stage.css ui/live.html` — confirmed the contrast rules
  and the `?v=401` bump are both already staged as uncommitted changes.
- Manual read of base `.name-on-tile` pill styling (line ~12202) and the
  trio-searching override chain (lines 2311, 20866, 20880) to confirm no later
  rule overrides color/background/opacity for `#remote-name`.

## Connect risk
none — CSS-only inspection, no `live.js` / `webrtc.js` / ICE / offer changes.

COMPLETE
