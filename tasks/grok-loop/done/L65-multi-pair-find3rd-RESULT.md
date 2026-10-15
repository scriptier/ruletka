# L65 multi-pair find-3rd RESULT

**Status:** COMPLETE (SCAFFOLD_DONE only)  
**Date:** 2026-08-12  
**Worker:** Grok loop

## Command

```bash
cd /home/drakosik/freenet-roulette
MODE=web2 FIND_THIRD=1 BUDGET_MS=30000 CHROME=/usr/bin/chromium node scripts/multi-pair.mjs
```

## Exit / honesty

| Field | Value |
|-------|--------|
| Exit code | **0** |
| Harness final line | `SCAFFOLD_DONE (not MULTI_PASS)` |
| MULTI_PASS | **No** — not claimed, not invented |
| Product PASS / GOAL_MET | **No** |
| Code edits | **None** (no live.js, no APK, no phone adb) |

**SCAFFOLD_DONE ≠ MULTI_PASS.** Exit 0 only means the harness finished its observation budget without hard boot fail. It does **not** mean multi product works or that a third human joined.

## Observed phases (from SUMMARY)

```json
{
  "mode": "web2",
  "budget_ms": 30000,
  "find_third_enabled": true,
  "observed": {
    "boot": true,
    "pair_1v1_hint": true,
    "find_third_invite_sent": true,
    "find_third_accept_ui": true,
    "hunt_ui_hint": true,
    "multi_pc_hint": false,
    "third_tile_hint": false
  },
  "honesty": "SCAFFOLD_DONE only — not multi product PASS; human faces still required for GOAL_MET",
  "next": "Human: verify 3-way faces if third_tile/multi_pc observed; else re-run longer BUDGET"
}
```

### Timeline (wall clock ~12:06:20 → 12:07:18 UTC slice)

1. **Boot** — MultiA then MultiB chromium contexts; fake media; ICE groups + TURN.
2. **Early churn** — MultiA started first, briefly matched into a party_browse path, then partner left / requeue (`not matched`).
3. **1v1 pair** — Both clicked Start; matched MultiA↔MultiB solo; ICE relay→relay; frames on both (`pair_1v1_hint`, iceOk, frames).
4. **Find-third UI** — MultiA invite via `btn-match-more` → `btn-find-third` (`find_third_invite_sent`); MultiB accepted via `btn-find-third-yes` (`find_third_accept_ui`).
5. **Hunt** — Both entered stageTrio / stageTrioSearching; console “find-third — looking for a 3rd”; phase `hunt_ui_hint` until budget elapsed.
6. **No third** — `multi_pc_hint=false`, `third_tile_hint=false` (expected for web2-only: no third tab/phone; F56 owns phone).

## Screenshots

- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiA-1786536437368.png`
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiB-1786536437672.png`

## Risks / notes

- Hub occasionally logged `error: not matched` during hunt (background noise; pair frames still flowing).
- Stagger meant MultiA alone briefly joined another queue path before MultiB; second match established clean 1v1.
- web2 + FIND_THIRD exercises invite/accept/hunt UI only; third peer would need web3 or web2phone (F56 owns phone — not this card).

## Merge / next

- Nothing to merge (no code changes).
- Card L65 → `done/`.
- Product multi still needs human 3-way faces or a longer MODE=web3 / coordinated phone run — **not** this RESULT’s claim.
