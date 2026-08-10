# Hub forensics handoff — 2026-08-08 06:15Z

## Verdict: GREEN

No connect/WebRTC code touched — matches > 0 and offers > 0, so this does not meet the
task's RED trigger (matches>0, offers=0). Nothing to hand off as a code fix.

## Metrics (last 90m, source: `scripts/admin-agent/logs/last-hub-metrics.env`)

| metric | value |
|---|---:|
| matches | 4 |
| offers | 5 |
| answers | 4 |
| offer drops | 0 |
| slow offers (>15000ms threshold) | 0 |
| max match_to_offer_ms | 5268 |
| mto source | hub_field |
| verdict | GREEN |

Config in effect: `HUB_LOOKBACK_MIN=90`, `SLOW_OFFER_MS=15000` (from
`scripts/admin-agent/config.env` — note this is 15000, not the 5000 in
`config.env.example`).

## Raw hub log (bridge, `roulette-bridge`, from `reports/2026-08-08.md`)

- 3 successful solo-match → offer → answer cycles, `match_to_offer_ms` = 218ms, 183ms, 169ms.
- 1 match flagged `WARN ... first offer after match SLOW from=c2d2e126 match_to_offer_ms=5268` —
  this is the max_mto value above. It logged as WARN in the bridge (bridge's own internal
  threshold is lower than ours) but stays under this repo's configured `SLOW_OFFER_MS=15000`,
  so `ADMIN_HUB_SLOW=0` and it does not flip the verdict to `YELLOW_slow`.
- All 4 matches got an offer; all offers got an answer. 0 drops.

## Recommendation

**No code change.** This is a routine GREEN cycle — one match with a slower-than-usual
(5.3s) first-offer time, but within configured tolerance and consistent with the known
residual `YELLOW_slow` behavior called out in `docs/CONNECTIVITY_LOCK.md` (user already
accepted this trade-off; cameras/audio work is priority #1 and unaffected).

If the WARN-level 5268ms events become frequent (not just this one occurrence), worth
flagging to Grok/lead whether the bridge's own SLOW threshold (which appears lower than our
`SLOW_OFFER_MS=15000`) should be reconciled — but that's a policy/config question, not a
connect-code bug, and out of scope for this read-only task.

## Source files read

- `scripts/admin-agent/logs/last-hub-metrics.env`
- `scripts/admin-agent/logs/agent.log` (tail, current + prior nightly cycle)
- `scripts/admin-agent/config.env`
- `scripts/admin-agent/lib.sh` (verdict logic, lines ~279-361)
- `tasks/admin-queue/reports/2026-08-08.md` (raw hub forensics block for this cycle)
- `tasks/admin-queue/reports/SLEEP-STARTED.md` (baseline: APK 0.1.148 vc156)
