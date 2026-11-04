# W4b friends error/empty copy polish — RESULT

## Status
**COMPLETE**

## OWN
- `mobile/app/friends.tsx` only

## Goal
Friends empty/error/offline recovery CTAs clear; labeled **Retry**; no crash paths. No APK. No new i18n packs.

## What changed

### Empty
- List empty card uses **`mobile.friends.emptyTitle`** + **`mobile.friends.empty`** (title + body).
- Search with no hits uses **`mobile.friends.searchEmpty`** + **Clear** (not “no friends yet”).
- Share invite + Copy code remain primary CTAs when truly empty.

### Offline recovery
- Hero offline strip is a **pressable** with **`mobile.friends.offline`** + labeled **`mobile.live.retryPath`** (“Retry”).
- Empty-offline path also shows offline + **Retry**.
- Retry → `reconnectHub()` + re-hello + history reload (`retryConnection` / pull-to-refresh).

### Error / loading
- `histStatus: loading | ready | error` for local match/call history.
- First load (no rows yet): spinner + **`mobile.common.loading`**.
- History load failure: banner (**`mobile.live.errorTitle`** + **`mobile.friends.notConnected`**) + **Retry** → reload (and reconnect if offline).

### Crash / dead CTA guards
- Share/copy with empty friend code → toast (loading / not connected), never silent no-op.
- Clipboard/share failures toast instead of swallowing.
- History loaders coerced to `[]` if non-array.
- `keyExtractor` falls back if `user_id` missing.
- Friend row code line / copy-code paths tolerate missing `user_id`.
- Accept-friend failure toasts **notConnected** (no raw exception string).

## Files touched
- `/home/drakosik/freenet-roulette/mobile/app/friends.tsx`

## i18n (existing keys only — no pack edits)
| Key | Use |
|-----|-----|
| `mobile.friends.emptyTitle` / `empty` | Empty card |
| `mobile.friends.searchEmpty` | Search miss |
| `mobile.friends.offline` | Offline copy |
| `mobile.friends.notConnected` | Error body / failed actions |
| `mobile.live.retryPath` | **Retry** label |
| `mobile.live.errorTitle` | Error banner title |
| `mobile.common.loading` | Loading strip / code not ready |
| `mobile.home.hubOfflineTap` | Offline a11y hint |

## Verify
- Brace/paren/bracket balance OK
- All `styles.*` refs defined
- All `t(...)` keys present in `mobile/src/i18n/overlay/en.json`
- Static pattern check: offline Retry, error Retry, emptyTitle, searchEmpty, loading, reconnectHub

## Connect risk
**None** — Friends UI/state only. No WebRTC, MediaSession, ICE, or hub protocol changes. `reconnectHub` is existing hub helper (WS reconnect only).

## Out of scope
- APK / AAB
- i18n overlay/pack file edits
- settings.tsx, live.tsx, FriendChatSheet, deploy

## COMPLETE
