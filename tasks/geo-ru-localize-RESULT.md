# geo-ru-localize RESULT

**Status:** completed by Grok (Claude hung ~5min with empty log — process killed, work finished here)

## Screenshot
`/home/drakosik/Pictures/2026-08-07_03-40.png` — Russian UI, English **Canada** / **Calgary**

## Fix
When UI lang is `ru`, hub English geo is localized:
- Canada → **Канада**
- Calgary → **Калгари**

## Files
| File | Change |
|------|--------|
| `ui/geoLocalize.js` | `RuletGeo.localizeCountry` / `localizeCity` |
| `ui/live.js` | `setLocationOnTile` localizes; refresh on `nextface:lang` |
| `ui/live.html` | loads `geoLocalize.js` before `live.js` |
| `mobile/src/i18n/geoLocalize.ts` | same maps + Intl |
| `mobile/src/identity/flagTrust.ts` | `formatLocLine` localizes |
| `mobile/src/identity/PartnerChrome.tsx` | `useI18n().lang` |
| `mobile/app/live.tsx` | separate `partnerCountry` + `partnerCity` |

## Verify
```bash
# Web unit (node)
# RU: Канада / Калгари  EN: Canada / Calgary
```
Browser: hard-refresh live.html, set language Русский, match — expect Канада / Калгари under flag.
Mobile: install APK ≥0.1.122 with geo wiring.

## Connectivity
Out of scope for this task (Grok parallel).
