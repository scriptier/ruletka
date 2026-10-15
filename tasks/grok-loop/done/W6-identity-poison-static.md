# W6 identity poison static audit (PC)

## Goal
Confirm isRealPartnerDisplayName rejects Partner/hex; lastGoodPartnerName latch mid-trio.

## OWN
- RESULT only (read-only ui/live.js identity helpers)

## Work
1. Grep latch / stealMainLatch / isRealPartnerDisplayName.
2. RESULT PASS audit or note residual. No code unless one-line proof bug.
3. COMPLETE. No deploy.

## Must not
Edit live.js without proof bug; thrash multi
