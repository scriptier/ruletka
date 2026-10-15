# BM2 blur match apply fix (Android)

## Goal
Forensics BM1: prefs `intro` but mid-match veil_visible=no and no `[blur] show`. Fix so Matched strangers get applyMatchBlurVeil.

## OWN
mobile/app/live.tsx blur/match paths only

## Work
1. Read BM1-phone-blur-forensics-RESULT + BM1-blur-prefs-race-audit-RESULT
2. Grep applyMatchBlurVeil / Matched / onRemoteStream / wantBlur
3. Ensure stranger match with intro|hold calls applyMatchBlurVeil once when remote stream ready
4. Minimal fix; log [blur] show
5. RESULT COMPLETE. No APK unless required. No invent PASS.

## RESULT
tasks/grok-loop/done/BM2-blur-match-apply-fix-RESULT.md
