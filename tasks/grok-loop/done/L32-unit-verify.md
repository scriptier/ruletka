# L32 unit verify

## Goal
Run unit + match-ux verify; optional one cheap test fix only if fail is trivial and non-product-thrash.

## Work
1. `./scripts/dev-smoke.sh --unit` (or project unit entry) from repo root
2. `node mobile/scripts/verify-match-ux.mjs`
3. RESULT with exit codes / counts
4. No invent blur/multi product PASS from unit green

## OWN
- Read-only preferred; optional tiny pure test fix only if unit fail is test-side
- RESULT: `tasks/grok-loop/done/L32-unit-verify-RESULT.md`

## Must not
SoftBlur/MediaSession product thrash, invent blur PASS, force-push, APK/deploy, adb, live.js dual-write
