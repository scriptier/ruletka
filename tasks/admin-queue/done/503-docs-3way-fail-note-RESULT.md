# Docs: confirm SMOKE-NEXT §D still says human rsync after 084504Z — RESULT

Status: COMPLETE

## What I checked
- Read `knowledge/specs/SMOKE-NEXT.md` §D (`Multi-party 3-way / 4-way`). Note: this file does not
  physically exist in this worktree (`/home/drakosik/freenet-roulette-claude`) — only `knowledge/raw/`
  and `knowledge/wiki/` are present here. It is untracked by git (not gitignored, simply absent), so I
  read it directly from the main tree (`/home/drakosik/freenet-roulette/knowledge/specs/SMOKE-NEXT.md`),
  the only place it exists on disk.
- §D line 291 still reads: **"Human rsync (`084504Z` FAIL — prod tab — not agent): rsync `live.html` +
  `live.js` + `webrtc.js` + `live-stage.css` + `i18n.js`. Hard-refresh laptop + PC to pins above. ...
  No MULTI_PASS."** — unchanged, confirmed present.
- §D line 290 records disk pins: `live.js?v=598` · `webrtc.js?v=324` · `stage 414` · `brand 16` ·
  `i18n 252`.
- Compared those pins against this worktree's `ui/live.html` (self-consistent, all references agree):
  `live-stage.css?v=414`, `live-brand.css?v=16`, `live.js?v=598` (both preload + script tag),
  `webrtc.js?v=324`, `i18n.js?v=252`. **No lag** — pins match exactly. No edit made.

## Note for Grok (not acted on — out of scope)
Main tree's `ui/live.html` was being edited concurrently while I checked (mtime ~25s before my check).
Its `<script src="live.js?...">` tag currently reads `v=599` while the `<link rel="preload">` still
reads `v=598` (internally inconsistent, mid-edit, uncommitted). I did not use this as the comparison
baseline since it's a live WIP edit in a tree I don't own and not a settled state — using it would risk
stamping a pin that changes again before a human actually runs the smoke. Worth a quick re-check once
that main-tree edit settles/commits.

Files touched: none (no pin lag found against this worktree's disk copy)
Verify commands run:
- `grep -noE '(live\.js|webrtc\.js|live-stage\.css|live-brand\.css|i18n\.js)\?v=[0-9]+' ui/live.html`
- `grep -n 084504Z knowledge/specs/SMOKE-NEXT.md` (main tree)
Connect risk: none
COMPLETE
