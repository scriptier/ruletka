---
name: android-partner-paint
description: >
  Android partner first paint for freenet-roulette / ruletka: conversationalist
  camera that lands must stay. SoftBlur (live face behind blur) is the product
  privacy cover; intro peel must reveal the already-mounted RTCView, not navy.
  Use when Android shows the PC camera then it disappears at ~3s, SoftBlur then
  Linking then black, "Partner video shown" with no video, first face then gone,
  intro peel, blurCoverElevated slab, forceRepaintRemote remount, or the user
  asks why the conversationalist vanished after a good first paint. Slash
  /android-partner-paint. Do NOT thrash MediaSession / ICE / force_relay for
  "face then gone" — that is overlay/peel, not a dead PC. Browser Hide / Blur
  them are a separate canvas lock (see this skill's web note).
metadata:
  short-description: "Android partner face stays after first paint"
  learned: "2026-08-14"
  triggers:
    - conversationalist camera gone after 3s
    - SoftBlur then Linking then black
    - Partner video shown no video
    - intro peel
    - first paint then gone
    - blurCoverElevated
    - forceRepaintRemote intro
    - android-partner-paint
---

# Android partner paint (first face stays)

You keep the **conversationalist camera** on Android after it first paints.  
You do **not** open ICE / TURN / `MediaSession` unless frames never existed.  
You do **not** swap SoftBlur for mosaic Privacy veil or CSS `filter:blur()` on `<video>`.

Stance: `AGENTS.md`. Specs: `knowledge/specs/2026-08-14-android-first-paint.md`,
`knowledge/specs/2026-08-14-one-live-blur.md`.  
Wiki: `knowledge/wiki/gotchas.md` **45–47**. Connect (real no-frames): `av-fix-loop`.

## When to use

| Symptom | This skill |
|---------|------------|
| Phone saw PC face (often SoftBlur) then navy/black at ~3s | **Yes** |
| SoftBlur → “Partner video shown” / Linking → gone | **Yes** |
| First paint then `forceRepaintRemote` remount freeze | **Yes** |
| Opaque `#45536c` slab over a live RTCView after peel | **Yes** |
| Never any face, both sides frames_out=0 | **No** → `av-fix-loop` |
| 3-way tile count / hunt layout | **No** → `multi-party-stage` |
| Name / ★ / flag only | **No** → `mobile-match-identity` |

**Clock tell:** disappear at **~2.8–4s** = `INTRO_UNBLUR_MS` peel, not ICE death.

## Product

| Keep | Drop |
|------|------|
| `SoftBlurRemote` / `SoftBlurVideoView` — live frames, face behind blur | Mosaic `PartnerBlurVeil` as the primary cover |
| RTCView **mounted** the whole match (zOrder 0) | Unmount RTCView while veiled |
| Intro ~3s SoftBlur then **clear face stays** | Intro peel that remounts or covers the face |

`PartnerBlurVeil` only if `!softBlurNative` (iOS / missing manager).

## Sequence that kills the face

1. Stream URL lands → SoftBlur second sink paints the **right** blur (human likes this).
2. `INTRO_UNBLUR_MS` (2800) → `revealPartnerVideo("intro_*")`.
3. SoftBlur `active=false`. Wrapper still `blurCoverElevated` (`#45536c`, elevation 32) **or** `forceRepaintRemote` remounts the stream.
4. User sees navy / Linking. Camera was never dead.

Gotcha **33**: SoftBlur sink during ICE checking → native SIGABRT.  
Gotcha **34**: `removeSink` / unmount SoftBlur → RTCView black.  
Gotcha **45–46**: first paint then Linking / intro peel toast.  
Gotcha **47**: peel onto opaque elevated slab.

## Overlay contract

| State | Wrapper style | SoftBlur `active` |
|-------|---------------|-------------------|
| Intro / hold / eye on | `softBlurCover` — **transparent**, elevation 32 | true |
| Peeled / off | `softBlurIdle` — 1×1, elevation 0, stay mounted | false |

Never use opaque `blurCoverElevated` (`#45536c`) as the SoftBlur shell. That color is the 3–4s “face then gone” slab.

`revealPartnerVideo("intro_*")` **returns before** `forceRepaintRemote`. RTCView stayed mounted under SoftBlur; remount is navy.

## Procedure (one hop)

1. **Lane** — did a face exist? If never → `av-fix-loop`. If yes then gone at ~3s → this skill.
2. **Do not** touch `MediaSession` ICE / pool / force_relay.
3. Confirm peel path in `live.tsx` (`revealPartnerVideo`, `scheduleIntroUnblur`) and overlay in `LiveStageVideo.tsx` / `liveStyles.ts`.
4. One change: overlay collapse **or** skip intro remount — not both plus a veil rewrite.
5. `node mobile/scripts/verify-match-ux.mjs` (must include SoftBlur peel + intro no-remount).
6. APK only with FAIL ticket / human ask. Then **stop** for smoke: SoftBlur ~3s → **clear face stays**.

## Verify

```bash
node mobile/scripts/verify-match-ux.mjs
# expect: softBlurCover + softBlurIdle; intro peel before forceRepaintRemote?
```

Human 1v1 (Pixel ↔ PC):

- [ ] SoftBlur of conversationalist for ~3s (face visible behind blur)
- [ ] Then **clear** face stays (not navy, not Linking flash)
- [ ] Eye / Hold uses the same SoftBlur, not mosaic veil
- [ ] No “Partner video shown” toast on intro peel

Do **not** invent `product.ok` / GOAL_MET from code or av-verify parser alone.

## Browser (related, not this OWN)

**Hide you-tile (browser):** original frost `filter: blur(26px) saturate(0.8)` + `scale(1.06)` on `#local` — not a faint canvas over a sharp selfie. Outbound Hide is still a live canvas track (phone sees frost, not black).  
**Blur them:** canvas on `#remote` (`applyPeerBlurCover`). Never CSS filter on partner `<video>` (GPU black).  
**Hide until Reveal:** sticks across Next (`ruletka.hideUntilReveal`). Friends still auto-reveal.  
Disk pins live in `ui/live.html`. **Pin ≠ prod** until human rsync. Agents must not `push.sh`.

## MUST NOT

1. Thrash `MediaSession.ts` / ICE / force_relay / pool for peel/overlay FAIL.  
2. `forceRepaintRemote` on `intro_*`.  
3. Unmount SoftBlur to “show” RTCView (`removeSink` black).  
4. Opaque `#45536c` `blurCoverElevated` over SoftBlur.  
5. Re-enable mosaic Privacy Modal / CSS filter on video as the product blur.  
6. Attach SoftBlur sink while ICE is still **checking** (gotcha 33).  
7. Second APK without FAIL ticket or human ask.  
8. Invent product.ok / GOAL_MET.

## Source of truth

| Path | Use |
|------|-----|
| `mobile/app/live.tsx` | `revealPartnerVideo`, intro timer, leftover latch |
| `mobile/src/live/LiveStageVideo.tsx` | SoftBlur vs veil; cover vs idle |
| `mobile/src/live/liveStyles.ts` | `softBlurCover` / `softBlurIdle` / `blurCoverElevated` |
| `mobile/src/live/SoftBlurRemote.tsx` | Native overlay; `getStreamUrl` |
| `mobile/android-patches/SoftBlur/SoftBlurVideoView.java` | Second VideoSink |
| `mobile/scripts/verify-match-ux.mjs` | Peel + Hide static gates |
| `knowledge/specs/2026-08-14-android-first-paint.md` | First face stays |
| `knowledge/specs/2026-08-14-one-live-blur.md` | One live blur |
| `knowledge/wiki/gotchas.md` | 33–34, 45–47 |

## Related

- `av-fix-loop` — never painted / one-way frames  
- `multi-party-stage` — 3-way tiles; still do not remount partner RTCView  
- `mobile-match-identity` — name · ★ · loc, not the camera  
- `spec` / `knowledge-compound` — write DONE WHEN; compound after human smoke  
