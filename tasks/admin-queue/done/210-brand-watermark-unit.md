# Unit/verify: BrandWatermark exists + LiveStageVideo import

## Goal
Lock brand watermark presence with a pure static check (verify-match or unit test). `mobile/src/live/BrandWatermark.tsx` already exists — ensure it is imported/used by `LiveStageVideo` and cannot regress silently.

## OWN (only these)
- `mobile/scripts/verify-match-ux.mjs` and/or new `mobile/src/live/brandWatermark.test.mjs` (or similar pure `.test.mjs`)
- Optional **minimal** wire only if missing: `mobile/src/live/LiveStageVideo.tsx` import + mount of `<BrandWatermark />` (no layout thrash, no live.tsx rewrite)
- Do **not** touch GiftFxOverlay, MediaSession, ICE, device-smoke

## Do
1. Assert file exists: `mobile/src/live/BrandWatermark.tsx` exports `BrandWatermark`
2. Assert `LiveStageVideo.tsx` imports `BrandWatermark` (and mounts it when appropriate / always-on stage mark — match existing component intent)
3. Prefer adding 1–2 checks to `verify-match-ux.mjs` **or** a pure `*.test.mjs` auto-picked by `test-live-units.mjs`
4. Run: `cd mobile && node scripts/verify-match-ux.mjs` and/or `node` the new test + `npm run test:match-ux` if you touched verify-match

## Must not
- Deploy, APK build, force_relay, pool, ICE thrash, dual-write MediaSession
- Rewrite GiftFx, PartnerIdentityDock, live.tsx chrome

## Done
- Checks green; RESULT with Status COMPLETE + files + connect risk none
