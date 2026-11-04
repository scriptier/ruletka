# 512 RESULT — i18n: 3-way pair vs 3rd copy

**COMPLETE**

## Scope check

Audited every locale in `mobile/src/i18n/packs/`, `mobile/src/i18n/overlay/`, and `ui/i18n/` against `en.json` for keys used by the trio/pair banners (`trio.*`, `*noCam*`, `*audioOnly*`, find-3rd/find-fourth copy).

- `mobile/src/i18n/packs/*`: already complete for all 14 locales, no changes needed.
- `mobile/src/i18n/overlay/*`: all 13 non-en locales were missing `mobile.live.noCamTitle` / `mobile.live.noCamSub` (the no-cam "Talking with microphone" badge). Filled.
- `ui/i18n/*`: all 13 non-en locales were missing `remote.audioOnly`, `local.audioOnly`, `remote.noCamTitle`, `remote.noCamSub`, `local.noCamTitle`, `local.noCamSub`. Filled.
- `trio.stripSoloVsParty` ("You vs a pair"), `trio.peerRetry` / `trio.iceRestart` (3rd connecting), and all other `trio.*` keys were already present in every locale — no gap there.

## Why ui/i18n gap wasn't visible on-site

`ui/i18n.js` bundles full `en` and `ru` dictionaries directly and merges `STR.en` as the base for any other language before applying that language's JSON pack (`Object.assign({}, STR[c] || STR.en, j, …)`). So missing keys in a locale JSON silently fell back to English text rather than breaking — but the pack itself was incomplete. `ru` was functionally fine (bundled Russian already had these strings); filled `ru.json` too for consistency, using the exact text already bundled in `ui/i18n.js` so no visible change for existing ru users.

`ui/i18n.js` was **not** edited — its bundled `en`/`ru` blocks already contained these keys; only the on-disk locale packs needed filling.

## Files changed

- `mobile/src/i18n/overlay/{ar,bg,cs,de,es,fr,pl,pt,ru,sr,tr,uk,zh}.json` — added `mobile.live.noCamTitle`, `mobile.live.noCamSub`.
- `ui/i18n/{ar,bg,cs,de,es,fr,pl,pt,ru,sr,tr,uk,zh}.json` — added `remote.audioOnly`, `local.audioOnly`, `remote.noCamTitle`, `remote.noCamSub`, `local.noCamTitle`, `local.noCamSub`.

Translations were derived from existing in-file vocabulary for "camera" / "microphone" (e.g. `local.noDevice`, `mobile.live.partnerHiddenBody`, `audio.multiPeerBody`) to keep terminology consistent per locale. All 26 edited files validated as parseable JSON.

## Not touched (out of scope / pre-existing)

- `mobile.live.blurTapAnywhere(Hint)` — missing in the same overlay locales but unrelated to trio/pair/no-cam copy; left alone.
- Several overlay/en.json and ui/i18n/en.json lines already showed as modified in git status before this task started (unrelated prior session work, e.g. `stars.unlockEasterEgg*`, `mobile.settings.noiseReduction*`) — not touched further, just left as-is.
- No edits to `live.js`, `live.tsx`, CSS, MediaSession, or APK, per task constraints.

## Verify

Re-ran the missing-key diff for `trio*`, `*noCam*`, `*audioOnly*`, `pair`, `3rd` across all three directories — zero missing after the fix.

## Merge advice

Pure i18n JSON additions, no code paths touched. Safe to merge; no smoke test needed beyond a visual spot-check of the no-cam badge / find-3rd banner in a non-English locale if desired.
