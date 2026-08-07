# Task: P0 — Reduce second-offer thrash

**Priority:** MUST — hub shows **offer dropped: debounce** (age ~0.8s and ~4s).

## Goal
Stop clients from sending a **second non-restart offer** within hub’s **~8s** debounce window. Keep single-offer lock; preserve **iceRestart after 15s grace**.

## Hub evidence
- Sample drops: `age_ms=787`, `790`, `4005` after a successful offer+answer
- Pattern: first offer+answer OK, then second offer within 1s (client bug) or ~4s
- Prefer **client** fix; hub debounce is already the safety net

## Scope (only these)
- `ui/webrtc.js` — double-offer guards, `callGen`, post-answer re-offer, 12s browser re-offer ignore
- `mobile/src/media/MediaSession.ts` — `offerSent` / watchdog / promote creating extra offers
- Do **not** change hub debounce constants unless RESULT proves client cannot fix

## Done criteria
- [ ] Source of second offer identified (**file:line**, which client)
- [ ] Minimal guard if safe (callGen / offerSent / ignore re-offer)
- [ ] iceRestart after 15s still possible (document how)
- [ ] RESULT: connect risk
- [ ] No deploy / no push

## Completion promise
Put **`COMPLETE`** in RESULT when source is fixed or fully documented with a one-line residual risk.

## Do not
- Remove hub debounce
- Always-on force_relay
- Deploy / push / merge main
