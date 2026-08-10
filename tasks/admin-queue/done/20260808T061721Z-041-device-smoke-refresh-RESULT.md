# RESULT: 041-device-smoke-refresh

## Status
DONE

## Completion promise
COMPLETE

## What changed
- `docs/DEVICE_SMOKE.md`: version table bumped to **0.1.148 / vc156**; matrix rows added/updated
  for Stop one-tap (`8b`), mid-chat gift chips (`11`), soft toasts (`11c`), friends row
  Online/Call/Chat CTAs (`16d`), renumbered the old `16e` (Live More speaker/earpiece) → `16f` to
  avoid an id collision.
- `docs/PLAY_INTERNAL_TEST_CHECKLIST.md`: header ship-tip bumped to 0.1.148/156; smoke table (§1)
  gained rows 8–10 for Stop one-tap, mid-chat gifts + soft toasts, friends CTA row.
- `docs/POLISH_NOW.md`: added Done-table rows for friends CTA polish, mid-chat gifts, Stop
  one-tap, soft toasts; updated the "still smoke-critical" version line.

## Important finding (not a fix — flagging for Grok)
The 0.1.148/vc156 binary is real (`mobile/artifacts/ruletka-0.1.148-vc156.apk`/`.aab`, built
2026-08-08 00:06–00:07, `ruletka-latest.apk` symlinked to it) and its source **does** contain the
friends CTA / mid-chat-gift / Stop-one-tap / soft-toast work described in the task. But that
source only exists as a single giant snapshot commit on `backup/pre-sleep-20260808T061524Z-wip`
(one commit ahead of `main`, ~107 files / ~11k lines) — it was never merged into `main` or any
`admin/*` branch. `main` and every worktree I checked (including this one) still checkout
0.1.136/vc144. I verified this by diffing `main` against that backup branch and grepping the
diffed files (`LiveGiftBar.tsx`, `mobile/app/live.tsx` `doStop()`, `mobile/app/friends.tsx`
CTA labels) for the exact features named in the task — they're there.

I did **not** merge or cherry-pick that branch (out of scope for a docs-only task, and it's a
large unreviewed diff). Docs now describe the real running APK, but until someone merges/replays
`backup/pre-sleep-20260808T061524Z-wip` into `main`, the next `--bump` build will fork from the
stale 0.1.136 base and silently drop this feature work. I added inline notes to all three docs
pointing at this.

## Files
- docs/DEVICE_SMOKE.md
- docs/PLAY_INTERNAL_TEST_CHECKLIST.md
- docs/POLISH_NOW.md

## Verify ran
- Manual read-through of all three edited docs for table/markdown integrity.
- `grep` for stale `0.1.136`/`vc144` mentions — only the intentional reconciliation notes remain.
- Confirmed `mobile/artifacts/ruletka-0.1.148-vc156.{apk,aab}` exist and `ruletka-latest.apk` /
  `ruletka-android-latest.apk` symlink to the vc156 apk.
- Confirmed feature code (LiveGiftBar, Stop one-tap, friends CTA labels, showToast usage) exists
  in `backup/pre-sleep-20260808T061524Z-wip` via `git show`/`git diff --stat` (read-only; no
  checkout/merge performed).
- No code touched; no WebRTC/offer path touched; no build run.

## Connect risk
safe to merge after smoke — docs-only change, no code/behavior touched.

## Handoff for morning
- merge branch: `admin/20260808T061721Z-041-device-smoke-refresh` (docs only, trivial to merge)
- **Separate, more important item for Grok:** reconcile `backup/pre-sleep-20260808T061524Z-wip`
  into `main` (or replay its diff) before the next `mobile/` `--bump` build — that branch holds
  the only copy of the friends-CTA/gifts/Stop/toast source that produced the vc156 APK currently
  being smoked.
- smoke: use `docs/DEVICE_SMOKE.md` rows `8b`, `11`, `11c`, `16d` for the new polish; run the
  existing Play↔PC connect smoke (P0) unchanged — connect path was not touched by this task.
- do not: deploy without Play↔PC check
