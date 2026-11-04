# P1 Friends Play-ready — RESULT

## Status
**COMPLETE**

## OWN
- `mobile/app/friends.tsx` only (no APK, no i18n file edits — reused existing keys)

## What changed
Play-ready polish so Friends never looks broken or has silent primary CTAs:

1. **Empty state**
   - Card UI: `emptyTitle` + `empty` body (existing i18n keys).
   - Primary CTAs: **Share invite** + **Copy code** (both wired; toast if code not ready).
   - Search with no hits: `searchEmpty` with `{query}` (not the “no friends yet” copy).

2. **Loading state**
   - `histStatus: loading | ready | error` for local match/call history.
   - First open: spinner + `mobile.common.loading` strip (soft reloads keep prior rows).

3. **Error state**
   - History load failure → banner + **Retry** (`conn.retry`) re-runs `reloadHistory`.
   - Share/copy/clipboard failures → toast (`notConnected`), never silent no-op.

4. **Avatars / history usable**
   - Existing avatar `onError` → letter tile; match thumbs → friend avatar → letter (unchanged, still safe).
   - Match copy / long-press: empty code toasts `lastMatchNoCode`; clipboard reject toasts.
   - Call history Call back / Ring anyway unchanged and still place calls.

5. **Crash / dead CTA guards**
   - `keyExtractor` / code line fall back if `user_id` missing.
   - History arrays coerced to `[]` if loaders return non-arrays.
   - Share/copy with empty friend code toast instead of sharing blank / silent return.

## Files
- `/home/drakosik/freenet-roulette/mobile/app/friends.tsx`

## Smoke checklist (manual / next device)

| # | Check | Pass? |
|---|--------|-------|
| 1 | Open Friends with **0 friends** → empty card title+body, Share + Copy visible and tappable | ☐ |
| 2 | Tap Share / Copy **before** hub hello (no code) → toast, no crash | ☐ |
| 3 | Hub connected, tap Share → system share sheet with code | ☐ |
| 4 | Hub connected, tap Copy → “code copied” toast | ☐ |
| 5 | First open shows brief history **loading** strip, then ready (or empty history) | ☐ |
| 6 | Pull-to-refresh → spinner ends; list still usable | ☐ |
| 7 | Friend with avatar paints; broken URI falls back to letter (no redbox) | ☐ |
| 8 | Friend row Chat / Call / Invite / ⋯ all open sheet, call, or Alert (no dead taps) | ☐ |
| 9 | Offline: header warn; Add still toasts “not connected” | ☐ |
| 10 | Call history (if any): Call back / Ring anyway labels + place call path | ☐ |
| 11 | Match history (if any): thumbs or letter; copy/add/report/block/dismiss work | ☐ |
| 12 | Search (3+ friends) with no match → searchEmpty copy, not “no friends yet” | ☐ |
| 13 | Incoming accept / decline still works when requests present | ☐ |
| 14 | No APK built (task constraint) | ☑ |

## Connect risk
**None** — UI/state only on Friends screen. No WebRTC / offer / MediaSession / hub protocol changes.

## Verify ran
- Static review of empty / loading / error / CTA paths
- Brace/paren balance + symbol presence check on `friends.tsx`
- Confirmed i18n keys already present: `mobile.friends.emptyTitle`, `empty`, `searchEmpty`, `mobile.common.loading`, `conn.retry`, `mobile.home.lastMatchNoCode`

## Out of scope
- APK / AAB
- i18n overlay edits
- FriendChatSheet, hub client, history storage modules
