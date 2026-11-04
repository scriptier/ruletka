# 545 — Wiki/spec: linking <3s vs answers=0 FAIL

## Status
COMPLETE

## Note on location
Same situation as task 541: this worktree's `knowledge/` branch (`claude/p0-connectivity`) is stale past 2026-08-12 and main has active uncommitted wiki edits from other agents. The task's OWN files only exist current in the main tree (`/home/drakosik/freenet-roulette`). Edited there directly — pure markdown appends, no code/deploy/APK touched — to avoid forking a stale snapshot or clobbering concurrent edits.

Task 541 (already COMPLETE) added gotcha 70, a connect-scorecard entry, and a log.md block for this same `20260820T203346Z` FAIL. This task closes the remaining gap: the **spec** (`current-linking-speed.md`) and the **linking-speed wiki page** still didn't cite it, so a Grok hop reading only those two (the usual entry points for linking-speed work) could still land on the `relayWaitBudgetMs` 480 question without seeing the FAIL.

## Files touched (main tree)
- `knowledge/specs/current-linking-speed.md` — added a new bullet at the top of `### Status`: **FAIL `20260820T203346Z`** flagged as a blocker for <3s GOAL_MET, citing matches=3/offers=2/**answers=0**, android av_path `ice=new`/`cs=new` all-window, `force_relay=true`, `bind_v=0`, `app_vc=464`, TURN HOT. Explicitly states cutting `relayWaitBudgetMs` 480 is out of scope/cannot fix a dead answer leg. `DONE WHEN` block **untouched** (still requires `product.status=ok`).
- `knowledge/wiki/linking-speed.md` — added a new top section `## FAIL (2026-08-20 · 1v1 PC↔Android 20260820T203346Z · answers=0 — cite as <3s blocker)` with a metrics table + explicit "read this correctly" note distinguishing it from the 480 tuning lock below it in the same file.
- `knowledge/wiki/log.md` — one-line follow-up entry (`## [2026-08-20] wiki | spec + linking-speed cite 20:33Z answers=0 FAIL`) pointing at the two file updates above, distinct from 541's earlier FAIL block already in the file.

## Verify commands run
- `git status --short -- knowledge/wiki/*.md knowledge/specs/*.md` (main tree) — confirmed only intended files carry my edits (rest is pre-existing concurrent-agent WIP, matching 541's prior note).
- `grep -n "20260820T203346Z" knowledge/specs/current-linking-speed.md knowledge/wiki/linking-speed.md knowledge/wiki/log.md` — confirmed the stamp is now cited in all three.
- `git diff -- knowledge/wiki/log.md | grep -A5 -B2 "spec + linking-speed cite"` — confirmed my log.md insertion is exactly the intended 3 new lines, isolated from the large pre-existing diff in that file.
- `git status --short -- ui/live.js ui/webrtc.js mobile/src/media/MediaSession.ts knowledge/wiki/now.md` — confirmed these show modified only from **other agents' pre-existing work**; I made zero edits to any of them (used Edit tool only on the 3 OWN files).

## Compound content
- No `product.ok` / GOAL_MET invented anywhere in the new text.
- No suggestion to cut `relayWaitBudgetMs` 480 — text explicitly says cutting it is out of scope for an answers=0 FAIL.
- `DONE WHEN` in the spec is unchanged (still gated on `product.status=ok`).
- No `force_relay=false` advice.
- No `live.js` / `webrtc.js` / `MediaSession.ts` / `now.md` / deploy / APK touched by me.

## Connect risk
none — documentation-only wiki/spec compounding, no code, no deploy, no APK.

COMPLETE
