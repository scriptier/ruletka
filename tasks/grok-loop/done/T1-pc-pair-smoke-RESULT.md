# T1-pc-pair-smoke — RESULT

**Status:** COMPLETE (execution done; smoke **FAIL**)  
**When:** 2026-08-12  
**OWN:** `scripts/pair-smoke.mjs` execution only (no product code change)  
**Exit code:** **2** (assertion fail)  
**Log:** `/tmp/t1-pair-smoke.log`  
**Bridge:** present `target/release/roulette-bridge` (no SKIP)  
**Chrome:** `/usr/bin/chromium`  
**Rematch:** default on (`PAIR_SMOKE_REMATCH=1`)

## Command

```bash
export CHROME=/usr/bin/chromium
cd /home/drakosik/freenet-roulette
node scripts/pair-smoke.mjs 2>&1 | tee /tmp/t1-pair-smoke.log
# EXIT:2
```

## Budgets (configured)

| Budget | Limit (ms) |
|--------|------------|
| MTO (match→offer hub) | 3000 |
| MTA (match→answer hub) | 4000 |
| OTA (offer→answer client) | 3000 |
| TRACK (match→remote track) | 15000 |
| wall per match | 25000 |
| attempts | 5 |

## Measured (match1 last attempt / scorecard)

| Metric | Value |
|--------|-------|
| wire offers | **0** (expected 1) |
| wire answers | **0** (expected 1) |
| mto_ms | **null** |
| mta_ms | **null** |
| offer_to_answer_ms | **null** |
| track_a_ms | 326 |
| track_b_ms | 296 |
| dual_offer | 0 |
| rematch m2 | not reached |

Scorecard line:

```json
{"pass":false,"attempt":5,"m1":{"offers":0,"answers":0,"mto_ms":null,"mta_ms":null,"offer_to_answer_ms":null,"track_a_ms":326,"track_b_ms":296,"dual_offer":0},"m2":null,"fails":["match1@5: expected 1 wire offer, got 0","match1@5: expected 1 wire answer, got 0","match1@5: hub missing \"first offer after match\"","match1@5: hub missing \"first answer after match\""]}
```

Also appended: `artifacts/connect-scorecard.jsonl`

## Attempt summary

| Attempt | Result |
|---------|--------|
| 1/5 | FAIL — 0 wire offer/answer; hub missing first offer/answer |
| 2/5 | FAIL — same |
| 3/5 | FAIL — same + botA/botB no remote track within budget |
| 4/5 | FAIL — same + botB no remote track |
| 5/5 | FAIL — 0 wire offer/answer; hub missing first offer/answer |

All five match1 attempts failed the same core contract. Rematch never ran.

## Observed behavior (forensics only)

- Bridge came up: `mode=simple`, `ROULETTE_TURN=off`, port `8797`.
- Both bots matched quickly (`matched with botA/botB · solo`).
- Clients log thrash: `force_relay no TURN — fail-open all` then  
  `offer first-relay count=0` → `offer no relay — rebuild pure-relay PC and retry once` in a tight loop.
- Many `localSdp offer` hooks fire; **zero** `wsOut offer` / `wsOut answer` on the wire → hub never sees first offer/answer.
- Script itself did not crash (no code fix applied; not a pair-smoke harness bug).

## Not done (by job scope)

- No product fix in `ui/webrtc.js` / live path
- No phone adb / deploy
- No inventing GOAL_MET / PASS

## Verdict

**FAIL** — local web↔web pair-smoke did not prove wire offer/answer or hub mto/mta budgets. Exit **2**. Job execution COMPLETE.
