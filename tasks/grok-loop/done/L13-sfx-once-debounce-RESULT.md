# L13 match chime once (PC) — RESULT

**Status:** COMPLETE  
**OWN:** `ui/live.js` `playMatchChime` + related; `ui/live.html` `live.js?v=` bump  
**Date:** 2026-08-11  
**Deploy:** human — ship `live.js?v=565` (+ `live.html` pin). No agent push.

## Goal
Rate-limit match chime so double Matched = one spin sound; prefer `spin.mp3` only; never stack mp3 + dual-tone.

## Work

### 1. `ui/live.js` — `playMatchChime()`
- Added `lastMatchChimeAt` + `MATCH_CHIME_MIN_GAP_MS = 1500` — second call within ~1.5s is a no-op (sound path).
- Prefer `sounds/match.mp3` (spin) via cached `HTMLAudioElement` only.
- Removed dual-tone (660+880) fallback that could stack with mp3.
- If `Audio` cannot be created → **one** soft single tone once (`740Hz`, short).
- If `play()` fails (autoplay / decode) → **retry once** with fresh element; still fail → **silence** (never mp3+tones).
- Unchanged: `softHaptic`, `matchSoundEnabled()`, callers (`handleMatched`, friend request/accept toasts).

### 2. `ui/live.html` — cache bump
| Site | Before | After |
|------|--------|-------|
| preload (~L397) | `live.js?v=564` | `live.js?v=565` |
| script (~L3032) | `live.js?v=564` | `live.js?v=565` |

## Verify (disk)
```text
$ grep -nE 'live\.js\?v=' ui/live.html
397:  <link rel="preload" href="live.js?v=565" as="script" />
3032:  <script src="live.js?v=565" defer></script>

$ grep -nE 'MATCH_CHIME_MIN_GAP|lastMatchChimeAt|softOnce' ui/live.js
15995:let lastMatchChimeAt = 0;
15996:const MATCH_CHIME_MIN_GAP_MS = 1500;
…
```
- Dual-tone 660/880 pair no longer in `playMatchChime` fallback.

## Connect risk
**None** — SFX only; no WebRTC / Matched / ICE path changes.

## Deploy note (human)
1. Deploy `ui/live.html` + `ui/live.js` (+ `ui/sounds/match.mp3` if not already on prod).
2. Hard-refresh; Network must show **`live.js?v=565`**.
3. Smoke: match once → one spin; re-Matched / double Matched within 1.5s → no second spin; prefs off → silence.

## Not claimed
- No prod deploy / curl PASS
- No APK / Android sound path
- No invent multi PASS

## COMPLETE
