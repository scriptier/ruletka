# Task: Settings — show last connect stopwatch

## Owner
**Claude Code** (implementer)

## Success
- Settings (or Live debug strip) shows last match connect summary from `MediaSession.getLastConnectTiming()`:
  - offer ms / answer ms / ice ms / first frame ms
- Empty state: “No connect yet” or similar (i18n key in en + one overlay pack OK)
- No change to WebRTC offer/answer/ICE logic

## Context
- 0.1.189 human pass: cameras link fast. We now have `getLastConnectTiming()` + toast on first frame.
- Persist last summary for post-call review without re-matching.

## Files (prefer only these)
- `mobile/app/settings.tsx` and/or `mobile/app/live.tsx` (display only)
- `mobile/src/i18n/overlay/en.json` (+ mirror one other if required by project)
- Optional tiny helper under `mobile/src/media/connectUi.ts` for formatting only

## Do not
- Edit `MediaSession.ts` offer/answer/ICE/gather/retry
- Edit `ui/webrtc.js` / `ui/live.js` kickSolo
- Deploy / push / APK build
- Undo force_relay, thrash guards, warm PC promote

## Already shipped (do not undo)
- CONNECT toast on first frame
- `getLastConnectTiming()` on MediaSession

## Done
Write `tasks/admin-queue/done/050-settings-last-connect-timing-RESULT.md` with Status + COMPLETE
