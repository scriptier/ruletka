# Party shapes second critic (read-only)

## Goal
Read-only critic of hub 4-way product rule before/while parent lands `bridge/src/simple.rs`.

Product (`knowledge/specs/2026-08-21-party-shapes.md`):
- Queue: 1v1, 1v2 (3-way), friend 2v2
- Never queue 3v1 (Party3 vs Solo) or 2v3
- 4th person only via friend **call join** into a live 3-way
- Friend 1v1 stays 1v1 until Find 3rd
- hunt-keep HELD; pool=0; no MULTI_PASS invent

## OWN
- `tasks/admin-queue/running/` RESULT only — **no product code**

## Must not
- Edit `bridge/src/simple.rs`, `ui/live.js`, `MediaSession.ts`
- deploy, APK, pool>0, ICE thrash

## Done
RESULT with:
1. Confirm current hub still allows Party3 vs Solo (3v1 queue) — cite `entries_compatible` + `enqueue_party3`
2. Confirm `stranger_party_blocks_2v2` already blocks stranger-pair vs pair
3. Risks of dropping 3v1 queue (stuck Waiting Party3 leftovers)
4. Whether `start_three_person_join` force_relay:false is in scope (recommend: **out** this hop)
5. COMPLETE

Write RESULT under tasks/admin-queue/done/ or the harvest RESULT block.
