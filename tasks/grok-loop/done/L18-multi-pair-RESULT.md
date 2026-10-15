# L18 multi-pair web2 — RESULT

## Status
**COMPLETE** — harness **SCAFFOLD_DONE** (exit 0)  
**Not multi product PASS / not GOAL_MET**

## OWN
- Run only: `scripts/multi-pair.mjs`
- **No invent multi PASS**
- **No product UI / media / deploy / APK**

## Goal
Run `MODE=web2 FIND_THIRD=0 BUDGET_MS=20000` multi-pair pair-only scaffold; record exit + observed phases honestly.

## Command
```bash
cd /home/drakosik/freenet-roulette
MODE=web2 FIND_THIRD=0 BUDGET_MS=20000 CHROME=/usr/bin/chromium \
  node scripts/multi-pair.mjs
# EXIT:0
# [multi-pair] SCAFFOLD_DONE (not MULTI_PASS)
```

| Field | Value |
|-------|--------|
| **When (UTC)** | `2026-08-12T03:38:46Z` → `03:39:29Z` |
| **HEAD** | `a0d195d` |
| **Root** | `/home/drakosik/freenet-roulette` |
| **URL** | `https://ruletka.vip/live.html` |
| **MODE** | `web2` |
| **FIND_THIRD** | `0` |
| **BUDGET_MS** | `20000` |
| **CHROME** | `/usr/bin/chromium` |
| **peers** | 2 (MultiA, MultiB) |
| **Exit code** | **0** |
| **Harness status** | **SCAFFOLD_DONE (not MULTI_PASS)** |

## Observed SUMMARY (honest)

```json
{
  "mode": "web2",
  "budget_ms": 20000,
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
| pair_1v1_hint | **yes** (both tabs: `pcCount=1`, `iceOk=true`, `frames=true`) |
| MultiA↔MultiB matched | **yes** — `matched with MultiB · solo` / `matched with MultiA · solo` |
| ICE / frames | **yes** — relay→relay; first frame ~5.0–5.2s; wave_ok through ~12s |
| find_third_* | **no** (FIND_THIRD=0) |
| hunt_ui / multi_pc / third_tile | **no** |
| multi product PASS / GOAL_MET | **NOT claimed** |

## Timeline (selected)
| UTC | Event |
|-----|--------|
| 03:38:47 | chrome boot; mode=web2 peers=2 find_third=0 budget=20000 |
| 03:38:54 | MultiA `#btn-start-match` |
| 03:39:04 | MultiB `#btn-start-match` |
| ~03:39:05–10 | mutual match + ICE/frames (pair_1v1_hint); CONNECT ice ~4.8s |
| 03:39:11→03:39:29 | phase polls stay pair_1v1_hint; no find-third path |
| 03:39:29 | screenshots + SUMMARY + SCAFFOLD_DONE |

## Screenshots
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiA-1786505969481.png`
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiB-1786505969652.png`

## Notes
- Soft-skip path not hit (Chrome + puppeteer present).
- FIND_THIRD=0 → pair-only; no invite/accept/hunt UI exercised (expected).
- Body text during polls: both “In a call …” (stable pair).
- Fake-device media; nsfw fetch TypeError; occasional `setParameters InvalidStateError` (noise).
- Exit 0 always means scaffold complete or soft-skip — **never** multi product PASS.
- Harness `next` text is generic (3-way wording); with FIND_THIRD=0 there is no multi path to re-verify unless FIND_THIRD=1 / MODE=web3 / human 3rd.

## Files touched
- none (verify-only hop)
- Canonical RESULT: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L18-multi-pair-RESULT.md`
- Worker mirror: `/home/drakosik/tasks/grok-loop/done/L18-multi-pair-RESULT.md`

## Connect risk
**None** — harness run only. No product edits, no ICE thrash config flip, no deploy.

## COMPLETE or BLOCKED
**COMPLETE** — SCAFFOLD_DONE exit 0; pair_1v1_hint **observed**; **no multi PASS invented**
