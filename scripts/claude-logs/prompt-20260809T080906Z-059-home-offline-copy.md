You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

# Task: Home offline / reconnect soft copy

## Goal
If home shows hub offline or reconnect states, ensure short soft EN+RU strings exist and are used (no hard Alert for soft offline if toast exists).

## Scope
- `mobile/app/index.tsx` (copy/toast only)
- `mobile/src/i18n/overlay/en.json` + `ru.json` only if new keys needed

## Done criteria
- [ ] Offline/reconnect messaging is soft and clear
- [ ] No hub protocol changes
- [ ] RESULT + COMPLETE

## Do not
- Connect/WebRTC / deploy

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/059-home-offline-copy-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
