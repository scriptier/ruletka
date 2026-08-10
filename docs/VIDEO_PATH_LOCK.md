# Video path lock (2026-08-09) — stop thrashing this

**Human smoke failed for days** because we kept flipping ICE policy and coturn
`external-ip` without a regression test. This file freezes what is proven.

## Symptom chain (what you saw)

| UI | Hub | Coturn |
|----|-----|--------|
| Matched / “connected”, black cams both sides | offer+answer, sometimes `relay_candidates=1` | ALLOCATE ok, CREATE_PERM ok, **peer_usage ≈ 0** |
| Phone re-offer ~9–10s | answerer grace drop | — |
| App crash once | — | paint recovery remount race |

## Root causes (stacked)

1. **Coturn:** `external-ip=PUBLIC` alone → CreatePermission to own public IP =
   **403 Forbidden IP** → force_relay (relay↔relay) can never carry media.
   **Fix:** `external-ip=PUBLIC/PRIVATE` (DigitalOcean dual address on eth0).
2. **Clients:** Under `force_relay`, **must** use `iceTransportPolicy=relay`,
   wait for `typ relay` in SDP, strip host/srflx. CONNECTIVITY_LOCK.
   Flipping to `policy=all` “for LAN” broke the hairpin path.
3. **Answerer thrash:** Phone must not re-offer after answering (hub drops it).
4. **Paint:** Do not multi-remount RTCView / MediaStream on every ICE tick.

## Locked config

### Coturn (`/etc/turnserver.conf` / `scripts/deploy/coturn.conf`)

```
external-ip=<PUBLIC>/<PRIVATE>   # DO eth0
# NO allowed-peer-ip allowlist (LOCK: allowlist can 403)
min-port=49160
max-port=50000
use-auth-secret
```

**Regression test (must pass after any coturn change):**

```bash
./scripts/test-coturn-relay.sh
```

### Clients (web + Android) — updated 2026-08-09 evening

| Flag | Behavior |
|------|----------|
| Hub `force_relay=true` | same public IP / hide_ip / untrusted IP only — **not** every web↔android |
| Hide IP | pure `iceTransportPolicy=relay`, strip host/srflx |
| Normal match (incl. most Play↔browser) | `policy=all` + TURN in config; ICE picks host/srflx/relay |

**2026-08-09 thrash kill:** no iceRestart-offer for 15–20s after first answer;
answerer never re-offers; earlyBlack grace 15s (was 3.5s → offer@4s black).

### Hub

| Rule | Value |
|------|--------|
| `pair_force_relay` | **hide_ip** **or** same public IP **or** untrusted IP — **NOT** every web↔android |
| Answerer re-offer | drop until match age ≥30s |
| Offer debounce | ~3.5s |

**Unit test:** `cargo test -p freenet-roulette-bridge connectivity_lock`  
(see `pair_force_relay_decision` in `bridge/src/simple.rs`)

## Smoke (human) — only after `test-coturn-relay.sh` PASS

1. Install **only** latest: `mobile/artifacts/ruletka-android-latest.apk` (**≥ 0.1.278**)
2. Hard-refresh `https://ruletka.vip/live.html` (current `webrtc.js?v=` / `live.js?v=`)
3. Hide IP off, blur off, Start **once**, wait 15s (no Next spam)
4. Hub: normal pair **`force_relay=false`**; no answerer offer drop
5. Coturn: `peer_usage` rising **both** ways (not one-way forever)
6. **PC sees phone** + phone sees PC

## Do not “try” without re-proving

- `external-ip=PUBLIC` only (breaks self-peer)
- `allowed-peer-ip` as global whitelist
- `force_relay` with `iceTransportPolicy=all`
- Answerer promote-to-offerer / re-offer before 30s
- forceRebuildRemoteStream on every `pc_connected`
- Docker coturn, SFU default

## If black again

1. Run `./scripts/test-coturn-relay.sh` — if FAIL, fix coturn first (not clients).
2. Hub log: both sides `relay_candidates≥1`?
3. Coturn: `CREATE_PERM ok` up, `PERM 403` near 0, `peer_usage` bytes climbing (not just STUN-sized ~100B)?
4. Phone: still answerer re-offer drops? → install latest APK, do not re-offer as answerer.

## 2026-08-09 evening lock-in (peer_usage=0 root cause)

**Symptom:** offer+answer both `relay_candidates≥1`, CREATE_PERM sometimes OK,
coturn self-peer PASS, but **peer_usage HOT ≈ 0** and both cams black.
Same public IP (Play+browser on same Wi‑Fi) → hairpin.

**Cause stack:**
1. Warm `createOffer` left PC in `have-local-offer` (RN rollback fails) → dirty PC / skipped startCall race.
2. `iceCandidatePoolSize=8` + TCP+UDP TURN → ALLOCATE storm (16–30 sessions/match).
3. Race: `startCall` used `policy=all` while hub `force_relay=true` → host preferred on same IP.

**Locked client behavior (0.1.262+ / UI stamp):**
- force_relay → `iceTransportPolicy=relay`, UDP TURN only, pool=2
- Clean rebuild after warm prime (never leave dirty local offer)
- `ensureRelayPolicyPc` before offer/answer
- Answerer never re-offers (hub grace drop)

