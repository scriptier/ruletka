# Spec: Android extra no-cam tile — identity over cylinder

**Status:** human-ok · 2026-08-15 · APK **0.1.409/vc417** · not MULTI_PASS  
**Human:** 3-way 3rd tile — name + ★ flash, then no-cam picture covers them. Want name, location, flag, ★ **over** the picture.

```text
GOAL: 3rd (and 4th) conversationalist identity stays readable on the no-cam cylinder.
DONE WHEN:
  1) ExtraRemoteTile still paints StageTileChrome when advertisedNoCam / audio-only.
  2) Chrome shows name · ★ · loc · one flag on top of NoCamPortrait (zIndex/elevation).
  3) Loc uses omitFlag so flag is not duplicated in the loc line.
  4) First VideoView key="live-first-remote" stays. No MediaSession / hunt remount.
EVAL:
  - grep ExtraRemoteTile: StageTileChrome not gated on !tileNoCam
  - node mobile/scripts/verify-match-ux.mjs
  - node mobile/src/live/stageStreams.test.mjs
CHECKPOINTS: none (overlay only; APK after verify — human asked)
OUT OF SCOPE: ICE, MediaSession, force_relay, invent MULTI_PASS, remount first RTC
VERIFY:
  - After: verify-match-ux + stageStreams tests
  - Second critic: Claude read-only
LANE: identity overlay
OWN: LiveStageVideo.tsx · live.tsx extra flag/loc · verify-match-ux.mjs
MUST NOT: pool>0, push.sh, MediaSession.ts, webrtc.js, remount live-first-remote
MAX HOPS: 1 then APK then human smoke
```
