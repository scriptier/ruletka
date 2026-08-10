# Task: Overnight hub/coturn scorecard

## Goal
Append a readable scorecard for matches over the last 2h so morning smoke has numbers.

## Context
- Baseline: pure force_relay + no answerer promote (0.1.283 / webrtc v285)
- Plan: docs/OVERNIGHT_2026-08-10.md
- Do NOT change ICE / hub pair_force_relay / coturn

## Scope (only these)
- Run `./scripts/connect-monitor.sh --once` and/or `./scripts/hub-match-speed.sh 60`
- Write `tasks/admin-queue/reports/2026-08-10-overnight-scorecard.md` with: matches, force_relay, match_to_offer_ms, answerer drops, peer_usage notes
- Optional: append one JSONL line under `artifacts/connect-monitor/` if script supports `--log`

## Done criteria
- [ ] Scorecard markdown exists with timestamp
- [ ] No production deploy
- [ ] RESULT with connect risk **none**
- [ ] COMPLETE in RESULT

## Do not
- Deploy, edit simple.rs force_relay policy, touch MediaSession ICE, docker coturn
