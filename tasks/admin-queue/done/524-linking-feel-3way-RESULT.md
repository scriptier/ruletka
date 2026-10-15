# 524 — Linking-feel spec: 1v1 paint then 3-way 30s — RESULT

**Status:** COMPLETE

## What changed
Added a short residual section, "2026-08-15 residual: fast 1v1 → picture →
3rd tile ~30s", to `knowledge/specs/current-linking-feel.md`, recording the
2026-08-15 human observation: 1v1 starts fast, then a picture, then the 3rd
tile, but the whole sequence feels ~30s (want 2–3s). Real 3-way = PC + laptop
+ phone; 3 tiles is the correct outcome, not a bug. Cross-referenced the new
`knowledge/specs/2026-08-15-fast-1v1-to-3way.md` spec and summarized static
critic 523's findings against disk 639: the five layout/guard issues named in
that spec (hybrid rebuild, mid-offer setDirection, setNoCamPortrait-over-paint,
the `638` trio-collapse-to-duo bug, lobby-spin rematch) are all guarded off;
the two causes still open for the ~30s feel are outside `live.js`/`webrtc.js`
reach — hub per-client offer debounce (gotcha 40, coded but deploy-unconfirmed)
and inherent 3rd-TURN-allocation RTT under the same-IP `force_relay` lock
(gotcha 39). No GOAL_MET / product.ok / MULTI_PASS invented for the ~30s
figure — flagged explicitly as the human's own timing, not an av-verify number.

## Files touched
- `knowledge/specs/current-linking-feel.md` (main tree
  `/home/drakosik/freenet-roulette` — this file does not exist in the
  `freenet-roulette-claude` worktree; `knowledge/specs/` is only present on
  the main tree, same pattern noted by task 522's RESULT). No other file
  edited.

## Verify commands run
- `node --check ui/live.js` → exit 0
- `node --check ui/webrtc.js` → exit 0
  (both files untouched by this task; ran as due-diligence confirmation only,
  since other agents have concurrent uncommitted edits on the shared main
  tree.)

## Connect risk
**none** — doc/spec-only edit. No `live.js`, `webrtc.js`, MediaSession, ICE,
hub, or APK changes. No `relayWaitBudgetMs` touched.

COMPLETE
