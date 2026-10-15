# SFX match link → spin.mp3 (PC + Android)

## Goal
When a new conversationalist link/match connects, play spin.mp3 instead of old chime/wav.

## Source
`/home/drakosik/Music/sound effects/spin.mp3`
Already copied to:
- `ui/sounds/match.mp3` (PC)
- `mobile/assets/sounds/match.mp3` (Android)

## OWN
- `ui/live.js` — `playMatchChime()` use HTMLAudio / Audio from `sounds/match.mp3` (respect matchSound pref + haptic ok)
- `mobile/src/feedback/sounds.ts` — match asset → `match.mp3`
- Do not change ring/gift/turn unless required

## Work
1. PC: replace WebAudio dual-tone in playMatchChime with play of sounds/match.mp3 (preload once; volume ~0.55; catch fail → optional soft fallback tone)
2. Android: require("../../assets/sounds/match.mp3"); remove or leave unused match.wav
3. Bump live.js?v= in live.html if PC change
4. RESULT COMPLETE. No deploy/APK unless asked.

## RESULT
tasks/grok-loop/done/SFX-match-spin-mp3-RESULT.md
