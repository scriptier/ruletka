# RESULT: 044-home-online-strip

## Status
DONE

## Completion promise
COMPLETE

## What changed
- Home screen (`mobile/app/index.tsx`) now reads `friends` from `useHub()` and computes `onlineFriends = friends.filter(f => f.online).length`.
- When `onlineFriends >= 1`, a small green pill strip renders under the meta line: a dot + "{n}/{total} friends online" text, tappable → navigates to `/friends` (reuses existing `<Link href="/friends" asChild>` pattern already used elsewhere on the screen — no new call-routing logic touched).
- When zero friends are online, the strip renders nothing (`null`) — no empty chrome.
- No i18n edits needed: `mobile.home.friendsOnline` ("{n}/{total} friends online" / "{n}/{total} друзей онлайн") already existed in `en.json` and `ru.json` overlays but was unused. Other locales fall back to the English overlay automatically via `translate()` in `mobile/src/i18n/index.tsx` (overlay → pack → English overlay → English pack → key), so no missing-translation risk.

## Files
- mobile/app/index.tsx

## Verify ran
- Confirmed `useHub()`/`HubProvider` wraps the router tree (`mobile/app/_layout.tsx`) so calling `useHub()` in `index.tsx` is safe.
- Confirmed `FriendInfo.online: boolean` exists in `mobile/src/hub/types.ts` and `friends` array is already populated from the hub `friends` snapshot message.
- `tsc --noEmit` isolated to `app/index.tsx`: this worktree has no `node_modules` installed, so I ran the same `tsc -p .` against the main repo's `mobile/node_modules` (which does have deps) pointed at this worktree's files — 0 errors for `app/index.tsx` (6 unrelated pre-existing errors elsewhere in `live.tsx`, present on the unmodified main repo too, so unrelated to this change).
- Manually traced the render logic: strip mounts only in the `onlineFriends >= 1` branch, uses the same `Link`/`Pressable` pattern as the rest of the screen, and does not touch `live.tsx` or `MediaSession`.

## Connect risk
safe to merge after smoke — this task never touches `mobile/src/media/*`, `mobile/app/live.tsx`, or any connect/matching code path. Purely additive UI on the home screen.

## Handoff for morning
- merge branch: `admin/20260808T074943Z-044-home-online-strip`
- smoke: open Home with 0 friends online (no strip should show), then with ≥1 friend online (green pill "N/total friends online" should show and tapping it should open Friends screen).
- do not: deploy without Play↔PC connect check (unrelated to this change, but per standing policy).
