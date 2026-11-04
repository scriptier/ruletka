# P0 Android 4-way tile wire

## Goal
Wire up to 3 remote streams on live stage (media2 + placeholder path). Prefer helpers in stageStreams. No second GUM.

## OWN
- mobile/app/live.tsx (multi tiles only)
- mobile/src/live/LiveStageVideo.tsx
- mobile/src/live/stageStreams.ts if needed

## Done
3 remotes paintable; hunt still top/bottom; no MediaSession thrash
