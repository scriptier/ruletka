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

## Relayed same-Wi-Fi = designed FRA TURN (lock stays)

Same house / same public IP **must** stay `force_relay=true` → **FRA coturn**. Host/mDNS hairpin **blacked cams** when force=false (2026-08-10 smoke: web `relay_candidates=0`). **CONNECTIVITY_LOCK:** do **not** set `pair_force_relay` false on same public IP. **Never recommend `force_relay=false`** to “get P2P back.”

Signaling is still **mesh P2P** (hub signal + one `RTCPeerConnection` per pair). Relayed **media** is TURN, **not SFU**. 3-way = 3 links / 2 PCs; 4-way = 6 links / 3 PCs. See [multi-party](multi-party.md).

**Badge:** Settings / chrome **Relayed** (`arch.relay` / `sec.pathRelay`) = designed same-LAN path, **not** “we lost P2P.”

**Not this lock:** keep remaining pair when 3rd leaves is a **client disk hop** (close only that extra PC; survivor stays; no rematch). Spec [`2026-08-14-keep-pair-no-relink.md`](../specs/2026-08-14-keep-pair-no-relink.md). Herd `20260814T085708Z`. **No product.ok invent.**

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
**Never** apply that force=false on **same** public IP / same Wi-Fi.

### Log

- 2026-08-10: documented android latch mismatch as primary same-LAN one-way contributor.
- 2026-08-10 walk-loop hop4: pure offer SDP short-circuit 800ms poll → APK **0.1.308+** / latest **0.1.309-vc317** (unverified).
- 2026-08-11 knowledge-health: CONNECTIVITY_LOCK had stale “NOT same public IP” — fixed to match code (same-IP forces pure).
- 2026-08-16: laptop↔Android 1v1 `060913Z` — same Calgary, **two** public IPs (`96.1.124.150` phone vs `162.157.227.46` fibre web). `force_relay=false` is lock-correct. Phone left fibre at 05:28. Gotcha **61**. **No lock flip.** **No product.ok.**
- 2026-08-14 keep-wiki (herd `20260814T085708Z`): Relayed same-Wi-Fi = designed **FRA TURN**; lock **stays**; mesh signaling still P2P **not SFU**; **never** `force_relay=false` on same IP. 3rd-leave keep-pair is a **disk hop** (not ICE). Spec [`2026-08-14-keep-pair-no-relink.md`](../specs/2026-08-14-keep-pair-no-relink.md). **No product.ok invent.**
- 2026-08-20 (task 543): reconfirmed **Find-3rd Matched** (`bridge/src/simple.rs` `handle_find_third_respond`) sends `force_relay: self.pair_force_relay(me, them)` — **not** a hardcoded `false`. Lock intact on this path. The 3-way laptop-miss-Android leftover that day (extra link `ice=checking` 0/0, see [multi-party.md](multi-party.md) Log) is a stuck ICE gather, **not** a force_relay regression — **do not** "fix" it by setting `force_relay=false` on Find-3rd.
