# T5 Phone Friends empty + Retry soft tap

## Goal
Exclusive phone: open ruletka://friends; if Retry visible soft-tap once; dump+shot; no crash. No long match.

## OWN exclusive phone Pixel 45141FDAP0004F
ANDROID_HOME + adb only. RESULT COMPLETE.

## Work
1. force-stop; am start ruletka://friends
2. uiautomator dump; if Retry/Повторить exists tap once; re-dump + shot
3. logcat FATAL 10s
4. RESULT COMPLETE. No invent PASS / multi GOAL_MET.

## Must not
device-smoke simultaneous, settings concurrent, deploy, APK
