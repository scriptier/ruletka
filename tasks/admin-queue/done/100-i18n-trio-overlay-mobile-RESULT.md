# 100 — i18n trio overlay keys for hunt caption

## Status
COMPLETE

## What was wrong
Mobile ships only `mobile/src/i18n/overlay/{lang}.json` (small overlay, loaded via
`mobile-overlay.ts` → `MOBILE_BY_LANG`/`MOBILE_EN`), not the full `mobile/src/i18n/packs/*.json`.
`trio.slotEmpty` and `trio.searching` existed in `packs/*.json` (all 14 langs) but were
missing from every `overlay/*.json`. `translate()` in `mobile/src/i18n/index.tsx` falls back
to the raw key when both the lang overlay and `MOBILE_EN` miss — so in principle these two
keys could render as literal `"trio.slotEmpty"` / `"trio.searching"`.

In practice `mobile/app/live.tsx` already had hardcoded English miss-guards at both call sites
(`live.tsx:3538`, `live.tsx:5741-5742`), so the raw key was never actually shown to users —
but non-English users were silently seeing the English fallback string instead of their
localized trio caption.

## Fix
Copied `trio.slotEmpty` and `trio.searching` from `packs/{lang}.json` into `overlay/{lang}.json`
for all 14 supported languages (en, ru, uk, pl, cs, bg, sr, de, es, fr, pt, tr, ar, zh), appended
as new keys — no reordering or reformatting of existing overlay content performed by this change.

Note: all 14 `overlay/*.json` files (and many other mobile/docs files) already had large
pre-existing uncommitted diffs vs HEAD before this task started (visible in `git status` at
session start) — that content is from other in-flight work in this shared tree and was left
untouched. This task's diff is scoped to exactly the two new `trio.*` keys per file.

## Files touched
- `mobile/src/i18n/overlay/en.json`
- `mobile/src/i18n/overlay/ru.json`
- `mobile/src/i18n/overlay/uk.json`
- `mobile/src/i18n/overlay/pl.json`
- `mobile/src/i18n/overlay/cs.json`
- `mobile/src/i18n/overlay/bg.json`
- `mobile/src/i18n/overlay/sr.json`
- `mobile/src/i18n/overlay/de.json`
- `mobile/src/i18n/overlay/es.json`
- `mobile/src/i18n/overlay/fr.json`
- `mobile/src/i18n/overlay/pt.json`
- `mobile/src/i18n/overlay/tr.json`
- `mobile/src/i18n/overlay/ar.json`
- `mobile/src/i18n/overlay/zh.json`

## Verify commands run
- `python3 -c "import json; json.load(open(f))"` on all 14 overlay files — valid JSON.
- `node -e "require('./src/i18n/overlay/<lang>.json')['trio.slotEmpty']"` for en/ru — resolved
  correct localized strings (not raw key).
- Loop over all 14 langs confirming both keys present via `require()` — all present.
- Confirmed both `live.tsx` call sites (`live.tsx:3538`, `live.tsx:5741-5742`) that reference
  these keys already had safe fallback chains, so no regression existed even before this fix —
  this change makes the *localized* (non-English) caption actually resolve instead of always
  falling through to the hardcoded English default.

No APK build performed (out of scope per task).

## Connect risk
none — i18n-only change, no hub/ICE/MediaSession/WebRTC code touched.

COMPLETE
