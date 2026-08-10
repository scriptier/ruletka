You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

# Task: Sync blur/privacy i18n overlays (non-EN/RU)

## Goal
Bring **blur stranger mode** + **blurModeSaved** + **home liveTips** strings in all mobile overlay packs in line with EN (default off, brief, hold). EN/RU already updated — fix the rest so RU-default isn’t the only accurate copy.

## Context
- Source of truth: `mobile/src/i18n/overlay/en.json` keys:
  - `mobile.settings.blurStrangers`
  - `mobile.settings.blurStrangersHint`
  - `mobile.settings.blurModeOff` / `blurModeIntro` / `blurModeHold`
  - `mobile.settings.blurModeSaved` (new: `"Privacy veil · {mode} · next stranger match"`)
  - `mobile.home.liveTips`
- Many packs (de/es/fr/pl/uk/…) still say “Brief frost… (default)” which is **wrong** — product default is **Off**.

## Scope (only these)
- `mobile/src/i18n/overlay/*.json` **except** leave en.json alone if already correct; update ru only if missing `blurModeSaved`
- Optional: one-line note in RESULT listing packs touched

## Done criteria
- [ ] Every overlay pack has the five blur keys + `blurModeSaved` + accurate liveTips
- [ ] No pack claims intro/hold is the default
- [ ] No `mobile/app/*` or media/connect edits
- [ ] RESULT under `tasks/admin-queue/done/` with **COMPLETE**

## Completion promise
Put `COMPLETE` in RESULT when done.

## Do not
- Deploy / push / APK / touch WebRTC / live.tsx
- Invent SFU or Prefer Direct strings

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/054-i18n-blur-overlay-sync-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
