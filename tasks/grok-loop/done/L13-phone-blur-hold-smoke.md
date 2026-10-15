# L13 Phone blur Hold smoke (EXCLUSIVE)

## Goal
APK 0.1.367-vc375: Settings blur Hold → match → veil_visible + [blur] show in logcat.

## OWN exclusive adb
export ANDROID_HOME=$HOME/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$PATH
S=45141FDAP0004F

## Work
1. Confirm package 0.1.367 / 375
2. SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=25 device-smoke
3. During match: logcat [blur]; UI dump for Show video / Privacy
4. RESULT veil_visible yes|no + logs. No invent multi PASS.

## RESULT
tasks/grok-loop/done/L13-phone-blur-hold-smoke-RESULT.md
