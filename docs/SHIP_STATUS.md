# Ship status — 0.1.282 (290)

**Updated:** 2026-08-10 · **Prod web:** live · **Git:** `main` @ `cd22836`

## Gate results

| Gate | Status |
|------|--------|
| `./scripts/test-connectivity-lock.sh` | Pass |
| Hub `/health` | `ok` · TURN on |
| Live assets | `webrtc.js?v=285` · pure `force_relay` |
| APK | `mobile/artifacts/ruletka-0.1.282-vc290.apk` |

## What this fix does (bilateral black video)

Same-LAN (same public IP) always sets hub `force_relay=true`. Hybrid
`iceTransportPolicy=all` preferred host → hairpin hung, coturn
`peer_usage≈0`, **both cams black**. Android answerer also promoted@~9s
→ dual-offer glare.

**Locked path now:**

1. Hub `force_relay` → pure `iceTransportPolicy=relay` (UDP TURN only) on **web + Android**
2. Strip host/srflx under force_relay (no private CREATE_PERM)
3. Android hub-answerer **never promotes** to offerer (waits for web)
4. Hide IP still pure relay (unchanged)

## Human smoke (required)

```bash
adb install -r mobile/artifacts/ruletka-0.1.282-vc290.apk
# hard-refresh https://ruletka.vip/live.html  (must show webrtc.js?v=285)
# Hide IP off · blur off · Start once · wait 15s · no Next spam
```

Success:

- PC sees phone face **and** phone sees PC ≥30s
- Hub: `force_relay=true` (same Wi‑Fi) · **1 web offer + 1 android answer**
- No `answerer first-path grace` drop
- Coturn: `peer_usage` rising both ways (not stuck ~0)

## Do not re-enable without re-proof

- Hybrid `policy=all` for hub force_relay
- Answerer promote-to-offerer watchdog
- Blanket web↔android force_relay (cross-city must stay false)
