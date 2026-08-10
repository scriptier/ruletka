You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

# Task: Friends empty-state i18n keys EN+RU

## Goal
If friends empty CTA strings are hardcoded English, move to overlay keys and wire `t(...)`.

## Scope
- `mobile/app/friends.tsx`
- `mobile/src/i18n/overlay/en.json`
- `mobile/src/i18n/overlay/ru.json`

## Done criteria
- [ ] Empty list uses t() keys
- [ ] EN+RU present
- [ ] RESULT + COMPLETE

## Do not
- Push/call protocol / deploy

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/062-friends-i18n-empty-keys-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
