# RESULT: 004-web-kicksolo-speed

## Status
DONE

## Completion promise
COMPLETE

## Plan
- Read 001 RESULT (`20260807T123651Z-001-connect-slow-offer-RESULT.md`) and `docs/CONNECTIVITY_LOCK.md` speed targets.
- Spot-check the exact file:line citations from 001 still hold in current `ui/live.js` / `ui/webrtc.js` (not a full re-trace).
- Verify the two items in this ticket's scope that 001 didn't explicitly call out: (a) `joinPeers` teardown of a live kickSolo offer, (b) modal/UI blocking before `kickSoloWebRtc` fires.
- Run `./scripts/hub-match-speed.sh 30` (read-only) to note live/idle status.
- Patch only if a residual multi-second stall is proven — none was found, so no code changed.

## Spot-check vs 001's audit

- `handleMatched` — `ui/live.js:22440` (001 cited `22440-22569`, still matches). WS switch-case dispatch is synchronous: `case "matched": handleMatched(msg); break;` at `ui/live.js:22337-22339` — no modal/UI await before it fires.
- `kickSoloWebRtc` invocation — fire-and-forget `void kickSoloWebRtc(...)` at `ui/live.js:22559`, called directly off `handleMatched`, before any `dismissFriendRingUi()`/toast cleanup (that happens later at `22586`, non-blocking, and `dismissFriendRingUi` itself at `12241-12248` is just `clearTimeout`/DOM hide — no awaits).
- `kickSoloWebRtc` body — `ui/live.js:23228-23402` (001 cited `23228-23402`, unchanged): GUM capped at 900ms (`23245-23262`), 500ms `startPreview()` fallback race on failure (`23274-23279`, `startPreview` itself at `17663` is only reached through this capped race, never awaited directly on the hot path), existing warm/live/mid-offer PC kept as-is (`23290-23332`).
- **`joinPeers` teardown check (this ticket's added scope):** confirmed guarded. `handleMatched` explicitly branches `solo1v1` 1:1 matches to `kickSoloWebRtc` only and skips `joinPeers` for that case (`ui/live.js:22556-22569`), with an inline comment recording why: *"Do NOT call joinPeers after — it tore down kickSolo's PC mid-offer (existing without live video was closed → 12s silence until rematch)"* (`22557-22558`). `joinPeers` (`23404+`) is only reached for non-solo (trio/friend) matches, so it cannot tear down a live 1:1 kickSolo offer.
- `RouletteWebRtc.connect()` / `_createAndSendOffer` — not re-diffed line-by-line since `ui/webrtc.js` is outside this ticket's primary files and 001 already traced offerer watchdog (500ms) + 80ms micro-ICE pause with no changes since `0d61dbb`.

No residual multi-second stall found beyond what 001 already covered. Worst-case web match→offer remains ~1.0–1.3s (cold cam) as established in 001.

## What changed
- No code changes. Confirmed "already optimal" per this ticket's completion-promise gate ("Already optimal + 001 evidence is a valid COMPLETE").

## Files
- (none modified)

## Verify ran
- `./scripts/hub-match-speed.sh 30` → **IDLE**, 0 matches in last 30 min (consistent with 001's idle reading; no live MTO data available right now).
- Read/grep spot-check of `ui/live.js:22337-22339, 22440-22590, 23228-23402, 12241-12248, 17663` confirming line ranges 001 cited are unchanged and that `joinPeers`/modal dismiss do not block or race `kickSoloWebRtc`.
- No `tsc`/build run — no files changed.

## Connect risk
safe to merge after smoke — no diff to review.

## Handoff for morning
- merge branch: nothing new from this ticket (audit-only, no diff).
- smoke: after a real Play↔PC pairing, run `./scripts/hub-match-speed.sh 30` and confirm `match_to_offer_ms < 2000` with exactly 1 offer + 1 answer.
- do not: deploy without Play↔PC check; do not fold 003's rematch/double-offer thrash fix into this ticket.
