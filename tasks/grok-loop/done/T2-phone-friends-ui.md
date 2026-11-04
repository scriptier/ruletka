# T2 Phone Friends screen UI dump

## Goal
adb: open Friends deep-link or navigate; uiautomator dump + screencap; no crash.

## OWN exclusive phone after T1 frees
- ANDROID_HOME + adb serial Pixel
- RESULT only

## Work
1. am start friends route if scheme known (ruletka:// or expo)
2. dump UI, shot, check FATAL logcat 15s
3. RESULT COMPLETE

## Must not
Simultaneous device-smoke
