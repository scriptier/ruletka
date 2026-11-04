# P2-play-store-checklist — RESULT

**Status:** COMPLETE  
**When:** 2026-08-12  
**OWN:** `docs/PLAY_INTERNAL_TEST_CHECKLIST.md` · `docs/PLAY_TODAY.md`  
**SMOKE-NEXT:** install stamp already **0.1.364-vc372** — no edit needed

## Done WHEN

- [x] Primary tip stamped **0.1.364-vc372**
- [x] Honest checklist — **no invent PASS**
- [x] Missing-for-Console called out first: **privacy policy**, **Data safety**, **screenshots**
- [x] Tree honesty: app.json **0.1.365/373**, AAB still **MISSING**

## Files touched

| File | Change |
|------|--------|
| `docs/PLAY_INTERNAL_TEST_CHECKLIST.md` | Tip **0.1.364-vc372**; missing-items table (privacy / Data safety / screenshots) first; no Console PASS |
| `docs/PLAY_TODAY.md` | Day plan tip **0.1.364-vc372**; same three missing Console items only as primary list |
| `knowledge/specs/SMOKE-NEXT.md` | Unchanged (already 0.1.364-vc372) |

## What's still missing for store

1. **Privacy policy URL** in Play Console (URL live HTTP 200; field **not verified**)  
2. **Data safety** form in Console (draft `docs/PLAY_DATA_SAFETY.md` only)  
3. **Screenshots** upload in Console (PNGs on disk only)  
4. **AAB** for ship cut (build + Internal testing release)  
5. Content rating / 18+ / ads + **human** Play↔PC smoke  

## Evidence (local)

| Check | Result |
|-------|--------|
| APK tip | **OK** `ruletka-0.1.364-vc372.apk` |
| APK tree latest | **OK** `ruletka-0.1.365-vc373.apk` (+ latest) |
| AAB current | **MISSING** (`play-status` FAIL for 0.1.365-vc373) |
| Keystore | present |
| Screenshots on disk | phone-01…09 + tablet7/10 |
| Privacy URL | HTTP **200** |
| Data safety Console | **not verified** |
| Device smoke | **not PASS** |

## Explicit non-claims

- Did **not** mark privacy / Data safety / screenshots as Console PASS  
- Did **not** claim AAB ready  
- Did **not** claim human smoke green  

## Connect risk

**None** — docs only.

## COMPLETE or BLOCKED

**COMPLETE** (docs honesty pass). Store Internal track remains **blocked** on human Console work + AAB + smoke.
