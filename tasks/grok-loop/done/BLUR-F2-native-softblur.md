# BLUR-F2 Native SoftBlurVideoView

## Goal
Finish Android native soft live blur: SoftBlurVideoView (+ Manager) registered so RN `SoftBlurVideoView` resolves. Package `com.oney.WebRTCModule` for `getStreamForReactTag`.

## Disk already
- `mobile/android/app/src/main/java/com/oney/WebRTCModule/SoftBlurVideoView.java` (~477 lines) — VideoSink, ~12fps, tiny~48, ImageView, optional RenderEffect
- **Missing:** SoftBlurVideoViewManager.java, package registration in MainApplication / ReactPackage, RESULT

## OWN
- `mobile/android/app/src/main/java/` only (SoftBlur* + minimal package register)
- Prefer same package `com.oney.WebRTCModule` as view
- Register view manager so `requireNativeComponent('SoftBlurVideoView')` works (F3 name)

## Work
1. SoftBlurVideoViewManager.java — props `streamURL` (string), `active` (boolean)
2. Register package (MainApplication.kt or dedicated Package) without breaking existing WebRTC
3. Ensure SoftBlurVideoView implements setStreamURL / setActive; resolve track via WebRTCModule.getStreamForReactTag
4. RESULT COMPLETE at `tasks/grok-loop/done/BLUR-F2-native-softblur-RESULT.md`
5. No invent device PASS (F6 owns APK smoke)

## Done criteria
- [ ] Manager + registration on disk
- [ ] View compiles conceptually (note any gradle gaps)
- [ ] RESULT + COMPLETE + non-claim product soft-blur PASS

## Must not
- LiveStageVideo / SoftBlurRemote.tsx / live.tsx Modal (F3–F5 done)
- Deploy, force-push, adb exclusive (F6 may hold phone)
- MediaSession / ICE

## Factory
Director tick 2026-08-12 · plan §F F2 critical path
