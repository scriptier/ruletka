You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

# Task: LiveSearchLabel a11y / i18n audit

## Goal
Audit `mobile/src/live/LiveSearchLabel.tsx`. Labels come from props (live.tsx t()). Ensure live region / accessibilityLabel present; no hardcoded EN.

## Scope
- `mobile/src/live/LiveSearchLabel.tsx`
- en/ru only if keys needed

## Done criteria
- [ ] Search status readable by a11y tools
- [ ] RESULT + COMPLETE

## Do not
- Connect path / deploy

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/078-search-label-i18n-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
