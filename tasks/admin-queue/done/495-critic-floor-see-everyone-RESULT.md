# 495 — Critic: stage floor + 3-way see-everyone (read-only)

**Status:** COMPLETE — all 7 checks PASS, no product edits made.

Reviewed on-disk state in worktree `/home/drakosik/freenet-roulette-claude` (uncommitted
working-tree changes on top of `349970c`, i.e. the herd `20260814T080020Z` + Grok floor hop
result). `ui/live-stage.css` carries an explicit `2026-08-14` comment marker for this floor
rework (`ui/live-stage.css:21908-21913`).

## Checks

1. **`#tile-floor-partner` is a child of `#stage`, not inside `#tile-remote`** — **PASS**.
   Verified by parsing tag balance, not just indentation: `<section id="tile-remote">`
   (`ui/live.html:675`) closes at `ui/live.html:986`. `#tile-floor-partner`
   (`ui/live.html:1259`) opens well after that close, as a sibling of `#tile-remote`,
   `#tile-third`, and `#tile-local`, all direct children of `<main id="stage">`
   (`ui/live.html:667`).
   *Side note (not a check failure):* the legacy inline `<style>` block in `ui/live.html:116-138`
   still has dead descendant selectors (`#tile-remote.is-chrome-open .tile-floor-partner`,
   `#tile-remote:not(.is-chrome-open) .tile-floor-partner`) that can never match now that the
   floor is a stage-level sibling, not a `#tile-remote` descendant. Harmless (never matches, so
   no visual effect) — the real chrome-autohide visibility rules live in
   `ui/live-stage.css:11957-12130` and `ui/live-stage.css:22017-22029`, which correctly use
   `:has()` / direct-class selectors for the sibling relationship. Flagging for cleanup, out of
   scope for this critic pass (must not edit `ui/live.html`).

2. **3-way/4-way CSS reserves padding via `--stage-dock-h` so the floor doesn't cover faces** —
   **PASS**. `ui/live-stage.css:21914-21916` defines `--stage-dock-h: 3.55rem` on `#stage`;
   `ui/live-stage.css:21943-21949` applies `padding-bottom: var(--stage-dock-h) !important` to
   `#stage.stage-trio, .stage-quad, .stage-count-3, .stage-count-4, .stage-trio-searching`. No
   competing `padding-bottom` rule for those selectors elsewhere in the file (only other
   `.stage.stage-trio` block is `ui/live-stage.css:2184`, which does not touch padding-bottom).
   The floor itself is `position: absolute; bottom: 0; width: 100%` under those same classes
   (`ui/live-stage.css:21950-21969`), sitting inside the reserved band.

3. **1v1 floor still partner-column only (not full width)** — **PASS**.
   `ui/live-stage.css:21924-21936`: for `#stage` without `.stage-trio/.stage-quad/.stage-count-3/
   .stage-count-4`, `#tile-floor-partner` is `position: absolute; left: 0; width: 50%;
   max-width: 50%`.

4. **2×2 button only when 4 people (`stage-quad` / `people===4`)** — **PASS**.
   `ui/live.js:12325` — `const quad = people === 4;` then `stage.classList.toggle("stage-quad",
   quad)` (`ui/live.js:12326`); the `#btn-grid-2x2` button visibility is driven by the same
   `quad` flag: `btn2x2.hidden = !quad` (`ui/live.js:12333-12335`). `want2x2`
   (`ui/live.js:12309`, the actual 2×2 *layout* toggle vs. just the button) is additionally
   gated on `people === 4 && stageLayoutMode === "grid"`.

5. **`syncNextButtonCopy` sets Leave 3rd / Leave call by `yourRole`** — **PASS**.
   `ui/live.js:13770` (`function syncNextButtonCopy()`): when `thirdLive` is true —
   `yourRole === "party"` → `stopText = "Leave 3rd"` (`ui/live.js:13839-13843`);
   `yourRole === "solo"` → `stopText = "Leave call"` (`ui/live.js:13844-13847`).

6. **`live.html` pins match bodies: live.js 598, stage 413, i18n 252** — **PASS**.
   `ui/live.html:426` `live-stage.css?v=413`, `ui/live.html:428-429` preload
   `live.js?v=598` / `i18n.js?v=252`, `ui/live.html:3138` `i18n.js?v=252`,
   `ui/live.html:3143` `live.js?v=598`. Actual file line counts:
   `ui/live-stage.css` = 22033 lines, `ui/live.js` = 37001 lines, `ui/i18n.js` = 2137 lines —
   pin numbers are cache-bust version tags, not line counts, and they match each other
   consistently across every reference in `live.html` (re-read the file per task instruction;
   no stale pin found).

7. **`pool=0`; no `force_relay` always-on flip; no `MULTI_PASS` invented** — **PASS**.
   `ui/webrtc.js:17` — `const ICE_CANDIDATE_POOL_SIZE = 0;`, reused at
   `ui/webrtc.js:567,716,730`. No hardcoded `force_relay: true` / `force_relay = true`
   introduced (checked `git diff HEAD~5 -- ui/live.js ui/live-stage.css ui/live.html
   ui/webrtc.js` for additions — none). All `MULTI_PASS` occurrences in the repo are in
   `tasks/**` docs as explicit non-claims/disclaimers ("no invent MULTI_PASS"), never asserted
   as a passed gate.

## Files touched
None (read-only review). This RESULT file only.

## Verify commands run
```
git status --short
git log --oneline -5 / -15 -- ui/live.js ui/live-stage.css ui/live.html
grep -n "tile-floor-partner" ui/live.html ui/live.js ui/live-stage.css
grep -n "stage-dock-h" ui/live-stage.css
grep -n "stage-quad|people ===|quad" ui/live.js
grep -n "syncNextButtonCopy" ui/live.js
grep -n "live\.js|live-stage\.css|i18n\.js" ui/live.html
grep -n "force_relay|forceRelay" ui/live.js ui/webrtc.js
grep -n "ICE_CANDIDATE_POOL_SIZE" ui/webrtc.js
grep -rn "MULTI_PASS" ui/ docs/ tasks/
git diff HEAD~5 -- ui/live.js ui/live-stage.css ui/live.html ui/webrtc.js | grep "force_relay.*true"
python3 (tag-balance parse of ui/live.html to confirm #tile-floor-partner is NOT a
  descendant of the #tile-remote <section>, not just an indentation guess)
```

## Connect risk
**none** — read-only review, zero product files edited, no ICE/offer/TURN/pool changes made or
recommended as blocking.

COMPLETE
