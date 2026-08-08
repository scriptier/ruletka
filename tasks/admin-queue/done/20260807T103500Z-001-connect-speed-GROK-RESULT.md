# RESULT: 001-connect-slow-offer (partial — Grok pre-Claude)

## Status
PARTIAL

## What changed (committed on main)
- `ui/live.js` kickSolo: GUM 900ms cap, keep mid-offer PC, force offer if live PC never offered
- `ui/webrtc.js`: answerer promote 280ms, offerer watchdog 500ms
- `mobile/src/media/MediaSession.ts`: offerer GUM race 700ms, promote 250ms

## Why
Hub YELLOW_slow ~25s MTO. Goal &lt;2s with warm cam.

## Still for Claude overnight
- Audit remaining delays (modal dismiss, rematch thrash, platform offerer selection)
- Verify no double-offer regression
- Run hub-match-speed after smoke

## Connect risk
smoke-then-merge — small targeted changes; do not deploy without Play↔PC smoke

## Completion promise
(not COMPLETE — needs device smoke)
