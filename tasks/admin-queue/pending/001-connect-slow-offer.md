# Task: P0 — Fix slow match→offer (Play↔PC)

**Priority:** MUST — hub `YELLOW_slow` (manager 2026-08-07). Do this first.

## Goal
Cut **match → first offer** from ~25s (hub max) to **&lt; 2000ms** (ideally &lt;1000ms with warm cam) per `docs/CONNECTIVITY_LOCK.md`.

Offers ≈ answers already — the path works; **latency** is the bug.

## Hub snapshot (last forensics)
- `ADMIN_HUB_VERDICT=YELLOW_slow`
- max `match_to_offer` **25000ms** (`timestamp_delta`)
- offers=5 answers=5 drops=3 slow=1 (sample window)
- Typical log pattern: double `solo matched` ~12s apart, then first offer ~20–25s after earliest match
- `force_relay=false` (lock OK) — do not flip

## Hypotheses to check (in order)
1. Browser cam/GUM not warm before match → createOffer waits on getUserMedia
2. `kickSoloWebRtc` / `handleMatched` deferred behind UI/modal
3. Mutex / single-flight on `startCall` / offer path serializes too long
4. Phone promoted to offerer late when web silent (pair with 002/004)
5. Log-only if fix too risky overnight

## Scope (prefer only these)
- `ui/live.js` — `kickSoloWebRtc`, `handleMatched`, startPreview / warm path
- `ui/webrtc.js` — connect, offer watchdog, createOffer path
- `mobile/src/media/MediaSession.ts`, `mobile/app/live.tsx` — only if phone is offerer / startCall timing
- Optional: timestamps in console / hub-visible only

## Done criteria
- [ ] Root cause with **file:line** in RESULT
- [ ] Minimal fix **or** precise handoff if blocked (no drive-by refactors)
- [ ] How to verify: `./scripts/hub-match-speed.sh 30` (target max MTO &lt; 2000)
- [ ] RESULT states connect risk + whether APK rebuild needed
- [ ] No deploy / no push / no coturn changes

## Completion promise
Put **`COMPLETE`** in RESULT when a minimal fix landed **or** root cause is proven with a one-step handoff Claude cannot finish (human/device only).

## Do not
- Rewrite whole WebRTC stack
- Always-on `force_relay`, docker coturn, double-offer thrash
- Production deploy / push / merge main
