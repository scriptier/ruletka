# RESULT 023 — Web friend-call notify (tab unfocused)

**Status:** COMPLETE  
**Connect risk:** safe (non-connect UI)  
**By:** Grok (Claude rate-limited earlier)

## What changed
- `pageIsBackgrounded()` — hidden tab OR unfocused window
- Ring loop re-notifies OS Notification when backgrounded
- Title flash only while backgrounded
- `visibilitychange` / `blur` / `focus` handlers: re-notify on leave, focus Answer on return
- Permission grant path uses `pageIsBackgrounded()` (not only `visibilityState !== visible`)

## Files
- `ui/live.js`
- `docs/PARITY_MATRIX.md` (remaining SW gap)

## Follow-up
- `039-web-push-sw-friend-call` — true background when tab closed

## Do not
- Deploy owned by Grok; human smoke: open live, opt-in friend alerts, switch tab, receive friend call.
