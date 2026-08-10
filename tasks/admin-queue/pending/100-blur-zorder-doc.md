# Task: Document Android blur zOrder lock

## Goal
One short section in CONNECTIVITY_LOCK or VIDEO_PATH_LOCK: privacy veil keeps RTCView mounted at zOrder 0 + opaque mosaic; never unmount-to-black.

## Scope
- docs/CONNECTIVITY_LOCK.md or docs/VIDEO_PATH_LOCK.md (small addition)
- Reference 0.1.283 LiveStageVideo behavior

## Done criteria
- [ ] Doc paragraph added
- [ ] COMPLETE, connect risk none

## Do not
- Reintroduce Modal blur, unmount-on-veil, hybrid force_relay
