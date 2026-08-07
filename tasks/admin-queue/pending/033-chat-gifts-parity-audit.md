# Task: P2 — Chat + typing + gifts parity audit (Play vs browser)

## Goal
Confirm chat, typing indicator, and all 8 gift effects work on Play the same as web. Fix only real gaps (missing effect, wrong cost, typing not sent).

## Scope
- `mobile/src/stars/gifts.ts`, gift FX components
- `mobile/app/live.tsx` chat/typing
- Compare to web gift list in PARITY_MATRIX

## Done criteria
- [ ] Matrix row update if needed
- [ ] Fix gaps or RESULT "no gaps"
- [ ] No deploy
