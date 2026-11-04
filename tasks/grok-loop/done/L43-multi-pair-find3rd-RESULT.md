# L43 multi-pair find-3rd — RESULT

## Status
**COMPLETE** — harness **SCAFFOLD_DONE** (exit 0)  
**Not multi product PASS / not GOAL_MET**  
**multi_product_pass: false**

## OWN
- Run only: `scripts/multi-pair.mjs`
- **No invent multi PASS**
- **No product UI / media / deploy / APK / live.js / phone adb**

## Goal
Harness observe-only: `MODE=web2 FIND_THIRD=1 BUDGET_MS=30000` via `scripts/multi-pair.mjs`. Document **SCAFFOLD_DONE** only. web2 only (F29 owns phone).

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
| **When (UTC)** | `2026-08-12T09:06:34Z` → `09:07:51Z` (~77s wall) |
| **HEAD** | `a0d195d` |
| **Root** | `/home/drakosik/freenet-roulette` |
| **URL** | `https://ruletka.vip/live.html` |
| **MODE** | `web2` |
| **FIND_THIRD** | `1` |
| **BUDGET_MS** | `30000` |
| **CHROME** | `/usr/bin/chromium` (present — soft-skip **not** used) |
| **peers** | 2 (MultiA, MultiB) — no third tab (web2); no phone adb |
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
    "find_third_accept_ui": false,
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
| pair_1v1_hint | **yes** (both tabs early: `pcCount=1`, `iceOk=true`, `frames=true`) |
| MultiA match log | `matched with MultiA · solo` (self-label in log; still 1v1 PC) |
| MultiB match log | `matched with MultiB · solo` (self-label in log; still 1v1 PC) |
| ICE / frames | **yes** early — MultiA first frame ~13.1s; MultiB ~4.1s; relay→relay; wave_ok |
| find_third_invite_sent | **yes** — MultiA `btn-match-more` → `btn-find-third` |
| find_third_accept_ui | **no** — MultiB never hit accept (`btn-find-third-yes`); stayed `pair_1v1_hint` until leave |
| hunt_ui_hint | **yes** — MultiA only: `stageTrio=true`, `stageTrioSearching=true` for remainder of budget |
| multi_pc_hint | **no** (`pcCount` stayed 1) |
| third_tile_hint | **no** (no third peer in web2; hunt `error: not matched` noise expected) |
| partner churn late | MultiB left ~28s (`Last call: Relay · OK · 0:28` → requeue); MultiA `party partner left` |
| multi product PASS / GOAL_MET | **NOT claimed** |
| multi_product_pass | **false** |

## Timeline (selected)
| UTC | Event |
|-----|--------|
| 09:06:34 | chrome boot; mode=web2 peers=2 find_third=1 budget=30000; HONESTY banner |
| 09:06:56 | MultiA `#btn-start-match` |
| ~09:06:56 | MultiA `matched with MultiA · solo` + kickSolo |
| ~09:07:09 | MultiA ICE connected relay→relay; first frame ~13.1s |
| 09:07:15 | MultiB `#btn-start-match` |
| ~09:07:16 | MultiB `matched with MultiB · solo` + kickSolo |
| ~09:07:19 | MultiB ICE + first frame ~4.1s |
| 09:07:21 | phase poll: both `pair_1v1_hint` ice/frames true |
| 09:07:24 | MultiA find-third invite (`btn-find-third`); MultiA “looking for a 3rd” |
| 09:07:31→09:07:44 | MultiA `hunt_ui_hint` (`stageTrioSearching=true`); MultiB still `pair_1v1_hint` (no accept) |
| ~09:07:45 | MultiB leaves call (~28s); MultiA `party partner left`; MultiB requeue |
| 09:07:47–50 | late polls: MultiA still hunt; MultiB ice/frames false after leave |
| 09:07:50–51 | screenshots + SUMMARY + SCAFFOLD_DONE |

## Key log lines
```
[multi-pair] chrome=/usr/bin/chromium
[multi-pair] url=https://ruletka.vip/live.html mode=web2 peers=2 budget_ms=30000 find_third=1
[multi-pair] HONESTY: exit 0 ≠ multi product PASS; phases are observations only
[MultiA] matched with MultiA · solo
[MultiB] matched with MultiB · solo
[multi-pair] MultiA find-third invite attempt {"clicked":"btn-find-third",...}
[MultiA] find-third invite sent — waiting / looking for a 3rd
[multi-pair] … MultiA phase=hunt_ui_hint stageTrio=true stageTrioSearching=true
[multi-pair] … MultiB phase=pair_1v1_hint (no accept_ui)
[MultiB] Last call: Relay · OK · 0:28
[MultiA] party partner left
SUMMARY {"observed":{"boot":true,"pair_1v1_hint":true,"find_third_invite_sent":true,"find_third_accept_ui":false,"hunt_ui_hint":true,"multi_pc_hint":false,"third_tile_hint":false},...}
[multi-pair] SCAFFOLD_DONE (not MULTI_PASS)
EXIT:0
```

## Screenshots
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiA-1786525670603.png`
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiB-1786525670891.png`

## Notes
- Soft-skip path not hit (Chrome + puppeteer present).
- FIND_THIRD path partially exercised: invite → MultiA hunt stage; **accept_ui false** this run (vs L42 true).
- Pair early windows had ice+frames on both; MultiB later left (~28s) while MultiA still hunting → expected soft churn for web2-only scaffold, not a product FAIL claim.
- Match labels logged as self-solo (`matched with MultiA/MultiB · solo`); harness still recorded mutual `pair_1v1_hint` phases with frames — not used as multi PASS evidence.
- No third human/tab joined (MODE=web2 only) → **no** multi_pc / third_tile; expected for scaffold.
- Fake-device media; nsfw fetch TypeError; occasional `setParameters InvalidStateError` (noise).
- Exit 0 always means scaffold complete or soft-skip — **never** multi product PASS.
- **SCAFFOLD_DONE only · not MULTI_PASS · multi_product_pass: false**
- Phone adb not used (F29 owns phone).

## Files touched
- none (verify-only hop)
- RESULT: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L43-multi-pair-find3rd-RESULT.md`
- Job card moved: `running/L43-multi-pair-find3rd.md` → `done/L43-multi-pair-find3rd.md`

## Connect risk
**None** — harness run only. No product edits, no ICE thrash config flip, no deploy, no live.js, no adb, no APK.

## COMPLETE or BLOCKED
**COMPLETE** — SCAFFOLD_DONE exit 0; find-third invite + hunt **observed**; accept_ui **false** this run (honest); **no multi PASS invented**
