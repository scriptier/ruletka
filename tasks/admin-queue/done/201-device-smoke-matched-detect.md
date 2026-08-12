# device-smoke: detect matched state on Pixel

## Goal
`mobile/scripts/device-smoke.sh` installs and taps Start but does not classify **matched** vs searching. Improve exit signal for overnight loops.

## OWN
- `mobile/scripts/device-smoke.sh` only (optional tiny python one-liner inside)

## Do
1. After wait, parse UI dump or screenshot path for signals: "Looking up" is obsolete; look for "Stop"+"Report"+"Next" together, or "Gifts", or call timer `\d+:\d+`
2. Write `artifacts/device-smoke/last-verdict.txt` with MATCHED|SEARCHING|IDLE|UNKNOWN
3. Exit 0 if ALIVE and no FATAL even if SEARCHING; exit 4 if MATCHED and still shows infinite looking-up text (regression guard)
4. Dry-run docs in script header

## Must not
- Deploy, APK, ICE, connect thrash

## Done
RESULT COMPLETE + sample last-verdict format
