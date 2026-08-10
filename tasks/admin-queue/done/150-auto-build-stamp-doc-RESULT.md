# Result: Note auto-build path in AGENT_FACTORY if missing

## Status
Done

## Audit
`docs/AGENT_FACTORY.md` documented the overnight admin-agent stack and commands but had no
mention of `scripts/agents/auto-build.sh` (the mobile APK auto-build path), even though
`docs/NEXT_PLAN.md` (A6) already references it as "wired in harvest". No other doc under
`docs/` covers this script except `NEXT_PLAN.md`. Confirmed the script is sideload-only
(never touches Play/site), gates on `dev-smoke.sh --unit`, and stamps
`artifacts/agents/last-apk-build.stamp` + appends to `artifacts/agents/build.jsonl`.

## Fix
Added a short "Auto-build (mobile, sideload-only)" section to `docs/AGENT_FACTORY.md` after
the Commands section, describing what triggers a build, the gate, and a pointer to
`docs/NEXT_PLAN.md` (A6) for more detail. No new `t()` keys needed (docs-only change).

## Files touched
- `docs/AGENT_FACTORY.md`

## Verify commands run
- `grep -rln "auto-build" scripts/**/*.sh docs/*.md` (confirmed script exists, was undocumented in AGENT_FACTORY.md)
- Manual read-through of `scripts/agents/auto-build.sh` to confirm described behavior matches source

## Connect risk
none — docs-only change, no code/runtime paths touched.

COMPLETE
