# L32 multi-pair web2 — RESULT

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
| **When (UTC)** | `2026-08-12T07:29:00Z` → `07:29:47Z` |
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
| **Full log** | `/tmp/L32-multi-pair-web2.log` |

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
| pair_1v1_hint | **yes** (both tabs: `pcCount=1`; age≈3.1s+: `iceOk=true`, `frames=true`) |
| MultiA↔MultiB matched | **yes** — `matched with MultiB · solo` / `matched with MultiA · solo` |
| ICE / frames | **yes** — relay→relay; first frames ~4.3–4.6s after mutual match; wave_ok through ~12s+ |
| find_third_* | **no** (FIND_THIRD=0) |
| hunt_ui / multi_pc / third_tile | **no** |
| multi product PASS / GOAL_MET / MULTI_PASS | **NOT claimed** |

## Timeline (selected)
| UTC | Event |
|-----|--------|
| 07:29:00 | chrome boot; mode=web2 peers=2 find_third=0 budget=25000; HONESTY banner |
| 07:29:08 | MultiA `#btn-start-match` |
| 07:29:17 | MultiB `#btn-start-match` |
| ~07:29:17–19 | mutual MultiA↔MultiB match + Force Relay + kickSolo; ICE / late video after audio |
| ~07:29:21–22 | ice_connected relay→relay; first frames ~4.3–4.6s; match connected (frames) both sides |
| 07:29:22 | phase poll age≈3.1s: pair_1v1_hint both; iceOk=true, frames=true; body “In a call …” |
| 07:29:25→07:29:46 | phase polls stay `pair_1v1_hint` with iceOk+frames; wave_2000…wave_12000; both “In a call …” |
| 07:29:47 | screenshots + SUMMARY + `SCAFFOLD_DONE (not MULTI_PASS)` |

## Screenshots
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiA-1786519786955.png`
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiB-1786519787159.png`

## Notes
- Soft-skip path not hit (Chrome + puppeteer present).
- FIND_THIRD=0 → pair-only; no invite/accept/hunt UI exercised (expected).
- Clean MultiA↔MultiB pair (no intervening stranger match this run); held through full budget with frames.
- Fake-device media; nsfw `TypeError: Failed to fetch`; late video after audio hard re-paint; setParameters InvalidStateError (harness noise).
- Exit 0 always means scaffold complete or soft-skip — **never** multi product PASS.
- **multi_product_pass: false** even though exit 0 and 1v1 frames observed.
- Harness `next` text is generic (3-way wording); with FIND_THIRD=0 there is no multi path to re-verify unless FIND_THIRD=1 / MODE=web3 / human 3rd.

## Files touched
- none (verify-only hop)
- Canonical RESULT: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L32-multi-pair-web2-RESULT.md`
- Card moved: `tasks/grok-loop/running/27-L32-multi-pair-web2.md` → `tasks/grok-loop/done/L32-multi-pair-web2.md`

## Connect risk
**None** — harness run only. No product edits, no ICE thrash config flip, no deploy.

## COMPLETE or BLOCKED
**COMPLETE** — SCAFFOLD_DONE exit 0; pair_1v1_hint **observed**; **no multi PASS invented**; multi_product_pass:false
