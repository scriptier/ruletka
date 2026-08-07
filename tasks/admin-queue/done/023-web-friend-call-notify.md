# Task: P1 — Web friend-call notify when tab not focused

**Priority:** **NEXT after 001b.** Safe non-connect UI. Do **not** start this while `001b-connect-yellow-slow-mto.md` is still pending (hub YELLOW_slow).

**Status note (manager 2026-08-07 ~14:40):** `022` COMPLETE. Branch `admin/…-023-web-friend-call-notify` may exist but product not landed — implement here, don’t re-open 022. Hub is **YELLOW_slow** → **001b first**.

## Goal
When tab is **open but unfocused**, still surface friend-call **Notification** and/or **ringtone**. Document true background/SW push as follow-up (out of scope).

## Context
- Roadmap X3/F3; PARITY_MATRIX biggest functional asymmetry vs Android FCM
- Full service-worker `register_push` is **not** this ticket
- Prefer small handlers; do **not** restructure `ui/live.js` match/WebRTC blocks
- Mobile side already has vibration ring + accept→live nav on `admin/…-022` (not necessarily merged) — web notify is independent

## Scope (only these)
- `ui/live.js` — Notification + focus/visibility handlers for **friend call only** (grep `startIncomingRing`, friend-call / call invite paths; avoid bulk live.js rewrite)
- Optional small `ui/` helper (e.g. `ui/friendCallNotify.js`) if it keeps live.js delta tiny
- `docs/PARITY_MATRIX.md` — note remaining SW-push gap (create/update row only)

## Done criteria
- [ ] Tab open + unfocused → Notification and/or ringtone fires (or evidence already works + tiny polish with file:line)
- [ ] Focused tab: no double-noise (Notification optional when visible)
- [ ] Document: tab fully closed still needs SW push (suggest follow-up task name in RESULT)
- [ ] RESULT: connect risk = **safe** (non-connect UI)
- [ ] No deploy / no push / no merge main
- [ ] RESULT contains **`COMPLETE`**

## Completion promise
Put **`COMPLETE`** in RESULT when done criteria are met.

## Do not
- Full FCM/web-push infrastructure / service worker install
- Solo match / offer / ICE / MediaSession / CONNECTIVITY_LOCK surfaces
- Deploy / push / merge main
- Touch `mobile/` (022 already owns Play ring path)
