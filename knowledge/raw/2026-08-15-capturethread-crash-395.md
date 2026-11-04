---
title: CaptureThread crash on 0.1.395 (21:50:59)
date: 2026-08-15
slug: capturethread-crash-395
source_type: logcat
source_path: artifacts/shots/20260815T035149Z-crashnow-phone.png
captured_by: agent
skill: add-new-resource
---

# Raw: CaptureThread crash 0.1.395

## Source
- Pixel 9 Pro `45141FDAP0004F`
- APK **0.1.395 / vc403** (`me.ruletka.app`)
- Time: 2026-08-14 21:50:59 local (2026-08-15 03:50Z)
- Phone after: launcher. App DEAD. PC match tab gone (Grok TUI).

## Stack

```
FATAL EXCEPTION: CaptureThread
Process: me.ruletka.app, PID: 27715
java.lang.IllegalStateException: Session has been closed; further changes are illegal.
at android.hardware.camera2.impl.CameraCaptureSessionImpl.setRepeatingRequest
at org.webrtc.Camera2Session$CaptureSessionCallback.onConfigured(Camera2Session.java:174)
```

## Sequence (same second)

1. CameraCapturer startCapture 640x480@24 — **new GUM**
2. Camera2Session create + Opening camera 1
3. `rn-webrtc:pc:DEBUG 55 ctor` + `[blur] prefs_load mode=intro` + `[audio] ns=1`
4. Camera capture session configured (old callback)
5. Camera 1: Shutting down / disconnect
6. Old onConfigured → FATAL → SIG 9

Same class as 20:04:34 on 0.1.393. 394 skip GUM only when `multiPeerAudio`. 1v1 `refreshLocalVideoTrack` / new session `openLocalStream` still GUMs while Camera2 is configuring.

## Shots
- `artifacts/shots/20260815T035149Z-crashnow-phone.png` — home screen
- `artifacts/shots/20260815T035149Z-crashnow-pc.png` — no live match (TUI)
