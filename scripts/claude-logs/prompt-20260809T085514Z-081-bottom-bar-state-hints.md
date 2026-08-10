You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

# Task: LiveBottomBar state a11y

## Goal
Polish `mobile/src/live/LiveBottomBar.tsx`: ensure mute/cam/blur/next buttons expose accessibilityState (selected/disabled) and labels from props.

## Scope
- `mobile/src/live/LiveBottomBar.tsx` only
- en/ru only if new keys

## Done criteria
- [ ] Interactive controls labeled + state
- [ ] RESULT + COMPLETE

## Do not
- live.tsx connect logic / MediaSession / deploy

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/081-bottom-bar-state-hints-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
