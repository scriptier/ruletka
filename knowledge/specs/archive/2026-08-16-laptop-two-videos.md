# Spec: Laptop 3rd must show 2 videos (Courtier + Dragonov)

**Status:** active · 2026-08-16 · **do not invent MULTI_PASS**  
**Evidence:** `knowledge/raw/2026-08-16-laptop-vs-pc-3way-compare.md` · `010045Z`  
**Herd:** laptop-two-videos (this hop)

## Human facts

1. Laptop is the **3rd** (YOU Laptop · vs a pair). This PC is the pair (YOU Dragonov).
2. This PC view is honest: Courtier phone live + Laptop no-cam + you.
3. Laptop `010045Z`: left **Dragonov black** · mid **Partner ★133** no-cam · self no-cam.
4. Mid ★133 is **Courtier**. Name + video wrong. Left is Dragonov with no paint.
5. Laptop has **no webcam** — self cylinder only. Must not cover inbound cams.
6. Hunt-keep **HELD**. 414 extra-reset installed. Pins 662/332.

## GOAL

Laptop 3rd paints **two inbound cameras**: Courtier (phone) + Dragonov (this PC). Self stays no-cam.

## DONE WHEN (disk — human smoke still required)

1. Left/#remote name **and** stream are the same person (occupancy PC).
2. Mid/#remote-third is the other remote (real name, not Partner if we know it).
3. Same `srcObject` is never bound to two remote tiles.
4. Once a remote tile has decoded pictures, no-cam cannot cover it.
5. EVAL green. **No APK this hop.** **No MULTI_PASS.**

## EVAL

- `node --check ui/live.js`
- `node ui/live-third-slot.test.mjs`
- Director re-grep: `tileEverHadCamera` · occupancy trio name · no dual `srcObject`
- **No APK.** Rsync only after EVAL.

## MUST NOT

- `MediaSession.ts` / hunt remount / pool>0 / force_relay
- Dual-write `live.js`
- Invent MULTI_PASS / product.ok
- APK / `push.sh`

## Lanes

| Lane | OWN | Hop |
|------|-----|-----|
| p-paint | `ui/live.js` `ui/live.html` | bind stream↔peer; no dual bind; no-cam never re-cover |
| p-test | `ui/live-third-slot.test.mjs` | EVAL asserts for bind/name/ever-frames |
| p-wiki | `knowledge/wiki/now.md` `gotchas.md` `log.md` | hop stamp · no MULTI_PASS |
| d-score | `knowledge/raw/2026-08-16-laptop-two-videos-diag.md` | RO scorecard: laptop PCs / android extra ice |

Director bumps `live.js?v=` after p-paint. **Verify before rsync.** **No build.**
