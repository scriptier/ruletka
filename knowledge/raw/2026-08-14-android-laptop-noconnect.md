# Android ↔ laptop Chrome: no-media (ICE failed)

**Stamp:** av-verify `20260814T051134Z`  
**Shot:** `artifacts/shots/20260814T051122Z-and-laptop-phone.png` — 2:07 black Partner, PiP self. Desk PC idle (not in this pair).

| Field | Value |
|-------|--------|
| product | **no-media** |
| pair | web↔android `force_relay=true` |
| android policy | relay · fr=1 · mismatch false |
| app_vc | **386** bind_v=1 |
| max_mto / mta | **1567 / 2826** (signaling OK) |
| last relay_candidates | offer **1** / answer **0** |
| frames | web 0/0 · android 0/0 |
| ice (android beacons) | **failed** interval_8s |

Answer path `Math.min(relayWaitBudgetMs(), 480)` emitted host-only SDP. Laptop is relay-only → no pair. Disk hop: answer wait = full **1200**, early-exit on first relay. **Needs APK.** No product.ok invent.
