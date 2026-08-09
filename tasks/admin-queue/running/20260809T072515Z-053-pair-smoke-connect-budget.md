# Task: pair-smoke — assert connect budgets + CONNECT fields

## Owner
**Claude Code**

## Success
- `scripts/pair-smoke.mjs` after PASS path:
  - log / assert hub `match_to_offer_ms` < 2000 (already partial)
  - if page has `window.__ruletConnect`, log offerMs/answerMs/trackMs
  - soft budget: trackMs < 8000 when present (env `PAIR_SMOKE_TRACK_MS`)
- Keep wire-only offer/answer counts (not localSdp warm noise)
- Doc one-liner in script header

## Files
- `scripts/pair-smoke.mjs`

## Do not
- Change app connect logic
- Require network to production

## Done
RESULT with **COMPLETE**
