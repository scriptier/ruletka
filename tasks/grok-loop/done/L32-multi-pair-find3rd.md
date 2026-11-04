# L32 multi-pair find-3rd scaffold

## Goal
Web multi-pair find-3rd scaffold recheck. **SCAFFOLD_DONE only — not MULTI_PASS.** No invent multi product PASS.

## Work
```bash
MODE=web2 FIND_THIRD=1 BUDGET_MS=30000 CHROME=/usr/bin/chromium node scripts/multi-pair.mjs
```
Record metrics/honesty from harness. Prefer **web2** (no phone) so **BLUR-F18** can hold exclusive phone adb.

## OWN
- `scripts/multi-pair.mjs` run only (no product edits)
- Artifacts optional under `mobile/artifacts/device-smoke/l32-multi/` or harness default
- RESULT: `tasks/grok-loop/done/L32-multi-pair-find3rd-RESULT.md`

## Must not
live.js edit, force-push, invent MULTI_PASS, dual phone adb (F18 owns phone), APK/deploy
