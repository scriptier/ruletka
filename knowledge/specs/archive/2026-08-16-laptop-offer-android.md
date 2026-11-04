# Spec: Laptop must offer to Android (Courtier mid)

**Status:** active · 2026-08-16 · **verify before build · no MULTI_PASS**  
**Herd:** after 665 no visual change

## Facts

1. 663 WIN: laptop left Dragonov + this PC cam. 664 Courtier name. 664/665 REGRESS Dragonov black.
2. Human: nothing changed since last. Mid Courtier has no Android video.
3. Score `012303Z` app_vc **422**: this PC pair live; laptop `58493127` ice=**checking** 0/0 **offerer=0**; android extra ice=**new** bind_v=0.
4. Paint hops cannot invent Courtier frames. Laptop never beacons **offerer=1** to Android.

## DONE WHEN (disk)

1. `joinPeers` / ensure: listed extra without live PC gets a **new offerer** PC + `connect()`.
2. Extra ice=new MediaSession accepts a new offer (reset leftover). **No APK until director EVAL.**
3. EVAL green. **No MULTI_PASS.**

## EVAL

- `node --check ui/live.js`
- `node ui/live-third-slot.test.mjs`
- `node mobile/src/live/matchContinuity.test.mjs`
- Director re-grep: extra offerer connect + `resetStuckExtraPc`
- **No `build-apk` this hop.**

## MUST NOT

- Dual-write MediaSession
- APK / push.sh / pool>0 / hunt remount
- Invent MULTI_PASS

## Lanes

| Lane | OWN |
|------|-----|
| p-offer | `ui/live.js` `ui/live.html` |
| p-ms | `mobile/src/media/MediaSession.ts` |
| p-test | `ui/live-third-slot.test.mjs` `mobile/src/live/matchContinuity.ts` `mobile/src/live/matchContinuity.test.mjs` |
| p-wiki | `knowledge/wiki/now.md` `gotchas.md` `log.md` |
