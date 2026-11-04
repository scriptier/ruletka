# L22 multi-pair find-3rd — RESULT

## Status
**COMPLETE** — harness **SCAFFOLD_DONE** (exit 0)  
**Not multi product PASS / not GOAL_MET**  
**multi_product_pass: false**

## OWN
- Run only: `scripts/multi-pair.mjs`
- **No invent multi PASS**
- **No product UI / media / deploy / APK**

## Goal
Harness observe-only: `MODE=web2 FIND_THIRD=1 BUDGET_MS=30000` via `scripts/multi-pair.mjs`. Document **SCAFFOLD_DONE** only.

## Prior flags (L15 find3rd)
From `L15-multi-pair-find3rd-RESULT.md`: `MODE=web2 FIND_THIRD=1 CHROME=/usr/bin/chromium`; L15 used `BUDGET_MS=60000`. This L22 hop uses job-specified **`BUDGET_MS=30000`**.

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
| **When (UTC)** | `2026-08-12T04:36:09Z` → `04:37:18Z` (~69s wall) |
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
| pair_1v1_hint | **yes** (both tabs: `pcCount=1`, `iceOk=true`, `frames=true`) |
| MultiA↔MultiB matched | **yes** — `matched with MultiB · solo` / `matched with MultiA · solo` |
| ICE / frames | **yes** — relay→relay; first frame ~6.3–6.4s; wave_ok |
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
| 04:36:11 | chrome boot; mode=web2 peers=2 find_third=1 budget=30000; HONESTY banner |
| 04:36:24 | MultiA `#btn-start-match` |
| 04:36:38 | MultiB `#btn-start-match` |
| ~04:36:39 | mutual match MultiA↔MultiB + kickSolo |
| ~04:36:45 | ICE connected relay→relay; first frames ~6.3–6.4s |
| 04:36:48 | phase poll: both `pair_1v1_hint` ice/frames true |
| 04:36:52 | MultiA find-third invite (`btn-find-third`) |
| 04:36:53 | MultiB accept (`btn-find-third-yes`); both “looking for a 3rd” |
| 04:36:56→04:37:16 | hunt_ui_hint polls; `stageTrioSearching=true`; no third; `not matched` log noise |
| 04:37:16–17 | screenshots + SUMMARY + SCAFFOLD_DONE |

## Key log lines
```
[multi-pair] chrome=/usr/bin/chromium
[multi-pair] url=https://ruletka.vip/live.html mode=web2 peers=2 budget_ms=30000 find_third=1
[multi-pair] HONESTY: exit 0 ≠ multi product PASS; phases are observations only
[MultiB] matched with MultiA · solo
[MultiA] matched with MultiB · solo
[multi-pair] MultiA find-third invite attempt {"clicked":"btn-find-third",...}
[multi-pair] MultiB find-third accept via btn-find-third-yes
[multi-pair] … phase=hunt_ui_hint … stageTrio=true stageTrioSearching=true
SUMMARY {"observed":{"boot":true,"pair_1v1_hint":true,"find_third_invite_sent":true,"find_third_accept_ui":true,"hunt_ui_hint":true,"multi_pc_hint":false,"third_tile_hint":false},...}
[multi-pair] SCAFFOLD_DONE (not MULTI_PASS)
EXIT:0
```

## Screenshots
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiA-1786509436156.png`
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiB-1786509436874.png`

## Notes
- Soft-skip path not hit (Chrome + puppeteer present).
- FIND_THIRD path exercised end-to-end at UI level: invite → accept → hunt stage.
- Clean MultiA↔MultiB mutual pair (unlike L21 pool-pollution with live human).
- No third human/tab joined (MODE=web2 only) → **no** multi_pc / third_tile; expected for scaffold, not a product FAIL claim.
- Fake-device media; nsfw fetch TypeError; occasional `setParameters InvalidStateError` (noise).
- Exit 0 always means scaffold complete or soft-skip — **never** multi product PASS.
- **SCAFFOLD_DONE only · not MULTI_PASS · multi_product_pass: false**

## Files touched
- none (verify-only hop)
- RESULT: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L22-multi-pair-find3rd-RESULT.md`
- Job card moved: `running/L22-multi-pair-find3rd.md` → `done/L22-multi-pair-find3rd.md`

## Connect risk
**None** — harness run only. No product edits, no ICE thrash config flip, no deploy.

## COMPLETE or BLOCKED
**COMPLETE** — SCAFFOLD_DONE exit 0; find-third invite/accept/hunt **observed**; **no multi PASS invented**
