# W8 mobile trio.* overlay keys

## Goal
Android t() overlay has trio.slotEmpty + trio.searching so hunt caption never paints raw key.

## OWN
- mobile/src/i18n/ overlay source only (find where EN overlay lives — packs may not load)
- OR mobile i18n loader if needed for miss-guard t(k)!==k fallback

## Work
1. Find how mobile t() resolves keys (overlay vs packs).
2. Add trio.slotEmpty / trio.searching to the surface that actually loads.
3. RESULT COMPLETE. No APK.

## Must not
Full 14-locale thrash, deploy, MediaSession
