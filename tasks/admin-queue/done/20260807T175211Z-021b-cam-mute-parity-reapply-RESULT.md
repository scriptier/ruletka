# RESULT: 021b-cam-mute-parity-reapply

## Status
DONE

## Completion promise
COMPLETE

## What changed
Re-landed the cam-off confirmation copy that was lost when the `020-cam-mute-parity` branch disappeared. This is a copy-only change — mute mechanics (`track.enabled = false`) were already in place and are untouched.

- `mobile/app/live.tsx`:
  - Cam toggle `Pressable` now gets `accessibilityHint={t("mobile.live.camOffHint")}` when `!camOn` (`undefined` when cam is on).
  - A small `<Text style={styles.camOffHint}>` hint renders under the controls row when `!camOn`, mirroring web's "Hidden from them" self-blur badge.
  - Added matching `camOffHint` style to the `StyleSheet.create` block.
- `mobile/src/i18n/overlay/*.json` (all 14 locales): added key `mobile.live.camOffHint`.
  - EN: `"Hidden from them"`
  - RU: `"Скрыты от них"` (correctly UTF-8 encoded — note the pre-existing `camOff`/`camOn` strings in `ru.json` are mojibake from an earlier, unrelated bug; not touched, out of scope)
  - All other 12 overlays (ar, bg, cs, de, es, fr, pl, pt, sr, tr, uk, zh) also carry a localized value.

No offer/ICE/`MediaSession` files touched.

## Files
- mobile/app/live.tsx
- mobile/src/i18n/overlay/ar.json
- mobile/src/i18n/overlay/bg.json
- mobile/src/i18n/overlay/cs.json
- mobile/src/i18n/overlay/de.json
- mobile/src/i18n/overlay/en.json
- mobile/src/i18n/overlay/es.json
- mobile/src/i18n/overlay/fr.json
- mobile/src/i18n/overlay/pl.json
- mobile/src/i18n/overlay/pt.json
- mobile/src/i18n/overlay/ru.json
- mobile/src/i18n/overlay/sr.json
- mobile/src/i18n/overlay/tr.json
- mobile/src/i18n/overlay/uk.json
- mobile/src/i18n/overlay/zh.json

## Branch / diff proof
- Branch: `admin/20260807T175211Z-021b-cam-mute-parity-reapply` (confirmed present via `git branch --show-current` after this run)
- `git diff --stat`:
  ```
   mobile/app/live.tsx             | 16 +++++++++++++++-
   mobile/src/i18n/overlay/ar.json |  1 +
   mobile/src/i18n/overlay/bg.json |  1 +
   mobile/src/i18n/overlay/cs.json |  1 +
   mobile/src/i18n/overlay/de.json |  1 +
   mobile/src/i18n/overlay/en.json |  1 +
   mobile/src/i18n/overlay/es.json |  1 +
   mobile/src/i18n/overlay/fr.json |  1 +
   mobile/src/i18n/overlay/pl.json |  1 +
   mobile/src/i18n/overlay/pt.json |  1 +
   mobile/src/i18n/overlay/ru.json |  1 +
   mobile/src/i18n/overlay/sr.json |  1 +
   mobile/src/i18n/overlay/tr.json |  1 +
   mobile/src/i18n/overlay/uk.json |  1 +
   mobile/src/i18n/overlay/zh.json |  1 +
   15 files changed, 29 insertions(+), 1 deletion(-)
  ```

## Verify ran
Previous verify attempt failed with hundreds of `tsc --noEmit` errors (`Cannot find module 'react'`, `'--jsx' is not set`, `expo/tsconfig.base not found`, etc.). Root cause: this worktree had **no `node_modules` installed at all** — worktrees don't share git-ignored `node_modules` with the main checkout, so essentially every import failed to resolve, unrelated to the copy-only diff.

Fix applied for verify purposes: ran `npm ci` in `mobile/` (network available, ~15s, 938 packages installed from the tracked `package-lock.json` — no edits to `package.json`/lockfile). This is local and git-ignored; nothing pushed or deployed.

- `npx tsc --noEmit` after `npm ci`: only **one** remaining error:
  ```
  src/media/MediaSession.ts(20,8): error TS2307: Cannot find module './adaptiveQuality' or its corresponding type declarations.
  ```
- Confirmed via `git stash` (temporarily removing this task's diff, rerunning `tsc`, then `git stash pop`) that this exact single error is **pre-existing on `HEAD`/`main`** — `adaptiveQuality.ts` doesn't exist anywhere in this commit's history (`git show HEAD:mobile/src/media/adaptiveQuality.ts` → path does not exist). It only exists on an unrelated, non-ancestor commit (`7769c32`). Not introduced by this change; fixing it would require editing `MediaSession.ts`, which is explicitly forbidden for this task.
- `git diff` reviewed line-by-line: change is copy/UI only (accessibilityHint + conditional hint `<Text>` + new style + 14 i18n keys). No offer/ICE/MediaSession edits.
- All 14 overlay JSON files validated with `python3 json.load()` — well-formed, and `mobile.live.camOffHint` confirmed present with expected string in each.

## Connect risk
safe to merge after smoke

## Handoff for morning
- merge branch: `admin/20260807T175211Z-021b-cam-mute-parity-reapply`
- smoke: `cd mobile && npm ci` (or reuse this worktree's now-installed `node_modules`), then `expo run:android` or device build — open Live screen, toggle Cam off, confirm the hint text renders under the controls row and the Cam toggle's `accessibilityHint` fires (screen reader / accessibility inspector). Confirm no visual regression on Cam-on state or the other controls.
- follow-up (separate ticket, not this one): `mobile/src/i18n/overlay/ru.json` has pre-existing mojibake affecting every string in that file except the new `camOffHint` key — worth a small dedicated ticket to re-save it as clean UTF-8. Also a separate pre-existing baseline break: `mobile/src/media/MediaSession.ts` imports `./adaptiveQuality`, which doesn't exist in this commit history — `tsc --noEmit` will not be fully clean until that's resolved (unrelated to cam-mute copy, do not fix under this ticket's scope).
- do not: deploy without Play↔PC check; do not touch `MediaSession.ts`/offer/ICE code under this ticket.
