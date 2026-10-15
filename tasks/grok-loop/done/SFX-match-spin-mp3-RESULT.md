# SFX-match-spin-mp3 RESULT

**Date:** 2026-08-11  
**Status:** COMPLETE (code-on-disk; no deploy / no APK)

## Goal
On new conversationalist link/match, play **spin.mp3** instead of the old synthetic dual-tone (PC) / `match.wav` (Android).

## Assets verified
| Path | Status |
|------|--------|
| Source `/home/drakosik/Music/sound effects/spin.mp3` | Present (15165 B) |
| `ui/sounds/match.mp3` | Present; **byte-identical** to source |
| `mobile/assets/sounds/match.mp3` | Present; **byte-identical** to source |
| `mobile/assets/sounds/match.wav` | Left unused (not deleted) |

Format: MPEG ADTS layer III, 64 kbps, 48 kHz stereo.

## Files touched

### 1. `ui/live.js` — `playMatchChime()`
- Replaced WebAudio dual-tone sequence with cached `HTMLAudioElement` → `sounds/match.mp3`.
- Single shared element via `getMatchChimeAudio()` (`preload = "auto"`, volume **0.55**).
- Each match: `currentTime = 0` + `play()`; autoplay/decode fail → same short dual-tone fallback as before.
- Still: `softHaptic([18, 40, 28])` first; respects `matchSoundEnabled()`.
- Chat / ring tone paths unchanged (still `playToneSequence`).

### 2. `mobile/src/feedback/sounds.ts`
- `match` asset: `require("../../assets/sounds/match.wav")` → **`match.mp3`**.
- `playMatchChime()` still plays kind `"match"` at 0.55 — callers unchanged.
- turn / urgent / gift / ring assets untouched.

### 3. `ui/live.html` — cache bump
- `live.js?v=562` → **`live.js?v=563`** (preload link + script tag).

## Not touched
- Ring / gift / turn assets or chimes
- ICE / MediaSession / WebRTC
- Deploy / APK rebuild
- Multi-party logic

## Human verify (not agent PASS)
1. **PC:** hard-refresh live; Network shows `live.js?v=563` and can load `sounds/match.mp3`.
2. Start match / accept link → hear spin-style chime (not the old dual beep). Soft vibration still ok on mobile browser if supported.
3. Prefs: disable match sound → silence (haptic may still fire; sound gated only).
4. **Android:** rebuild APK later so metro bundles `match.mp3`; first match after cold start should use preloaded cache when `preloadUiSounds()` ran.
5. Autoplay-blocked tab: optional soft dual-tone fallback is acceptable.

## COMPLETE
