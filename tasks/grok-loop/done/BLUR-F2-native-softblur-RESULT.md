# BLUR-F2 Native SoftBlurVideoView — RESULT

## Status
**COMPLETE** (native view + manager + package registered). Manual `javac` of all SoftBlur sources **PASS**. Full `./gradlew :app:compileReleaseJavaWithJavac` **not completed in-session** (system JRE lacks compiler; concurrent `assembleRelease` + Metro release bundle blocked clean release task; JDK17 manual compile used instead). **No invent multi PASS.** No APK.

## OWN
- `mobile/android/app/src/main/java/com/oney/WebRTCModule/SoftBlurVideoView.java`
- `mobile/android/app/src/main/java/com/oney/WebRTCModule/SoftBlurVideoViewManager.java`
- `mobile/android/app/src/main/java/me/ruletka/app/SoftBlurVideoViewPackage.java`
- `mobile/android/app/src/main/java/me/ruletka/app/MainApplication.kt` (register package only)
- Prebuild survival (same pattern as RuletkaShortcuts):
  - `mobile/android-patches/SoftBlur/*`
  - `mobile/android-patches/SoftBlurVideoViewPackage.java`
  - `mobile/scripts/patch-android-native.sh`
- **Did not** edit `LiveStageVideo.tsx` / `live.tsx` (siblings F4/F5)
- **Did not** touch MediaSession / ICE / force_relay

## Goal
PC-like soft live blur of remote WebRTC video while privacy on: streamURL → VideoTrack → VideoSink → tiny I420 sample (~48px) → scale-up bilinear → ImageView.

## Design

| Piece | Choice |
|-------|--------|
| Package | `com.oney.WebRTCModule` so package-private `WebRTCModule.getStreamForReactTag` + `ThreadUtils` work (same as library `WebRTCView`) |
| View | `SoftBlurVideoView extends FrameLayout` + full-size `ImageView` (`centerCrop`) |
| Props | `streamURL` (String), `active` (boolean) |
| Resolve | ReactContext → WebRTCModule → getStreamForReactTag → `videoTracks[0]` on WebRTC executor |
| Sink | `active && attached` → `addSink`; else `removeSink` + clear bitmap |
| Frame path | retain → `buffer.toI420()` → sample ~48px ARGB → scale to view (≤480w) FILTER_BILINEAR + dim `rgba(10,12,18,~0.18)` → UI `setImageBitmap` → release |
| Throttle | ~12 fps + single `frameInFlight` drop |
| API 31+ | optional `RenderEffect` blur(4) on ImageView (extra frost; primary blur is downscale) |

## requireNativeComponent name

```ts
// Already wired in SoftBlurRemote.tsx (BLUR-F3):
requireNativeComponent('SoftBlurVideoView')
// props: streamURL: string, active: boolean
export const SOFT_BLUR_NATIVE_NAME = "SoftBlurVideoView";
```

JS usage (F3 wrapper):

```tsx
import { SoftBlurRemote, getStreamUrl, isSoftBlurNativeAvailable } from "./SoftBlurRemote";

{isSoftBlurNativeAvailable() && (
  <SoftBlurRemote
    streamURL={getStreamUrl(remoteStream)}
    active={privacyBlur}
    style={StyleSheet.absoluteFill}
  />
)}
```

## Files touched

| File | Change |
|------|--------|
| `.../com/oney/WebRTCModule/SoftBlurVideoView.java` | FrameLayout + VideoSink soft blur |
| `.../com/oney/WebRTCModule/SoftBlurVideoViewManager.java` | `REACT_CLASS = "SoftBlurVideoView"` |
| `.../me/ruletka/app/SoftBlurVideoViewPackage.java` | ViewManager package |
| `.../me/ruletka/app/MainApplication.kt` | `packages.add(SoftBlurVideoViewPackage())` |
| `mobile/android-patches/SoftBlur/*` + `SoftBlurVideoViewPackage.java` | prebuild re-apply |
| `mobile/scripts/patch-android-native.sh` | copy SoftBlur + register package |

## Verify

```text
# Manual javac (JDK 17) against android-35 + webrtc-124-api + rn-webrtc classes + react-android-api:
javac SoftBlurVideoView.java SoftBlurVideoViewManager.java SoftBlurVideoViewPackage.java
→ JAVAC_EXIT:0  (warnings only: kotlin annotation retention on RN stubs)
```

Full Gradle release compile was **not** green in this hop:
- Default `/usr/lib/jvm/java-21-openjdk` = runtime without `javac` (`JAVA_COMPILER` capability missing)
- With `JAVA_HOME=/home/drakosik/.local/jdk-17`, `:app:compileReleaseJavaWithJavac` still pulls `:app:createBundleReleaseJsAndAssets` (Metro); concurrent `assembleRelease` from another process contended the daemon

**Next hop (F6):** APK build with JDK17 + install smoke for soft blur visible under privacy.

## Multi product claim
**Not claimed.** No multi device smoke. No invent multi PASS.

## Risks
- Package-private cross-module access to `getStreamForReactTag` relies on same package name in app dex (standard Android/RN patch pattern; matches library `WebRTCView`).
- Extra VideoSink is CPU cost while privacy on — throttled to ~12fps + tiny 48px sample.
- If streamURL changes before resolve finishes, rebind guards drop stale attach.
- ImageView sits in RN z-order (not SurfaceView) — F4 stage integrate must place it **above** partner RTCView with elevation so soft blur covers clear video.

## Merge advice
- Safe with F3 (wrapper already expects `SoftBlurVideoView`).
- F4 mounts SoftBlurRemote over partner tile when privacy on; PartnerBlurVeil fallback if native missing.
- F5 Modal chrome should stay transparent enough for soft blur to show.
- APK only after human **proceed** / F6 smoke hop.
