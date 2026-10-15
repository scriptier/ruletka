# i18n trio.searching / slotEmpty reconfirm

## Goal
Reconfirm `trio.searching` and `trio.slotEmpty` exist in ui/i18n packs (en,ru,uk,de,es,fr at minimum). Fill missing only if any. No invent product PASS.

## OWN
- `ui/i18n/*.json` only
- RESULT: `tasks/grok-loop/done/i18n-trio-keys-reconfirm-RESULT.md`
- Card → `done/` when COMPLETE

## Work
1. Grep packs for trio.searching / trio.slotEmpty
2. Add missing keys using en as source only if absent
3. RESULT table pack → present/added

## Must not
MediaSession, live.js, deploy, APK, force-push, invent multi PASS
