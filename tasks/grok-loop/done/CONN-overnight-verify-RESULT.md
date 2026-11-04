# CONN overnight verify-after-hop10 RESULT

**Job:** `tasks/grok-loop/running/01-CONN-verify-after-hop10.md` → done  
**OWN:** `./scripts/av-verify.sh --min 10` only · no MediaSession / live.js / deploy  
**Plan:** `knowledge/specs/CONNECT-IMPROVE-PLAN.md`  
**Stamp:** `artifacts/av-verify/latest.json` / `latest.md` · `2026-08-12T05:15:53Z` · window **10 min** · `stamp=20260812T051553Z`

```
## Verdict
PASS / product ok · signaling balanced · TURN HOT · android av_path present

## 5 lines
1. Signaling OK: matches=2 offers=2 answers=2 max_mto=1633ms max_mta=3697ms max_mti=3681ms; last platforms android↔web force_relay=true.
2. TURN HOT freeze: max_rb=518150 peer_hot=38 alloc_ok=5 err_437=0 → media_pass=true; not turn-media.
3. PRODUCT ok done=true: web fin/fout=3851/4257 · android fin/fout=32/6 · phone_to_pc=true · pc_to_phone=true · min_frames=10.
4. Android av_path PRESENT: fr=1 policy=relay · app_vc=376 · bind_v=1 · hub_fr_beacon=1 · fr_mismatch=false (answer_sent / connected / ice_connected / wave_2000).
5. Residual vs hop10 stretch: mto 1633 (>1500 pure / >800 warm) · mta 3697 (>2500) · last answer relay_candidates=0 (offer=1) · android fout thin (6).

## Product parse
web fin/fout=3851/4257 · android fin/fout=32/6 · force_relay hub=true web=true android=1 · mismatch=false · web policy=relay · android policy=relay · app_vc=376 bind_v=1

## NEXT_ROLE
web-kick

## Why not thrash
product.status=ok + TURN HOT + answers=offers → do **not** open coturn, pool, MediaSession dual thrash, or invent one-way regression. Baseline (A) android silence is **cleared this window**. Prefer **web-kick / linking-speed** residual (mto/mta + answer relay_candidates feel) over android-answer as primary. Thin android fout=6 is sample/window depth, not classic 0/0 silence.

## GOAL_MET
product machine window: **yes** (product.status=ok done=true this stamp)  
hop10 linking-speed GOAL_MET: **no** (mto/mta still above stretch; no human faces claim)  
do **not** invent broader ship / Play without human
```

### Scorecard snapshot (do not invent)

| Field | Baseline 04:48:52Z | Overnight 05:15:53Z | Stretch / note |
|-------|--------------------|---------------------|----------------|
| **verdict** | WARN | **PASS** | PASS |
| **product.status** | one-way · done=false | **ok · done=true** | ok |
| web fin/fout | 62634 / 62634 | **3851 / 4257** | both ≥10 |
| android fin/fout | 0 / 0 | **32 / 6** | both ≥10 ideally; fout thin |
| android av_path | **none** | **yes** (platform=android) | present |
| app_vc / bind_v | null / null | **376 / 1** | tip plan said 378; this sample is **376** |
| force_relay hub/web/android | true / true / null | **true / true / 1** | android fr=1 |
| android policy | null | **relay** | no mismatch |
| fr_mismatch | false | **false** | ok |
| matches / offers / answers | 4 / 3 / 2 | **2 / 2 / 2** | answers ≥ offers |
| max_mto / max_mta | 1999 / 3368 | **1633 / 3697** | mto improved slightly; mta still high |
| last answer relay_candidates | 0 | **0** | residual ≥1 pure |
| TURN max_rb / err_437 | 498789 / 0 HOT | **518150 / 0** HOT | freeze coturn |
| last platforms | web ↔ android | **android ↔ web** | same-WiFi pure |

### Residual vs CONNECT-IMPROVE-PLAN (honest)

| Plan item | Overnight read |
|-----------|----------------|
| **P0** Get Android av_path / smoke phone | **CLOSED this window** — android beacons + product.ok. Not idle silence (A). |
| **(A) no android** | **Cleared** — av_path platform=android, app_vc set. |
| **(B) frames_out=0 classic one-way** | **Not this window** — android fout=6 + web fin HOT; product both directions true. Thin fout ≠ 0/0 encode death. |
| **P1–P3 android-answer / policy** | De-prioritize as primary: policy already **relay**, fr=1, answers complete. Keep as polish only if next smoke regresses. |
| **P4 hop10 web-kick residual** | **OPEN** — mto **1633** still > pure stretch 1500 / warm 800; mta **3697** > 2500; answer relay_candidates still **0**. Pin remains `live.js?v=569` (not re-verified here). |
| **P5 hub-turn** | **Freeze** — media HOT. |
| **app_vc tip** | Plan disk tip **0.1.370-vc378**; this smoke **app_vc=376** — prove tip APK separately if hop10 android denser waves claimed. |
| **GOAL_MET hop10 speed** | **No** — product.ok alone ≠ linking-speed stretch. |

### Diagnosis letter (this stamp)

| Letter | Fit overnight |
|--------|----------------|
| **(A)** silence / no av_path | **NO** — android present |
| **(B)** encode/bind dead fout=0 | **NO** — fout=6 + bind_v=1 + product ok |
| **(C)** harness noise | **LOW** — real web↔android pure match with dual frames |

### DO_NOT
- Invent failure back to one-way from this stamp
- Coturn / pool / dual MediaSession thrash while product.ok + media_pass
- Deploy / APK bump / Play without human
- Claim hop10 linking-speed GOAL_MET from product.ok alone
- Edit MediaSession / live.js on this verify-only job

### NEXT_ROLE rationale
**web-kick** — after product.ok, CONNECT plan routes linking feel / mto-mta residual to web-kick (P4 remaining), not turn-media, not android-answer primary. Optional follow-up: human re-smoke with tip APK **vc378** for denser android fout + hop10 arm proof, then re-verify.

### Commands run
```bash
./scripts/av-verify.sh --min 10
# exit 0 · verdict PASS · product.status=ok
```
