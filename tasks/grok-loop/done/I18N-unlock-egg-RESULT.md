# i18n: star unlock easter egg strings — RESULT

## Status
**COMPLETE**

## Goal
Add `stars.unlockEasterEgg` + `stars.unlockEasterEggTip` for ★ double-click easter egg (`ui/live.js`), with EN + optional ru/uk.

## OWN
- `mobile/src/i18n/overlay/*.json`
- `ui/i18n/*.json` (web `_t` used by live.js)
- `mobile/src/i18n/packs/*.json` (parity with ui en for `check-i18n.py`)

## What changed

### Keys (both)

| Key | EN value |
|-----|----------|
| `stars.unlockEasterEgg` | `★ unlock timer · easter egg · double-click ★ again to hide` |
| `stars.unlockEasterEggTip` | ` · Double-click for unlock timer` |

Matches hardcode fallbacks in `ui/live.js` (`peekStarUnlockEasterEgg` / `wireStarUnlockEasterEgg`).

### Locales

| Locale | Status |
|--------|--------|
| **en** | Full strings (from live.js fallbacks) |
| **ru** | Translated |
| **uk** | Translated |
| de, es, fr, pl, pt, tr, zh, cs, bg, sr, ar | EN fill-in (key parity for check-i18n) |

### Surfaces

1. **Web** `ui/i18n/{en,ru,uk,…}.json` — required: `live.js` calls `_t("stars.unlockEasterEgg")` / `_t("stars.unlockEasterEggTip")`.
2. **Mobile packs** `mobile/src/i18n/packs/*.json` — same keys; keeps packs en ↔ ui en symmetric for `scripts/check-i18n.py`.
3. **Mobile overlay** `mobile/src/i18n/overlay/*.json` — same keys (runtime mobile `t()` uses overlay; parity across 14 langs).

## Files
- `/home/drakosik/freenet-roulette/ui/i18n/{en,ru,uk,de,es,fr,pl,pt,tr,zh,cs,bg,sr,ar}.json`
- `/home/drakosik/freenet-roulette/mobile/src/i18n/packs/{en,ru,uk,de,es,fr,pl,pt,tr,zh,cs,bg,sr,ar}.json`
- `/home/drakosik/freenet-roulette/mobile/src/i18n/overlay/{en,ru,uk,de,es,fr,pl,pt,tr,zh,cs,bg,sr,ar}.json`

## Verify

| Check | Result |
|-------|--------|
| Keys present in all 14 ui packs | PASS (grep) |
| Keys present in all 14 mobile packs | PASS (grep) |
| Keys present in all 14 overlays | PASS (grep) |
| EN matches live.js fallbacks | PASS |
| ru/uk non-English | PASS |
| No MediaSession / deploy | PASS |

## Connect risk
**None** — i18n string keys only. No live.js logic, ICE, MediaSession, or deploy.

## Out of scope
- Machine-translate remaining 11 locales (EN fill-in is fine)
- Wiring mobile double-tap ★ to these keys (mobile still uses `mobile.live.starUnlock*` when bar is shown)
- APK / deploy

## Completion promise
COMPLETE
