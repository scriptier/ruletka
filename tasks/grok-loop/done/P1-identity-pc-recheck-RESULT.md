# P1 PC identity recheck Courtier — RESULT

**Status:** COMPLETE  
**OWN:** `ui/live.js` identity paths only  
**Date:** 2026-08-11  
**Syntax:** `node --check ui/live.js` → **PASS** (exit 0)  
**Deploy:** none

## Goal
Grep `live.js` for `partner_short` paint on `#remote-name`; ensure Courtier latch intact after multi / find-3rd.

## Grep: partner_short → #remote-name

| Check | Verdict |
|-------|---------|
| No `name: msg.partner_short` seed on MatchPeer | **PASS** — peers seed `name: ""` with explicit poison comments (~25201, ~25421) |
| `lastMatchMeta.name` never set from `partner_short` / bare hex | **PASS** — only `isRealPartnerDisplayName` / latch / empty |
| `#remote-name` writers go through `setDisplayNameOnTile` / `paintPartnerIdentityChrome` (poison reject) | **PASS** — 6 `$("remote-name")` sites; soft multi path now uses `setDisplayNameOnTile` |
| `isPoisonDisplayName` rejects 6–12 hex + anon/Partner | **PASS** ~1077–1084 |
| `resolvePartnerPaintName` never prefers short_id / friend_code | **PASS** ~1616–1640 |
| `partner_short` only for short_id / status log / connect keys | **PASS** — not conversationalist name |

## Latch after multi / find-3rd — gap found + fixed

### Bug
When party find-3rd lands a stranger, hub `primary` becomes the stranger (`role === "stranger"` first). Prior code:

1. `clearGoodPartnerNameLatch()` because `primary.user_id !== lastGoodPartnerUserId`
2. Main paint used `opponents[0]` (stranger) for `#remote-name`
3. DC `partner_identity` from stranger re-latched Alice over Courtier on main tile

Main video stayed Courtier (teammate) while name chrome could flip to Partner / stranger / wipe.

### Fix (identity only)

1. **Latch clear** (~25555): clear only when latched `user_id` is **not** still in `peers` (`latchedStillPresent`). Find-3rd mate keeps Courtier.
2. **Latch write**: do not re-latch stranger primary over a still-present mate Courtier.
3. **Main paint** (~25755): when `trioBrowse`, prefer `matePeer` for `#remote-name` + location; name order `rawPeer → lastGoodPartnerName → lastMatchMeta`.
4. **keep-PC re-Matched** (~25085): do not steal latch from a different peer’s hub name; re-paint prefers `lastGoodPartnerName`.
5. **DC `partner_identity`** (~8925): if `trioBrowse` and uid ≠ latched mate, skip main latch/paint (`stealMainLatch`).
6. **`bindFirstPartnerToMain`**: prefer `lastGoodPartnerName` over `lastMatchMeta.name` (meta may be stranger block primary).
7. **Split soft path**: soft label via `setDisplayNameOnTile` so latched Courtier cannot be raw-wiped.

### Intact contracts (unchanged)

| Item | Location |
|------|----------|
| `lastGoodPartnerName` + `latchGoodPartnerName` / `isRealPartnerDisplayName` | ~1574–1602 |
| `setDisplayNameOnTile` keeps latched Courtier over wipe | ~1644–1670 |
| `paintPartnerIdentityChrome` + hide who-sub 1v1 | ~1684–1699 |
| Find-third `softKeepPartnerPaint` re-paint Courtier | ~32861+ |
| Hangup clears latch via `resetClientMediaSession` | ~25901 |

## Files
- `/home/drakosik/freenet-roulette/ui/live.js` (identity paths only)

## Verify ran
```bash
node --check ui/live.js   # exit 0
```
Static asserts: `latchedStillPresent`, `stealMainLatch`, mate-prefer paint, no `name: msg.partner_short`.

## Not done (by job scope)
- No deploy / no APK / no cache v-bump
- No human smoke (PC↔phone find-3rd Courtier chip) — code-path recheck + surgical fix
- No WebRTC / multi-clone / MediaSession edits

## Connect risk
**None** — identity chrome / latch only. No ICE, offer, pool, or MediaSession thrash.

## Job complete
Moved running job → done; RESULT filed.
