# Task: P2 — Chat + typing + gifts parity audit (Play vs browser)

**Priority:** NICE — only if P0/P1 done.

## Goal
Confirm chat, typing indicator, and all gift effects work on Play same as web. Fix **only real gaps** (missing effect, wrong cost, typing not sent).

## Scope (only these)
- `mobile/src/stars/gifts.ts`, gift FX components
- `mobile/app/live.tsx` — chat/typing only
- Compare to web gift list in `docs/PARITY_MATRIX.md`

## Done criteria
- [ ] Matrix row update if needed
- [ ] Fix gaps or RESULT “no gaps” with evidence
- [ ] No deploy / no push

## Completion promise
Put **`COMPLETE`** in RESULT when audit finished and gaps fixed or documented.

## Do not
- New gift economy / pricing redesign
- Deploy / push / merge main
