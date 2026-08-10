# RESULT — 146 docs-device-smoke-blur-line

## Status
COMPLETE

## Audit
`docs/DEVICE_SMOKE.md` smoke-matrix item **29** still read:

> Stranger blur-first → Show video; Settings blur pref

That describes the *old* default (`blurStrangersMode: "intro"`, blur-on-by-default). Checked
current source of truth:
- `mobile/src/prefs/store.ts` — `DEFAULTS.blurStrangersMode = "off"` (CONNECTIVITY_LOCK: connect
  first, clear video fast; comment explicitly notes the old forced-hold/intro default was undone).
- `mobile/app/live.tsx` (~line 1559) — "Privacy veil only if Settings intro/hold (default off =
  fast clear video)."
- `mobile/src/i18n/overlay/en.json` `mobile.settings.blurStrangersHint` — "Off = fastest connect
  (default). Brief = soft veil ~2.5s then open. Hold = veiled until Show video."

So item 29 contradicted both the code and the doc's own **P1** row ("Match with blur **Off** →
cams link without black veil"), which already reflects the current default correctly. Rest of the
blur-related lines in the doc (P1–P8, header Notes) already match current behavior — only item 29
was stale.

## Fix
One-line edit to item 29 to match the actual default-off behavior and the Brief/Hold opt-in modes
(reusing existing `mobile.settings.blurMode*` / `mobile.live.unblurShort` copy, no new strings):

```
- | 29 | Stranger blur-first → Show video; Settings blur pref | |
+ | 29 | Stranger clear by default (Off); Settings **Brief/Hold** → veiled → Show video | |
```

## Files touched
- `docs/DEVICE_SMOKE.md` (1 line)

## Verify commands run
- `grep -n -i blur docs/DEVICE_SMOKE.md` — confirmed remaining blur lines (12, 37, 41, 44) are
  consistent with current default; no other stale blur-first assumptions found.
- `git diff -- docs/DEVICE_SMOKE.md` — confirmed the only new delta on top of the existing
  working-tree docs refresh is this one line.
- Read-only audit of `mobile/src/prefs/store.ts`, `mobile/app/live.tsx`,
  `mobile/src/i18n/overlay/en.json` to confirm default/mode copy before editing (no code changed).

## Connect risk
none — docs-only change, no code/behavior touched.

COMPLETE
