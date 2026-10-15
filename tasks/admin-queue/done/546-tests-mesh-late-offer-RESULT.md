# 546 — Unit tests: mesh late-offer / extra stuck

## Status
COMPLETE

## What changed
Extended `ui/live-extra-ice.test.mjs` (pre-existed untracked in this worktree from prior mesh-late-offer work; did not create a new file) to lock down the laptop 3rd late-offer retry gate so it cannot regress silently:

- `meshExtraOffererRetryAllowed(n, stuckExtra)` — a local mirror of `ensureMeshExtraOfferer`'s `offerer:` key gate in `ui/live.js` (`if (n >= 2) { const stuck = ...; if (!stuck || n >= 4) return false; }`). Asserts: always retries while `n<2`; once `n>=2`, only continues while the extra is genuinely `stuckExtra` (no live A/V, no offer in flight); hard stop once `n>=4`. This is the exact "cap 4" behavior named in the task — the previously-existing `extraOffererRetryOk` helper in the same file claimed a cap of 2, which only reflects the two scheduled `armMeshLateOfferKicks` timers (kick@220ms, kick2@1100ms), not the `meshEnsureCounts` retry cap; left that test in place (different, still-true claim) rather than rewriting it, since it isn't wrong on its own terms.
- Static source assertions against `ui/live.js` confirming the named functions/identifiers still exist: `function armMeshLateOfferKicks`, `stuckExtra`, `meshEnsureCounts`, the exact cap-4 line `if (!stuck || n >= 4) return false;`, and the `ice === "checking"` / `age < 5000` stuck-ICE gate in `peerPcOfferInFlight`.

## Files touched
- `ui/live-extra-ice.test.mjs` (extended only; no new file needed — it already existed untracked in this worktree)

## Verify commands run
- `node ui/live-extra-ice.test.mjs` → `live-extra-ice.test.mjs: ok` (exit 0)
- `node ui/live-third-slot.test.mjs` → `live-third-slot.test.mjs: ok` (exit 0, unaffected)

## Connect risk
none — test-only change, no edits to `live.js`/`webrtc.js`/MediaSession.

## Note for Grok
This worktree already has a large uncommitted diff in `ui/live.js` (mic boost, hide-until-reveal, gift kinds, fx-lite, etc.) and several untracked test files (`live-extra-ice.test.mjs`, `live-third-slot.test.mjs`, `live-trio-names.test.mjs`, `next-stop-roll.test.mjs`, `peer-blur-frost.test.mjs`, `webrtc-answer-dir.test.mjs`, `webrtc-udp-relay.test.mjs`, `admin-page.test.mjs`, `gift-kinds.test.mjs`, `debate-hub.test.mjs`) predating this task — left untouched, not authored by this task.

COMPLETE
