# Android privacy = PartnerBlurVeil (soft blur product OFF)

## Request
Replace new soft live-blur with the existing Android privacy veil.

## Change
- `SOFT_BLUR_PRODUCT_ENABLED = false` in `mobile/src/live/SoftBlurRemote.tsx`
- `isSoftBlurNativeAvailable()` always false while flag off → LiveStageVideo always uses `PartnerBlurVeil`
- Android Modal restored to full-screen `PartnerBlurVeil` mosaic (not transparent SoftBlur chrome)

## Smoke
- Settings: Hold or Intro → match stranger → mosaic privacy veil + Show video
- Eye toggles veil; RTCView stays mounted under veil
- Log: `[blur] show … softNative=0`

## APK
Needs rebuild/install to ship (JS bundle + Modal layout).
