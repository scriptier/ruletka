# RESULT: 824-ios-parity-friends

## Status
COMPLETE (best-effort, static-analysis only — no physical iPhone/simulator
available to this agent; needs Grok/human TestFlight smoke to confirm pixel
fit).

## Context / note
`knowledge/specs/current-ios-parity.md` does not exist in this worktree
(`knowledge/specs/` only has `2026-08-20-ru-reach.md`). Read it from the main
tree instead (`/home/drakosik/freenet-roulette/knowledge/specs/current-ios-parity.md`)
— same DONE WHEN / MUST NOT as prior 82x tasks in this chain
(Platform.OS iOS branches where Android has chrome; no MediaSession/ICE/pool>0).

## What I found
The Chats | Calls | Blocked tab layout, per-friend row thumbs, and the
Add/Block/Report actions on the Calls (match-history) tab called for in the
Goal are **already implemented** in `friends.tsx` (`tabsRow`, `blockedPanel`,
`addMatchFriend`/`blockMatchHistory`/`reportMatchHistory` wired into the
match-history rows) — nothing to build there.

For the safe-area/header half of the Goal: the screen relies entirely on the
native Expo Router Stack header (`Stack.Screen options={{ title: screenTitle }}`,
no `headerShown:false`, no `headerTransparent`), which on iOS is a real
`UINavigationBar` that reserves its own space above content — it already
handles the notch/Dynamic Island correctly by construction. Adding a manual
`insets.top` pad on top of that would **double-pad** and push `tabsRow` down
under a real header on every normal load, which would be a regression, not a
fix — so I did not add one.

The one concrete, verifiable iOS-only gap: the "add friend code" and "search
chats" `TextInput`s live inside the `FlatList`'s `ListHeaderComponent`, and
the screen's root container was a plain `View`. Android's default
`windowSoftInputMode="adjustResize"` already shrinks the window for the
keyboard; iOS has no such default, so the keyboard could ride up over those
inputs (and over the Calls/Blocked tab content) with nothing compensating —
the same class of gap `FriendChatSheet.tsx` (same directory tree, not in
this task's OWN) already guards against with a `KeyboardAvoidingView` +
`Platform.OS === "ios" ? "padding" : undefined`.

## What changed
**`mobile/app/friends.tsx`**
- Added `KeyboardAvoidingView` and `Platform` to the `react-native` import.
- The screen's root `View` (previously `<View style={[styles.root, {
  paddingBottom: Math.max(insets.bottom, 8) }]}>`) is now a
  `KeyboardAvoidingView` with the same style array plus
  `behavior={Platform.OS === "ios" ? "padding" : undefined}`.
- Closing tag updated to match (`</KeyboardAvoidingView>`).
- On Android, `behavior={undefined}` makes `KeyboardAvoidingView` behave
  exactly like the plain `View` it replaces — no functional change there.
- No other lines touched; `tabsRow`, `FlatList`, `blockedPanel`, and the
  native `Stack.Screen` header wiring are unchanged.

## Files touched
- `mobile/app/friends.tsx`

No other files touched. `live.tsx`, `MediaSession`, and `settings.tsx` were
**not** edited, per Must-not.

## Verify commands run
- `npx tsc --noEmit -p .` (mobile/) — only the pre-existing
  `expo-clipboard` module-resolution error on `friends.tsx` line 2 (present
  before this change too — this worktree is missing some native module
  type declarations, same gap noted in the 823 RESULT); zero new errors
  introduced by this diff.
- `node scripts/verify-match-ux.mjs` — `L0 done: 139 ok, 0 fail`.
- No iOS simulator/device in this environment — verified via types + the
  existing static/unit checks above only, not an on-device TestFlight smoke.

## Connect risk
none — no hub/ICE/MediaSession/live.tsx changes; `connectivity-lock` script
not run (out of scope, no offer/ICE/media-session touched). The only
behavioral change is iOS-only keyboard-avoidance on one screen's root
container; Android path is a no-op by construction (`behavior={undefined}`).

COMPLETE
