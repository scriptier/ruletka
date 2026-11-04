# CONN-L1-diagnose RESULT

Source: `artifacts/av-verify/latest.json` / `latest.md` @ `2026-08-12T04:48:52Z` (window 10 min)  
Baseline copy: `artifacts/connect-loop/baseline-av-verify.*`  
Wiki: `one-way-video.md`, `force-relay-same-lan.md`, `linking-speed.md`, `gotchas.md`  
Skill: `av-fix-loop` · `ONE_WAY.md` · `GOTCHAS.md`

```
## Verdict
WARN / one-way / PRODUCT one-way (PC→phone weak) + answers(2)<offers(3)

## 5 lines
1. Signaling mostly works: matches=4 offers=3 answers=2 max_mto=1999ms max_mta=3368ms; last first-offer mto=1426 platform=web (web↔android force_relay=true).
2. TURN media HOT: max_rb=498789 peer_hot=242 alloc_ok=4 err_437=0 → media plane not the bottleneck (media_pass=true).
3. Product one-way: web fin/fout=62634/62634 · android fin/fout=0/0 · phone_to_pc=true · pc_to_phone=false · done=false.
4. Parsed av_path beacons ALL platform=web (relay→relay, policy=relay, ice=connected); zero android beacons → force_relay_android=null policy=null app_vc=null bind_v=null.
5. last offer/answer relay_candidates=1/0 — answer side not proving pure relay; answers lag offers (one pair no answer).

## Product parse
web fin/fout=62634/62634 · android fin/fout=0/0 · force_relay hub=true web=true android=null · mismatch=false · web policy=relay · android policy=null · app_vc=None bind_v=None

## NEXT_ROLE
android-answer

## Why not thrash
TURN HOT + err_437=0 → do not open coturn / force_relay hub policy / CONNECTIVITY_LOCK. Web already offers (~1.4s) and web↔web media is bidirectional relay-healthy — not web-kick or turn-media first. Classic one-way residual is **client-ice / android answer path** (sticky pure + answer relay SDP + bind/encode + av_path beacon), not dual MediaSession rewrites or pool>0.

## Top 3 improvements (ranked)
1. **Android answer pure + beacon** — when hub force_relay=true, latch sticky before/at inbound offer, wait typ relay in answer SDP (expect answer relay_candidates≥1), emit av_path with platform=android force_relay=1 policy=relay frames; prove app_vc/bind_v. Impact: high (kills product one-way / android 0/0 silence). Risk: medium (touch answer path only). OWN: `mobile/src/media/MediaSession.ts`, `mobile/app/live.tsx` — **one writer**, APK only after human authorize + smoke.
2. **Close answers < offers** — journal which side drops answer on web↔android pure (offerer_a=web); ensure answerer does not addTrack before setRemote / mid-nego rebuild. Impact: high on signaling completeness. Risk: low if observe-first. OWN: MediaSession answer serial only (no hub debounce thrash).
3. **Re-smoke gate after android hop** — human install APK with fix, PC hard-refresh, one clean match ≥20s; `./scripts/av-verify.sh --min 10` expect product.ok both fin/fout>0 and android beacon present. Impact: verification only. Risk: none. OWN: verify scripts / human smoke — no ship claim without product.ok.

## GOAL_MET
no — recommendations only
```

### Scorecard snapshot (do not invent)

| Field | Value |
|-------|--------|
| at | 2026-08-12T04:48:52Z |
| verdict | WARN |
| product.status | one-way |
| web fin/fout | 62634 / 62634 |
| android fin/fout | 0 / 0 |
| force_relay hub/web/android | true / true / null |
| mismatch | false |
| offers/answers | 3 / 2 |
| max_mto / max_mta | 1999 / 3368 |
| max_rb / err_437 | 498789 / 0 |
| last platforms | web ↔ android |
| app_vc / bind_v | null / null |

### DO_NOT
- Coturn / ICE policy thrash while media_pass
- pool>0
- Dual writers on MediaSession
- Invent product.ok / GOAL_MET from web-only frames
- Deploy/APK without human authorize + re-verify
