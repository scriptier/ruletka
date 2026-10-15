# Android gift star not visible on PC browser

## Symptom
User gifts a star (bars/flowers/etc.) from Android mid-match; PC browser shows no gift FX on local tile.

## Hub
`star effect applied` logs confirm spend succeeds (e.g. fireworks 20s). Broadcast goes to target + spender.

## Root causes (compound)
1. **Strict user_id match** on PC `star_effect`: paint only when `msg.user_id === myUserId` (onMe) or `=== primaryPartnerUserId` (onPartner). Mid-match thrash / empty `primaryPartnerUserId` / identity race → neither true → no `setFxOverlay`.
2. **No P2P gift path** — gifts were hub-only; mute already had DC + hub signal fallback.
3. (Historical) local FX under video — fixed earlier with `#tile-local .fx-overlay { z-index: 28 }` (already on prod).

## Fix (2026-08-12)
### PC `ui/live.js` (deployed live.js?v=567, deploy stamp `…-giftfx`)
- Harden `star_effect`: matched fallbacks from `from_user_id` / partner latch; default until if missing; minifier-safe nested block for gift body.
- `sendGiftFxP2p` + `applyGiftFxMessage` over DC + hub signal `kind:gift_fx`.
- Optimistic remote paint + gift_fx on PC spend.
- Log: `[gift] star_effect …` / `gift_fx→` / `gift_fx←`.

### Android `mobile/app/live.tsx` (needs APK for DC send)
- After `spendStars`, send `gift_fx` via DC + `hub.signal("gift_fx", …)`.
- Receive gift_fx on DC + hub signal → paint self/partner tiles.

## Smoke
1. Hard-refresh PC live (cache v=567).
2. Match Android ↔ PC.
3. Android gifts bars/heart/fireworks → PC **local** tile should show FX + toast/celebrate.
4. PC gifts → Android partner tile / stage FX.
5. Optional: PC console log filter `gift`.

## GOAL_MET
Not claimed — needs human smoke after hard refresh (+ APK for full gift_fx path).
