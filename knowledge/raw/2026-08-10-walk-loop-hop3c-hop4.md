# Walk-loop hops 3c + 4 + autostart (2026-08-10 evening)

Unverified until human UI deploy + APK install + av-verify product.ok.

## Residual (pre-ship hub journal)

- pure web→android: max mto **1749**, max mta **4097** (WARN)
- answer serial (mta−mto) ~2350 ms

## Code on disk (not all live)

| Hop | Side | Change | Artifact |
|-----|------|--------|----------|
| web hop3 | offer | pure first-relay budget 850; warm first-pass 500; pure cold second 500 flat | `ui/webrtc.js` — **UI deploy pending** |
| web hop3c | answer | same schedule as offer (was warm 700 / second budget+400) | `ui/webrtc.js` — **UI deploy pending** |
| android hop3 | answer | relay wait min(budget,450); post-setLocal bind fire-and-forget | APK **0.1.304+** |
| android hop4 | answer inbound | pure offer SDP → setForceRelay + **skip 800ms unlatched poll** | APK **0.1.308-vc316** |
| mobile UX | live.tsx | autostart race: schedule start before clear params | APK **0.1.307-vc315** |
| mobile UX | stage | partner RTCView zOrder 0; chrome elevation RN-only | APK **0.1.304+** |

## Belts (MUST NOT)

- pool>0
- wipe force_relay sticky mid-call
- dual-offer thrash
- pure-promote warm PC without belts
- GOAL_MET without product.ok smoke

## Next human

1. Deploy UI (webrtc hop3+3c)
2. Install `mobile/artifacts/ruletka-0.1.308-vc316.apk`
3. Same-WiFi force_relay pure smoke → av-verify product.ok + journal mto/mta
