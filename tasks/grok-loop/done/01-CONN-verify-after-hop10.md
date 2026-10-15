# CONN: re-score after hop10 (verify-only)

## Goal
Run av-verify, parse product + mto/mta, write honest residual vs CONNECT-IMPROVE-PLAN.

## OWN
- scripts: `./scripts/av-verify.sh --min 10` only
- WRITE: tasks/grok-loop/done/CONN-overnight-verify-RESULT.md
- optional append one line to knowledge/specs/CONNECT-IMPROVE-PLAN.md progress

## Must not
edit MediaSession/live.js, deploy, invent product.ok

## Done
RESULT with verdict, product, android av_path present?, NEXT_ROLE
