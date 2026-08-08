# Task: P0 — Fix slow match→offer (Play↔PC) — FOLLOW-UP

> **Grok already landed a first-pass speed fix** (see `tasks/admin-queue/done/20260807T103500Z-001-connect-speed-GROK-RESULT.md`).
> kickSolo GUM 900ms cap, watchdogs, warm-PC offer, mobile GUM race / promote.
> Your job: **verify residual multi-second stalls**, minimal extra fix only if still needed, RESULT with smoke notes.

**Priority:** MUST — last non-idle hub was `YELLOW_slow` (max MTO **25000ms**). Do this first.
**Hub now:** `idle` (0 matches overnight) — do **not** wait for live hub; audit code + prior log pattern.

## Goal
Cut **match → first offer** from ~25s (last forensics max) to **&lt; 2000ms** (ideally &lt;1000ms with warm cam) per `docs/CONNECTIVITY_LOCK.md`.

Offers ≈ answers already — the path works; **latency** is the bug.

## Hub snapshot (last non-idle forensics)
- `ADMIN_HUB_VERDICT=YELLOW_slow` (sample before idle)
- max `match_to_offer` **25000ms** (`timestamp_delta`)
- Pattern: double `solo matched` ~12s apart, then first offer ~20–25s after earliest match
- drops=3 (debounce ages ~0.8–4s) — hand thrash to **003**, don’t fix thrash inside this ticket
- `force_relay=false` (lock OK) — do not flip

## Work order (strict)
1. **Read** Grok RESULT + diff touch points: `ui/live.js` kickSolo, `ui/webrtc.js` watchdogs, `mobile/.../MediaSession.ts` GUM race
2. **Audit** remaining delays with **file:line** (modal dismiss, rematch, offerer selection, cold GUM)
3. **Patch only if** a residual multi-second stall is proven; else RESULT “Grok fix sufficient pending human smoke”
4. **Do not** thrash 002/003/004 scope into this RESULT — file handoffs

## Hypotheses to check (in order)
1. Browser cam/GUM not warm before match → createOffer waits on getUserMedia (Grok capped 900ms — still blocked elsewhere?)
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
- [ ] Root cause **or** residual-stall audit with **file:line** in RESULT
- [ ] Minimal fix **or** precise “already fixed by Grok; smoke-only” handoff
- [ ] How to verify: `./scripts/hub-match-speed.sh 30` (target max MTO &lt; 2000)
- [ ] RESULT states connect risk + whether APK rebuild needed
- [ ] No deploy / no push / no coturn changes

## Completion promise
Put **`COMPLETE`** in RESULT when a minimal fix landed **or** root cause is proven with a one-step handoff Claude cannot finish (human/device only).

## Do not
- Rewrite whole WebRTC stack
- Always-on `force_relay`, docker coturn, double-offer thrash
- Production deploy / push / merge main
