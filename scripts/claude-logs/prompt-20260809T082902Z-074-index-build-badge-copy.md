You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

# Task: Home build badge long-press hint

## Goal
If home shows build version, ensure long-press copy has a short hint EN+RU (or already does).

## Scope
- `mobile/app/index.tsx` (hint only)
- en.json + ru.json if needed

## Done criteria
- [ ] Support can find version easily
- [ ] RESULT + COMPLETE

## Do not
- Hub / connect

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/074-index-build-badge-copy-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
