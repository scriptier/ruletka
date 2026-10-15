# Spec: linking feel + “weak link” (laptop ↔ PC ↔ Android)

**Status:** active · 2026-08-14  
**Locks:** `docs/CONNECTIVITY_LOCK.md` — same public IP **stays** `force_relay=true`. Do **not** cut `relayWaitBudgetMs` (hop11 **480**). pool=0.

```text
GOAL: Laptop↔PC and Android↔laptop feel like they are linking, not “weak / forever.”
DONE WHEN:
  1) “Linking cameras…” hides once remote has live audio OR video frames
     (laptop no-cam counts).
  2) “weak link” is not painted just because first-path encode is low or
     because same-LAN is on TURN. Only when loss/rtt is actually bad.
  3) Same-WiFi still force_relay=true (lock). No pool>0. No dual-offer.
  4) av-verify product.ok still holds after UI hops (no invent).
EVAL:
  - node --check ui/live.js ui/webrtc.js
  - av-verify after human deploy (laptop is prod)
  - Human: Hide/no-cam laptop does not sit on Linking 10s+; badge is
    “Relay (TURN)” not “Relay · weak link” on a healthy FRA hop
CHECKPOINTS:
  - Deploy UI for laptop/PC (human)
  - APK for phone linking-feel (human)
  - No MediaSession ICE/wait cut this hop
OUT OF SCOPE:
  - Undo same-IP force_relay
  - SFU
  - Further relayWaitBudgetMs cuts
VERIFY:
  - Baseline: av-verify 20260814T041120Z product.ok but max_mto=6859 max_mta=7426
  - After: av-verify product.ok + human feel (no GOAL_MET on journal alone)
MUST NOT: pool>0; wipe force_relay; invent product.ok / linking GOAL_MET
MAX HOPS: 2 implementers per file without new smoke
```

### Why it always says weak link

Same house = **same public IP** → hub `force_relay=true` → media via **coturn in FRA**.  
WebRTC starts encode at **low** until first *video* frame (`_armQualityRampAfterFrame`). Laptop has **no camera** → no videoWidth → stays **low ~12s** → UI appends **“weak link”**.  
TURN RTT to Frankfurt also trips the relay adaptive ladder (`rtt > 160` → mid/low).

That is **not** a broken P2P path. Direct host is locked off for same-LAN (VIDEO_PATH_LOCK).

### Why linking feels forever

| Pair | Evidence | Residual |
|------|----------|----------|
| Laptop↔PC | product.ok web↔web; mto **6859** / mta **7426** one match | Cold offer + Linking waits for **frames**; laptop no-cam; **prod lag** |
| Android↔laptop | earlier `034518Z` product.no-media ICE **failed** | Phone APK lag + no-cam + Linking |
| Android↔PC | product.ok in mixed window | Feel only |

Disk already has `dismissLinkingIfMediaLive`. **Laptop is prod** until deploy.

### Tools (enough — no new stack)

| Have | Use |
|------|-----|
| `./scripts/av-verify.sh` | product + mto/mta |
| `./scripts/av-loop.sh` | if ICE fails again |
| `./scripts/shot.sh` | human layout |
| herd + OWN | parallel UI hops |
| **deploy** (human) | laptop/PC get `live.js` / `webrtc.js` |
| **build apk** (human) | phone feel |

Do **not** add SFU, extra TURN regions, or pool>0 this hop.

### Lanes (this herd)

| Lane | OWN | Do |
|------|-----|-----|
| link-web-ui | `ui/live.js` | Weak badge only on real loss/high rtt; Linking off on audio |
| link-webrtc | `ui/webrtc.js` | Ramp mid on live **audio** too; first-path low must not label weak forever |
| link-android-ui | `mobile/app/live.tsx` | awaitingRemoteVideo clears on live audio (laptop) |
| link-spec | wiki + this spec | Honesty; no GOAL_MET |
| link-measure | `knowledge/raw/` + wiki log | Re-read latest av-verify; no ICE edits |

MediaSession **OUT**.

### 2026-08-15 residual: fast 1v1 → picture → 3rd tile ~30s

**Human (2026-08-15):** 1v1 starts right and fast, then a picture, then the
3rd tile — but the whole sequence feels like **~30s**, not the wanted 2–3s.
Real 3-way: PC + laptop + phone. **3 tiles is the correct outcome** — layout
is not the bug. Full spec: `knowledge/specs/2026-08-15-fast-1v1-to-3way.md`.

Static critic (523) against disk 639, not yet re-confirmed by human smoke:
- Layout/guard code is correct — hybrid rebuild, mid-offer `setDirection`,
  `setNoCamPortrait` over an already-painted tile, and the `638`
  trio-collapse-to-duo bug are all guarded off (critics 501/513/523).
- Two non-layout causes stay open, outside this spec's `live.js`/`webrtc.js`
  reach:
  1. Hub per-client offer debounce (gotcha 40) is coded in
     `bridge/src/simple.rs` but **not confirmed deployed**; a stale hub can
     still drop the 3rd peer's offer as thrash.
  2. A 3rd participant is a 3rd TURN allocation under the same-IP
     `force_relay` lock (gotcha 39) — real allocation+permission RTT, not a
     client-side bug to delete.
- No GOAL_MET / product.ok / MULTI_PASS invented for the ~30s figure — it is
  the human's own timing, not an av-verify measurement.
