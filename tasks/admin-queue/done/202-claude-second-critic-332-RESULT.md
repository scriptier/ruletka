# 202 — Second critic: overnight 0.1.332 loc/name/autostart (re-run)

## Status
DONE — read-only review, one critical one-liner fixed (crash bug, in scope per task's "clear one-line bug" allowance).

## Note on re-run
A prior `202-claude-second-critic-332-RESULT.md` already exists in this queue, dated earlier, claiming the same `PartnerBlurVeil` import bug was found and fixed. On this pass the bug was **present again** in the current worktree state (`git status` shows `mobile/app/live.tsx`, `app.json`, `package.json` all modified vs HEAD — looks like Grok re-generated/overwrote `live.tsx` after the earlier fix, reintroducing it). Verified live via `tsc`, not assumed from the old RESULT — see Verify section.

## Scope reviewed
- `mobile/src/live/PartnerIdentityDock.tsx`
- `mobile/src/live/LiveStageVideo.tsx` (stage HUD loc)
- `mobile/app/live.tsx` autostart effect
- `mobile/src/identity/PartnerChrome.tsx`

Of these, `PartnerIdentityDock.tsx`, `LiveStageVideo.tsx`, `PartnerChrome.tsx` match the committed baseline (no uncommitted diff) — their "Looking up…" fix is already shipped. `mobile/app/live.tsx` carries the overnight uncommitted diff (0.1.332 / versionCode bump in `app.json`).

## Checks

**1. Infinite "Looking up…" removed? — PASS**
No "Looking up" string renders anywhere. `PartnerIdentityDock.tsx` only paints a loc line when `hideIp` (→ "Location hidden") or `formatLocLine` returns a real flag/country/city string; otherwise `showLoc=false`, nothing renders. Same rule in `PartnerChrome.tsx` (`locLine = hideIp ? hidden : loc || code || ""`) and the stage HUD computed in `live.tsx` (`partnerLocDisplay`, line ~4586) which is passed into `LiveStageVideo`'s `partnerLoc` prop — also never pending text. Consistent across all three belts.
- Minor, not a bug: `LiveStageVideo`'s `labels.locPending` prop is still declared and still populated by `live.tsx` (`t("mobile.live.locPending") || "Looking up location…"`, line ~4710), but the component never reads `L.locPending` anywhere in its render — dead prop/string, harmless, not worth touching for this task.

**2. Autostart: spin before clear param + 500ms retry without re-spin on matched? — PASS**
`live.tsx:3281-3337`. Primary spin fires at 80ms, before any `setParams` clear. The param is only cleared inside the 500ms retry timer callback (once, via `paramCleared` guard), so cleanup on the earlier timer can't race-cancel it. `tryAutostartSpin` explicitly bails when `phaseRef.current === "matched"`, and only proceeds from `idle`/`error`/`search`. Matches the "Race hardens (2026-08-11)" comment 1:1.

**3. SurfaceView / crash risk from dock always-on when matched? — PASS, no crash risk**
`PartnerIdentityDock` renders only when `uiPhase === "matched"` (`live.tsx:5187`) and sits as a flex sibling **after** the closing `</View>` of the `stageRef` container (`live.tsx:5179`) — outside the video-stage subtree entirely, confirmed by reading the JSX between those lines. It's a plain RN `View`/`Text`, never an `RTCView`/SurfaceView, so mounting/unmounting it on match transitions carries none of the native-crash risk the codebase's own comments warn about (that risk is specifically unmounting `RTCView` mid-call — `mountMainVideo`/`mountPipVideo` in `LiveStageVideo.tsx` stay keyed off stream presence, untouched by the dock).

**4. Regression vs `displayPartnerStars`? — PASS**
`matchPeers.ts:110-114`: `displayPartnerStars(stars, trust) = Math.max(clamp(stars), clamp(trust))`. `PartnerIdentityDock` and `LiveStageVideo` both import and call this helper directly. `PartnerChrome.tsx:54-59` inlines the identical logic (clamp both, then `Math.max`) — verified equivalent, not a fork/regression.

## Critical bug found and fixed (one-liner)
`mobile/app/live.tsx:5299` uses `<PartnerBlurVeil ...>` (Android-only fullscreen privacy-blur Modal, gated on `showPrivacyBlur && Platform.OS === "android"`), but `PartnerBlurVeil` was **not in the barrel import list** at the top of `live.tsx` — confirmed live via `tsc`: `error TS2552: Cannot find name 'PartnerBlurVeil'`. This is a `ReferenceError` at runtime, crashing the app on Android whenever the privacy-blur veil opens on a stranger match — a mainline path (intro/hold blur modes are the default), not an edge case. `src/live/index.ts:42` already exports it (`export { PartnerBlurVeil } from "./PartnerBlurVeil";`); it was simply missing from the destructured import.

Fixed with a one-line addition to the existing barrel import (`PartnerBlurVeil` added next to `PartnerIdentityDock`, `live.tsx:70`).

## Files touched
- `mobile/app/live.tsx` (1 line added: `PartnerBlurVeil` to the barrel import)

## Verify commands run
- `cd mobile && npx tsc --noEmit -p .` (before/after fix)
  - Before: `app/live.tsx(5299,14): error TS2552: Cannot find name 'PartnerBlurVeil'. Did you mean 'partnerBlurLine'?`
  - After: that error is gone. Remaining errors are unrelated: missing `node_modules` for deps in tonight's `package.json` diff (`expo-keep-awake`, `react-native-view-shot`, `expo-clipboard` — not yet `npm install`ed in this worktree), dynamic-import module-flag noise, and pre-existing type-strictness items (`readyState` on a simplified track stub, `onPress` signature laxity at `live.tsx:4971`). None are new, none are crashes, all out of this task's scope.
- No `npm install` run (out of scope / touches shared node_modules — flagging for Grok before next local build).

## Connect risk
**High → fixed (now none)** for the `PartnerBlurVeil` crash specifically (Android privacy-blur path, mainline). **None** for checks 1–4 (all PASS, no regressions found).

## Recommended next hop
1. Grok: re-check why `live.tsx` reverted to missing this import between the earlier critic pass and this one (likely an overnight regen/overwrite) — if there's an autosave/codegen step touching `live.tsx`, make sure it isn't silently dropping barrel imports.
2. Grok: `npm install` in `mobile/` to pick up new deps in tonight's `package.json`/`package-lock.json` diff, then re-run `tsc --noEmit` clean before APK build.
3. Phone+PC smoke should specifically exercise the Android privacy-blur veil (tap Unblur / hold-to-reveal on a stranger match) to confirm the fix holds at runtime, not just in `tsc`.

COMPLETE
