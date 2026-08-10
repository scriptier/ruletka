# 130 — CONNECTIVITY_LOCK one-line reminder

**Status:** Done (audit only, no changes needed)

## Files touched
None — `docs/CONNECTIVITY_LOCK.md` audited, already correct.

## Verify commands run
- Read `docs/CONNECTIVITY_LOCK.md` in full.

## Findings
- Line 12 still carries the reminder: "Do **not** regress connect without a proven better alternative + smoke."
- The "Do not re-enable without re-proving" section (lines 82–90) is intact, listing all locked-down anti-patterns: soft/hard ICE restart in first ~10s, premature phone promote-to-offerer, dense streamEpoch remount ladders, docker coturn as primary, SFU/LiveKit default, opaque black blur, USB-cam hacks.
- Frozen product decisions (lines 16–22) and client rules (lines 39–49) are unchanged and consistent with each other.
- No thrash, no stale/contradictory content found. No edit made.

## Connect risk
none

COMPLETE
