# BRAND has-brand-live wire (PC) — RESULT

## Status
**COMPLETE**

## Goal
PC watermark only animates when `.stage.has-brand-live`. Ensure Matched sets it; hangup clears; never leave `html.match-live` without stage class.

## OWN
`ui/live.js` only — `setStageBrandLive` / `has-brand-live` / `match-live`  
(no `live-brand.css` — sibling owns)

## Grep findings (before)

| Symbol | Sites |
|--------|--------|
| `setStageBrandLive(true)` | `startMatchTimer()` only |
| `setStageBrandLive(false)` | `stopMatchTimer()` always (even `closeAllPeers({ keepFriend })`) |
| `has-brand-live` class | toggled only inside `setStageBrandLive` on `main.stage` |
| `html.match-live` | `syncMatchChrome()` when `matched \|\| inFriendCall \|\| trioBrowse` |
| CSS spin gate | `.stage.has-brand-live .stage-brand-spin` / `.stage-brand-center` in `live-brand.css` |

### Gaps

1. **Brand was timer-only** — full `handleMatched` called `startMatchTimer()` → brand on; **keep-PC re-Matched** early-return skipped timer → no re-assert; `status: friend_call` set `matched` + `updateFriendActionButtons` → `match-live` on, but **never** `startMatchTimer` → **no `has-brand-live`**.
2. **Premature clear** — `closeAllPeers({ keepFriend: true })` always called `stopMatchTimer()` → `setStageBrandLive(false)` while still live (party Next / friend keep).
3. **Drift** — `match-live` and `has-brand-live` were independent; chrome could show live without watermark animation class.

## Changes (`ui/live.js`)

1. **`syncMatchChrome`** — after `match-live` toggle, `setStageBrandLive(isLive)` so stage class tracks live chrome (Matched / friend_call / trio via `updateFriendActionButtons` → sync).
2. **Keep-PC re-Matched** early-return — `setStageBrandLive(true)` + `updateFriendActionButtons()` so rematch without timer restart still arms brand.
3. **`stopMatchTimer`** — clear brand only when **not** still live (`!(matched \|\| inFriendCall \|\| trioBrowse)`); hangup paths that zero `matched` first still clear; keep-friend teardown no longer strips mid-call.
4. Comments aligned: center seam CSS spin (not “center seam off”).

Belt kept: `startMatchTimer` still `setStageBrandLive(true)` on full Matched path.

## Not touched
- `ui/live-brand.css` (sibling)
- WebRTC / MediaSession / identity chrome

## Verify (static)
- `setStageBrandLive` call sites: syncMatchChrome(isLive), keep-PC true, startMatchTimer true, stopMatchTimer false-if-idle
- `node --check ui/live.js` expected clean after edit

## DONE WHEN
- [x] Matched → `has-brand-live` on (via timer + syncMatchChrome)
- [x] keep-PC re-Matched re-asserts brand
- [x] Hangup / idle → brand off when not live
- [x] keepFriend teardown does not clear brand while still live
- [x] RESULT COMPLETE
