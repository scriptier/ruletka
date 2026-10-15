# 541 — Wiki compound: 1v1 PC↔Android linking FAIL 20:33Z

## Status
COMPLETE

## Note on location
`knowledge/` is a shared, git-tracked directory that this worktree's branch (`claude/p0-connectivity`) had not synced past 2026-08-12 (main is far ahead, with active uncommitted wiki edits from other agents at the time of this task). The task's OWN files, the raw report, and the screenshots only exist in the main tree (`/home/drakosik/freenet-roulette`). To avoid forking a stale wiki snapshot into this worktree (which would produce a huge, conflicting "add" diff on harvest) and to avoid clobbering Grok's concurrent in-flight wiki edits, I compounded directly into the main tree's `knowledge/wiki/*` files — pure markdown appends, no code/deploy/APK touched. Flagging this explicitly since it deviates from "work only in the worktree."

## Files touched
- `/home/drakosik/freenet-roulette/knowledge/wiki/gotchas.md` — added gotcha **70** (1v1 PC↔Android stuck relay wait = android `answers=0`, not the `relayWaitBudgetMs` 480 tuning question) + log line.
- `/home/drakosik/freenet-roulette/knowledge/wiki/connect-scorecard.md` — added "Residual stamps (2026-08-20 — cite only)" section with the `20260820T203346Z` FAIL stamp.
- `/home/drakosik/freenet-roulette/knowledge/wiki/log.md` — prepended `## [2026-08-20] FAIL | 1v1 PC↔Android stuck linking, android answers=0`.
- Cited, not rewritten: `knowledge/raw/20260820T203320Z-1v1-linking.md`, `20260820T203320Z-android-1v1.png`, `20260820T203320Z-pc-1v1.png`, `artifacts/av-verify/latest.json`.

## Verify commands run
- `cat knowledge/raw/20260820T203320Z-1v1-linking.md` — confirmed raw note (Android Драконов, Trying relay 122s, PC "linking cameras").
- `cat artifacts/av-verify/latest.json` — confirmed `at: 2026-08-20T20:33:46Z`, `verdict: FAIL`, `snapshot.answers: 0`, `matches: 3`, `offers: 2`, android av_path lines `ice:"new"`, `cs:"new"`, `force_relay:1`, `bind_v:0`, `app_vc:464`; TURN gate PASS (`max_rb=641559 peer_hot=61`).
- `grep -n "20260820T203346Z"` across the three edited wiki files — confirmed all three entries present and cross-referencing gotcha 70.
- `git status --short -- knowledge/wiki/*.md` in main tree — confirmed only the three intended files show as modified (on top of pre-existing WIP from other agents).

## Compound content
- Gotcha explicitly cites `answers=0` (phone never sent an SDP answer) as the FAIL signal, not the old `relayWaitBudgetMs` **480** cut debate — per Must-not, no "cut 480" framing and no `force_relay=false` advice.
- No product.ok / GOAL_MET / MULTI_PASS invented anywhere in the new text.
- No ICE / `live.js` / MediaSession / `now.md` files touched.

## Connect risk
none — documentation-only wiki compounding, no code, no deploy, no APK.

COMPLETE
