# RESULT: 045-open-on-pc-phase1-stub

## Status
DONE

## Completion promise
COMPLETE

## What changed
- Added a pure-UI, unwired "Open on PC" bottom sheet: `mobile/src/pc/OpenOnPcSheet.tsx`. Props: `{ visible, onClose, url, code? }`. Shows the hub URL and the user's friend code, each with a tap-to-copy row (expo-clipboard), plus a Close button. No QR (no QR lib in deps, per task note to avoid a new heavy dependency).
- Wired a single new row ("Open on PC") into `mobile/app/settings.tsx` → About section, opening the sheet via local `pcSheetOpen` state. URL passed is the literal public site `https://ruletka.vip` (same pattern already used by the existing "Share ruletka" row), friend code from `useHub().friendCode`.
- Added i18n keys (`mobile.settings.openOnPc`, `mobile.openOnPc.*`) to `src/i18n/overlay/en.json` and `src/i18n/overlay/ru.json`.

## Files
- mobile/src/pc/OpenOnPcSheet.tsx (new)
- mobile/app/settings.tsx
- mobile/src/i18n/overlay/en.json
- mobile/src/i18n/overlay/ru.json

## Verify ran
- `node -e "JSON.parse(...)"` on both overlay JSON files — valid.
- `tsc --noEmit` via a temporary symlink to the main checkout's `mobile/node_modules` (this worktree has no `node_modules` of its own and many `src/*` files — e.g. `src/feedback/haptics.ts`, `src/safety/*`, `src/identity/flagTrust.ts` — exist only as **untracked** files in the main repo working copy, not in git history, so this worktree's checkout doesn't have them at all). Result: the project-wide run has ~100+ pre-existing `Cannot find module` / unrelated type errors that reproduce identically on `app/settings.tsx`'s *existing* imports (e.g. `../src/feedback/haptics`, `../src/safety/blocks`) before any of my edits. My new file `src/pc/OpenOnPcSheet.tsx` produces exactly one error, and it's the same pre-existing-environment one (`Cannot find module '../feedback/haptics'`) — i.e. no error introduced by my code itself. Removed the temporary node_modules symlink afterward (not part of the diff).
- Manually reviewed the JSX fragment wrap (`<>...</ScrollView><OpenOnPcSheet .../></>`) for balance — confirmed via `git diff`.
- Did not run the app in a simulator/device (no working Metro/build env in this worktree — see above).

## Connect risk
safe to merge after smoke

## Handoff for morning
- merge branch: admin/20260808T075248Z-045-open-on-pc-phase1-stub
- smoke: open Settings → About → "Open on PC" row → confirm sheet shows `https://ruletka.vip` + friend code, both copy buttons work, Close dismisses. Confirm nothing here is reachable from Start/match/offer path (it isn't — only wired from settings.tsx About section).
- Real `tsc`/build verification should be re-run in an environment that has the (currently untracked in git) `mobile/src/feedback`, `mobile/src/safety`, etc. files present — that gap is pre-existing and unrelated to this task.
- do not: deploy without Play↔PC check
