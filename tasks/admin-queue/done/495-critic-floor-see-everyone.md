# Second critic (read-only): stage floor + 3-way see-everyone

## Goal
Read-only review of disk after herd `20260814T080020Z` + Grok floor hop. Do **not** invent MULTI_PASS.

## OWN
- `tasks/admin-queue/done/` RESULT file only (write RESULT when complete)

## Check
1. `#tile-floor-partner` is a child of `#stage`, not inside `#tile-remote`
2. 3-way/4-way CSS reserves padding so floor does not cover faces (`--stage-dock-h`)
3. 1v1 floor still partner-column only (not full width)
4. 2×2 button only when 4 people (`stage-quad` / people===4)
5. `syncNextButtonCopy` sets Leave 3rd / Leave call by `yourRole`
6. `live.html` pins match bodies: live.js 598, stage 413, i18n 252 (re-read file)
7. pool=0; no force_relay flip; no MULTI_PASS invent

## Done
- [ ] RESULT lists pass/fail per check with file:line
- [ ] COMPLETE
- [ ] No product file edits

## Must not
- Edit ui/ live.js live.html live-stage.css mobile/ wiki
- Deploy, APK, ICE
