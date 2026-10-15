# BM1 blur prefs race audit (read + optional tiny fix)

## Goal
Trace blurModeRef load vs first Matched applyMatchBlurVeil — race where Settings Off still veils.

## OWN
mobile/app/live.tsx blur block only if one-line proven race; prefer RESULT audit

## Work
1. Grep blurPrefsReadyRef, prefs_load, applyMatchBlurVeil("match")
2. Document order; if Off ignored until ready — minimal fix
3. RESULT COMPLETE. No MediaSession thrash. No APK unless tiny and user later rebuilds.

## RESULT
tasks/grok-loop/done/BM1-blur-prefs-race-audit-RESULT.md
