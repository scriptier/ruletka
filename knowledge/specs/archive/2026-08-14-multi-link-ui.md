# Spec: 3-way / 4-way linking + UI (2026-08-14)

**Status:** active · herd this hop  
**Product:** mesh P2P (not SFU). Cap **you + 3 remotes**.

```text
GOAL: 3-way and 4-way feel linked (cams + audio) faster, and each
      conversationalist has readable chrome. Mesh stays P2P.
DONE WHEN (code hops — human smoke still required):
  1) Extra peers connect in parallel; keep live teammate PC (no rematch tear).
  2) Linking hides on live audio OR frames (laptop no-cam counts) in multi too.
  3) Encode: primary mid, extras low; mobile floor low not min; clones on 2nd+ PC.
  4) 3-way + 4-way tiles: no orphan black pane; per-tile name/flag/loc/★/vol.
  5) Android extras: adopt/clone, no second GUM, no stop primary.
  6) Wiki honesty: 4-way mesh = 6 P2P links; same-LAN FRA TURN; no MULTI_PASS.
EVAL:
  - node --check ui/live.js ui/webrtc.js
  - node mobile/src/live/stageStreams.test.mjs (if touched)
  - no iceCandidatePoolSize != 0; no force_relay flip
MUST NOT: pool>0; SFU; deploy; APK; invent MULTI_PASS / product.ok / linking GOAL_MET
```

## Will 4 users / 4 videos / 4 voices work P2P?

**By design, yes — mesh, not a server mix.**

| People | Links (each pair) | Each client |
|--------|-------------------|-------------|
| 2 (1v1) | 1 | 1 PC |
| 3 | 3 | 2 PCs |
| 4 | 6 | 3 PCs |

Each person **encodes** their cam up to 3 times (primary mid, extras **low**) and **decodes** up to 3 remotes + 3 audio. Same house = hub `force_relay` → FRA coturn (3 TURN allocations per client). Desktop Chrome usually holds. Phone is the risk (HW encode / clone). **Human 3-way faces still OPEN.** Not MULTI_PASS until smoke.

## Lanes (OWN)

| Lane | OWN | Focus |
|------|-----|--------|
| trio-web | `ui/live.js` | keep-PC, parallel join, Linking dismiss, quality, clones |
| trio-webrtc | `ui/webrtc.js` | multiFast, audio quality ramp, clone-safe setLocalStream; keep recvonly no-cam |
| trio-layout | `ui/live-stage.css`, `ui/live.html` | 3/4-way grid, per-tile chrome, no orphan black |
| trio-android | `MediaSession.ts`, `stageStreams.ts`, `matchPeers.ts` | secondary clone/adopt; no ICE policy |
| trio-wiki | wiki + `SMOKE-NEXT` multi + i18n partyCap only | honesty + smoke steps |
