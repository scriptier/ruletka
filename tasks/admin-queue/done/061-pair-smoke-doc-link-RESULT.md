# 061 — Link pair-smoke + connect-scorecard in CONNECT_DEBUG

## Status
COMPLETE

## What changed
- `docs/CONNECT_DEBUG.md` did not reference `./scripts/agents/start-sleep-shift.sh` — confirmed it is not listed as required (nothing to remove).
- Verified `./scripts/connect-scorecard.sh` and `./scripts/dev-smoke.sh` are both present in the "Commands" section with accurate usage (checked against the actual script headers/flags in the main tree, since this worktree's `scripts/` doesn't carry all of them yet).
- Added an explicit pair-smoke-only line — `./scripts/dev-smoke.sh --pair` — plus the direct fallback `node scripts/pair-smoke.mjs`, since previously pair-smoke was only mentioned inside a comment on the default `dev-smoke.sh` line, not as its own copy-pasteable command.

## Files touched
- `docs/CONNECT_DEBUG.md`

## Verify commands run
- `./scripts/dev-smoke.sh --unit` → PASS (5 unit suites ok)
- Cross-checked `scripts/dev-smoke.sh`, `scripts/connect-scorecard.sh`, `scripts/smoke-connect.sh`, `scripts/pair-smoke.mjs`, `scripts/hub-match-speed.sh` headers in `/home/drakosik/freenet-roulette` (main tree) to confirm all flags/usage in the doc are accurate and current.
- `grep -n sleep-shift docs/CONNECT_DEBUG.md` → no matches (confirmed not required).

## Connect risk
none — docs-only change, no code/deploy touched.

COMPLETE
