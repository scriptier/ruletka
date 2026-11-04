# 522 — 3-way wiki compound: 234930Z ended tracks + hop 635/329 — RESULT

**Status:** COMPLETE

## What changed

Compounded the `234930Z` black-Courtier measure (ended tracks, not empty tile) and the disk hop `live.js?v=635` / `webrtc.js?v=329` into the multi-party wiki, plus one-line pointers in the log and resource catalog. Honest FAIL residual preserved — no MULTI_PASS / product.ok / GOAL_MET invented anywhere.

## Files touched

- `knowledge/wiki/multi-party.md` — new section "Ended tracks + leftover WxH = black, first-ok PC dropped on 3rd-join ice_failed (234930Z)" inserted after the Layout lock table; updated the "Latest desk" bullet to point at it. Documents: `#remote` `has-remote-feed` with ended audio/video tracks painted as a black slab (not a no-cam cylinder), root cause traced to `dropOnePeerKeepRest` tearing down the first-ok PC on 3rd-join `ice_failed`, 1v2 `recvonly` first-offer symptom, phone still 1v1 on 0.1.392, and the 635/329 disk+rsync hop that needs human hard-refresh to score. Cross-refs gotcha 53, distinguishes from 51/52.
- `knowledge/wiki/log.md` — new top entry `[2026-08-14] compound | 234930Z ended tracks black + hop 635/329 herd (this) c-wiki` summarizing the same, with raw/spec links and gotcha 53 cross-ref.
- `knowledge/wiki/resources.md` — new catalog card `{#card-3way-ended-tracks-black}` at the top with the same takeaways in card format (date, type, raw/spec links, shots, 5 takeaway bullets).

Note: `knowledge/wiki/multi-party.md` is untracked in git (`git log` shows no history for it, not gitignored) — it's an in-progress working-tree file from another agent, not yet committed. Edited in place; did not attempt to stage or commit.

Also note: the cited source files (`knowledge/specs/2026-08-14-3way-cameras-plan.md`, `knowledge/raw/2026-08-14-3way-ended-tracks-black.md`) and the OWN wiki files only existed in the main tree `/home/drakosik/freenet-roulette`, not in this worktree (`freenet-roulette-claude`, which only has a partial `knowledge/wiki/` subset). Read and wrote against the main tree paths since that's where the actual wiki lives; did not touch `now.md` (read-only) or any live.js/MediaSession/APK files.

## Verify commands run

None required/listed for this wiki-only compound task (no code changed). Confirmed via `git diff --stat` / `grep` that edits landed only in the three OWN files and did not touch `now.md`, `gotchas.md`, or any product code.

## Connect risk

**none** — wiki/doc-only edit, no touch to `live.js`, `webrtc.js`, hub, MediaSession, ICE, or APK.

COMPLETE
