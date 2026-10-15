# T3 Phone Settings UI after Friends frees phone

## Goal
Open Settings on Pixel; dump UI + screencap; no crash; note version chip.

## OWN exclusive phone
export ANDROID_HOME=$HOME/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$PATH
adb -s 45141FDAP0004F ...

## Work
1. Deep-link or am start settings route if known; else tap via uiautomator if simple
2. shot + dump + logcat FATAL 10s
3. RESULT COMPLETE. No invent PASS.
