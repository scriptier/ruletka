# T1 av-verify scorecard (hub)

## Goal
Run av-verify / latest scorecard; report product.ok, mto, mta, fr_mismatch. No invent GOAL_MET.

## OWN
- Run `./scripts/av-verify.sh` if exists; else read knowledge scorecards / latest.md
- RESULT only

## Work
1. Prefer live av-verify; fallback latest scorecard files
2. Table: product status, max_mto, max_mta, app_vc, force_relay notes
3. COMPLETE — human smoke still open for multi

## Done
RESULT tasks/grok-loop/done/T1-av-verify-scorecard-RESULT.md
