# T2-pc-pair-smoke-rematch — RESULT

**Status:** COMPLETE (execution done; smoke **FAIL**)  
**When:** 2026-08-12  
**OWN:** PC browsers / `PAIR_SMOKE_REMATCH=1 node scripts/pair-smoke.mjs` only (no product code, no phone, no deploy)  
**Log:** `/tmp/t2-pair-smoke-rematch.log`  
**Bridge:** `target/release/roulette-bridge` port `8797`  
**Chrome:** `/usr/bin/chromium`  
**Rematch flag:** `PAIR_SMOKE_REMATCH=1` (strict rematch path)

## Command

```bash
export CHROME=/usr/bin/chromium
cd /home/drakosik/freenet-roulette
PAIR_SMOKE_REMATCH=1 node scripts/pair-smoke.mjs 2>&1 | tee /tmp/t2-pair-smoke-rematch.log
echo EXIT:$?
# Pipeline printed EXIT:0 (tee exit; no pipefail). Harness scorecard pass:false → assertion fail path (exitCode=2, same as T1).
```

## Exit / rematch

| Field | Value |
|-------|--------|
| Pipeline `$?` (tee) | **0** (misleading without `set -o pipefail`) |
| Harness pass | **false** |
| Expected process exit | **2** (assertion fail in `pair-smoke.mjs`) |
| **Rematch reached?** | **n** (`m2: null` — match1 never passed) |

## Scorecard (last attempt / m1)

| Metric | Value |
|--------|-------|
| wire offers | **0** (expected 1) |
| wire answers | **0** (expected 1) |
| mto_ms | **null** |
| mta_ms | **null** |
| offer_to_answer_ms | **null** |
| track_a_ms | 265 |
| track_b_ms | null |
| dual_offer | 0 |
| **rematch m2** | **null** (not reached) |

SCORECARD line:

```json
{"pass":false,"attempt":5,"m1":{"offers":0,"answers":0,"mto_ms":null,"mta_ms":null,"offer_to_answer_ms":null,"track_a_ms":265,"track_b_ms":null,"dual_offer":0},"m2":null,"fails":["match1@5: expected 1 wire offer, got 0","match1@5: expected 1 wire answer, got 0","match1@5: botB no remote track within budget","match1@5: hub missing \"first offer after match\"","match1@5: hub missing \"first answer after match\""]}
```

Appended: `artifacts/connect-scorecard.jsonl` @ `2026-08-12T02:16:23.679Z`

## Attempt summary (match1 only — 5/5)

| Attempt | Result |
|---------|--------|
| 1/5 | FAIL — 0 wire offer/answer; hub missing first offer/answer |
| 2/5 | FAIL — same + botA no remote track |
| 3/5 | FAIL — same + botB no remote track |
| 4/5 | FAIL — same + botB no remote track |
| 5/5 | FAIL — same + botB no remote track |

Rematch (match2) **never started**.

## Console thrash (same as T1)

- Bots match fine: `matched with botA/botB · solo`.
- Tight loop thrash (~2k `force_relay no TURN — fail-open all`; ~670 `offer no relay — rebuild pure-relay PC and retry once`; many `localSdp offer`).
- **Zero wire offers/answers** on hub (`offerLines: 0`, `answerLines: 0`).
- Same root pattern as T1: force_relay thrash with no TURN → 0 wire SDP → match1 FAIL → rematch unreachable.

## Explicit non-claims

- No invent **GOAL_MET** / product **PASS**
- No product code fix (harness path ran; fail is product/local TURN residual, not harness crash)
- No phone / adb / deploy / APK
- Phone MATCHED (other jobs) **not** conflated with this local web↔web FAIL

## Verdict

**COMPLETE** — full rematch run executed.  
**Smoke FAIL** — rematch **n**; wire offers/answers **0/0**; mto/mta **null**; m2 **null**. Same force_relay thrash as T1.
