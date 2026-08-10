# 060 — Align DEVICE_SMOKE version badges to 0.1.228+

## Status
COMPLETE

## What changed
Brought stale version badges in the doc set up to the shipping baseline **0.1.228 / versionCode 236** (matches `docs/PLAY_TODAY.md`, already committed as the ship target).

- `docs/DEVICE_SMOKE.md`
  - "Current binary" table: `0.1.227 / 235` → `0.1.228 / 236` (Version + APK rows)
  - "Play handoff" row: dropped dead `PLAY-INTERNAL-0.1.227.txt` reference (file doesn't exist), pointed at `PLAY_TODAY.md` instead
  - Stale note referencing `app.json 0.1.148+` updated to `0.1.228+`
- `docs/POLISH_NOW.md`
  - Install snippet: `adb install -r … ruletka-0.1.227-vc235.apk` / badge comment → `0.1.228-vc236`
- `docs/PLAY_TODAY.md` — checked, already correct at 0.1.228/236, no edit needed

Left untouched intentionally: `(0.1.226+)` markers in both files — these are "feature introduced in" annotations for the privacy/blur package, not current-version badges, and changing them would misrepresent when the feature landed.

Note: `mobile/app.json` in this worktree currently shows an uncommitted `0.1.230 / vc238` (unrelated in-flight work — targetSdk 35 / permissions changes, not yet reflected in any doc or artifact filename). Per task scope and CLAUDE.md's parallel-agent rule ("only fix files you changed, don't refactor unrelated WIP"), I aligned to the task's stated **0.1.228 vc236** baseline, which matches the already-committed `PLAY_TODAY.md` ship plan — not the unrelated uncommitted app.json bump.

## Files touched
- `docs/DEVICE_SMOKE.md`
- `docs/POLISH_NOW.md`

## Verify commands run
- `grep -n -iE '0\.1\.22[6-8]|vc23[4-6]' docs/DEVICE_SMOKE.md docs/POLISH_NOW.md docs/PLAY_TODAY.md` — confirmed all three files now consistently reference 0.1.228/236 (with 0.1.226+ "since" markers intentionally left as-is)
- Manual read-through of both files to confirm the Privacy/resume package (P1–P8) section is intact

## Connect risk
none — docs-only change, no code/media/hub touched.

COMPLETE
