# L31 multi-pair find-3rd — RESULT

## Status
**COMPLETE** — harness **SCAFFOLD_DONE** (exit 0)  
**Not multi product PASS / not GOAL_MET / not MULTI_PASS**  
**multi_product_pass: false**

## OWN
- Run only: `scripts/multi-pair.mjs`
- **No invent multi PASS**
- **No product UI / media / deploy / APK / live.js / adb / force-push**
- web2 only (no dual phone; F17 holds phone)

## Goal
Run `MODE=web2 FIND_THIRD=1 BUDGET_MS=30000` multi-pair scaffold; observe find-third invite/accept/hunt phases honestly; record exit + SUMMARY.

## Command
```bash
cd /home/drakosik/freenet-roulette
MODE=web2 FIND_THIRD=1 BUDGET_MS=30000 CHROME=/usr/bin/chromium \
  node scripts/multi-pair.mjs
# EXIT:0
# [multi-pair] SCAFFOLD_DONE (not MULTI_PASS)
```

| Field | Value |
|-------|--------|
| **When (UTC)** | `2026-08-12T07:06:32Z` → `07:07:27Z` (~55s wall) |
| **HEAD** | `a0d195d` |
| **Root** | `/home/drakosik/freenet-roulette` |
| **URL** | `https://ruletka.vip/live.html` |
| **MODE** | `web2` |
| **FIND_THIRD** | `1` |
| **BUDGET_MS** | `30000` |
| **CHROME** | `/usr/bin/chromium` (present — soft-skip **not** used) |
| **peers** | 2 (MultiA, MultiB) — no third tab (web2) |
| **Exit code** | **0** |
| **Harness status** | **SCAFFOLD_DONE (not MULTI_PASS)** |
| **multi_product_pass** | **false** (never emitted) |

## Observed SUMMARY (honest)

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

### Phase table
| Signal | Result |
|--------|--------|
| boot | **yes** |
| pair_1v1_hint | **yes** — both: `pcCount=1`, `iceOk=true`, `frames=true` |
| MultiA↔MultiB matched | **yes** — after requeue: `matched with MultiB · solo` / `matched with MultiA · solo` |
| ICE / frames | **yes** — relay→relay; MultiB first frame ~2.8s; MultiA ~3.0s; wave_ok through budget |
| find_third_invite_sent | **yes** — MultiA `btn-match-more` → `btn-find-third` (~07:07:02) |
| find_third_accept_ui | **yes** — MultiB via `btn-find-third-yes` (~07:07:03) |
| hunt_ui_hint | **yes** — both: `stageTrio=true`, `stageTrioSearching=true` from ~age 9953ms through budget end; log: `find-third — looking for a 3rd` |
| multi_pc_hint | **no** (`pcCount` stayed 1) |
| third_tile_hint | **no** (no third peer in web2; hunt `error: not matched` noise expected) |
| multi product PASS / GOAL_MET | **NOT claimed** |
| multi_product_pass | **false** |

## Timeline (selected)
| UTC | Event |
|-----|--------|
| 07:06:32 | chrome boot; mode=web2 peers=2 find_third=1 |
| 07:06:41 | MultiA `#btn-start-match` |
| ~07:06:42 | MultiA briefly matched `MultiB+MultiA · party_browse` then partner left / requeue (stagger race) |
| 07:06:53 | MultiB `#btn-start-match` |
| ~07:06:54 | mutual match + kickSolo / offer path (solo) |
| ~07:06:56 | ice connected + first frames both sides |
| 07:06:59 | pair_1v1_hint polls; iceOk/frames true both |
| 07:07:02 | MultiA find-third invite (`btn-find-third`) |
| 07:07:03 | MultiB accept (`btn-find-third-yes`); both enter looking-for-3rd |
| 07:07:06→07:07:27 | hunt_ui_hint stable; stageTrio + stageTrioSearching; pcCount=1; frames stay ok |
| 07:07:27 | screenshots + SUMMARY + SCAFFOLD_DONE |

## Screenshots
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiA-1786518447287.png`
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiB-1786518447515.png`

## Notes
- Soft-skip path not hit (Chrome + puppeteer present).
- Stronger than L26 (same MODE/FIND_THIRD/BUDGET 30s): L26 had dark ICE / no invite; this hop had **media pair + invite + accept + hunt_ui**.
- Similar to L22 find3rd (same observed phase set: invite/accept/hunt yes; multi_pc/third_tile no).
- Early MultiA start matched a phantom party_browse then requeued — stagger artifact; stable 1v1 after MultiB start.
- During hunt: `error: not matched` noise expected (no third web peer in web2).
- Fake-device media; nsfw fetch TypeError (noise); occasional setParameters InvalidStateError (noise).
- Exit 0 always means scaffold complete or soft-skip — **never** multi product PASS.
- Harness `next`: human as 3rd for 3-way faces, or `MODE=web3` / longer BUDGET if wanting third scaffold peer. No adb (F17 phone lane).

## Files touched
- none (verify-only hop)
- Canonical RESULT: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L31-multi-pair-find3rd-RESULT.md`
- Running card moved → done

## Connect risk
**None** — harness run only. No product edits, no live.js, no ICE thrash config flip, no deploy, no force-push, no dual phone adb.

## COMPLETE or BLOCKED
**COMPLETE** — SCAFFOLD_DONE exit 0; boot + pair_1v1 + find_third invite/accept + hunt_ui_hint observed; multi_pc/third_tile **not** observed (web2); **no multi PASS invented**
