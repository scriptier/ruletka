# Task: P1 — Re-apply cam mute copy parity (020 product lost)

**Priority:** After **021**, before **022**. Previous ticket `020-cam-mute-parity` has RESULT COMPLETE but **no surviving `admin/*` branch / worktree** and `camOffHint` is **not on disk** (manager audit 2026-08-07 ~10:15 local). Re-land the small UI copy fix from RESULT evidence.

## Goal
Play cam-off shows the same partner-facing promise as web “Hidden from them” (badge / hint under Cam toggle). Partner already gets black frames via `track.enabled = false`; only **missing confirmation copy** on Android.

## Context (do not re-litigate mechanics)
- RESULT archive: `tasks/admin-queue/done/20260807T143415Z-020-cam-mute-parity-RESULT.md`
- Web: `toggleSelfBlur` → black canvas / hide badge; Android mute already blanks outbound video
- Lost branch name (do not search forever): `admin/20260807T143415Z-020-cam-mute-parity`

## Scope (only these)
- `mobile/app/live.tsx` — show hint when `!camOn` under cam controls + `accessibilityHint` on Cam toggle
- `mobile/src/i18n/overlay/*.json` — key `mobile.live.camOffHint` (reuse web `btn.selfBlurBadge` strings where possible)
- Optional: `docs/PARITY_MATRIX.md` Cam mute row if present / untracked

## Done criteria
- [ ] `mobile.live.camOffHint` exists in EN + RU at minimum (prefer all 14 overlays)
- [ ] UI shows hint when cam off; no MediaSession / offer / ICE edits
- [ ] RESULT includes branch name + `git diff --stat` proof product exists
- [ ] Connect risk = **low** (copy only)
- [ ] No deploy / no push

## Completion promise
Put **`COMPLETE`** in RESULT when keys + UI landed **and** branch is still present after agent exit.

## Do not
- Rewrite mute mechanics / black canvas on Android
- Touch offer path / `MediaSession` connect
- Deploy / push / merge main
