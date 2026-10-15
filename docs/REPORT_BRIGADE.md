# Brigade-resistant reporting (v2)

Goal: keep **real abuse** bans working while making **info-war / stream raids** expensive to turn into permanent death of an identity.

## Design principles

1. **Zero-rep / 1★ / one-friend praise don’t auto-ban.** Count only if **wallet ★ ≥ 5** or **trust from ≥2 unique gifters**. Hour bonus (+1) is not a vote. Underage still counts.
2. **Same /24 = one vote.** Counting reporters collapse by IPv4 /24 (or uid if IP unknown). Established still **1 each**; no ×2/×3. Explicit/hate at **3 clusters**. Spam/other **4**.
4. **Independence required.** `min_unique_reporters` uses **counting** reporters only, not raw rows.
5. **Mutual feuds don’t auto-ban.** If A already reported B, B’s report on A adds **0** ban score (still logged).
6. **Raid spikes soft-handle.** ≥6 reports on one target within 15 minutes → no permanent escalate; ban length capped at **48h** if a ban still fires; ops webhook `raid_spike` / `auto_ban_raid`.
7. **Permanent escalate** only when explicit strikes again with **≥3 counting** reporters and **not** during a raid spike (admin can still permanent ban).
8. **Politics / flags / language** are not ban categories. Clients should use **Next** or **Block**.
9. **Export cannot mint stars** (unchanged) — reputation ledger is hub-side.

## Code

| Piece | Location |
|-------|----------|
| Severity thresholds | `SimpleHub::report_severity` |
| Min unique reporters | `SimpleHub::min_unique_reporters` |
| Flat + mutual weight | `SimpleHub::report_weight_against` |
| Raid window | `report_recent` + `note_report_time` / `is_raid_spike` |
| Ban decision | `handle_report_user` |

## Ops

- Watch mod webhook for `raid_spike` and `auto_ban_raid`.
- Prefer human review for permanent bans on public creators.
- Do not grant manual “trust” that was meant to buy report power — report power is flat now.

## Not in v1

- Device / IP clustering of reporters (harder, privacy-sensitive).
- Language-based match splits.
- Full rewrite of the star ledger.
