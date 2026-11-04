# Spec: Partner actions — gifts + message; drop messy rows

**Status:** active · herd 20260815T224336Z  

**Human:** tap partner actions → message + gifts + send. Remove flip, blur again, mute partner, browser-style layout.

```text
GOAL: Partner-actions sheet is gifts + chat + keep-pair safety, not a settings dump.
DONE WHEN:
  1) LiveMoreSheet shows compact LiveGiftBar + Message field + Send.
  2) Sheet does not show mute / blur / flip cam / browser-style layout rows.
  3) live.tsx still has no stage LiveGiftBar / chat compose (410 hop).
  4) Extra slots still hide find-3rd / debate / browse. First VideoView key stays.
EVAL:
  - node mobile/scripts/verify-match-ux.mjs
  - grep LiveMoreSheet: LiveGiftBar, chatSend; no more-partner-mute / more-blur / flipCam / onToggleLiveLayout
CHECKPOINTS: none — proceed + verify + build
OUT OF SCOPE: MediaSession, ICE, remount, invent MULTI_PASS
MUST NOT: pool>0, push.sh, restore stage gift bar, remount live-first-remote
MAX HOPS: 1 then APK
```
