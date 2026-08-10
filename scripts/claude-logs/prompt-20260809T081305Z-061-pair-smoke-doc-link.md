You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

# Task: Link pair-smoke + connect-scorecard in CONNECT_DEBUG

## Goal
Ensure `docs/CONNECT_DEBUG.md` lists `./scripts/agents/start-sleep-shift.sh` is NOT required — only verify scorecard + pair-smoke commands are complete and accurate.

## Scope
- `docs/CONNECT_DEBUG.md` only

## Done criteria
- [ ] Commands copy-pasteable
- [ ] Mentions connect-scorecard + dev-smoke
- [ ] RESULT + COMPLETE

## Do not
- Code / deploy

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/061-pair-smoke-doc-link-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
