# 035 RESULT — Expand geo city map

**COMPLETE**

## Additions
≥70 new EN→RU city keys across web + mobile (RU regions, CIS, EU, US, Asia, LATAM).

Sample new mappings:
- Chelyabinsk → Челябинск, Omsk → Омск, Ufa → Уфа, Perm → Пермь, …
- Krakow → Краков, Wroclaw → Вроцлав, Milan → Милан, …
- San Diego → Сан-Диего, Buenos Aires → Буэнос-Айрес, …
- Bishkek, Dushanbe, Shymkent, Karaganda, …

Canada/Calgary unchanged: still **Калгари**.

## Files
- `ui/geoLocalize.js` — CITY_RU expanded (~244 keys)
- `mobile/src/i18n/geoLocalize.ts` — parity expansion
- `mobile/scripts/test-geo-localize.mjs` — extra assertions

## Tests
```text
node mobile/scripts/test-geo-localize.mjs  → all tests passed
```

## Connect risk
**None** (display strings only).
