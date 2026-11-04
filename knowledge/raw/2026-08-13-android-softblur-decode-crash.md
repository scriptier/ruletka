# Android native crash linking with PC browser

**When:** 2026-08-13 23:06:34 MDT  
**Device:** Pixel 9 Pro `45141FDAP0004F` · package **0.1.378 / vc386**  
**Pair:** Android ↔ PC browser, intro blur on

## Sequence (logcat)

1. `setRemoteDescription` then `iceConnectionState=closed` (no local/remote desc)
2. `ontrack` 18ms later
3. `[blur] show why=heal_matched mode=intro`
4. `[blur] show why=stage … softNative=1`
5. `SoftBlurVideoView: Sink attached for <streamURL>`
6. SurfaceView create
7. `createAnswer` / `setLocalDescription` / ICE **checking**
8. **~2.0s later** `Fatal signal 6 (SIGABRT)` tid **DecodingQueue** `libjingle_peerconnection_so.so`

Tombstone: `tombstone_21` · `data_app_native_crash` · Force finish MainActivity.

## Cause (product)

SoftBlur native `addSink` is a **second VideoSink** on the same remote track as RTCView, attached **during ICE / intro veil**. Decoder abort on Pixel 17 / RN WebRTC.

## Disk hop (needs APK)

`LiveStageVideo` SoftBlur only when `mediaReady` (matched + remote media + not awaiting). Linking uses PartnerBlurVeil only.

**No product.ok invent.**
