You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

# Task: Friends empty + online strip polish (no connect)

## Goal
Small UX polish on Friends: empty states and online strip readability — match web softness, no protocol changes.

## Context
- `mobile/app/friends.tsx` + any friends styles in that file
- Prior work: home online strip, friend Call/Chat CTAs
- Users still see sparse empty lists / weak hierarchy when offline

## Scope (only these)
- `mobile/app/friends.tsx`
- i18n overlay en.json + ru.json only if new short keys needed
- Optional: tiny shared style in same file (no new design system)

## Done criteria
- [ ] Empty friends list: clear CTA (add by code / invite) — not a blank void
- [ ] Online strip / row: online vs offline visually distinct without clutter
- [ ] No hub protocol / MediaSession / live.tsx changes
- [ ] `cd mobile && npx tsc --noEmit` if practical
- [ ] RESULT + **COMPLETE**

## Completion promise
Put `COMPLETE` in RESULT when done.

## Do not
- Deploy / push / APK
- Change call/ring/push registration logic (layout/copy only)
- Touch CONNECTIVITY_LOCK paths

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/055-friends-empty-online-polish-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
