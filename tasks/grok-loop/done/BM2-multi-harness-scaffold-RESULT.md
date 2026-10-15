# BM2-multi-harness-scaffold — RESULT

**Status:** COMPLETE  
**Date:** 2026-08-12T03:02:38Z  
**OWN:** `scripts/**` only  
**Plan:** `knowledge/specs/BLUR-MULTI-FINISH-PLAN.md` B1  
**Code change:** new multi harness scripts only (no product UI / no deploy / no APK)

## Goal

Scaffold multi-party smoke harness so agents can drive **2 web**, **2 web + phone find-third**, or **3 web** without inventing multi product PASS / GOAL_MET.

## What shipped

| Path | Role |
|------|------|
| [`scripts/multi-pair.mjs`](../../../scripts/multi-pair.mjs) | Preferred name from task: `MODE=web2\|web2phone\|web3`, phase observe, find-third poke after **stable mutual** 1v1 |
| [`scripts/multi-smoke.mjs`](../../../scripts/multi-smoke.mjs) | Sibling: `--mode 3web\|2web-phone`, OBSERVE scorecard always `multi_product_pass:false` |
| [`scripts/multi-smoke.README.md`](../../../scripts/multi-smoke.README.md) | How to run + honesty |
| [`scripts/phone-web-pair.mjs`](../../../scripts/phone-web-pair.mjs) | Header pointer → multi harness for multi/find-third (1v1 partner unchanged) |

No product UI/media edits. No deploy/APK. **No multi GOAL_MET claim.**

## How to run

```bash
# multi-pair (env MODE)
node --check scripts/multi-pair.mjs
MODE=web2 FIND_THIRD=0 BUDGET_MS=20000 CHROME=/usr/bin/chromium \
  node scripts/multi-pair.mjs
MODE=web2 FIND_THIRD=1 BUDGET_MS=90000 CHROME=/usr/bin/chromium \
  node scripts/multi-pair.mjs
MODE=web2phone BUDGET_MS=90000 CHROME=/usr/bin/chromium \
  node scripts/multi-pair.mjs   # prints phone join note
MODE=web3 BUDGET_MS=90000 CHROME=/usr/bin/chromium \
  node scripts/multi-pair.mjs

# multi-smoke (CLI mode + scorecard)
node scripts/multi-smoke.mjs --help
BUDGET_MS=45000 node scripts/multi-smoke.mjs --mode 3web
node scripts/multi-smoke.mjs --mode 2web-phone
```

Soft-skips (exit 0) if Chrome or `puppeteer-core` missing.

Artifacts:

- `mobile/artifacts/multi-pair/*.png`
- `artifacts/multi-smoke/last-scorecard.json` + screenshots + `scorecard.jsonl`

## Survey (existing harnesses — not replaced)

| Script | Scope |
|--------|--------|
| `pair-smoke.mjs` | Local bridge 1v1 budgets |
| `prod-pair-media.mjs` | Prod 2-web frames/ICE |
| `phone-web-pair.mjs` | 1 headless partner for phone device-smoke |
| `pair-test-headless.mjs` | 1 bot for human pair-debug |
| **`multi-pair.mjs` / `multi-smoke.mjs`** | **Multi scaffold (new)** |

## Verify (this hop — honest)

| Check | Result |
|-------|--------|
| `node --check scripts/multi-pair.mjs` | **OK** (exit 0) |
| `node --check scripts/multi-smoke.mjs` | **OK** (exit 0) |
| `node scripts/multi-smoke.mjs --help` | **OK** usage printed |
| `MODE=web2 FIND_THIRD=0 BUDGET_MS=18000` multi-pair | **SCAFFOLD_DONE** — MultiA↔MultiB **matched**, ICE + frames observed (`pair_1v1_hint`) |
| `MODE=web2 FIND_THIRD=1 BUDGET_MS=50000` multi-pair | **SCAFFOLD_DONE** — observed `find_third_accept_ui`, `hunt_ui_hint` (`stage-trio` / searching), `third_tile_hint` / `pcCount=2` on one tab |
| multi product PASS / GOAL_MET | **NOT claimed** — exit always `SCAFFOLD_DONE (not MULTI_PASS)` |

### multi-pair SUMMARY sample (FIND_THIRD=1, honest)

```json
{
  "mode": "web2",
  "find_third_enabled": true,
  "observed": {
    "boot": true,
    "pair_1v1_hint": true,
    "find_third_invite_sent": false,
    "find_third_accept_ui": true,
    "hunt_ui_hint": true,
    "multi_pc_hint": false,
    "third_tile_hint": true
  },
  "honesty": "SCAFFOLD_DONE only — not multi product PASS; human faces still required for GOAL_MET"
}
```

Console also saw: `find-third — looking for a 3rd`, `matched … party_browse`, `stageTrio:true` — **scaffold signals only**.

## Design notes

- Isolated `BrowserContext` per peer (identity / localStorage do not collide).
- Fake media args (same as phone-web-pair / prod-pair-media).
- `peerPcs` is **module-private** in `live.js` — harness hooks `RTCPeerConnection` + DOM (`#remote`, `#remote2`, `#remote-third`, `main.stage.stage-trio`, find-third toast/buttons).
- Find-third: open ⋯ menu → `#btn-find-third`; accept `#btn-find-third-yes`. multi-pair waits for **mutual stable** 1v1 before invite retries.
- Prod queue noise: real users / leftover bots can pair mid-run — phases are observations, not proofs.

## Honesty (must-not)

| Rule | Verdict |
|------|---------|
| No invent multi PASS / GOAL_MET | **Held** — status SCAFFOLD/OBSERVE only |
| No deploy / APK | none |
| No ICE thrash / pool>0 / force_relay flip | untouched product code |
| Soft skip without chrome/puppeteer | exit 0 |
| Human multi smoke still OPEN | yes (`multi-party-stage` skill) |

## Next steps (follow-up — not this scaffold)

1. Harden find-third **mutual** accept (both harness peers enter `party_browse` + trio).  
2. Assert dual remote frames + `stage-count-3` for ≥15s (still not product PASS without human faces).  
3. `MODE=web2phone` + optional `WEB_PAIR`-style phone device-smoke handoff without exclusive adb thrash.  
4. 4-way stretch after 3-way observe is stable (plan C5).

## Risks

- Prod queue matches non-harness strangers (name collision MultiA/MultiB across runs).  
- Fake-media frames under-report on some UAs; ICE/srcObject still useful.  
- Find-third accept path best-effort; invite may fail if pair not yet stable.  
- Two sibling scripts (`multi-pair` + `multi-smoke`) — prefer either; both soft-honest.

## Merge advice

**Safe scripts-only.** Prefer keeping both siblings or later alias one; no product behavior change. Optional later wire into `dev-smoke.sh` as soft gate (not required now).

## Files touched

- `scripts/multi-pair.mjs` (new)
- `scripts/multi-smoke.mjs` (new — sibling)
- `scripts/multi-smoke.README.md` (new)
- `scripts/phone-web-pair.mjs` (header pointer only)
- RESULT: this file
- Task: `running/BM2-multi-harness-scaffold.md` → `done/BM2-multi-harness-scaffold.md`

## Connect risk

**None** — harness only. No MediaSession / live.js multi thrash.

## COMPLETE or BLOCKED

**COMPLETE** (scaffold). Human multi / find-3rd smoke remains **OPEN**.
