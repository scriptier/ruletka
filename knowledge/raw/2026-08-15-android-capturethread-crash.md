---
title: Android CaptureThread crash mid 3-way (0.1.393)
date: 2026-08-15
source_type: logcat
---

20:04:34 Pixel 9 Pro 45141FDAP0004F · me.ruletka.app v401 (0.1.393)

```
FATAL EXCEPTION: CaptureThread
java.lang.IllegalStateException: Session has been closed; further changes are illegal.
at android.hardware.camera2.impl.CameraCaptureSessionImpl.setRepeatingRequest
at org.webrtc.Camera2Session$CaptureSessionCallback.onConfigured
```

App died PID 5470; restarted 20:04:45 PID 15330. SoftBlur: No video track after restart.

CDP 9222 `020601Z` live.js 646 / webrtc 331:
- Names CORRECT: left Courtier · mid Laptop · you Dragonov
- stage-trio · 2 PCs (teammate ice=disconnected live tracks; stranger ice=connected muted)
- Banner Connection weak — reconnecting (phone died)

Phone after restart: 1v1 black Partner ★0 + self PiP.

Cause class: second getUserMedia / Camera2 restart while onConfigured in flight (3-way startCall2 / outbound-zero refresh / applyFullAudioProcessing). Not SoftBlur SIGABRT (gotcha 33 / tombstone_21 is 2026-08-13).

Disk hop: skip refresh GUM when multiPeerAudio; latch multi before startCall2; no mid-3-way applyFullAudioProcessing.
---
