You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

# Task: PartnerChrome long-press copy hint polish

## Goal
If PartnerChrome supports long-press copy name, ensure a11y hint or short toast key exists EN+RU. Minimal change.

## Scope
- `mobile/src/identity/PartnerChrome.tsx`
- en.json + ru.json only if new key

## Done criteria
- [ ] Long-press discoverable or already clear
- [ ] RESULT + COMPLETE

## Do not
- Connect / media

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/070-partner-chrome-longpress-hint-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
