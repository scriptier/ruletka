# Connectivity lock-in (working baseline)

**Updated: 2026-08-11 (walk knowledge-health)** — same public IP **does**
`force_relay=true` (code + VIDEO_PATH_LOCK + unit test). Do **not** blanket
force all web↔android. Product.ok pure path 0.1.297+; latest walk APK **0.1.309**.

| Artifact | Value |
|----------|--------|
| Mobile APK | **`0.1.309` / vc317** → `mobile/artifacts/ruletka-android-latest.apk` |
| Plan / history | `docs/CONNECTIVITY_SPEED_PLAN.md` |
| Coturn / peer_usage | `docs/VIDEO_PATH_LOCK.md` |
| Media path | **P2P only** — SFU/LiveKit **shelved** |
| Working baseline | web offer + android answer, **`force_relay=false`** for normal cross-city pairs, both cams live |

Do **not** regress connect without a proven better alternative + **phone+PC smoke**.

---

## Product decisions (frozen)

1. **P2P mesh** via hub signal + host coturn — **no SFU default**.
2. Browser stranger matches send **real camera** outbound (not sticky black Hide canvas).
3. Mobile stranger privacy is optional veil — default **off** (intro/hold in Settings).
4. Local APKs only — no bulk APK dump on the public site until smoke is green.
5. **One paint:** after first partner frame, no timed RTCView remount spam.

---

## Server (ruletka.vip)

| Piece | Locked value | Why |
|--------|--------------|-----|
| coturn | **host** unit (`systemctl`), not docker | Docker lost auth → ALLOCATE failed |
| `/etc/turnserver.conf` | `use-auth-secret` + **`external-ip=PUBLIC/PUBLIC`** | PUBLIC-only → CreatePermission **403**; PUBLIC/VPC_PRIVATE → PERM ok but **peer_usage=0** |
| **`pair_force_relay`** | **true** for **hide_ip** **or** **untrusted client IP** **or** **same public IP** | **NOT** every web↔android. Same-LAN pure TURN re-proven 2026-08-10 evening (host path black when force=false); see `pair_force_relay_decision` + VIDEO_PATH_LOCK |
| offer debounce | hub drops 2nd offer within **~3.5s** | Sub-second thrash blocked |
| answerer re-offer grace | drop offer from a client that already **answered** until match age **≥30s** | Phone rebuild@~10–24s after healthy path |
| deploy | keep host coturn across `push.sh` | Never primary docker coturn |

**Regression test (must stay green):**

```bash
cargo test -p freenet-roulette-bridge connectivity_lock
# or: ./scripts/test-connectivity-lock.sh
```

---

## Client rules that keep video working

1. **Web preferred offerer** vs Android/iOS; phone answers. Do not flip roles without re-proving.
2. **Answerer never re-offers** after answering (hub will drop; thrash kills media).
3. **Answerer: no `addTrack` before `setRemote(offer)`** — only `replaceTrack` into offer m-lines (extra m-lines → phone→PC black).
4. **Hide IP** → pure `iceTransportPolicy=relay` + strip host/srflx.
5. **Hub `force_relay` (hide_ip / untrusted IP / same public IP)** → pure `iceTransportPolicy=relay` + strip host/srflx (UDP TURN only, pool=0).
6. **Normal match** (different public IPs, no hide/untrusted) → `force_relay=false`, `policy=all` + TURN in config; ICE may use host.
7. Don’t treat **ICE checking alone** as “already live” without remote **frames**.
8. **No force_relay arm mid-call** from auto soft/hard retry.
9. Browser: real cam outbound for strangers; paint once when track + frames exist.
10. Don’t multi-remount RTCView after first paint.
11. **Android privacy blur:** keep partner RTCView **mounted at zOrder 0** + opaque `PartnerBlurVeil` (and full-screen mosaic). Do **not** unmount-to-black; do **not** use RN Modal over SurfaceView.

---

## Speed targets

| Metric | Target |
|--------|--------|
| match → first offer | **&lt; 400 ms** (warm) |
| offer → answer | **&lt; 500 ms** |
| match → both cams usable | **&lt; 5 s** (stretch &lt; 3 s) |
| SurfaceView remounts after first paint | **0** |
| answerer offer drops in hub logs | **0** |

---

## Smoke (before any connect-touching PR)

**Mandatory human gate for hub / MediaSession / ICE policy:**

1. Install **latest** `mobile/artifacts/ruletka-android-latest.apk` (**≥ 0.1.283**).
2. Hard-refresh `https://ruletka.vip/live.html` (**`webrtc.js?v=285`**).
3. Hide IP **off**. Both Start **once**; **no Next spam for 15s**.
4. Hub log for that match:
   - Cross-city normal: **`force_relay=false`**; same public IP / hide_ip / untrusted: **`force_relay=true`**
   - **1 offer (web) + 1 answer (android)**
   - **no** `answerer first-path grace` drop
   - `video_dir=sendrecv` on answer
5. Success: **PC sees phone face** + phone sees PC; stay **≥ 30 s**.
6. Coturn: both sides `peer_usage` rising (not 50 KB forever vs 1 MB).

```bash
./scripts/test-connectivity-lock.sh   # unit + mobile policy tests
./scripts/test-coturn-relay.sh        # after any coturn change
./scripts/hub-match-speed.sh 30
# UI-only: UI_ONLY=1 ./scripts/deploy/push.sh
```

---

## Do not re-enable without re-proving (phone + PC smoke)

- **`pair_force_relay` true for all web↔android** (the regression that blacked PC)
- Soft ICE restart / hard rebuild / force_relay arm in the first **~15 s** of a match  
- Phone promote-to-offerer / re-offer after answering  
- Dense `streamEpoch` / remount ladders after first frame  
- Docker coturn as primary / peer IP allowlist on coturn  
- `external-ip=PUBLIC` only  
- `external-ip=PUBLIC/VPC_PRIVATE` (peer_usage=0 hairpin blackhole)  

- **`pair_force_relay` false for same public IP** (host/mDNS path blacked both cams 20:19 — pure TURN is the lock)  
- Hybrid thrash / pure thrash without phone+PC smoke  

- Answerer `addTrack` before `setRemoteDescription(offer)`  
- SFU/LiveKit as default media path  
- Unmount partner RTCView while privacy-blurred (black hole) / RN Modal over SurfaceView  

---

## If you break it

1. **Hub:** `force_relay=?` `offerer_a/b` `video_dir` offer drops — not CSS first.  
2. **Coturn:** `peer_usage` both directions.  
3. **Only then:** paint / empty overlay / remount.  

```bash
cd ~/freenet-roulette
./scripts/test-connectivity-lock.sh
./scripts/hub-match-speed.sh 30
# Install mobile/artifacts/ruletka-android-latest.apk (0.1.280+)
```

See also: `docs/VIDEO_PATH_LOCK.md`, `docs/CONNECT_MONITOR.md`, `docs/PC_BROWSER_SMOKE.md`.
