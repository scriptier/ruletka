# 221 — Gift FX: trim fireworks node count

Status: COMPLETE

## Files touched
- `mobile/src/stars/GiftFxOverlay.tsx` — `fireworkBursts()`, `nSparks` formula only

## Change
Audit 211 found the `fireworks` layer already had 5 burst centers (not 7 — that
appears to have been trimmed in an earlier pass), giving 83 simultaneous
animated nodes: 68 sparks (`nSparks = 12 + (bi % 3) * 2` → 12,14,16,12,14) + 5
burst cores + 10 drifting emoji. Since centers were already at the task's
target floor of 5, I applied the sparks-per-burst reduction instead: dropped
the base spark count by 4, from `12 + (bi % 3) * 2` to `8 + (bi % 3) * 2`.

## Before / after
| | before | after |
|---|---|---|
| sparks per burst (5 bursts) | 12, 14, 16, 12, 14 (sum 68) | 8, 10, 12, 8, 10 (sum 48) |
| burst cores | 5 | 5 (unchanged) |
| drifting emoji (`floatSpecs`) | 10 | 10 (unchanged) |
| **total animated nodes** | **83** | **63** |

Overall node count cut ~24% (83→63); sparks specifically cut ~29% (68→48).
Multi-color radial spread is preserved — the per-spark angle/dist/color/size
formulas are untouched, just fewer sparks sampled per burst, so bursts still
read as full radial fireworks, just slightly less dense.

## Verify commands run
- `npx tsc --noEmit -p .` (from `mobile/`) — pre-existing unrelated errors only
  (missing `expo-clipboard`/`react-native-gesture-handler`/etc. type
  declarations in this worktree's `node_modules`, and unrelated `live.tsx`
  issues). Confirmed zero errors reference `GiftFxOverlay.tsx`.

## Connect risk
none — no hub/ICE/MediaSession/CONNECTIVITY_LOCK code touched.

COMPLETE
