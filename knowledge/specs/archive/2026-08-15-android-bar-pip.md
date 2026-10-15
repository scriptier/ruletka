# Spec: Android 1v1 bar — no overlap on self cam

**Status:** active · herd 20260815T225522Z  
**Shots:** `artifacts/shots/20260815T165215Z-android-1v1-bar.png` · `165142Z`

Human: likes self cam at bottom. Buttons overlap the picture. Remove Report + Friends. Shift remaining buttons left.

```text
GOAL: Stop / Next / mic / flip / mute / blur / more sit left of the self PiP; no overlap.
DONE WHEN:
  1) LiveBottomBar matched: no live-report-btn, no live-friends-btn.
  2) Icon row + Stop/Next are left-aligned with paddingRight >= PIP_W (108) so they clear the PiP.
  3) Report still exists in partner-actions sheet (tap face).
  4) First VideoView key=live-first-remote stays.
EVAL:
  - node mobile/scripts/verify-match-ux.mjs
  - grep LiveBottomBar: no live-report-btn / live-friends-btn; PIP_W or paddingRight 108+
CHECKPOINTS: verify first — no APK until green
OUT OF SCOPE: MediaSession, ICE, remount, invent MULTI_PASS
MUST NOT: pool>0, push.sh, remount RTC, restore stage gift bar
MAX HOPS: 1 then wait for build ask
```
