# Connectivity lock-in (working baseline)

**Updated: 2026-08-09 (evening)** — **HUMAN PASS: PC partner video works** on
APK **0.1.278** + hub without blanket web↔android `force_relay`.

| Artifact | Value |
|----------|--------|
| Mobile APK | **`0.1.280` / vc288** → `mobile/artifacts/ruletka-android-latest.apk` |
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
| `/etc/turnserver.conf` | `use-auth-secret` + **`external-ip=PUBLIC/PRIVATE`** | PUBLIC-only → CreatePermission **403** on relay↔relay |
| **`pair_force_relay`** | **true** only for **hide_ip** **or** **same public IP** **or** **untrusted client IP** | **NOT** every web↔android — that caused **PC black partner** (2026-08-09) |
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
5. **Normal match** (most Play↔browser) → `policy=all` + TURN in config; ICE picks path.
6. Don’t treat **ICE checking alone** as “already live” without remote **frames**.
7. **No force_relay arm mid-call** from auto soft/hard retry.
8. Browser: real cam outbound for strangers; paint once when track + frames exist.
9. Don’t multi-remount RTCView after first paint.

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

1. Install **latest** `mobile/artifacts/ruletka-android-latest.apk` (**≥ 0.1.278**).
2. Hard-refresh `https://ruletka.vip/live.html` (check `webrtc.js?v=` cache bust).
3. Hide IP **off**, blur **off**. Both Start **once**; **no Next spam for 15s**.
4. Hub log for that match:
   - Normal pair: **`force_relay=false`**
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
- Pure `iceTransportPolicy=relay` for every force_relay (hide_ip only for pure)  
- Answerer `addTrack` before `setRemoteDescription(offer)`  
- SFU/LiveKit as default media path  
- Opaque black blur covering Android SurfaceView  

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
