# Connectivity lock-in (working baseline)

**Locked: 2026-08-07 evening** — user smoke: **fast load**, **both cams both ways**, privacy veil OK (not black wall, not heavy blur).

| Artifact | Value |
|----------|--------|
| Mobile APK | **`0.1.126` / versionCode `134`** → `mobile/artifacts/ruletka-0.1.126-vc134.apk` |
| Git (mobile + veil) | `44136c9` *fix(mobile): real privacy veil…* |
| Git (web outbound) | `85c5017` *fix(connect): P2P real camera outbound…* |
| Live web deploy | `ui_deploy` **`20260807T200900Z-85c5017`** (or later **same connect rules**) |
| Media path | **P2P only** — SFU/LiveKit **shelved** (not production) |

Do **not** regress connect / veil without a proven better alternative + smoke.

---

## Product decisions (frozen)

1. **P2P mesh** via hub signal + host coturn — **no SFU default**.
2. Browser stranger matches send **real camera** outbound (not sticky black Hide canvas).
3. Mobile stranger privacy is a **frosted veil over live video**, not a solid black wall.
4. Default veil mode: **`intro`** (~2.5s after video ready, or one tap). Settings: Off / Brief / Until I tap.
5. Local APKs only — no bulk APK dump on the public site.

---

## Server (ruletka.vip)

| Piece | Locked value | Why |
|--------|--------------|-----|
| coturn | **host** unit (`systemctl`), not docker `coturn-ruletka` | Docker lost auth conf → ALLOCATE failed |
| `/etc/turnserver.conf` | `use-auth-secret` + deny-list only (no peer allowlist) | Allowlist → CHANNEL_BIND 403 |
| same-IP `force_relay` | **false** | TURN-only stalled offers; LAN host works |
| offer debounce | hub drops 2nd offer from same client within **8s** | Double-offer thrash → black video |
| deploy | keep host coturn across `push.sh` / setup-turn | Never primary docker coturn |

---

## Client rules that keep video working

1. **One offer per match** (unless iceRestart after **15s** PC grace).
2. **Web preferred offerer** vs Android/iOS (`platform` on hello).
3. **Clear `force_relay`** when hub sends `force_relay: false`.
4. Don’t treat **ICE checking alone** as “already live” without remote media.
5. Browser: ignore re-offer for **12s** after a successful answer.
6. Browser: **no sticky self-Hide** for strangers unless prefs `hideFromStrangersDefault`.
7. Mobile: **`forceRepaintRemote`** + multi-wave `streamEpoch` on Show video / intro unblur.
8. Mobile: keep RTCView painting **under** the privacy veil (semi-transparent frost).

---

## Speed targets

| Metric | Target | Notes |
|--------|--------|--------|
| match → first offer | **&lt; 1s** (cam warm) | kickSolo / startCall EARLY; offerKick re-kick at 1.5s/3.5s if silent |
| offer → answer | **&lt; 1s** | |
| answer → usable remote | **&lt; 5–10s** same Wi‑Fi | veil intro may add ~2.5s by design |

**MTO forensics note (2026-08-07):** hub `match_to_offer_ms` only counts the *first* accepted offer after match (later soft/hard rebuild offers no longer re-log as first). Pure ~24s stalls were hard-watch rebuild when first SDP never left — not self-blur. Sticky Hide still forced real cam before stranger kickSolo.

---

## Smoke (before any connect-touching PR)

1. Install **`ruletka-0.1.126-vc134.apk`** (or later that still respects this lock).
2. Browser: hard refresh `https://ruletka.vip/live.html` (deploy ≥ `85c5017` rules).
3. Both Start **once**; **no Next spam for 15s**.
4. Hide off on browser; mobile veil = Brief (default).
5. Hub: `force_relay=false`, **1 offer + 1 answer**.
6. Success: both cameras + audio; mobile not a permanent black wall.

```bash
./scripts/hub-match-speed.sh 30
```

---

## Do not re-enable without re-proving

- Always-on `force_relay` for every match  
- Docker coturn as primary  
- Peer IP allowlist on coturn  
- Second non-restart offer within a few seconds of the first  
- SFU/LiveKit as default media path  
- Opaque black “blur” overlay covering Android SurfaceView forever  
- Sticky self-Hide black canvas outbound on every stranger match  

---

## If you break it

```bash
cd ~/freenet-roulette
# Prefer APK 0.1.126 + redeploy web at 85c5017+ connect fixes
git log --oneline -5   # 44136c9 veil · 85c5017 outbound · 52bcb92 re-offer
```

See also: `docs/CONNECTIVITY_NEXT.md`, `GO_BACK_IF_BROKEN.md`.
