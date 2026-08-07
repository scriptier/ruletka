# Play (Android) ↔ Browser (Web) parity matrix

Audited by reading `ui/live.js` + `ui/webrtc.js` (web) against `mobile/app/live.tsx`,
`mobile/src/media/*`, `mobile/src/hub/*`, `mobile/app/friends.tsx`, `mobile/app/settings.tsx`
(Android/Expo), cross-checked against the wire protocol in `bridge/src/protocol.rs` and
`docs/PROTOCOL.md`. Evidence is file:line; "done" means the feature is wired end-to-end
(protocol message + UI), not just present in a type file.

Overall: parity is **high** — every "must cover" feature has a working implementation on
both platforms. The gaps below are real but mostly narrow (one missing settings toggle, one
platform-inherent notification limitation, a couple of UX/security asymmetries) rather than
missing features.

| Feature | Web | Android | Notes / gap | Priority |
|---|---|---|---|---|
| Stranger match Start | done — `btn-start-match` → `spin` (`ui/live.js:13887,2767`) | done — `start()` → `hub.spin()` (`mobile/app/live.tsx:1713-1749`) | Equivalent. | — |
| Stranger match Next | done — `btn-next` → `next` (`ui/live.js:13892,4972`) | done — `next()` → `hub.next()` (`mobile/app/live.tsx:2082`) | Equivalent. | — |
| Stranger match Stop | done — `btn-stop` → `stop` (`ui/live.js:11413,13831`) | done — `stop()` → `hub.stop()` (`mobile/app/live.tsx:2141`) | Equivalent. | — |
| WebRTC offerer role | done — `isOfferer` state + debounced `createOffer` (`ui/webrtc.js:747-749,1423-1505`) | done — `is_offerer` → `startCall({isOfferer})` (`mobile/app/live.tsx:1016,1206`) | Equivalent, driven by the same `matched.is_offerer` field. | — |
| `force_relay` (hub-driven) | done — applied on `matched` (`ui/live.js:22461-22519`) | done — `mediaRef.current.setForceRelay(m.force_relay)` (`mobile/app/live.tsx:944-950`) | Equivalent. | — |
| TURN config via `/config.json` | done — fetched + cached (`ui/webrtc.js:36-96,301,328`) | done — `pcConfig()` (`mobile/src/media/MediaSession.ts:869-902`) | Equivalent. | — |
| "Prefer Direct" (force STUN-only, refuse TURN) user setting | done — `setPreferDirectOnly()`, mutually exclusive with Hide IP (`ui/live.js:9413-9447`) | **missing** — `MediaSession.ts` only supports `iceTransportPolicy` `"all"` or `"relay"` (`:882`); no STUN-only forced mode, no matching toggle in `settings.tsx` | Android users can't opt out of TURN relay for battery/latency/privacy-from-hub reasons the way web users can. Low usage feature but a real, deliberate one on web (has dedicated status strings). | P3 |
| Cam mute | partial — `toggleCam()` is now a no-op; "Hide" overlay used instead, track stays live (`ui/live.js:18031-18032`) | done — `toggleCam()` actually disables the track (`mobile/app/live.tsx:2240-2245`) | Intentional web redesign, but it means "mute camera" means different things per platform (video keeps flowing on web vs. real track-disable on Android). Could surprise a user switching platforms mid-session expectations. | P2 |
| Mic mute | done (`ui/live.js:17984-18004`) | done (`mobile/app/live.tsx:2203-2208`) | Equivalent. | — |
| Flip / switch camera | done — `flipCamera()` + explicit front/rear buttons (`ui/live.js:29149-29162,18501`) | done — `flipCamera()` via RN-WebRTC `_switchCamera()` (`mobile/src/media/MediaSession.ts:2202-2216`) | Equivalent. | — |
| Geo flag/country/city display | done — `ui/geoLocalize.js:280-338` | done — `PartnerChrome.tsx:18-36`, `flagTrust.ts` | Equivalent, same `MatchPeer.flag/country/city` fields. | — |
| i18n coverage | 14 languages, `ui/i18n/*.json` (en, ru, uk, pl, cs, bg, sr, es, de, fr, pt, tr, ar[rtl], zh) | 14 languages, `mobile/src/i18n/packs/*` + `overlay/*` (same set) | Equivalent language set. | — |
| Friends: add by code | done — deep link `?friend=CODE` + in-app add (`ui/live.js:12089-12131`) | done — `hub.addFriend(code)` (`mobile/app/friends.tsx:363,621`) | Equivalent. | — |
| Friends: call | done — `call_friend` send (`ui/live.js:13835-13839`) | done — `hub.callFriend(uid,{join})` (`mobile/app/friends.tsx:426`) | Equivalent, both support `join` (3-way). | — |
| Friends: hangup | done — shared `stop` flow (`ui/live.js:13831`) | done — `hangupFriend()` → `hangup_friend` (`mobile/src/hub/HubClient.ts:313-314`) | Equivalent. | — |
| Chat | done | done | Equivalent. | — |
| Typing indicator | done — P2P data-channel `typing`/`typing_stop` (`ui/live.js:7886-7980`) | done — same message types, 1200ms throttle (`mobile/app/live.tsx:2393-2396`) | Equivalent. | — |
| Stars: balance display | done — `myStars`, `setStarsBadge()` (`ui/live.js:532,2961-2965`) | done — `MatchPeer.stars` on partner badge (`PartnerChrome.tsx`) | Equivalent. | — |
| Stars: gift catalog | 8 effects: heart/bars/flowers/balloons/confetti/pass_mic/fireworks/please_stay | same 8 effects, same costs (`mobile/src/stars/gifts.ts:20-29`) | Catalog and pricing match protocol comments in `bridge/src/protocol.rs:166-170` exactly. | — |
| Stars: spend effect animation | done — `showStarFeedbackToast()` (~25 call sites) | done — `GiftFxOverlay.tsx` with `GIFT_FX_HOLD_MS` aligned to web | Equivalent. | — |
| Post-chat rate/gift prompt (`rate_prompt`) | done — `case "rate_prompt"` (`ui/live.js:21730`) | done — `RatePrompt` handling (`mobile/app/live.tsx`, `hub/types.ts`) | Equivalent. | — |
| Block user | done — `blockUserId()` (`ui/live.js:24716-24767`) | done — `hub.blockUser(uid)` (`mobile/app/live.tsx:2473-2481`) | Equivalent. | — |
| Report user | done — `reportPartner()` + reason sheet + optional screenshot (`ui/live.js:28459,28074`) | done — `ReportSheet.tsx` + screenshot capture (`mobile/app/live.tsx:2421-2456`) | Equivalent. | — |
| 18+ age gate | done — blocks camera prompt until accepted (`ui/live.js:12483-12627,30317`) | done — `rules.tsx` age step, `index.tsx` redirects to `/rules` when `!rulesOk` before `HubProvider` mounts (`mobile/app/index.tsx:55-59`) | Equivalent, both gate before media/match access. | — |
| Hide IP (force TURN relay, hide geo) | done — `setHideIpRelayOnly()` (`ui/live.js:9450-9479`) | done — `settings.tsx:661-675` toggle → `hideIp` pref → `forceRelay` in `pcConfig()` (`MediaSession.ts:876-880`) | Equivalent. | — |
| Push notification for incoming friend call while app/tab closed | **missing** — only in-page `Notification` API while the tab is open (`ui/live.js:14255-14283,26130-26200`); no service-worker push subscription wired to `register_push` | done — real FCM/APNs/Expo push via `register_push` (`mobile/src/push/register.ts`) | Web users miss friend-call rings whenever the tab/site isn't open; Android users get rung even from a killed app. Most user-visible asymmetry found in this audit. | P1 |
| Deep links / app links | done — URL query params only: `?friend=`, `?room=`, `?ref=` (`ui/live.js:118,12089-12131,13643`) | done — `FriendInviteHandler.tsx` + custom scheme `ruletka://` + universal/app links (`mobile/app.config.js:74,104-122`) | Different mechanisms, both functionally complete for their platform (not a real gap). | — |
| Identity export/import | done — `buildProfileExport()`/`importProfileFile()`, **optional** password ("Export without password (not recommended)", `ui/live.js:19463-19467`); never includes stars or the raw signing key | done — `profileBackup.ts`, **always** PBKDF2(310k)+AES-GCM encrypted (`mobile/app/settings.tsx:369-477`) | Web allows a plaintext export path (with a warning); Android forces encryption. Exported payload itself (user_id/name/friends/prefs, no stars, no private key) is low-sensitivity, so risk is limited, but it's an inconsistent security posture across platforms. | P3 |
| Find 3rd / party / browse_together | done — `btn-find-third`, `matchMode` `solo\|friend\|party_browse` (`ui/live.js:438,11742-11829`) | done — `browse_together`/`find_third_invite` wired (`mobile/app/live.tsx:2316,2328`) | Equivalent. | — |
| Formal debate mode (turn-based mic) | done (`ui/live.js:466-496,8345-8347`) | done — same P2P protocol reimplemented (`mobile/src/media/debate.ts`) | Not in the original "must cover" list but found during audit; fully ported. | — |
| Picture-in-picture | done — browser PiP API (`ui/live.js:26861-26863`) | done — `mobile/src/media/pipPrefs.ts` (native PiP) | Equivalent. | — |

## Top gaps, ranked

1. **P1 — No true push when the browser tab is fully closed.** Android rings via FCM/APNs/Expo
   even when the app is killed (`mobile/src/push/register.ts`). **Web (2026-08-07):** tab **open
   but unfocused/hidden** → OS `Notification` + title flash + ringtone (`tryShowCallNotification`,
   `pageIsBackgrounded`, blur/visibility re-notify). **Still open:** tab fully closed needs a
   service-worker / web-push follow-up (suggest task `039-web-push-sw-friend-call`).
2. **P2 — Cam "mute" means different things per platform.** Web's mute button no longer disables
   the video track — it shows a privacy overlay while the track keeps streaming (`ui/live.js:18031-18032`,
   deliberate redesign); Android's mute genuinely disables the track (`mobile/app/live.tsx:2240-2245`).
   Same button label, different guarantee — worth a shared copy/behavior review, not necessarily a
   code fix.
3. **P3 — Android has no "Prefer Direct" (STUN-only, refuse TURN) toggle.** Web exposes this as a
   privacy/battery option mutually exclusive with Hide IP (`ui/live.js:9413-9447`); Android's
   `MediaSession.pcConfig()` only knows `all` vs `relay` (`mobile/src/media/MediaSession.ts:882`).
   Low-traffic setting; port only if users ask for it.
4. **P3 — Identity export encryption is optional on web, mandatory on Android.** Web offers a
   plaintext "Export without password (not recommended)" path (`ui/live.js:19463-19467`); Android
   always encrypts (`mobile/app/settings.tsx`). Exported data is low-sensitivity (no stars, no
   signing key) so actual risk is small, but the inconsistent default is worth aligning.
5–10. **No further functional gaps found.** Every other "must cover" item (stranger match
   start/next/stop, offerer/force_relay/TURN, geo+i18n, friends add/call/hangup, chat+typing,
   stars balance/gift/effects/rate-prompt, block/report/18+, hide-IP, deep links, identity
   export/import, find-3rd/party) is implemented equivalently on both platforms. Deep links and
   push are the two places where the platforms *necessarily* use different mechanisms (URL query
   params vs. native scheme/universal links; in-page notification vs. OS push) — of those, only
   push represents an actual capability gap rather than a platform-appropriate difference.

## Scope note

This audit is read-only against the code as of this session; no WebRTC connect-path changes were
made (per task rules). No 1-line bugs were found that would justify a code change under the "do
not change the connect path unless you find a 1-line bug" rule.
