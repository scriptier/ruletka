# L87 multi-pair find-3rd RESULT

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
| multi_product_pass | **false** (not claimed) |
| Code edits | **None** (no live.js, no APK, no dual phone adb, no force-push) |

**SCAFFOLD_DONE ≠ MULTI_PASS.** Exit 0 only means the harness finished its observation budget without hard boot fail. It does **not** mean multi product works or that a third human joined. `multi_pc_hint` and `third_tile_hint` both stayed **false** (clean web2 1v1 → find-third hunt only).

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

### Phase table

| Signal | Result |
|--------|--------|
| boot | **yes** |
| pair_1v1_hint | **yes** (MultiA↔MultiB solo; iceOk + frames both; pcCount=1) |
| find_third_invite_sent | **yes** — MultiA `btn-match-more` → `btn-find-third` |
| find_third_accept_ui | **yes** — MultiB via `btn-find-third-yes` |
| hunt_ui_hint | **yes** — both stageTrio + stageTrioSearching until budget |
| multi_pc_hint | **no** |
| third_tile_hint | **no** |
| multi product PASS / GOAL_MET | **NOT claimed** |

## Timeline (wall ~15:16:01 → 15:16:53)

1. **Boot** — MultiA then MultiB chromium; fake media; ICE groups + TURN; honesty banner.
2. **Start** — MultiA `#btn-start-match` (~15:16:09); MultiB (~15:16:19).
3. **1v1 pair** — MultiA↔MultiB solo match; Force Relay; ICE relay→relay; frames both (`pair_1v1_hint`, age ~3s).
4. **Find-third UI** (~15:16:28) — MultiA invite; MultiB accept; both “find-third — looking for a 3rd”; Keep PC held.
5. **Hunt** — both `hunt_ui_hint` / stageTrioSearching through budget (~31s age); hub `error: not matched` while pair frames continued; hunt pcCount stayed 1.
6. **No multi_pc / third tile** — `multi_pc_hint=false`, `third_tile_hint=false` (expected for web2-only: no third tab/phone; F69 owns phone — no phone adb this card).
7. **End** — screenshots + SUMMARY + `SCAFFOLD_DONE (not MULTI_PASS)`; exit 0.

## Screenshots

- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiA-1786547813130.png`
- `/home/drakosik/freenet-roulette/mobile/artifacts/multi-pair/MultiB-1786547813447.png`

## Log evidence (selected)

```
[multi-pair 15:16:01.343] chrome=/usr/bin/chromium
[multi-pair 15:16:01.344] url=https://ruletka.vip/live.html mode=web2 peers=2 budget_ms=30000 find_third=1
[multi-pair 15:16:01.344] HONESTY: exit 0 ≠ multi product PASS; phases are observations only
…
[MultiB] [ruletka.vip] matched with MultiA · solo
[MultiA] [ruletka.vip] matched with MultiB · solo
…
[multi-pair 15:16:28.051] MultiA find-third invite attempt {"clicked":"btn-find-third","steps":["btn-match-more","btn-find-third"]}
[multi-pair 15:16:28.874] MultiB find-third accept via btn-find-third-yes
…
SUMMARY {"mode":"web2",...,"observed":{"boot":true,"pair_1v1_hint":true,"find_third_invite_sent":true,"find_third_accept_ui":true,"hunt_ui_hint":true,"multi_pc_hint":false,"third_tile_hint":false},...}
[multi-pair] SCAFFOLD_DONE (not MULTI_PASS)
EXIT=0
```

Full log also at: `/tmp/L87-multi-pair-find3rd.log`

## Risks / notes

- Clean 1v1 then find-third hunt; no early party_browse multi_pc latch.
- Hub `error: not matched` noise during hunt (pair frames still flowing; pcCount=1).
- web2 + FIND_THIRD exercises invite/accept/hunt UI only; third peer would need web3 or web2phone (phone owned by F69 — not this card).
- Fake-device media; nsfw fetch TypeError; setParameters InvalidStateError noise — not claimed product FAIL.
- **No invent MULTI_PASS.** **No invent multi SoftBlur PASS.**

## Merge / next

- Nothing to merge (no code changes).
- Card L87 → `done/`.
- Product multi still needs human 3-way faces or a longer MODE=web3 / coordinated phone run — **not** this RESULT’s claim.

## COMPLETE or BLOCKED

**COMPLETE** — SCAFFOLD_DONE exit 0; find-third invite/accept/hunt UI observed; multi_pc/third_tile **false**; **not MULTI_PASS / not product PASS**.
