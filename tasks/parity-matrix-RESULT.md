# Result: Play ↔ browser parity matrix

Status: **done**. Output: `docs/PARITY_MATRIX.md`.

## Method

- Read the protocol source of truth directly: `bridge/src/protocol.rs` (full `ClientMsg`/`ServerMsg`
  enums) and `docs/PROTOCOL.md`.
- Ran two parallel read-only Explore passes, one over the web client (`ui/live.js`, `ui/webrtc.js`,
  `ui/i18n/*`, `ui/geoLocalize.js`, `ui/identity.js`) and one over the Android app
  (`mobile/app/live.tsx`, `mobile/app/friends.tsx`, `mobile/app/settings.tsx`, `mobile/src/media/*`,
  `mobile/src/hub/*`, `mobile/src/stars/*`, `mobile/src/identity/*`, `mobile/src/linking/*`,
  `mobile/src/safety/*`, `mobile/src/i18n/*`), each collecting file:line evidence per "must cover"
  feature.
- Followed up myself with targeted greps/reads to verify or refute the few things the two passes
  disagreed on or didn't fully resolve: the post-chat `rate_prompt` flow, the full stars gift
  catalog/costs, the web-only "Prefer Direct" (STUN-only) setting, push notifications for offline
  friend calls, cam-mute semantics, debate mode, and identity-export encryption defaults.
- No files outside `docs/PARITY_MATRIX.md` and this result file were modified. No WebRTC
  connect-path code was touched.

## Headline finding

Parity is high. Every item in the task's "must cover" list has a working implementation on both
web and Android, backed by the same wire protocol. This audit found real feature parity, not the
partial/missing coverage the task brief anticipated — worth flagging since it changes the
takeaway from "here's what to build" to "here's what to polish."

## Top gaps (ranked, full detail in docs/PARITY_MATRIX.md)

1. **P1** — Web has no true push notification for incoming friend calls when the tab/site is
   closed; Android has real FCM/APNs/Expo push (`register_push`). This is the one gap with real
   user-facing impact (missed calls).
2. **P2** — Web's camera "mute" button no longer disables the video track (shows a privacy overlay
   instead, deliberate redesign); Android's mute genuinely disables the track. Same label, different
   guarantee — a copy/UX consistency issue more than a missing feature.
3. **P3** — Android has no "Prefer Direct" (force STUN-only, refuse TURN) setting that web exposes.
4. **P3** — Web allows an unencrypted identity-export path ("Export without password"); Android
   always encrypts. Low risk since exports carry no stars/signing key, but inconsistent.
5–10. No further gaps found — remaining "must cover" items (match start/next/stop, offerer role,
   force_relay/TURN, geo+i18n [14 languages both platforms], friends add/call/hangup, chat+typing,
   stars balance/gift-catalog/effects/rate-prompt, block/report/18+ gate, hide-IP, deep links,
   identity export/import, find-3rd/party/browse_together) are equivalently implemented on both
   platforms. Deep links and push use platform-appropriate but different mechanisms; of the two,
   only push is an actual capability gap rather than a reasonable platform difference.

## Rule compliance

- Read-only for connect-path code: confirmed, no `ui/webrtc.js` / `MediaSession.ts` connect-path
  edits were made; no 1-line bug was found that would justify one.
- No deploy actions taken.
- Only `docs/PARITY_MATRIX.md` and `tasks/parity-matrix-RESULT.md` were written.
