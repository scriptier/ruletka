# W4 live.html cache bump (Courtier + multi on disk)

## Goal
Bust browser cache so PC loads Courtier latch + multi clone fixes already on disk.

## OWN
- `ui/live.html` only

## Work
1. Bump **every** `live.js?v=` query from **560 → 561** (preload + script tags; grep for all).
2. Leave `webrtc.js?v=315` unchanged.
3. Leave `live-stage.css?v=385` unchanged (already dense chrome).
4. Do **not** edit live.js / stage css / webrtc.

## Done criteria
- [ ] `rg 'live\.js\?v=' ui/live.html` shows only **561**
- [ ] RESULT in `tasks/grok-loop/done/W4-live-html-cache-bump-RESULT.md` with COMPLETE
- [ ] Connect risk: none (cache bump only)

## Must not
- Deploy, APK, git push
- Edit live.js body
- Claim multi human smoke PASS
