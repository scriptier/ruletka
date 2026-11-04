# 551 — Test: TURN URL order (VPN vs speed)

## Status
COMPLETE

## What changed
Added `ui/turn-url-order.test.mjs`, a read-only contract test locking
`preferFastTurnFirst()` in `ui/webrtc.js` to sort TURN URLs
**UDP `turn:` first, then `transport=tcp`, then `turns:`** (STUN last).

The test:
- Asserts `function preferFastTurnFirst` exists in `ui/webrtc.js` and that its
  internal `score()` lines (UDP=0, TCP=1, TURNS=2) are present verbatim, so a
  future edit can't silently flip production back to TCP-first.
- Re-implements `preferFastTurnFirst` locally (mirrors the source exactly,
  since `webrtc.js` is browser code with `window` refs and isn't importable
  under Node — same pattern as `ui/webrtc-udp-relay.test.mjs`).
- Feeds a scrambled `[turns, tcp, udp, stun]` url list and asserts the sorted
  output is `udp < tcp < turns < stun` (both by explicit index order and
  by value).
- Asserts username/credential survive the sort, single-url servers pass
  through unchanged, and an already-sorted UDP-first list is not reordered.

## Files touched
- `ui/turn-url-order.test.mjs` (new)

## Verify commands run
- `node ui/turn-url-order.test.mjs` → `ok turn-url-order 6 asserts`

## Connect risk
none — test-only addition, no production code touched. `ui/webrtc.js` was
read-only for this task (confirmed via `git diff` before/after: no changes
made by this session; the file's existing working-tree diff predates this
task).

COMPLETE
