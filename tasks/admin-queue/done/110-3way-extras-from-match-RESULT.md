# 110 — 3-way extras still listed when hub has 2 remotes — RESULT

## Status
COMPLETE

## Root cause
`extraPeersFromMatch` short-circuited to `[]` whenever raw `msg.peers.length <= 1`,
regardless of whether that lone row actually matched the primary. A hub 3rd-join
Matched delta commonly lists **only the new peer** (e.g. `peers: [{peer_id: "laptop"}]`)
without re-listing the already-established primary. That single-row, non-primary
case was being nuked by the length guard, so the Laptop extra vanished and the
Android 2-screen 3-way split disappeared.

## Fix
`mobile/src/live/matchPeers.ts:extraPeersFromMatch` — removed the
`peers.length <= 1 → []` short-circuit (kept only the `!peers.length → []`
empty-array guard). Extras are now decided purely by the existing
primary-id filter (exact + `peerIdsLooseMatch`), which already yields the
correct semantics:
- Single row that IS the primary (or all rows loose-match the primary) → `[]`
  (1 unique remote, 1v1 lock).
- Single or multi rows with a genuinely different peer id → returned as
  extras (up to `MAX_EXTRA_PEERS`).

Mirrored the same one-line change in the plain-JS copy of the function inside
`matchPeers.test.mjs` (the test file reimplements the source functions rather
than importing the `.ts` module).

## Files touched
- `mobile/src/live/matchPeers.ts` — `extraPeersFromMatch`: drop `peers.length <= 1` guard.
- `mobile/src/live/matchPeers.test.mjs`:
  - Mirrored the same guard fix in the local `extraPeersFromMatch` copy.
  - Updated the one stale assertion that depended on the old length-only
    short-circuit (`peers:[{peer_id:"solo1"}]` vs primary `"p"` — those never
    matched, so the old code's `[]` result was an artifact of the bug, not a
    real 1v1 case). Rewrote it to assert primary == peer id.
  - Added a new regression block covering: 2 remotes listed → non-primary
    extra returned (Primary + Laptop); the actual hub-delta case (peers has
    only the new peer, primary omitted) → extra still returned; poison
    primary-only (2 rows, both loose-match primary) → `[]`; single row that
    is the primary alone → `[]`.

## Verify commands run
- `node mobile/src/live/matchPeers.test.mjs` → `matchPeers.test.mjs OK`
- `cd mobile && npx tsc --noEmit -p .` → pre-existing unrelated errors only
  (missing `node_modules` packages, `live.tsx`/`MediaSession.ts` issues
  predating this change); nothing new in `matchPeers.ts`.

## Connect risk
none — scoped to `mobile/src/live/matchPeers.ts` extras selection logic only.
No changes to `MediaSession.ts`, `ui/live.js`, `ui/webrtc.js`, startCall/closeCall,
ICE, force_relay, or pool gating.

## Note
`mobile/src/live/matchPeers.ts` and `matchPeers.test.mjs` show as untracked
(`??`) in this worktree's `git status`, not modified (`M`) — this predates my
edit (the files existed on disk pre-task but aren't yet in this worktree's
git index). Flagging for Grok's harvest step in case that's unexpected.

COMPLETE
