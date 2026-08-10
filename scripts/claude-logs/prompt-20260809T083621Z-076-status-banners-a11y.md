You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

# Task: LiveStatusBanners a11y

## Goal
Polish accessibility and/or i18n in `mobile/src/live/LiveStatusBanners.tsx`. Prefer audit + minimal fix. Use existing t() keys when possible.

## Scope
- `mobile/src/live/LiveStatusBanners.tsx`
- en.json + ru.json only if new keys required

## Done criteria
- [ ] Interactive strings labeled / localized
- [ ] RESULT + COMPLETE

## Do not
- Connect path / MediaSession / deploy

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/076-status-banners-a11y-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
