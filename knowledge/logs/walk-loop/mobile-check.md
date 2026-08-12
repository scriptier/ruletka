# mobile-check — 2026-08-10

**ROLE:** mobile-check  
**RESULT:** FIXED (1 bug) + APK bump  
**APK:** `0.1.307-vc315` → `mobile/artifacts/ruletka-0.1.307-vc315.apk`  
**ICE thrash:** none (hub `spin` only; no force_relay / PC policy changes)

## Checks

| Item | Status |
|------|--------|
| Home Start chatting → `/live?autostart=1` | OK — brand, CTA, pool busy, quiet-online |
| friendsOnly | OK — home CTA → Friends; live `start` + autostart no-op |
| Autostart effect | **FIXED** (see below) |
| Stop re-spin | OK after fix — param cleared only after arm; Stop → idle no re-spin |
| PartnerChrome / partner zOrder | OK — partner remote always `zOrder 0`; chrome elevation RN-only |
| `formatLocLine.test.mjs` | PASS |
| `matchPeers.test.mjs` | PASS |

## Bug fixed: autostart race

**File:** `mobile/app/live.tsx`

**Before:** effect set `autoStartConsumedRef`, called `router.setParams({ autostart: undefined })` *before* the 80ms `start()`, and cleanup `clearTimeout` on every re-run. When setParams updated the param, the effect re-ran, cancelled the timer, and the `want=false` branch reset consumed → **Start chatting could land on idle forever** (flake).

**After:**
- Depend on stable `wantAutostart` boolean (not raw array param identity)
- Schedule 80ms start first; `setParams` only *inside* the timer
- If already search/matched when timer fires, clear param only (no double-spin)
- friendsOnly still short-circuits

## zOrder scan (no change)

- `LiveStageVideo`: `mainShowsPartner || phase === "matched" → mainZOrder 0`
- Privacy / partner-hide / bars → 0 under RN covers
- `PartnerChrome`: zIndex/elevation only; comment requires partner RTCView stay 0
- `VideoView`: caps zOrder 0..2; partner call sites pass 0

## Not done

- No device install (no adb)
- No ICE / MediaSession changes
