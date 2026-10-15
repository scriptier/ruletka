# L22 multi-pair find-3rd scaffold

## Goal
Harness observe-only: MODE=web2 FIND_THIRD=1 via `scripts/multi-pair.mjs`. SCAFFOLD_DONE only — never MULTI_PASS.

## OWN
- Run only `scripts/multi-pair.mjs`
- RESULT: `tasks/grok-loop/done/L22-multi-pair-find3rd-RESULT.md`

## Work
1. Prior L15 find3rd RESULT for flags
2. `MODE=web2 FIND_THIRD=1 BUDGET_MS=30000 node scripts/multi-pair.mjs` (adjust CHROME if needed)
3. Capture exit, hunt_ui_hint, multi_product_pass:false
4. RESULT + move card done

## Must not
- Invent multi product PASS / GOAL_MET
- Edit live.js, adb phone, deploy, force-push

## Factory
Director tick · multi backlog
