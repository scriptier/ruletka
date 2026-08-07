# Task: P1 — Web friend-call notify when tab not focused

**Priority:** SHOULD after 022 (was 021; renumbered so Play ring/background land first).

## Goal
When tab is **open but unfocused**, still surface friend-call Notification and/or ringtone. Document true background/SW push as follow-up (out of scope).

## Context
- PARITY_MATRIX: biggest functional asymmetry vs Android FCM
- Full service-worker `register_push` is **not** this ticket

## Scope (only these)
- `ui/live.js` — Notification + focus/visibility handlers for friend call
- Optional small `ui/` helper
- `docs/PARITY_MATRIX.md` — note remaining SW-push gap

## Done criteria
- [ ] Tab open + unfocused → Notification and/or ringtone fires
- [ ] Document: tab fully closed still needs SW push (separate task)
- [ ] RESULT: connect risk = safe (non-connect UI)
- [ ] No deploy / no push

## Completion promise
Put **`COMPLETE`** in RESULT when done criteria are met.

## Do not
- Full FCM/web-push infrastructure
- Deploy / push / merge main
