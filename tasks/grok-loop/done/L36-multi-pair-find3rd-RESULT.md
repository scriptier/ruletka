# L36 multi-pair find3rd — RESULT

## Status
**COMPLETE** — harness **SCAFFOLD_DONE** (exit 0)  
**Not multi product PASS / not GOAL_MET / not MULTI_PASS**

## OWN
- Run only: `scripts/multi-pair.mjs`
- **No invent multi PASS**
- **No product UI / media / deploy / APK / live.js / adb / force-push**

## Goal
Run `MODE=web2 FIND_THIRD=1 BUDGET_MS=30000` multi-pair scaffold; observe find-third invite/accept/hunt phases honestly; record exit + SUMMARY. web2 only (F22 owns phone).

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
| **When (UTC)** | `2026-08-12T07:59:24Z` → `08:00:14Z` (~50s wall) |
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
| pair_1v1_hint | **yes** — MultiA↔MultiB matched (`matched with MultiB · solo` / `matched with MultiA · solo`); both `pcCount=1`, `iceOk=true`, `frames=true` |
| ICE / frames | **yes** — relay→relay; MultiB first frame ~3.4s (paint); MultiA ~3.7s (rvfc); wave_ok |
| find_third_invite_sent | **yes** — MultiA `btn-match-more` → `btn-find-third` |
| find_third_accept_ui | **yes** — MultiB via `btn-find-third-yes` |
| hunt_ui_hint | **yes** — both: `stageTrio=true`, `stageTrioSearching=true` for remainder of budget |
| multi_pc_hint | **no** (`pcCount` stayed 1) |
| third_tile_hint | **no** (no third peer in web2; hunt `error: not matched` noise expected) |
| multi product PASS / GOAL_MET | **NOT claimed** |
| multi_product_pass | **false** |

## Timeline (selected)
| UTC | Event |
|-----|--------|
| 07:59:24 | chrome boot; mode=web2 peers=2 find_third=1 |
| 07:59:31 | MultiA `#btn-start-match` |
| 07:59:41 | MultiB `#btn-start-match` |
| ~07:59:41 | mutual match + Force Relay + kickSolo |
| ~07:59:44 | ice_connected both; first frames + match connected |
| 07:59:46 | pair_1v1_hint poll (age~3s): iceOk/frames true both |
| 07:59:49 | MultiA find-third invite (`btn-match-more` → `btn-find-third`) |
| 07:59:49 | MultiB accept via `btn-find-third-yes` |
| ~07:59:50 | both: keep PC + `find-third — looking for a 3rd` |
| 07:59:52→08:00:14 | hunt_ui_hint polls; stageTrio/stageTrioSearching true; `error: not matched` (no 3rd peer) |
| 08:00:14 | screenshots + SUMMARY + SCAFFOLD_DONE |

## Screenshots
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiA-1786521614059.png`
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiB-1786521614276.png`

## Notes
- Soft-skip path not hit (Chrome + puppeteer present).
- FIND_THIRD path fully exercised for web2 scaffold: invite + accept + hunt UI observed.
- `multi_pc_hint` / `third_tile_hint` false is **expected** on web2 (only 2 tabs; no real third human).
- Hunt `error: not matched` noise is expected while searching for a 3rd that does not exist in this mode.
- Fake-device media; nsfw fetch TypeError (noise); setParameters InvalidStateError noise.
- Exit 0 always means scaffold complete or soft-skip — **never** multi product PASS.
- Harness `next`: human as 3rd / longer BUDGET / `MODE=web3` or `web2phone` if wanting a third scaffold peer (phone owned by F22 this hop).

## Files touched
- none (verify-only hop)
- Canonical RESULT: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L36-multi-pair-find3rd-RESULT.md`
- Running card moved → done

## Connect risk
**None** — harness run only. No product edits, no ICE thrash config flip, no deploy.

## COMPLETE or BLOCKED
**COMPLETE** — SCAFFOLD_DONE exit 0; boot + pair_1v1 + find_third invite/accept + hunt_ui_hint observed; multi_pc/third_tile **not** observed; **no multi PASS invented**
