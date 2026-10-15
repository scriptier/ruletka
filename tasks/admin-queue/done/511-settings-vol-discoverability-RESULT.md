# 511 — Settings volume discoverability — RESULT

## Status
COMPLETE

## What changed
Audited the Settings sheet (Devices view) "Partner audio" / "Your microphone" rows for
label clarity, since the quick volume control was pulled off the stage rails and Settings
is now the only place to reach it.

- `settings.speaker` (device picker), `settings.partnerVol` ("Partner volume", with a live
  `%` readout) and `settings.micBoost` ("Mic boost", with `%` readout + inline hint) rows
  were already present and clearly labeled with distinct section headers
  (`settings.secAudio` "Partner audio" vs `settings.secMic` "Your microphone"), so no
  wording changes were needed there.
- Found and fixed a real gap: the Settings-sheet Partner volume `<input type="range" id="remote-vol-sheet">`
  had **no** `title`/`aria-label`, unlike its stage-rail twin (`#remote-vol`, which uses
  `data-i18n-title="vol.partner"` / `data-i18n-aria="vol.partnerAria"`) and unlike the
  Mic boost slider right below it in the same sheet. Screen-reader / hover-title users had
  no label on that control.
- Fixed by adding the same `data-i18n-title="vol.partner"` / `data-i18n-aria="vol.partnerAria"`
  attributes (plus literal `title`/`aria-label` fallbacks) to `#remote-vol-sheet`, reusing
  the existing `vol.partner` / `vol.partnerAria` i18n keys already translated in all 14
  language packs — no new i18n strings required.

## Files touched
- `ui/live.html` (Settings → Devices view, Partner volume row, ~line 2154)

## Verify commands run
- `grep -n '"vol.partner"\|"vol.partnerAria"'` across all `ui/i18n/*.json` — confirmed all
  14 live-call locale packs already carry both keys (only the non-locale `meta.json` /
  `home-en.json` lack them, as expected — those aren't live-call packs).
- Manual read-through of `ui/live.html` Settings sheet markup (Devices view) and the JS
  wiring (`ui/live.js` — `on("remote-vol-sheet", ...)`, `$("remote-vol-sheet")`) to confirm
  the id/behavior wasn't touched, only the missing a11y/title attributes were added.
- No build step for this static HTML/i18n change; no `tsc`/test runner applicable.

## Connect risk
none — i18n/HTML label-only change in the Settings sheet, no CONNECTIVITY_LOCK, ICE,
offer, or MediaSession code touched.

## Notes
Pre-existing uncommitted changes to `ui/live.html` and `ui/i18n/*.json` (stage-rail
polish, unrelated to this task) were already present in the working tree from other
agent activity; per factory rules I did not touch or revert them and only edited the
one line relevant to this task.

COMPLETE
