# RESULT: 403-pc-trio-hunt-css-lock

## Status
COMPLETE — already satisfied by current working-tree state; no further code change needed.

## Findings
On starting this task, `ui/live-stage.css` and `ui/live.html` already contained a full implementation
of the requested lock (uncommitted vs. `main`/HEAD, likely left over from prior work in this shared
worktree that never got a RESULT written). I audited it line-by-line against the done criteria rather
than re-implementing, since the existing rules already cover every requirement — reimplementing would
just have added redundant/conflicting `!important` blocks.

Two layers exist and reinforce each other:
- `ui/live-stage.css:2262-2400` — primary `.stage.stage-trio.stage-trio-searching` rules.
- `ui/live-stage.css:20817-20899` — a later "FINAL LOCK" block (same selectors, appended at EOF so it
  wins ties in cascade order against any multi-layout `min-width:0` floors elsewhere in the file).

## Done criteria — verified
- [x] **Partner min size floors during hunt** — `#tile-remote`/`#tile-third`/`#tile-local` get
  `min-width: max(6.5rem, 18%) !important; min-height: max(10rem, 40%) !important;` under
  `.stage-trio.stage-trio-searching`, both at :2267-2288 and reinforced at :20822-20832/:20869-20878.
  Confirmed this beats the competing `#tile-remote, #tile-local { min-width: 0 !important; }` inline
  rule in `ui/live.html:89-95` on specificity (ID+3 classes vs. ID alone), independent of source order.
- [x] **`#remote-name` z-index above video** — `.vid.remote` is `z-index: 5`; `#remote-tile-tag` is
  `z-index: 60`; `#remote-name.name-on-tile` is `z-index: 61` (`:2298-2319`, `:20845-20858`).
- [x] **`third-empty` cannot cover `tile-remote`** — `#third-empty` is a DOM child of `#tile-third`
  only (confirmed in `ui/live.html:1007-1009`, a separate grid column from `#tile-remote`), and both
  `.tile-third`/`.tile` establish `position: relative; overflow: hidden` containing blocks, so an
  absolutely-positioned `#third-empty` (`inset:0`) is physically confined to that column. Belt-and-
  braces rule at `:20891-20899` additionally force-hides any `#third-empty`/`.third-empty` that would
  end up nested under `#tile-remote`/`#tile-local`. `#remote-empty` (the partner-tile's own empty
  brand) is separately force-hidden during `.stage-trio-searching` (`:2320-2340`, `:20860-20868`) so it
  can't cover the live partner feed either.
- [x] **Bump `live-stage.css?v=` by +1** — already bumped in the working tree, `ui/live.html:395` reads
  `live-stage.css?v=383` vs. `v=359` on `HEAD` (the CSS file has accumulated multiple unrelated edits
  from other in-flight work in this shared worktree since HEAD, each with their own bump; the version
  is already ahead of what's committed so cache-busting is satisfied — no further bump needed).
- [x] **`.stage-trio-searching` is live-driven** — confirmed `ui/live.js` toggles this class in 5
  places (search only, read-only check, no edits made).

## Files touched
None — verified pre-existing (uncommitted) state only. No new edits to `ui/live-stage.css` or
`ui/live.html` were required.

## Verify commands run
- `node -e` brace-balance check on `ui/live-stage.css` → balanced (0), 20900 lines.
- `grep -n "stage-trio-searching" ui/live-stage.css` → confirmed both rule blocks (:2247-2400 and
  :20817-20899) and no other selector re-collapses `#tile-remote`/`#tile-third` under this state.
- `grep -n "stage-trio-searching" ui/live.js` → confirmed the class is toggled by live app logic
  (5 call sites), so the CSS lock is not dead code.
- Manual DOM/CSS specificity audit (no headless browser available in this environment — playwright/
  puppeteer not installed — so this was static analysis, not a rendered screenshot).

## Connect risk
none — CSS-only, no `live.js`/`webrtc.js` touched, no deploy.

COMPLETE
