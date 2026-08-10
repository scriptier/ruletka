You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

# Task: Note hotkeys scroll fix in PC_BROWSER_SMOKE

## Goal
Add one row to `docs/PC_BROWSER_SMOKE.md` desktop chrome table: Settings → Hotkeys taller + scrolls (task 037).

## Scope
- `docs/PC_BROWSER_SMOKE.md` only

## Done criteria
- [ ] One checklist row added
- [ ] RESULT + COMPLETE

## Do not
- CSS/HTML (already done) / deploy

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/065-web-hotkeys-verify-note-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
