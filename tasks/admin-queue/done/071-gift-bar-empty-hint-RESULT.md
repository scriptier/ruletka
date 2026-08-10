# 071 — LiveGiftBar soft empty / locked copy

## Status
COMPLETE

## What changed
`LiveGiftBar` had no copy at all for two edge cases:
- `gifts` prop is empty (blank scroll area, no explanation)
- user's ★ balance is below the cheapest gift's cost, so every chip is disabled with no context beyond the dimmed style

Added a soft, muted hint line (reusing the existing `giftUnlockText` style already used for the unlock-progress caption) for both cases, sourced via `useT()` from `mobile/src/i18n`:
- Empty (`gifts.length === 0`): replaces the chip row entirely with `mobile.live.giftsEmpty`.
- Locked (chips render, but `stars < cheapest gift cost`): chip row still renders (unaffordable chips stay tappable → `onCantAfford` toast, unchanged), plus a hint line below it using `mobile.live.giftsLocked`.

No changes to spend/afford logic, chip rendering, or the star-review unlock bar — only added the two new conditional hint branches and the `useT` import.

## Files touched
- `mobile/src/live/LiveGiftBar.tsx` — import `useT`, compute `cheapest`/`allLocked`, render empty/locked hint text
- `mobile/src/i18n/overlay/en.json` — added `mobile.live.giftsEmpty`, `mobile.live.giftsLocked`
- `mobile/src/i18n/overlay/ru.json` — added same two keys, RU copy

Other languages (uk, pl, cs, bg, sr, de, es, fr, pt, tr, ar, zh) were intentionally left untouched — `translate()` in `mobile/src/i18n/index.tsx` falls back to the EN overlay for any key missing in a language pack, so the new strings render in English there until translated, per task scope (only EN + RU required).

## Verify commands run
- `cd mobile && npx tsc --noEmit -p .` — pre-existing unrelated errors only (missing native modules like `expo-clipboard`, `app/live.tsx` issues predating this change); nothing in `LiveGiftBar.tsx`.
- `node -e "JSON.parse(readFileSync('src/i18n/overlay/en.json')); JSON.parse(readFileSync('src/i18n/overlay/ru.json'))"` — both parse cleanly.

## Connect risk
none — no changes to signaling, offer/answer, ICE/TURN, or CONNECTIVITY_LOCK. Purely presentational copy inside the gift chip bar; `onSpend`/`onCantAfford` wiring untouched.

COMPLETE
