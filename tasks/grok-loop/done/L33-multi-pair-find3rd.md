# L33 multi-pair find-3rd scaffold

## Goal
Web multi-pair find-3rd scaffold. **SCAFFOLD_DONE only — not MULTI_PASS.**

## Work
```bash
cd /home/drakosik/freenet-roulette
MODE=web2 FIND_THIRD=1 BUDGET_MS=30000 CHROME=/usr/bin/chromium node scripts/multi-pair.mjs
```
Prefer **web2** (no phone) so **BLUR-F19** holds exclusive phone adb.

## OWN
- `scripts/multi-pair.mjs` run only
- RESULT: `tasks/grok-loop/done/L33-multi-pair-find3rd-RESULT.md`

## Must not
live.js edit, force-push, invent MULTI_PASS, dual phone adb, APK/deploy
