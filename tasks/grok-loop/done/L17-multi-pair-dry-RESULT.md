# L17 multi-pair dry — RESULT

## Status
**COMPLETE** — harness **SCAFFOLD_DONE** (exit 0)  
**Not multi product PASS / not GOAL_MET**  
**multi_product_pass: false**

## OWN
- Run only: `scripts/multi-pair.mjs`
- **No invent multi PASS**
- **No product UI / media / deploy / APK**

## Goal
Dry `MODE=web2 FIND_THIRD=0 BUDGET_MS=25000` multi-pair scaffold; record exit + observed phases. Soft skip ok if chrome missing.

## Command
```bash
cd /home/drakosik/freenet-roulette
MODE=web2 FIND_THIRD=0 BUDGET_MS=25000 CHROME=/usr/bin/chromium \
  node scripts/multi-pair.mjs
# EXIT:0
# [multi-pair] SCAFFOLD_DONE (not MULTI_PASS)
```

| Field | Value |
|-------|--------|
| **When (UTC)** | `2026-08-12T03:46:48Z` → `03:47:44Z` (~56s wall) |
| **HEAD** | `a0d195d` |
| **Root** | `/home/drakosik/freenet-roulette` |
| **URL** | `https://ruletka.vip/live.html` |
| **MODE** | `web2` |
| **FIND_THIRD** | `0` |
| **BUDGET_MS** | `25000` |
| **CHROME** | `/usr/bin/chromium` (present — soft-skip **not** used) |
| **peers** | 2 (MultiA, MultiB) |
| **Exit code** | **0** |
| **Harness status** | **SCAFFOLD_DONE (not MULTI_PASS)** |
| **multi_product_pass** | **false** |

## Observed SUMMARY (honest)

```json
{
  "mode": "web2",
  "budget_ms": 25000,
  "find_third_enabled": false,
  "observed": {
    "boot": true,
    "pair_1v1_hint": true,
    "find_third_invite_sent": false,
    "find_third_accept_ui": false,
    "hunt_ui_hint": false,
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
| pair_1v1_hint | **yes** (both tabs: `pcCount=1`, `iceOk=true`, `frames=true` by age≈9s+) |
| MultiA↔MultiB matched | **yes** — `matched with MultiB · solo` / `matched with MultiA · solo` |
| ICE / frames | **yes** — relay→relay; first frame ~8.2–8.3s; wave_ok through ~12s+ |
| find_third_* | **no** (FIND_THIRD=0) |
| hunt_ui / multi_pc / third_tile | **no** |
| multi product PASS / GOAL_MET / MULTI_PASS | **NOT claimed** |

## Timeline (selected)
| UTC | Event |
|-----|--------|
| 03:46:48 | chrome boot; mode=web2 peers=2 find_third=0 budget=25000; HONESTY banner |
| 03:47:01 | MultiA `#btn-start-match` |
| 03:47:14 | MultiB `#btn-start-match` |
| ~03:47:15–25 | mutual match + Force Relay + ICE; first frames ~8.2s; pair_1v1_hint |
| 03:47:19→03:47:42 | phase polls stay `pair_1v1_hint` (budget); no find-third path |
| 03:47:43–44 | screenshots + SUMMARY + `SCAFFOLD_DONE (not MULTI_PASS)` |

## Screenshots
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiA-1786506462681.png`
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiB-1786506463508.png`

## Notes
- Soft-skip path not hit (Chrome + puppeteer present).
- Early poll (age≈3.5s) had `iceOk=false` / `frames=false` while body said “In a call”; later polls recovered ice+frames — observation timing only.
- Fake-device media; nsfw `TypeError: Failed to fetch` (noise).
- Exit 0 always means scaffold complete or soft-skip — **never** multi product PASS.
- **multi_product_pass: false** even though exit 0 and 1v1 frames observed.

## Files touched
- none (verify-only hop)
- RESULT: `tasks/grok-loop/done/L17-multi-pair-dry-RESULT.md`
- Card moved: `tasks/grok-loop/running/L17-multi-pair-dry.md` → `tasks/grok-loop/done/L17-multi-pair-dry.md`

## Connect risk
**None** — harness run only. No product edits, no ICE thrash config flip, no deploy.

## COMPLETE or BLOCKED
**COMPLETE** — SCAFFOLD_DONE exit 0; **no multi PASS invented**; multi_product_pass:false
