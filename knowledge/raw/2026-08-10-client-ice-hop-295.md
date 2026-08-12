# Raw: client-ice hop 0.1.295 (PC black)

## Scorecard before
- product=one-way, verdict=WARN
- web fin=0 fout=high; android beacons missing / fout=0 historically
- max_rb HOT — not turn-media

## Code
- Longer force_relay wait before answer PC
- Longer pure relay gather + restartIce if n=0
- app_vc from expo-application fallback
- product verifier: web fout ≠ phone receives

## Ship
- APK 0.1.295 / vc303
- NEXT: human install + smoke; then agentic-loop / av-verify
