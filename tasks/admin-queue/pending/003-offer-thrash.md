# Task: P0 — Reduce second-offer thrash

## Goal
Hub still logs `offer dropped: debounce`. Find client second-offer source within ~8s and keep single-offer lock without breaking iceRestart after 15s grace.

## Scope
- `ui/webrtc.js` double-offer guards / callGen
- `mobile/src/media/MediaSession.ts` offerSent / watchdog
- Hub already debounces — prefer **client** fix

## Done criteria
- [ ] Source identified
- [ ] Minimal guard if safe
- [ ] No deploy
