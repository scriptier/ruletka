# Deep-link fix — `ruletka://live` → Live (not Friends)

**Date:** 2026-08-10  
**ROLE:** deeplink-emu  
**APK:** `0.1.313` / `versionCode` **321**  
**Artifact:** `mobile/artifacts/ruletka-0.1.313-vc321.apk`  
**Screencap:** `mobile/artifacts/emu-live-verify.png`

## Symptom (emu-smoke)

`adb shell am start -a VIEW -d ruletka://live` landed on **Friends** (invite / code UI), not Live.  
`ruletka://settings` also mis-routed; toast sometimes `unknown friend code…`.  
Friend-code field could show garbage path segments (`FRIENDS` / route leakage).

## Root cause

1. **`parseFriendInviteUrl` bare-path rule**  
   For `ruletka://live`, path segment `live` → normalize → `LIVE`.  
   `CODE_RE = /^[A-Z0-9]{4,16}$/` matches `LIVE`, `FRIENDS`, `SETTINGS`.  
   `FriendInviteHandler` then `router.push("/friends")` and `consumeFriendInvite("LIVE")`.

2. **Scheme URL shape**  
   `ruletka://live` is host=`live`, path empty (not path=`/live`).  
   expo-router’s `extractPathFromURL` usually maps host→`live`, but friend-handler theft ran after and stole the stack.

3. **`+native-intent` (first draft)**  
   Returning the raw scheme string for friend invites produced **Unmatched Route** (`ruletka:///friend/…`). Fixed to land on `/friends`.

## Fix (must not break friend invites)

| File | Change |
|------|--------|
| `mobile/src/linking/friendInvite.ts` | `RESERVED_APP_SEGMENTS` + `isReservedAppSegment`; bare path never treats live/friends/settings/rules as codes; `parseAppRouteUrl()` for app screens + query (`autostart=1`) |
| `mobile/src/linking/FriendInviteHandler.tsx` | Friend code → `/friends` (unchanged); else app route → `router.replace` with cold-start retry; 1.5s URL dedupe |
| `mobile/app/+native-intent.ts` | Rewrite `ruletka://live` → `/live`, `?autostart=1` preserved; friend/add/bare code → `/friends` (never raw scheme) |
| `mobile/scripts/test-friend-invite.mjs` | Regression cases for live/settings/friends + route parse |

**scheme / app.json:** still `"scheme": "ruletka"` — OK.  
**intentFilters:** `data: [{ scheme: "ruletka" }]` — OK.  
No friends-only build flag involved.

## Smoke (emulator-5554)

```bash
adb -s emulator-5554 install -r mobile/artifacts/ruletka-0.1.313-vc321.apk
adb -s emulator-5554 shell am force-stop me.ruletka.app
adb -s emulator-5554 shell am start -a android.intent.action.VIEW -d "ruletka://live" me.ruletka.app
# → Live: "Your camera", "tap Start to match", Start button
# screencap → mobile/artifacts/emu-live-verify.png

adb … -d "ruletka://friend/AB12CD99"   # → Friends (Your code / Share invite)
adb … -d "ruletka://friends"           # → Friends, no unknown-code toast
adb … -d "ruletka://settings"          # → Settings
```

| Link | Result |
|------|--------|
| `ruletka://live` | **Live** idle + Start |
| `ruletka://live?autostart=1` | Live (params supported) |
| `ruletka://friend/CODE` | **Friends** + invite consume |
| `ruletka://friends` | Friends (not code `FRIENDS`) |
| `ruletka://settings` | Settings (not code steal) |

Unit: `cd mobile && node scripts/test-friend-invite.mjs` → pass.

## Keep

- Explicit invite forms: `ruletka://friend/CODE`, `ruletka://add?friend=`, web `live.html?friend=`
- Bare `ruletka://AB12CD` still treated as friend code → Friends  
- Home `/live?autostart=1` CTAs unchanged
