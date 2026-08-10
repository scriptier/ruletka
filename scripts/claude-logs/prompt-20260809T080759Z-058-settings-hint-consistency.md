You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

# Task: Settings hint consistency (mobile overlay)

## Goal
Audit `mobile/src/i18n/overlay/en.json` vs `ru.json` for settings.* hints that still contradict product defaults (blur off, connect-first). Fix only contradictory blur/connect-related strings.

## Scope
- `mobile/src/i18n/overlay/en.json`
- `mobile/src/i18n/overlay/ru.json`

## Done criteria
- [ ] No string claims blur-on-by-default or permanent black veil as default
- [ ] RESULT + COMPLETE

## Do not
- Deploy / media / live.tsx

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/058-settings-hint-consistency-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
