# Android crashed once (2026-08-12)

## Device log
- Wireless adb 192.168.1.94 — no FATAL EXCEPTION left in ring buffer (rotated after restart).
- App rebooted cleanly; version was **0.1.371-vc379** (overnight SoftBlur product ON).

## Likely cause
SoftBlurVideoView VideoSink + dual-path while product soft blur enabled on 371; race on frame retain after detach.

## Mitigation shipped **0.1.372-vc380**
1. `SOFT_BLUR_PRODUCT_ENABLED = false` (privacy veil only)
2. SoftBlurVideoView: safe retain, shutdown executor on detach, schedule reject guard
3. Includes multi layout gate + MX2 android multi audit landings if any

## User
Install/open 0.1.372 from Download or adb install done on wireless.
If crashes again: note action (match / find-3rd / blur) and keep app open for logcat.
