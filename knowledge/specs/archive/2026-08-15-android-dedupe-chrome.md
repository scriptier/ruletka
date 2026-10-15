# Spec: Android 3-way — one identity, no gift/chat compose

**Status:** active · herd 20260815T221947Z  
**Shot:** `artifacts/shots/20260815T160739Z-android-doubles.png`

Human: top has **doubles** of name / flag / loc; extra ★ top-right; gifts + Message + Send eat the stage. Tap-face partner actions replace gifts/chat compose.

```text
GOAL: One identity belt; more stage for faces; gifts/chat compose off the matched bar.
DONE WHEN:
  1) Primary 3-way tile does NOT mount StageTileChrome (dock is the only name/flag/loc).
  2) Dock does not paint top-right ★ (PartnerIdentityDock showStars=false).
  3) Extra tiles KEEP StageTileChrome (409 no-cam chrome hop).
  4) Matched native (and browser dock) do not render LiveGiftBar or Message/Send row.
  5) Incoming LiveChatOverlay may stay (no compose). First VideoView key stays.
EVAL:
  - node mobile/scripts/verify-match-ux.mjs
  - grep: no StageTileChrome on multiRemote primary; ExtraRemoteTile still has it
  - grep: LiveGiftBar / chatSend not in matched native compose (or gated off)
CHECKPOINTS: none — human asked proceed + build
OUT OF SCOPE: MediaSession, ICE, remount, invent MULTI_PASS
MUST NOT: pool>0, push.sh, hunt remount, remove extra-tile chrome
MAX HOPS: 1 then APK then human smoke
```
