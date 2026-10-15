# Spec: Android ↔ browser 3-way parity (then APK)

**Status:** active · 2026-08-14 · APK **0.1.385 / vc393** on disk · human smoke OPEN  
**Related:** `2026-08-14-3way-see-everyone.md` · `current-multi-party.md` · `current-no-cam.md`

```text
GOAL: Phone behaves like the browser in a 3-person call: sees both
      other people, does not sit on Linking / black cover, Stop/Next
      mean the same as PC, identity (name · loc · ★) on each remote.
DONE WHEN (code — human smoke still required):
  A) 3-way: big window splits top/bottom remotes; PiP = you.
     Hunt: top partner · bottom looking. No remount of first RTCView.
  B) 2nd/3rd remote actually starts (startCall2/3). No audio-first
     cylinder over a live PC cam. Linking off on audio or video.
  C) Extra tiles: name (no hex) · loc · stars · per-tile volume.
  D) Stop/Next labels match browser contract:
     pair + 3rd live → Next skip 3rd / Stop "Leave 3rd"
     you are 3rd → Next solo / Stop "Leave call"
     1v1 → Next / Stop
  E) 2×2 only when 4 people. pool=0. No MediaSession ICE this hop.
EVAL:
  - node mobile/src/live/stageStreams.test.mjs
  - node mobile/src/live/matchContinuity.test.mjs
  - cd mobile && npm run verify
  - APK --bump after verify (human authorized this turn)
MUST NOT: pool>0; force_relay flip; dual-write MediaSession;
          deploy; invent MULTI_PASS / product.ok
```

## Why (Android vs browser)

| Browser (disk) | Phone on **0.1.384** | Need |
|----------------|----------------------|------|
| 3 columns, floor under tiles | 1v1 full partner; extras may not start | Split + startCall2 |
| Leave 3rd / Leave call | Generic Stop / Next | Wire `btn.stopLeave*` |
| No-cam cylinder only if advertised | Audio-first hid PC cam | Already on disk |
| Per-tile loc ★ vol | Extra chrome missing on tip | Already on disk |

SoftBlur multi + ICE wait hops stay **out** of this implement (need APK only). MediaSession: **read/ship only**, no rewrite.

## Lanes

| Lane | OWN | Agent |
|------|-----|--------|
| and-live | `mobile/app/live.tsx` | Grok |
| and-bar | `mobile/src/live/LiveBottomBar.tsx` | Grok |
| and-stage | `LiveStageVideo.tsx` `liveStyles.ts` | Grok |
| and-peers | `matchPeers.ts` | Grok |
| and-wiki | wiki + SMOKE-NEXT (version after APK) | Grok |
| Claude 4 | i18n check, units, critic, verify RESULT | Claude factory |

## APK

After verify: `mobile/scripts/build-apk-local.sh --bump`  
Update SMOKE-NEXT install APK **version string only**.
