# RESULT: 022-friend-call-ring-parity

## Status
DONE

## Completion promise
COMPLETE

## What changed

### Gap table — ring / accept / miss (current vs fixed)

| Area | Current (before) | Fixed |
|---|---|---|
| **Ring (incoming call banner)** | `CallBanners` (`mobile/app/_layout.tsx`) showed a visual "Incoming call" banner with Answer/Decline, but **no sound or vibration** — a call ringing while the phone isn't being looked at is silent. Browser parity ref: `ui/live.js` `startIncomingRing()` plays a repeating WebAudio tone burst *and* `navigator.vibrate([120,80,120,80,200])` every 2.2s. Mobile copy in Settings already promises this ("In‑app ringtone + vibration when a friend calls while the app is open", `mobile.settings.notifyComingSoon`) but nothing implemented it. | Added a repeating `Vibration.vibrate([0,120,80,120,80,200,1600], true)` effect keyed on `incomingCall`, cancelled on cleanup (`mobile/app/_layout.tsx`). Matches the browser's vibration cadence exactly (same pulse pattern, ~2.2s cycle) using only React Native's built-in `Vibration` API — no new deps/assets needed. A synthesized audio tone (parity with the browser's WebAudio burst) is **not** done — this checkout has no `expo-av`/audio module or ring asset (see "not fixed" below). |
| **Accept → live video** | Accept button only called `hub.callRespond(id, true)` + `clearIncomingCall()` — no navigation to `/live`. Since WebRTC/match handling lives entirely in `live.tsx` and only runs while that screen is mounted, accepting from Home/Friends never opened video unless already on the Live tab. | Accept now also calls `router.push("/live")` after responding (`mobile/app/_layout.tsx`). |
| **Outbound call → live video** | `friends.tsx` `call()` sent `hub.callFriend()` + set `outboundCall`, same gap from the caller's side. | `call()` now also `router.push("/live")` right after placing the call (`mobile/app/friends.tsx`). Covers both the "Call" button and "Call back" from missed-call history, since `callFromHistory()` routes through the same `call()`. |
| **Miss surfacing (miss card)** | `countUnreadMissed()` already existed in `mobile/src/calls/history.ts:90` but was never called from any screen — dead code, no badge on Home. Friends screen's own history list with "Call back" was already fine (`friends.tsx:255-296`, already OK). | Home screen (`mobile/app/index.tsx`) now shows a missed-call card wired to `countUnreadMissed()`, refreshed on `callHistoryTick`, using existing 14-language i18n keys `mobile.home.missedTitle` / `mobile.home.missedBody`, linking to `/friends`. |
| **Decline** | `hub.callRespond(id, false)` + clear, no extra feedback toast. | Left as-is — already OK, not an obvious gap. |

## Files
- `mobile/app/_layout.tsx` — incoming-call vibration ring (`Vibration` from `react-native`); accept handler navigates to `/live`
- `mobile/app/friends.tsx` — `call()` navigates to `/live` after placing an outbound call
- `mobile/app/index.tsx` — missed-call card on Home, wired to previously-unused `countUnreadMissed()`

## Not fixed (out of scope, documented)
- **Audio ringtone** (only vibration was added): no audio module (`expo-av`/`expo-audio`) or sound asset exists in this checkout's `package.json`/`assets/`. Adding one is a real dependency/asset addition, not a copy/nav/miss-card fix — flagging as a follow-up rather than expanding this task.
- **Background/offline push ring** (OS notification when app is closed, browser parity: `tryShowCallNotification`): needs `mobile/src/push/pendingCall.ts`, `localCallAlert.ts`, `notifOptIn.ts` — none of these exist in this branch (see build-breakage finding below); explicitly excluded by the task ("not full FCM stack").
- `docs/PARITY_MATRIX.md` does not exist on this branch (only as uncommitted WIP in the main checkout), so no row was added there — noted here instead.

## ⚠️ Pre-existing, unrelated finding: `live.tsx` doesn't build on this branch

`mobile/app/live.tsx` does not type-check or bundle, independent of this task. `npx tsc --noEmit` reports **91 errors, 100% confined to `app/live.tsx` and `src/live/LiveBottomBar.tsx`** — confirmed via `git stash` + rerun that the exact same 91 errors exist on the base commit (`7769c32`) *before* any of this task's changes, and are byte-identical after. This task's 3 files introduce **zero** new errors.

Root cause: `live.tsx` imports ~21 modules that were never committed to any branch (`../src/feedback/*`, `../src/identity/PartnerChrome`, `../src/calls/matchHistory`/`matchThumbs`, `../src/media/debate`/`connectUi`/`pipPrefs`/etc., `../src/safety/*`, `../src/stars/GiftFxOverlay`, `../src/live/liveStyles`), plus 3 npm packages missing from `package.json` (`expo-keep-awake`, `react-native-view-shot`, `expo-clipboard`), plus several `HubContextValue`/`MatchPrefs`/`ServerMatched` fields `live.tsx` expects that aren't defined in this branch's `HubProvider.tsx`/`hub/types.ts`/`prefs/store.ts`. All of these files exist as **uncommitted** working-tree content in the separate main checkout (`/home/drakosik/freenet-roulette`, currently dirty with a large amount of unrelated uncommitted WIP) — this worktree, being a clean checkout from `7769c32`, doesn't have them. Not fixed here: reconstructing ~21 files + 3 deps + Hub API surface is far outside "one concern per task" and squarely inside this task's own "do not" list (no MediaSession/offer-path rewrite).

## Verify ran
- `cd mobile && npx tsc --noEmit -p .` — 91 errors, all in `app/live.tsx` / `src/live/LiveBottomBar.tsx`. Ran before and after every edit (including the vibration change); `diff` of full error output is byte-identical each time — confirms none of this task's changes introduced any new type errors.
- Confirmed i18n keys used (`mobile.home.missedTitle`, `mobile.home.missedBody`, `mobile.call.*`, `mobile.history.*`) exist in `mobile/src/i18n/overlay/en.json` and all 14 locale overlays.
- Confirmed `callFromHistory()` in `friends.tsx` routes through the same `call()` used for the fix, so missed-call "Call back" also gets the new auto-navigate.
- Could not do an on-device/simulator smoke test: the Live screen is blocked by the pre-existing `live.tsx` breakage above, unrelated to this diff.

## Connect risk
friend-call only — no offer/ICE/MediaSession edits. Logic changes: 1 `Vibration` effect, 2 added `router.push("/live")` calls, 1 new Home UI card, all gated on existing `incomingCall`/`outboundCall`/`countUnreadMissed` state. hold on end-to-end device smoke — blocked by the pre-existing, unrelated `live.tsx` build breakage (see finding); the diff itself is verified not to regress anything that currently compiles.

## Handoff for morning
- merge branch: `admin/20260807T184705Z-022-friend-call-ring-parity` — diff is additive/isolated to 3 files, verified not to introduce new type errors; safe to merge, but the friend-call flow it targets can't be exercised on device until `live.tsx` builds again.
- **Priority ahead of any further live.tsx/friend-call work**: reconcile `mobile/app/live.tsx`'s ~21 missing modules / 3 npm deps / Hub API gaps against the uncommitted WIP sitting in the main checkout (`/home/drakosik/freenet-roulette`) — that appears to be the intended source. Task `021b` independently hit one instance of this same pattern earlier.
- smoke (once live.tsx builds): Play↔Play or Play↔browser friend call — confirm (1) accepting auto-opens Live and video connects, (2) placing the call auto-opens Live, (3) phone vibrates on incoming call even face-down, (4) let a call ring out unanswered, confirm a missed-call card appears on Home and tapping it opens Friends with a working "Call back."
- do not: deploy without Play↔PC check; do not fold `live.tsx` build fixes into this branch — separate task.
