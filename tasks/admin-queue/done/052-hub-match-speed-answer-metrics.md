# Task: hub-match-speed.sh — answer + thrash metrics

## Owner
**Claude Code**

## Success
- `./scripts/hub-match-speed.sh` summary table includes:
  - max / count slow `match_to_answer_ms` (threshold env `SLOW_ANSWER_MS`, default 2000)
  - count of `answerer first-path grace` drops
  - count of `first offer after match SLOW` with `platform=android`
- Verdict FAIL if android SLOW first-offers > 0 in window (optional WARN if answers < offers)
- Still works with only `match_to_offer_ms` (older logs)
- No server code changes

## Files
- `scripts/hub-match-speed.sh` only (maybe 2 lines in `scripts/smoke-connect.sh` if dedupe needed)

## Do not
- Edit bridge/simple.rs
- Deploy

## Done
RESULT with **COMPLETE**
