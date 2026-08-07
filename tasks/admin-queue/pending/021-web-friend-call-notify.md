# Task: Web friend-call notify when tab not focused

## Goal
Android rings friend calls via FCM even when killed. Web only fires in-page `Notification` while the tab is open. Implement a **minimal** improvement: when the tab is open but unfocused (or minimized), still surface a visible/audible alert; document true background/SW push as follow-up (not required for this ticket).

## Context
- Source: `docs/PARITY_MATRIX.md` gap #1 (P1) — biggest functional asymmetry
- Play user calling a web friend is the cross-platform pain case
- Full service-worker `register_push` is larger; this ticket is the **small win**

## Scope (only these)
- `ui/live.js` (Notification + focus/visibility handlers for friend call)
- Optional: `ui/` small helper if needed
- `docs/PARITY_MATRIX.md` note what still missing (SW push)

## Done criteria
- [ ] Friend call while tab open but unfocused → Notification and/or ringtone path fires
- [ ] Document remaining gap: tab fully closed still needs SW push (separate task)
- [ ] RESULT with connect risk = safe for non-connect UI
- [ ] No production deploy

## Completion promise
Put `COMPLETE` in RESULT when done criteria are met.

## Do not
- Full FCM/web-push infrastructure unless already half-wired
- Deploy / push / merge main
