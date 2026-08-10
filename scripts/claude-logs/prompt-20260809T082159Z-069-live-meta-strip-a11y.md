You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

# Task: LiveMetaStrip accessibility

## Goal
Audit `mobile/src/live/LiveMetaStrip.tsx` for pressable chips missing accessibilityLabel. Add labels from existing i18n/props only.

## Scope
- `mobile/src/live/LiveMetaStrip.tsx` only (i18n en+ru if truly needed)

## Done criteria
- [ ] Interactive elements labeled
- [ ] RESULT + COMPLETE

## Do not
- Connect path / WebRTC

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/069-live-meta-strip-a11y-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
