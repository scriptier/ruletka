# 494 — i18n: Stop/Next 3-way keys on Android overlay + packs

## Status
COMPLETE

## What changed
Added the 5 Stop/Next 3-way keys to all 14 `mobile/src/i18n/overlay/*.json` and all 14 `mobile/src/i18n/packs/*.json` files, matching the meaning/wording already used in `ui/i18n/<lang>.json` (web source of truth):

- `btn.stopLeaveCall`
- `btn.stopLeaveCallTitle`
- `btn.stopLeaveThird`
- `btn.stopLeaveThirdTitle`
- `btn.nextSoloTitle`

Values were copied 1:1 from `ui/i18n/*.json` per language (ar, bg, cs, de, en, es, fr, pl, pt, ru, sr, tr, uk, zh — all present on both sides), so wording matches web exactly.

Insertion points (alphabetical, consistent with each file's existing key ordering):
- overlay: `btn.nextSoloTitle` after `btn.next`; the 4 `stopLeave*` keys after `btn.stop`.
- packs: `btn.nextSoloTitle` after `btn.nextHuntingTitle` (before `btn.nextStranger`); the 4 `stopLeave*` keys after `btn.stop` (before `btn.stopPartyTitle`).

## Files touched
- `mobile/src/i18n/overlay/{ar,bg,cs,de,en,es,fr,pl,pt,ru,sr,tr,uk,zh}.json`
- `mobile/src/i18n/packs/{ar,bg,cs,de,en,es,fr,pl,pt,ru,sr,tr,uk,zh}.json`

(28 files; `live.tsx` / `LiveStageVideo` / `MediaSession` untouched — no wiring, keys only.)

## Verify commands run
- `python3 -c "import json; json.load(open(f))"` over all 28 touched files — all valid JSON.
- Key-count diffing before/after per file confirmed exactly +5 keys added, nothing else changed (overlay en.json: 671 → 676 content keys; packs en.json: 1908 → 1913 keys).
- `grep -n "stopLeaveCall|stopLeaveThird|nextSoloTitle"` across all overlay + pack files confirms all 5 keys present with correct per-language values.

Note: the working tree's overlay files were already heavily modified relative to `main` before this task started (large pre-existing diff, part of other in-progress work in this shared tree). This task only adds the 5 keys on top of that existing state — verified via key-count diffing, not via `git diff` against HEAD (which is noisy due to unrelated prior changes).

## Connect risk
none — i18n key/value additions only, no code paths reference these keys yet (label hop is a separate later task per spec).

COMPLETE
