# P0-android-4way-tiles — RESULT

**Status:** COMPLETE  
**When:** 2026-08-11  
**OWN:** `mobile/app/live.tsx` (multi only), `mobile/src/live/LiveStageVideo.tsx`, `mobile/src/live/stageStreams.ts` (helpers already present; used)

## What landed

### LiveStageVideo (up to 3 remote tiles)
- Props: `remoteStream3`, `remoteEpoch3`, `thirdName`
- `pickStageStreams` + `pickMultiTiles` now receive third remote
- `splitTiles` paints `tiles[]` from stageStreams (2 or 3 remotes)
- **Find-3rd hunt stays top/bottom** (`huntingThird`): requires `lookingForThird` and **no** `remoteStream2`/`remoteStream3` — does **not** flip `multiRemote` (no RTC remount freeze)
- True multi only when streams/extra peers present

### live.tsx multi wire (no second GUM, no MediaSession rewrite)
- `media3Ref` + `MediaSession` tertiary PC
- `remoteStream3` / `remoteEpoch3` state + URL epoch guard
- `tertiaryPeerId` + signal route (`signal3`)
- Matched: `third = extras[1]`, `keepTertiary`, `startTertiary` parallel with secondary
- Tertiary uses `adoptLocalStream(primary local)` — **no second getUserMedia**
- Multi-audio / mic / cam / ICE / data-saver / net hints / ICE restart include media3
- Cleanup on hangup / next / stop / start / unmount
- `LiveStageVideo` props: stream3 + thirdName only when `extraPeers[1]` exists (no orphan 3rd tile in 3-way)
- Hunt ends when remote2 **or** remote3 binds

### stageStreams.ts
- Already had `MAX_REMOTE_TILES=3`, `remoteStream3`, `pickMultiRemoteTiles`, `tileC`
- Unit tests: `node src/live/stageStreams.test.mjs` → **ok**

## Constraints honored
- No second GUM  
- No MediaSession rewrite (only live.tsx binding + adoptLocalStream)  
- No APK  
- Find-3rd hunt top/bottom preserved  

## Smoke (human)
- 3-way: two remote tiles + self PiP  
- 4-way: three remote tiles paint when extras[1] + media3 stream  
- Find-3rd accept: partner top live, looking bottom; no freeze  
- 3rd joins: multi tiles; partner still live  

## Not done here
- Device APK / human 4-way smoke  
- MediaSession internals / clone thrash (separate lane)  
- Full tertiary promote continuity (only keep/replace by peer id)
