# P1 Hunt looking caption i18n wire — RESULT

## Status
**COMPLETE**

## Goal
Android find-3rd looking pane caption uses existing `trio.slotEmpty` / `trio.searching` only (no new `mobile.live.*` caption keys).

## OWN
- `mobile/src/live/LiveStageVideo.tsx` (label path)
- `mobile/app/live.tsx` (labels prop wire)
- `mobile/src/i18n/overlay/*.json` (2 keys only — mobile `t()` loads overlay, not packs)

## What changed

1. **`live.tsx` → `labels.lookingForThird`**
   - Prefers `t("trio.slotEmpty")` (short), then `t("trio.searching")`.
   - Treats `t()` returning the key string as miss (never paints `"trio.slotEmpty"`).
   - Final hardcode matches EN pack `trio.slotEmpty`: `"Looking for a 3rd…"`.

2. **`LiveStageVideo.tsx` label path**
   - Hunt pane still uses `lookingLabel` from `labels.lookingForThird` only.
   - Comments document wire: `trio.slotEmpty` → `trio.searching`; EN hardcode = pack slotEmpty.
   - Renders on `testID="live-looking-for-third"` caption + a11y label.

3. **Mobile overlays (all 14 langs)**
   - Added `trio.slotEmpty` + `trio.searching` from `mobile/src/i18n/packs/*.json`.
   - Required: runtime `translate()` uses **overlay only**; without these keys UI would show raw key.

## Files
- `/home/drakosik/freenet-roulette/mobile/app/live.tsx`
- `/home/drakosik/freenet-roulette/mobile/src/live/LiveStageVideo.tsx`
- `/home/drakosik/freenet-roulette/mobile/src/i18n/overlay/{en,ru,uk,pl,cs,bg,sr,de,es,fr,pt,tr,ar,zh}.json`

## Verify

| Check | Result |
|-------|--------|
| Overlay has both keys all 14 langs | PASS |
| Simulated EN → `Looking for a 3rd…` | PASS |
| Simulated RU → `Ищем третьего…` | PASS |
| Miss guard rejects raw key | PASS |
| No new mobile.live looking-for-third key | PASS |
| APK | No (task constraint) |

## Smoke checklist (manual / next device)

| # | Check | Pass? |
|---|--------|-------|
| 1 | EN: find-3rd hunt bottom caption = **Looking for a 3rd…** | ☐ |
| 2 | RU: caption = **Ищем третьего…** | ☐ |
| 3 | Partner stays live on top while caption shows | ☐ |
| 4 | 3rd joins → looking pane ends | ☐ |
| 5 | No APK this hop | ☑ |

## Connect risk
**None** — caption string wire + 2 overlay keys. No MediaSession / ICE / offer / RTC mount changes.

## Out of scope
- APK / AAB
- New i18n keys beyond existing `trio.slotEmpty` / `trio.searching`
- PC `live.js` trio middle caption (ui packs already have keys)

## Completion promise
COMPLETE
