# BLUR-F9 multi SoftBlur static residual

## Goal
Static audit: multi-tile SoftBlur path on Android (LiveStageVideo splitTiles / remote2/3) still wired after F4; list gaps for device multi SoftBlur (not invent PASS).

## OWN
- Read-only: `mobile/src/live/LiveStageVideo.tsx`, SoftBlurRemote, PartnerBlurVeil
- Optional: `node mobile/scripts/verify-match-ux.mjs` only
- RESULT: `tasks/grok-loop/done/BLUR-F9-multi-soft-static-RESULT.md`
- No product edit unless one-line bug with clear fail (prefer RESULT-only audit)

## Work
1. Confirm privacy + softNative + getStreamUrl per multi tile
2. Note hunt/lookingForThird tiles vs remotes
3. Explicit **NOT multi SoftBlur device PASS**
4. COMPLETE + move card done

## Must not
adb invent multi PASS, MediaSession thrash, force-push, APK

## Factory
Director tick · blur residual multi
