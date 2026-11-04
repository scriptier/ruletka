# L24 multi-pair web2 — RESULT

## Status
**COMPLETE** — harness **SCAFFOLD_DONE** (exit 0)  
**Not multi product PASS / not GOAL_MET**  
**multi_product_pass: false**

## OWN
- Run only: `scripts/multi-pair.mjs`
- **No invent multi PASS**
- **No product UI / media / deploy / APK / live.js / adb / force-push**

## Goal
Run `MODE=web2 FIND_THIRD=0 BUDGET_MS=25000` multi-pair pair-only scaffold; record exit + observed phases honestly.

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
| **When (UTC)** | `2026-08-12T05:06:01Z` → `05:06:54Z` |
| **HEAD** | `a0d195d` |
| **Root** | `/home/drakosik/freenet-roulette` |
| **URL** | `https://ruletka.vip/live.html` |
| **MODE** | `web2` |
| **FIND_THIRD** | `0` |
| **BUDGET_MS** | `25000` |
| **CHROME** | `/usr/bin/chromium` |
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
| pair_1v1_hint | **yes** (both tabs: `pcCount=1`, `iceOk=true`, `frames=true` from age≈3.3s) |
| MultiA↔MultiB matched | **yes** — `matched with MultiB · solo` / `matched with MultiA · solo` |
| ICE / frames | **yes** — relay→relay; first frame ~4.7–4.9s; wave_ok through ~12s+ |
| find_third_* | **no** (FIND_THIRD=0) |
| hunt_ui / multi_pc / third_tile | **no** |
| multi product PASS / GOAL_MET / MULTI_PASS | **NOT claimed** |

## Timeline (selected)
| UTC | Event |
|-----|--------|
| 05:06:01 | chrome boot; mode=web2 peers=2 find_third=0 budget=25000; HONESTY banner |
| 05:06:11 | MultiA `#btn-start-match` |
| 05:06:22 | MultiB `#btn-start-match` |
| ~05:06:22–27 | mutual match + Force Relay + ICE; CONNECT ice ~4.5–4.7s; first frames ~4.7–4.9s |
| 05:06:29→05:06:54 | phase polls stay `pair_1v1_hint`; no find-third path |
| 05:06:54 | screenshots + SUMMARY + `SCAFFOLD_DONE (not MULTI_PASS)` |

## Screenshots
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiA-1786511214098.png`
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiB-1786511214433.png`

## Notes
- Soft-skip path not hit (Chrome + puppeteer present).
- FIND_THIRD=0 → pair-only; no invite/accept/hunt UI exercised (expected).
- Body text during polls: both “In a call …” (stable pair).
- Fake-device media; nsfw `TypeError: Failed to fetch`; occasional `setParameters InvalidStateError` (noise).
- Exit 0 always means scaffold complete or soft-skip — **never** multi product PASS.
- **multi_product_pass: false** even though exit 0 and 1v1 frames observed.
- Harness `next` text is generic (3-way wording); with FIND_THIRD=0 there is no multi path to re-verify unless FIND_THIRD=1 / MODE=web3 / human 3rd.

## Files touched
- none (verify-only hop)
- Canonical RESULT: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L24-multi-pair-web2-RESULT.md`
- Card moved: `tasks/grok-loop/running/L24-multi-pair-web2.md` → `tasks/grok-loop/done/L24-multi-pair-web2.md`

## Connect risk
**None** — harness run only. No product edits, no ICE thrash config flip, no deploy.

## COMPLETE or BLOCKED
**COMPLETE** — SCAFFOLD_DONE exit 0; pair_1v1_hint **observed**; **no multi PASS invented**; multi_product_pass:false
