# Spec: one live blur (keep canvas + SoftBlur)

**Status:** active · 2026-08-14  
**Herd:** `20260814T094635Z` lanes blur-web + blur-android

```text
GOAL: One partner-privacy blur that shows the face (soft live frames).
      Drop mosaic / CSS-filter-on-video / covering Modal that hid or
      killed the tile.
DONE WHEN:
  A) Browser: Hide / Blur them / intro use #local-frost / #remote-frost
     (.frost-vid) playing an already-soft-blurred captureStream.
     No filter:blur() or scale() on source <video>. #local / #remote stay mounted.
  B) Android: SoftBlurRemote is the privacy cover when native exists.
     PartnerBlurVeil only if native missing. No privacy Modal. No
     blur status banner. RTCView stays mounted. Intro may SoftBlur.
  C) Self-hide / no-cam portrait / chrome glass backdrop-filter stay.
  D) Hide until Reveal: Next / new stranger keeps outbound soft-blur
     until the user taps Reveal. Friends still auto-reveal.
  E) pool=0; no MediaSession ICE; no invent product.ok / blur GOAL_MET
EVAL:
  - node mobile/scripts/verify-match-ux.mjs
  - Human: Start opens (no blurMode crash); intro SoftBlur ~3s then
    **clear face stays** (not navy slab); eye Hold uses same live blur
  - Human PC after rsync: Hide frosts you-tile (blur 26px like original);
    Reveal shows clear selfie again
  - Human PC after rsync: Blur them covers conversationalist (not sharp face)
  - Human: Hide then Next — still hidden on both sides until Reveal
MUST NOT: deploy; force_relay flip; invent blur GOAL_MET
```

Keep: web canvas (`drawSoftBlurredVideo`) · Android SoftBlurVideoView.  
Drop: PartnerBlurVeil as primary · CSS filter on .vid · Android privacy Modal · LiveStatusBanners blur row.
