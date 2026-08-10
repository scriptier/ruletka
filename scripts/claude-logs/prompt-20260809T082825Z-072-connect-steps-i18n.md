You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

# Task: LiveConnectSteps string keys

## Goal
Ensure LiveConnectSteps labels come from i18n (queue/media/video stages). Wire or confirm t() usage.

## Scope
- `mobile/src/live/LiveConnectSteps.tsx`
- en.json + ru.json if missing keys

## Done criteria
- [ ] Stage labels localized
- [ ] RESULT + COMPLETE

## Do not
- Connect algorithm / MediaSession

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/072-connect-steps-i18n-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
