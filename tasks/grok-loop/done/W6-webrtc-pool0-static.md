# W6 webrtc pool=0 hop9 static recheck

## Goal
Confirm pool=0 and hop9 pure 520 / warm 350 still on disk.

## OWN
- RESULT only read-only ui/webrtc.js

## Work
1. Grep pool, pure, warm budgets, multiFast.
2. RESULT COMPLETE. No edits unless regression proven.

## Must not
ICE thrash, pool>0
