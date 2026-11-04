# T8 Phone Settings UI exclusive

## Goal
Open ruletka://settings on Pixel; dump+shot; version chip; no crash.

## OWN exclusive phone 45141FDAP0004F
export ANDROID_HOME=$HOME/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$PATH

## Work
1. force-stop me.ruletka.app; am start ruletka://settings
2. uiautomator dump + screencap; scroll for version chip 0.1.366/374
3. logcat FATAL 10s
4. RESULT COMPLETE. No invent PASS.

## Must not
device-smoke concurrent, friends concurrent, deploy, APK
