# RESULT: 020-cam-mute-parity

## Status
DONE

## Completion promise
COMPLETE

## What changed
- Re-audited the actual cam-mute mechanics on both platforms before touching anything:
  - Web `toggleSelfBlur()` → `pushOutboundVideoTracks()` (`ui/live.js:15827-15862`) swaps the
    outbound video *sender* to a black canvas track (falls back to `setCamEnabled(false)`, i.e.
    `track.enabled = false`, on error). Partner never receives live video. Local self-preview
    stays visible (CSS-blurred) with a "Hidden from them" badge (`ui/live.html:1065,1100`).
  - Android `toggleCam()` → `MediaSession.setCamEnabled()` (`mobile/src/media/MediaSession.ts:2106-2110`)
    sets `track.enabled = false` on the same shared local/outbound track. Per the WebRTC spec, a
    disabled video track also sends black frames to the remote peer — the same partner-facing
    result as web's canvas swap. Android's local self-preview shares that track, so it blanks too
    (unlike web's self-view, which stays visible).
  - Conclusion: the **partner-facing promise was already equivalent** on both platforms (no live
    video ever reaches them once muted/hidden). The real gap `docs/PARITY_MATRIX.md` flagged was
    stale/imprecise, and the actual asymmetry was just **missing confirmation copy on Android** —
    web reassures with "Hidden from them," Android showed nothing beyond a generic "Cam off"
    label.
- Fixed the copy gap (no offer/ICE/connect-path files touched):
  - Added a new `mobile.live.camOffHint` i18n key to all 14 Android locale overlay files
    (`mobile/src/i18n/overlay/*.json`), reusing web's *exact* existing translated string for
    `btn.selfBlurBadge` ("Hidden from them" / localized equivalents) so the promise reads
    identically across platforms.
  - `mobile/app/live.tsx`: show that hint as visible text under the mic/cam/flip/report row when
    `!camOn`, and as an `accessibilityHint` on the Cam toggle button (screen-reader parity too).
  - `docs/PARITY_MATRIX.md`: recreated this untracked-in-git doc in the worktree (it only existed
    as an untracked scratch file in the main worktree, not part of any commit, so this branch
    doesn't inherit it automatically) and updated the "Cam mute" row + gap-list entry #2 to
    "resolved," with the corrected technical explanation above.

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
- docs/PARITY_MATRIX.md (new in this worktree; see note above — untracked in main, not in git history)

## Verify ran
- `node -c ui/live.js` — untouched, syntax OK (sanity check only).
- `python3 -c "json.load(...)"` on all 14 edited overlay JSON files — all parse valid.
- `git diff --stat` reviewed — 15 files, +28/-1, no connect-path files (`ui/webrtc.js`,
  `mobile/src/media/MediaSession.ts`, `mobile/src/hub/*`) touched.
- Could **not** run `npm run lint` (`tsc --noEmit`) in `mobile/` — no `node_modules` installed in
  this worktree and no network install attempted (out of scope for this task / risk of a long-running
  side effect). Manually reviewed the JSX diff against existing sibling `Pressable`/`Text` usage in
  the same file — same prop shapes (`accessibilityHint` is a standard RN `Pressable` prop already
  implicitly typed as `string`), so it should typecheck, but this was not executed.
- Did not run the Expo/RN app or browser UI (no device/simulator available in this environment) —
  cam-mute UI copy change was verified by code review only, not a live smoke test.

## Connect risk
safe to merge after smoke

## Handoff for morning
- merge branch: `admin/20260807T143415Z-020-cam-mute-parity`
- smoke: run `mobile/` (`npm install && npm run lint` at minimum, ideally `expo run:android`) and
  confirm the new "Hidden from them" hint renders under the Cam toggle when cam is off, and that
  `ui/live.js` "Hide" badge still reads the same. No offer/ICE code changed, so no Play↔browser
  connect smoke test is strictly required for this change, but doing the standard
  `docs/CONNECTIVITY_LOCK.md` smoke test anyway before merge is still recommended as general
  hygiene since this branch touches `mobile/app/live.tsx`.
- do not: deploy without Play↔PC check
