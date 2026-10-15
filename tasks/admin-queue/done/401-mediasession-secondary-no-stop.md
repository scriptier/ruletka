# MediaSession secondary multi: never kill primary cam

## Goal
Secondary MediaSession close / multi-audio never stop() shared primary tracks; no mid-multi GUM on secondary.

## OWN
- `mobile/src/media/MediaSession.ts` only

## Context
- Grok may have polished already — verify + finish any gaps
- iceCandidatePoolSize must stay 0
- hop9 pure answer ≤280ms intact

## Done criteria
- [ ] Secondary closeCall never stop shared preview
- [ ] No GUM on secondaryLink paths
- [ ] setMultiPeerAudio secondary only lowers encode ceiling
- [ ] iceCandidatePoolSize = 0
- [ ] RESULT + COMPLETE
- [ ] No APK/deploy

## Must not
- live.tsx thrash, deploy, pool>0
