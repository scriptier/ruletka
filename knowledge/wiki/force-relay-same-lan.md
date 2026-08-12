# Same-WiFi / same public IP force_relay

## Current hub rule (authoritative: `pair_force_relay_decision` in bridge)

Same public IP → **force_relay=true** (pure TURN), because:

- Chrome mDNS host stripped → no private host for Android  
- Host/srflx hairpin often fails  
- Smoke with force_relay=false: web **relay_candidates=0**, media dead  

Also true for: **hide_ip** either side, or **untrusted** client IP.  
**Never** solely because platforms are web↔android (cross-city stays force=false).

Code lock: unit `same_public_ip_forces` + `VIDEO_PATH_LOCK` + `CONNECTIVITY_LOCK` (aligned 2026-08-11).  
Coturn dual-relay media lock: `./scripts/test-coturn-relay.sh` (expect PASS, PUBLIC/PUBLIC).

## Client expectations

| Side | When hub force_relay=true |
|------|---------------------------|
| web | sessionForceRelay, policy=relay, pool=0, wait for relay in SDP |
| android | sticky hub latch **before** startCall; policy=relay after TURN; av_path force_relay=1 |

## Inbound offer race (android hop4, 0.1.308)

Offer often beats `matched.force_relay` by 100–400ms. If sticky not yet latched:

1. Parse offer SDP — if pure (typ relay, no host/srflx) → `setForceRelay(true)` **immediately** and **skip** the old 800ms unlatched poll.
2. Hybrid / fail-open offers still poll ≤800ms for hub sticky.

Expect pure mta −0–800ms when offer races matched. Unverified until smoke.

## Known failure mode (2026-08-10)

Hub+web pure while android still `force_relay:0 policy=all` → one-way media possible (phone receives, does not send). See [one-way-video](one-way-video.md).

## Pool

`iceCandidatePoolSize = 0` always. Pool≥2 → 437 mismatched allocation storms.

## Cross-network strangers

Different public IPs → force_relay=false unless hide_ip / untrusted IP.  
**Never** force solely because platforms are web↔android.

### Log

- 2026-08-10: documented android latch mismatch as primary same-LAN one-way contributor.
- 2026-08-10 walk-loop hop4: pure offer SDP short-circuit 800ms poll → APK **0.1.308+** / latest **0.1.309-vc317** (unverified).
- 2026-08-11 knowledge-health: CONNECTIVITY_LOCK had stale “NOT same public IP” — fixed to match code (same-IP forces pure).
