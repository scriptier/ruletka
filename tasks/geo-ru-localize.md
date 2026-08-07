# Task: Russian country/city on match UI (from screenshot)

## Context screenshot
`/home/drakosik/Pictures/2026-08-07_03-40.png`

Shows Russian UI (Добавить, Уведомления, …) but English geo:
- 🇨🇦 **Canada**
- **Calgary**

Product default language is **Russian**. Hub geo is English. Must show **Канада** / **Калгари** when lang is `ru`.

## Already started (do NOT throw away — finish/wire/verify)
Grok started:
- `ui/geoLocalize.js` — `RuletGeo.localizeCountry` / `localizeCity`
- `ui/live.js` — `setLocationOnTile` uses RuletGeo; `refreshAllLocationTiles` on `nextface:lang`
- `ui/live.html` — script tag `geoLocalize.js?v=1` before live.js
- `mobile/src/i18n/geoLocalize.ts`
- `mobile/src/identity/flagTrust.ts` — `formatLocLine` localizes
- `mobile/src/identity/PartnerChrome.tsx` — passes lang (needs clean useI18n().lang)

## Your job
1. **Review the screenshot** and ensure the exact layout (flag → country → city) localizes for `ru`.
2. **Complete web**:
   - Confirm `live.html` loads `geoLocalize.js` before `live.js`
   - Bump cache-bust query params if needed
   - On lang change, remote + local loc tiles re-render RU names
   - `countryNameForCode("CA")` → `Канада` when getLang() is ru
3. **Complete mobile**:
   - PartnerChrome must use `useI18n().lang` (not broken require)
   - Pass both `country` and `city` from match peer (live.tsx currently does `setPartnerCountry(peer.country || peer.city)` — fix to keep both)
   - Partner chrome shows localized country + city when lang=ru
4. **Tests** (small unit if easy): Canada/Calgary → Канада/Калгари for ru; unchanged for en
5. Do **not** work on WebRTC/connectivity — Grok owns that in parallel.

## Done criteria
- With UI language Russian: Canada → Канада, Calgary → Калгари (web + mobile)
- English UI: stays Canada / Calgary
- No regressions to match/connect path

## Report back
Write summary to `tasks/geo-ru-localize-RESULT.md` with files changed and how to verify.
When finished, your process exit notifies Grok — keep RESULT.md clear.

Work in worktree `$HOME/freenet-roulette-claude` if present; sync changed files back to main tree paths under freenet-roulette when done (or edit main tree if worktree missing).
