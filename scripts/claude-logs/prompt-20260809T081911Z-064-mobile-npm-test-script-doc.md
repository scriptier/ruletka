You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

# Task: Document auto-build + continuous in POLISH_NOW

## Goal
Add a short “Automation” section to `docs/POLISH_NOW.md` pointing at start-sleep-shift, watchdog cron, and auto-build after harvest. No product claims about Play.

## Scope
- `docs/POLISH_NOW.md` only

## Done criteria
- [ ] Links to AGENT_GROK_CLAUDE / NEXT_PLAN / agents scripts
- [ ] RESULT + COMPLETE

## Do not
- Code / deploy

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/064-mobile-npm-test-script-doc-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
