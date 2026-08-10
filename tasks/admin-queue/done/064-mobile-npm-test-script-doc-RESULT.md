# RESULT — 064-mobile-npm-test-script-doc

**Status:** COMPLETE

## What changed
Added an "Automation" section to `docs/POLISH_NOW.md` documenting the factory scripts:
start-sleep-shift/stop-sleep-shift, watchdog cron, harvest, auto-build (sideload-only), and status.
Links to `AGENT_GROK_CLAUDE.md` and `NEXT_PLAN.md`. Explicitly notes no Play/product claims —
sideload builds only, referencing `docs/MOBILE_BUILD.md`.

## Files touched
- `docs/POLISH_NOW.md`

## Verify commands run
- `git status --short docs/POLISH_NOW.md` (confirmed file modified in worktree)
- Manual read-through of `scripts/agents/*.sh` headers to confirm script purposes/paths cited are accurate.

## Connect risk
none — docs-only change, no code touched.

COMPLETE
