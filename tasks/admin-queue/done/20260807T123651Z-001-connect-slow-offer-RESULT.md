# RESULT: 001-connect-slow-offer

## Status
DONE

## Completion promise
COMPLETE

## Plan
- Read Grok's prior RESULT + `docs/CONNECTIVITY_LOCK.md` speed targets.
- Diff Grok's commit `0d61dbb` to confirm what actually landed on `ui/live.js`, `ui/webrtc.js`, `mobile/src/media/MediaSession.ts`.
- Trace the full match→offer path on both sides (web `handleMatched`→`kickSoloWebRtc`→`RouletteWebRtc.connect()`; mobile `matched` case→`MediaSession.startCall()`) and sum worst-case delay at every await/timeout, file:line.
- Confirm hub is actually idle (read-only `hub-match-speed.sh`) before concluding no live data is available.
- Patch only if a residual multi-second stall is provable from the code; otherwise hand off as smoke-only.

## Audit — match→offer path, worst-case delay budget

**Web offerer (`ui/live.js` `handleMatched`→`kickSoloWebRtc`, `ui/webrtc.js` `connect()`):**
- `handleMatched` (`ui/live.js:22440-22569`) is a synchronous switch-case handler off the WS `onmessage` — no modal/UI await before `kickSoloWebRtc` fires. ICE config prefetch (`loadRtcConfig`) is fire-and-forget, not awaited (`ui/live.js:22521-22525`).
- `kickSoloWebRtc` (`ui/live.js:23228-23402`): if cam not already live, GUM is capped at **900ms** via `Promise.race` (`ui/live.js:23245-23262`), with a 500ms fallback race on failure. Existing warm PC is kept as-is if live/mid-offer (`ui/live.js:23290-23332`).
- `RouletteWebRtc.connect()` (`ui/webrtc.js:1197-1389`): offer watchdog armed at **500ms** offerer / **280ms** answerer (`ui/webrtc.js:1370`); offerer path calls `_createAndSendOffer` immediately, not gated on anything else.
- `_createAndSendOffer` (`ui/webrtc.js:1428-1511`): `createOffer` + `setLocalDescription` (native, ~tens of ms) + a **80ms** micro ICE-gather pause (`ui/webrtc.js:1492`, `_waitForInitialIce`) before emitting the offer signal. No wait for full ICE gathering (trickle carries the rest) — correct.
- **Worst case (cold cam):** ~900ms GUM + ~80ms micro-gather + sync overhead ≈ **~1.0–1.3s**, well under the 2000ms target. Warm-cam case ≈ **~100–200ms**.

**Mobile offerer (`mobile/app/live.tsx` `matched` case, `MediaSession.startCall`):**
- `matched` case (`mobile/app/live.tsx:208-240`) calls `media.startCall()` synchronously (fire-and-forget `.then`), not blocked by React state updates or audio-processing calls (those are also not awaited).
- `startCall` (`MediaSession.ts:1206-1413`): stuck-mutex breaker at **2500ms** (`MediaSession.ts:1208-1218`) — only fires if a *previous* call hung, not on the normal path. Offer watchdog armed at **500ms** offerer / **250ms** answerer (`MediaSession.ts:1272`). Cold-cam GUM race capped at **700ms** offerer / **1100ms** answerer (`MediaSession.ts:1304-1313`), running in parallel with a max **400ms** ICE-config wait (`MediaSession.ts:1298`, only when `hasIceServers()` is false).
- **Worst case (cold cam, no ICE yet):** ~700ms GUM race + sync overhead ≈ **~750ms–1s**, under target. The 2500ms mutex-break path is a bug-recovery fallback, not the steady-state path — noted but not patched (see below).

**Conclusion:** every await/timeout on the hot path is already capped well under the 2000ms budget on both sides. I could not find a code-level stall that would reproduce the prior 20–25s max MTO.

## Why the prior 25s figure is not a residual code stall
The forensics note says: *"double `solo matched` ~12s apart, then first offer ~20-25s after earliest match."* That is a **second hub-side `matched` message arriving ~12s after the first** (`bridge/src/simple.rs:4466-4467, 4972` — `start_solo_match` / `"solo matched"` log), i.e. a rematch/thrash event, not a slow offer computed from a single match. The client-side offer-path code above only ever adds sub-1.5s of latency once a `matched` message is actually processed; a 20-25s "first offer" timestamp measured from the *earliest* of two matched events is explained by the rematch gap, not by GUM/mutex/watchdog delay. This is exactly the `drops=3` debounce/thrash pattern the task explicitly hands to **003** ("hand thrash to 003, don't fix thrash inside this ticket") — I did not touch it.

## What changed
- No code changes. Audit-only per task's "patch only if a residual multi-second stall is proven" gate — none was found.

## Files
- (none modified)

## Verify ran
- `./scripts/hub-match-speed.sh 60 2000` (read-only SSH grep of `journalctl -u roulette-bridge`) → **IDLE**, 0 matches in last 60 min, confirms task's "hub idle" note and that no live MTO data exists to sample right now.
- Static trace of every await/setTimeout on the offerer paths in `ui/live.js`, `ui/webrtc.js`, `mobile/src/media/MediaSession.ts`, `mobile/app/live.tsx` (see Audit above) — no path exceeds ~1.3s worst case.
- No `tsc`/build run — no files were changed.

## Connect risk
safe to merge after smoke — no diff to review beyond Grok's already-landed `0d61dbb`.

## Handoff for morning
- merge branch: nothing new from this ticket to merge (Grok's `0d61dbb` is already on `main`/this branch).
- smoke: run `./scripts/hub-match-speed.sh 30` **after** a real Play↔PC pairing (script reports `IDLE` with zero traffic, as it did here). Target: max `match_to_offer_ms` < 2000.
- One-step device-only follow-up I can't finish here: confirm on live traffic that MTO is now sub-second/low-seconds now that the double-`matched`/rematch (003) issue is separately addressed — if 003 lands and MTO is still high, re-open this ticket with fresh forensics.
- do not: deploy without Play↔PC check; do not fold 003's rematch-debounce fix into this ticket.
