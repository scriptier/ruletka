# BM1 Phone blur forensics (EXCLUSIVE PHONE)

## Goal
Prove whether privacy veil mounts mid-match on Pixel 0.1.366-vc374.

## OWN exclusive adb
export ANDROID_HOME=$HOME/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$PATH
S=45141FDAP0004F OUT=mobile/artifacts/device-smoke

## Work
1. SKIP_INSTALL device-smoke OR match via WEB_PAIR so phase=matched.
2. During match: adb logcat -d | grep -iE '\[blur\]|PartnerBlur|veil' | tail -40
3. uiautomator dump — look for Show video / Privacy / blur Modal
4. Screencap matched state
5. RESULT: veil_visible yes|no|unknown; blur logs present; paths to shots
6. No invent multi PASS. No code rewrite this hop (forensics only).

## RESULT
tasks/grok-loop/done/BM1-phone-blur-forensics-RESULT.md COMPLETE
