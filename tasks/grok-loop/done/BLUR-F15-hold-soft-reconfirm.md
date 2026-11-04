# BLUR-F15 Hold soft reconfirm after MX multi code

## Goal
After MX1–MX5 multi MediaSession/live changes: quick **Hold** soft reconfirm on tip **0.1.371** via **wireless adb** (USB may be no-permissions). Expect softNative=1 + Sink. No invent multi SoftBlur PASS.

## OWN
- Phone exclusive one adb: prefer `-s 192.168.1.94:42227` (or current wireless)
- RESULT: tasks/grok-loop/done/BLUR-F15-hold-soft-reconfirm-RESULT.md
- Read-only product code

## Work
1. export PATH=$HOME/Android/Sdk/platform-tools:$PATH; adb connect if needed
2. Confirm package 0.1.371/379
3. Settings Hold → match WebPair → logcat softNative=1 + Sink
4. Artifacts mobile/artifacts/device-smoke/f15-blur/
5. If no device BLOCKED

## Must not
Force-push, invent multi PASS, edit SoftBlurRemote/MediaSession
