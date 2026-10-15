# Spec: Android first paint must stick

**Status:** active · 2026-08-14  
**Symptom (human):** conversationalist camera showed instantly → toast “Partner video shown” with no video → “Linking cameras…” → black. Video starts then stops behind extra UI steps.

**Locks:** `docs/CONNECTIVITY_LOCK.md` · no MediaSession ICE thrash · pool=0 · no APK flood.

```text
GOAL: First remote face that paints stays. Later Matched / intro veil /
      Linking chrome must not unmount or cover a live partner.
DONE WHEN:
  A) Same-partner rematch or first-match race: leftover live stream is
     kept (no setRemoteStream(null), no re-arm awaitingRemoteVideo).
  B) New partner: leftover of the previous person IS cleared.
  C) Intro privacy veil is not applied AFTER the face already painted
     (too late + SoftBlur second sink on a live decode → black).
  D) “Linking cameras…” pill/card is hidden once remote audio OR video
     is live (laptop no-cam counts).
  E) startCall EARLY still runs on a true new match; it does not rebuild
     a same-peer live PC.
EVAL:
  - node mobile/src/live/matchContinuity.test.mjs
  - Human 1v1: face stays; no Linking flash after first paint
MUST NOT: pool>0; force_relay flip; MediaSession rewrite; invent
          product.ok / GOAL_MET; second APK bump without FAIL ticket
```

## Sequence we are killing

1. `startCall EARLY` → remote track → **face on stage**
2. Same `Matched` continues with `keepPrimary=false` (was still search)
3. Intro veil + SoftBlur sink attach over a live SurfaceView
4. `setConn("connecting")` / Linking pill even though media is live
5. Intro peel toast “Partner video shown” onto a torn/black tile
6. Optional second `startCall` / `setRemoteStream(null)` → black

## Not this hop

- ICE / TURN / force_relay
- APK (phone still 0.1.384 until human installs 385 + this hop)
