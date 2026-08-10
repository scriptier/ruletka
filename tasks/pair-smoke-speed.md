# Claude task: automated pair smoke (speed + 1 offer)

## Goal
Script that proves two clients match and exchange **exactly 1 offer + 1 answer** within a time budget.

## Preferred approach
1. Two headless Chromium tabs against `https://ruletka.vip/live.html` (fake media devices), OR
2. Extend `scripts/pair-test-headless.mjs` with:
   - assert hub-visible timing if possible
   - console log scrape for offer sent
   - fail if second offer within 5s
   - timeout 20s for first remote track

## Also acceptable
- Local unit tests that lock MediaSession single-offer + offerer promote timing
- Plus a documented manual hub grep for `match_to_offer_ms`

## Rules
- Local only; no production deploy
- Do not break CONNECTIVITY_LOCK rules
- Prefer adding `scripts/pair-smoke.mjs` + short `docs/DEVICE_SMOKE.md` section

## Done when
- `node scripts/pair-smoke.mjs` (or documented command) exits 0 on a happy path or clearly skips if no Chrome
- `tasks/pair-smoke-speed-RESULT.md` explains how to run + sample output

Work under `/home/drakosik/freenet-roulette`.
