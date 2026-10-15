# 530 — Android partner-actions i18n — RESULT

**Status:** COMPLETE

## What changed
Keys for the tap-a-face partner actions menu:
- `mobile.live.partnerActions` = "Partner actions"
- `mobile.live.actionsFor` = "Actions · {name}"
- `mobile.live.tapPartnerHint` = "Tap a face for their actions"

`mobile/src/i18n/overlay/*.json` already had these 3 keys, fully translated in
all 14 languages, as an uncommitted change already present in this worktree
before this session started (confirmed via `git diff`, not re-added). This is
the runtime-authoritative table: `mobile/src/i18n/index.tsx` → `mobile-overlay.ts`
loads only `./overlay/*.json` on device, so the feature was already correctly
localized for the app.

This session added the same 3 keys to `mobile/src/i18n/packs/en.json`, which
the task's OWN list names explicitly (not conditionally) alongside overlay.
Other pack languages (`packs/{ru,de,...}.json`) do **not** have any
`mobile.live.*` key path yet, so per "other packs only if you already have the
same key path" they were correctly left untouched.

Note: the spec's key description used `{{name}}` (double braces), but this
codebase's mobile `format()` interpolates single-brace `{name}` (see
`mobile/src/i18n/index.tsx`, and every existing key like
`mobile.live.rateTitle: "Rate {name}?"`). Used the single-brace form to match
the actual template engine and existing convention; double braces would have
rendered literally as `{John}`.

## Files touched
- `mobile/src/i18n/packs/en.json` (added 3 keys, this session)
- `mobile/src/i18n/overlay/*.json` (all 14 langs — already present, unchanged this session, verified intact)

## Verify commands run
- `python3 -c "import json; json.load(open('mobile/src/i18n/packs/en.json'))"` — OK
- Same JSON validity check looped over all 14 `mobile/src/i18n/overlay/*.json` — all OK
- `git diff mobile/src/i18n/packs/en.json | grep -A3 -B1 mobile.live` — confirmed the 3 new keys landed correctly, alphabetically ordered before `mobile.settings.*`
- Confirmed via `grep` that no `packs/{lang}.json` other than `en.json` has any `mobile.live.*` key, so no other pack files needed edits

No task-local test script was listed for this task (i18n key addition only),
so no further verify script was run.

## Connect risk
none — no changes to live.tsx, LiveStageVideo, MediaSession, ICE, TURN, or any
connectivity path. Pure JSON string-table additions.

COMPLETE
