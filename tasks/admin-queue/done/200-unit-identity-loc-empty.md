# Unit: identity loc empty + Partner placeholder name

## Goal
Pixel smoke showed infinite "Looking up location…" and top chrome "Partner" vs dock short-id. Code fixed in 0.1.332 — **lock with unit tests**.

## OWN (only these)
- `mobile/src/identity/formatLocLine.test.mjs` and/or new `mobile/src/live/partnerIdentityDisplay.test.mjs`
- Optional tiny pure helper extract if needed for testability (no live.tsx rewrite)

## Do
1. Assert empty geo → formatLocLine "" (not pending string)
2. Assert flag-only still produces non-empty loc
3. Assert name "Partner" / empty treated as placeholder → short-id preferred in pure helper if you extract one
4. Run: `node` the test file + `cd mobile && npm run test:match-ux`

## Must not
- Deploy, APK build, force_relay, pool, ICE thrash
- Rewrite PartnerIdentityDock UI (already fixed — tests only)

## Done
- Test green; RESULT with Status COMPLETE + files
