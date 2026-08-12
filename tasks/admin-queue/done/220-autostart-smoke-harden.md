# Autostart: deep-link always reaches Searching

## Goal
device-smoke sometimes ends IDLE with Start still visible after ruletka://live?autostart=1.

## OWN
- mobile/app/live.tsx autostart effect only (or tiny helper)
- optional note in mobile/scripts/device-smoke.sh: if IDLE after wait, tap Start once more

## Do
1. Read current autostart effect (80ms spin + 500ms retry)
2. Harden: if still idle at 1200ms, one last spin; clear param after that
3. device-smoke: if verdict IDLE after main wait, one more Start tap + 8s wait + reclassify
4. Run npm run test:match-ux

## Must not
- Deploy, ICE thrash, rewrite whole live.tsx

## Done
RESULT COMPLETE + files
