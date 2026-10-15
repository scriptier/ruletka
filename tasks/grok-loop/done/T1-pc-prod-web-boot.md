# T1 PC prod live.html boot smoke (headless Chromium)

## Goal
Boot https://ruletka.vip/live.html or local ui with Chromium; confirm live.js?v= loads / age gate / Start exists. Soft FAIL ok if prod lag vs disk 561.

## OWN
- RESULT + optional node scripts/phone-web-pair.mjs with short BUDGET_MS=25000 WITHOUT claiming match
- Or scripts/prod-pair-media.mjs if better for boot-only
- Prefer **do not** fight phone agent for match queue long — use BUDGET_MS=20000

## Work
1. Find Chrome; run phone-web-pair or minimal puppeteer boot
2. Note URL, live.js version from network or page if visible, errors
3. RESULT COMPLETE

## Must not
Long thrash match queue against phone exclusive agent; deploy
