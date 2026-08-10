You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

# Task: Align DEVICE_SMOKE version badges to 0.1.228+

## Goal
Update any remaining stale version numbers in `docs/DEVICE_SMOKE.md` and `docs/POLISH_NOW.md` to match latest APK **0.1.228 vc236** (or newer if present in artifacts).

## Scope
- `docs/DEVICE_SMOKE.md`
- `docs/POLISH_NOW.md`
- optionally `docs/PLAY_TODAY.md` if stale

## Done criteria
- [ ] Version tables match `mobile/app.json` or latest artifact name
- [ ] Privacy package section still present
- [ ] RESULT + COMPLETE

## Do not
- Code changes / deploy

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/060-docs-device-smoke-228-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
