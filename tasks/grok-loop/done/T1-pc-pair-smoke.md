# T1 PC browser pair-smoke (web↔web local)

## Goal
Run `node scripts/pair-smoke.mjs` with Chromium — prove wire offer/answer + track budgets.

## OWN
- scripts/pair-smoke.mjs execution + RESULT only (no product code unless script crash fix tiny)

## Work
1. `export CHROME=/usr/bin/chromium` (or google-chrome)
2. `cd /home/drakosik/freenet-roulette && node scripts/pair-smoke.mjs` (or with PAIR_SMOKE_REMATCH=1)
3. If SKIP (no bridge): try cargo build bridge release only if cheap <3min; else RESULT BLOCKED with reason
4. Paste budgets mto/mta/track; exit code

## Done
RESULT tasks/grok-loop/done/T1-pc-pair-smoke-RESULT.md COMPLETE

## Must not
Phone adb (other agent owns phone), deploy, pool thrash
