# Brigade-resistant reporting (v1)

Goal: keep **real abuse** bans working while making **info-war / stream raids** expensive to turn into permanent death of an identity.

## Design principles

1. **Stars ≠ ban artillery.** Trust/senior labels remain for UI and soft rank, but non-underage auto-ban score is **1 per independent reporter**.
2. **Independence required.** Explicit needs **3** distinct reporters; spam/other need **4**. Underage stays **1** (safety).
3. **Mutual feuds don’t auto-ban.** If A already reported B, B’s report on A adds **0** ban score (still logged).
4. **Raid spikes soft-handle.** ≥6 reports on one target within 15 minutes → no permanent escalate; ban length capped at **48h** if a ban still fires; ops webhook `raid_spike` / `auto_ban_raid`.
5. **Permanent escalate** only when explicit strikes again with **≥3** unique reporters and **not** during a raid spike (admin can still permanent ban).
6. **Politics / flags / language** are not ban categories. Clients should use **Next** or **Block**. Report reasons remain underage / explicit / harassment / hate / spam / other.
7. **Export cannot mint stars** (unchanged) — reputation ledger is hub-side.

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
