# L13 match chime once (PC)

## Goal
playMatchChime rate-limit ~1.5s; never dual-tone fallback when mp3 loads (silence or one spin only).

## OWN
ui/live.js playMatchChime only + live.html v bump

## Work
1. Debounce playMatchChime so double Matched = one sound
2. Remove dual-tone fallback if file exists (user wants only spin)
3. Bump live.js?v=564→565
4. RESULT COMPLETE. Deploy optional note.

## RESULT
tasks/grok-loop/done/L13-sfx-once-debounce-RESULT.md
