# 834 — iOS BootToLiveOnce / stack header — RESULT

## Status
COMPLETE

## Spec note
`knowledge/specs/current-ios-parity.md` does not exist in this worktree
(`knowledge/specs/` here only has `2026-08-20-ru-reach.md`). Went off the task's
own Goal/Must-not/Done text, plus the prior `828-ios-parity-critic` finding,
which already concluded this file was "already correct" for the boot/header
parts and flagged the swipe-gesture behavior as unverified.

## What changed
`mobile/app/_layout.tsx` — no behavior change to `BootToLiveOnce` or the
`headerShown: false` line; both were already shared, non-`Platform.OS`-gated
code and already apply identically on iOS:

- `BootToLiveOnce` (module-flag guarded `router.push("/live")` on cold start
  when `rulesOk` and on Home) — already platform-neutral, confirmed unchanged.
- `Stack.Screen name="live"` `headerShown: false` — already platform-neutral,
  confirmed unchanged.

Added one explicit option + a comment on the `live` `Stack.Screen`:
`gestureEnabled: true` (this is already the react-navigation default, so no
behavior changes) with a comment explaining why it must stay enabled and
documenting a real Android/iOS asymmetry I found while auditing "Back → home":

- Android's "leave call" only fires because `live.tsx` (`app/live.tsx:6408-6426`)
  listens for `hardwareBackPress` and calls `doStop()` first when the call is
  `matched`/`search`, only letting the event fall through to pop the nav stack
  to Home once the phase is idle (two-step: stop call, then leave).
- `BackHandler.addEventListener("hardwareBackPress", ...)` is an Android-only
  API — it is a silent no-op on iOS (no hardware back button exists).
- `headerShown: false` on `live` means there's also no header back button, and
  `live.tsx` has no in-UI Home/leave button (confirmed via
  `grep -n "router\.|onLeave|onHome|onBack|onExit" mobile/app/live.tsx
  mobile/src/live/LiveBottomBar.tsx` — the only `router.*` calls in `live.tsx`
  go to `/friends` or `/settings`, never Home).
- That leaves the **native edge-swipe-back gesture as the only way back to
  Home on iOS.** It must stay enabled or iOS users get stuck on `/live` with
  no way out — so `gestureEnabled: false` would be a regression, not a fix.
- The real gap: iOS's swipe pops straight to Home in one motion, even
  mid-call, skipping Android's "first back just stops the call" grace step
  (since `BackHandler` never fires on iOS to run `doStop()` first). Closing
  that fully needs a `beforeRemove` listener wired to `live.tsx`'s local
  `phase` state (not exposed via `HubProvider`/`useHub()` — checked
  `mobile/src/hub/HubProvider.tsx`, no `matched`/`search` phase surfaced) —
  which means editing `live.tsx`, out of scope per this task's **Must not**.

Documented this as a code comment (kept in-scope, since the OWN file is
`_layout.tsx`) rather than silently leaving it unaddressed, per the Done item
"iOS header / gesture back notes if needed."

## Files touched
- `mobile/app/_layout.tsx` (comment + explicit `gestureEnabled: true` on the
  `live` `Stack.Screen` only; no logic changes)

## Verify commands run
- `npx tsc --noEmit` (from `mobile/`) — no new errors from this change. The
  only `_layout.tsx` error is the pre-existing `Cannot find module
  'expo-keep-awake'` (missing `node_modules` in this worktree, unrelated,
  present before my edit). All other errors are pre-existing in `live.tsx`
  and other files untouched by this task.
- `grep -n "gestureEnabled" mobile/app/_layout.tsx` — confirms the one new
  line landed in the `live` `Stack.Screen` options only.
- `grep -n "BackHandler|gestureEnabled" mobile/app/live.tsx` and
  `grep -rn "gestureEnabled|fullScreenGesture" mobile` — confirmed no other
  gesture config exists anywhere else in the app (this is the only one).
- Read `mobile/src/hub/HubProvider.tsx` to confirm call-phase state isn't
  exposed for a non-`live.tsx` fix — none found.

## Connect risk
none — no MediaSession/ICE/hub/offer changes. `HubProvider` untouched.
`gestureEnabled: true` matches the existing default, so no runtime behavior
changed for either platform; this is a documentation-only guard against a
future accidental regression (e.g. someone disabling the gesture for visual
polish and trapping iOS users on `/live`).

COMPLETE
