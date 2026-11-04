# L21 multi-pair web2 — RESULT

## Status
**COMPLETE** — harness **SCAFFOLD_DONE** (exit 0)  
**Not multi product PASS / not GOAL_MET**  
**multi_product_pass: false**

## OWN
- Run only: `scripts/multi-pair.mjs`
- **No invent multi PASS**
- **No product UI / media / deploy / APK**

## Goal
Re-run multi harness scaffold: `MODE=web2 FIND_THIRD=0 BUDGET_MS=25000` via `scripts/multi-pair.mjs`. Document **SCAFFOLD_DONE** only.

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
| **When (UTC)** | `2026-08-12T03:57:33Z` → `03:58:40Z` (~67s wall) |
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
| **multi_product_pass** | **false** (never emitted) |

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
| pair_1v1_hint | **yes** (harness aggregate) — **not** clean MultiA↔MultiB |
| MultiA match | **yes** — `matched with Драконов · solo` (live human, **not** MultiB) |
| MultiA ICE / frames | **yes** — relay→relay; first frame ~8.8s; wave_ok |
| MultiB match / ICE / frames | **no** — stayed queue UI (`Waiting 1`); `iceOk=false`, `frames=false` through budget |
| find_third_* | **no** (FIND_THIRD=0) |
| hunt_ui / multi_pc / third_tile | **no** |
| multi product PASS / GOAL_MET | **NOT claimed** |
| multi_product_pass | **false** |

### Caveat (pool pollution)
Live matchmaking paired **MultiA** with a real peer (`Драконов`) before **MultiB** finished boot/start. MultiB never joined MultiA. Harness still reports `pair_1v1_hint: true` because MultiA reached `pcCount=1` + ice + frames. This is **scaffold observation only** — not a dual-tab 1v1 product pass and **not** multi GOAL_MET.

## Timeline (selected)
| UTC | Event |
|-----|--------|
| 03:57:34 | chrome boot; mode=web2 peers=2 find_third=0 budget=25000; HONESTY banner |
| 03:57:50 | MultiA `#btn-start-match` |
| ~03:57:52 | MultiA `matched with Драконов · solo` (live human) |
| ~03:58:00 | MultiA first frame + CONNECT relay→relay |
| 03:58:10 | MultiB `#btn-start-match` (too late for MultiA) |
| 03:58:15→03:58:38 | phase polls: MultiA pair_1v1_hint ice/frames ok; MultiB phase label pair_1v1_hint but ice/frames false, body Waiting |
| 03:58:39–40 | screenshots + SUMMARY + SCAFFOLD_DONE |

## Key log lines
```
[multi-pair] chrome=/usr/bin/chromium
[multi-pair] url=https://ruletka.vip/live.html mode=web2 peers=2 budget_ms=25000 find_third=0
[multi-pair] HONESTY: exit 0 ≠ multi product PASS; phases are observations only
[MultiA] matched with Драконов · solo
[multi-pair] … MultiA phase=pair_1v1_hint iceOk=true frames=true
[multi-pair] … MultiB phase=pair_1v1_hint iceOk=false frames=false (Waiting)
SUMMARY {"observed":{"boot":true,"pair_1v1_hint":true,"find_third_invite_sent":false,...}}
[multi-pair] SCAFFOLD_DONE (not MULTI_PASS)
EXIT:0
```

## Screenshots
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiA-1786507118214.png`
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiB-1786507119141.png`

## Optional FIND_THIRD=1 hop
**Skipped** — not cheap this tick: first hop already ~67s wall; pool pollution (live third party) would make find-third observations unreliable. Prior L15 already documented FIND_THIRD=1 SCAFFOLD_DONE with mutual MultiA↔MultiB + invite/accept/hunt.

## Notes
- Soft-skip path not hit (Chrome + puppeteer present).
- FIND_THIRD=0 → pair-only; no invite/accept/hunt UI exercised (expected).
- Fake-device media; nsfw fetch TypeError; `setParameters InvalidStateError` (noise).
- Exit 0 always means scaffold complete or soft-skip — **never** multi product PASS.
- Compared to L14/L18 clean MultiA↔MultiB mutual match: this L21 run is noisier due to live peer; still valid **SCAFFOLD_DONE**.

## Files touched
- none (verify-only hop)
- RESULT: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L21-multi-pair-web2-RESULT.md`
- Job card moved: `running/L21-multi-pair-web2.md` → `done/L21-multi-pair-web2.md`

## Connect risk
**None** — harness run only. No product edits, no ICE thrash config flip, no deploy, no APK/adb.

## COMPLETE or BLOCKED
**COMPLETE** — SCAFFOLD_DONE exit 0; boot + pair_1v1_hint **observed**; **not MULTI_PASS**; **not multi GOAL_MET**; **no invent multi product PASS**
