You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

# Task: LiveGiftBar soft empty / locked copy

## Goal
When gifts locked or empty mid-chat, ensure soft hint uses t() and is readable EN+RU.

## Scope
- `mobile/src/live/LiveGiftBar.tsx`
- en.json + ru.json if needed

## Done criteria
- [ ] No raw English hardcodes for empty/locked
- [ ] RESULT + COMPLETE

## Do not
- Stars protocol / spend logic

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/071-gift-bar-empty-hint-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
