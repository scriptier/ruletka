# Connectivity lock-in (working baseline)

**Locked after 2026-08-07** when phone↔browser finally connected (browser saw Play app camera).

Do **not** regress these without a proven faster alternative.

## Server (ruletka.vip)

| Piece | Locked value | Why |
|--------|--------------|-----|
| coturn | **host** unit (`systemctl`), not docker `coturn-ruletka` | Docker lost auth conf → ALLOCATE/CHANNEL_BIND failed |
| `/etc/turnserver.conf` | `use-auth-secret` + deny-list only (no peer allowlist) | Allowlist caused CHANNEL_BIND 403 |
| same-IP `force_relay` | **false** | TURN-only path stalled offers; LAN host candidates work |
| offer debounce | hub drops 2nd offer from same client within **8s** | Double-offer thrash → black video both ways |
| deploy stamp | keep host coturn across `push.sh` / setup-turn | Never `docker restart coturn-ruletka` |

## Client rules that keep video working

1. **One offer per match** (unless iceRestart after 15s grace).
2. **`callGen` invalidates** in-flight createOffer after hangup/rematch.
3. **Clear `force_relay`** when hub sends `force_relay: false` (don’t leave sticky TURN-only).
4. **Don’t keep “ICE checking” PCs** as “already live” without remote video.
5. Browser: ignore re-offer for **12s** after a successful answer.

## Speed targets (post lock-in)

| Metric | Target |
|--------|--------|
| match → first offer | **&lt; 1s** (cam already warm) |
| offer → answer | **&lt; 1s** |
| answer → first remote frame | **&lt; 5–10s** on same Wi‑Fi |

Working path had match→offer **~25s** (GUM/mutex stall) — fixed in 0.1.119+ fast-path.

## Smoke test

1. Install latest local APK (`mobile/artifacts/ruletka-latest.apk`).
2. Browser: one tab `https://ruletka.vip/live.html` hard refresh.
3. Both Start once; **do not spam Next for 15s**.
4. Hub should log: `force_relay=false`, **exactly 1 offer + 1 answer**.
5. Success: both sides remote camera.

## Do not re-enable without re-proving

- Always-on `force_relay` for every match
- Docker coturn as primary
- Peer IP allowlist on coturn
- Second non-restart offer within a few seconds of the first
