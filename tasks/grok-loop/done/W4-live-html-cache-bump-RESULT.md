# W4 live.html cache bump — RESULT

## Status
COMPLETE

## Goal
Bust browser cache so PC loads Courtier latch + multi clone fixes already on disk.

## OWN
- `ui/live.html` only

## Files
- `ui/live.html` — `live.js?v=560` → `live.js?v=561` (2 sites)

## Changes
1. Preload: `live.js?v=560` → `live.js?v=561` (line ~397)
2. Script tag: `live.js?v=560` → `live.js?v=561` (line ~3032)
3. Unchanged: `webrtc.js?v=315`, `live-stage.css?v=385`
4. No edits to `live.js` body, stage CSS, or webrtc

## Verify
```
$ grep -nE 'live\.js\?v=' ui/live.html
397:  <link rel="preload" href="live.js?v=561" as="script" />
3032:  <script src="live.js?v=561" defer></script>
```
- Only **561** present for `live.js?v=`
- `webrtc.js?v=315` unchanged
- `live-stage.css?v=385` unchanged

## Connect risk
**None** — cache-bust query string only; no logic/signal path changes.

## Human smoke
Not claimed. Cache bump only; Courtier latch + multi clone still need human PC reload verify when ready.

## COMPLETE
