# Morning brief — 2026-08-10

**Sleep window work:** pure-relay + blur ship (0.1.283) + overnight polish  
**Git main:** see `git log -5`  
**Restore if needed:** `./scripts/admin-agent/restore-pre-sleep.sh`

## You must do (human gate)

```bash
adb install -r mobile/artifacts/ruletka-0.1.283-vc291.apk
# hard-refresh https://ruletka.vip/live.html  → webrtc.js?v=285
# both Start once · wait 15s · both faces ≥30s
# eye blur → frosted mosaic (not pure black) · Show video
```

**Hub fix live (overnight):** same public IP no longer sets `force_relay=true`
(pure TURN hairpin left `peer_usage=0` / ICE stuck). Same Wi‑Fi should use **host**.
Hub log expect: **`force_relay=false`** · 1 web offer + 1 android answer.

Optional Internal: upload `mobile/artifacts/ruletka-0.1.283-vc291.aab`

## What overnight proved (no human phone)

| Check | Result |
|-------|--------|
| connectivity-lock | PASS |
| coturn self-peer | PASS |
| Prod web stamp | `webrtc.js?v=285` |
| Headless web↔web | **matched** force_relay=true · relay_candidates=1 · MTO ~1.7s · 1 offer + 1 answer |
| peer_usage HOT | ~0 on headless (fake media; expect rise on real cams) |
| AAB | `ruletka-0.1.283-vc291.aab` built |
| APK dual-build race | flock in `build-apk-local.sh` + hook probe |

## Do not overnight-regress

- Hybrid `policy=all` for hub force_relay  
- Answerer promote  
- Unmount RTCView on blur  
- Deploy without smoke  

## After smoke green

```bash
./scripts/hub-match-speed.sh 15
./scripts/connect-monitor.sh --once
# want: peer_usage HOT rising · no answerer grace drops
```

## Headless pair (overnight note)

`prod-pair-media.mjs` fixed:
- `#btn-age-yes` / `#btn-rules-accept` / `#btn-start-match`
- isolated browser contexts
- soft ICE pass path
- still flaky: second tab sometimes never enqueues; earlier successful runs got **force_relay=true · relay_candidates=1 · MTO ~1.7s**

Human Play↔PC remains the real media gate.
