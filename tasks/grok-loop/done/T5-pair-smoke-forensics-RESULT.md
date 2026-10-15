# T5 local pair-smoke wire 0/0 forensics — RESULT

**Status:** COMPLETE  
**When:** 2026-08-12  
**OWN:** RESULT-only root cause (logs + harness + offer-path comments). No product ICE rewrite, no deploy, no pool>0, no dual MediaSession, no force-push, no thrash fix.

## Verdict

Local PC pair-smoke **FAIL** is **harness residual**: `ROULETTE_TURN=off` + hub `force_relay` → fail-open thrash → **wsOut offer never fires** → wire **0/0**.  
**Not** a phone fail. **Not** invent product `GOAL_MET`.

| Source | Path | Wire offers/answers | Rematch |
|--------|------|---------------------|---------|
| T1 | `/tmp/t1-pair-smoke.log` | **0 / 0** | not reached (`m2: null`) |
| T2 | `/tmp/t2-pair-smoke-rematch.log` | **0 / 0** | not reached (`m2: null`) |

## Why `wsOut` offer never fires (quoted chain)

### 1. Harness forces TURN off

```631:631:scripts/pair-smoke.mjs
      env: { ...process.env, RUST_LOG: "info", ROULETTE_TURN: "off" },
```

Header also states simple mode **TURN off** (`scripts/pair-smoke.mjs` L3–4). Wire hygiene is counted from WS send hooks, not from `setLocalDescription`:

```145:148:scripts/pair-smoke.mjs
        if (obj && obj.type === "signal" && (obj.kind === "offer" || obj.kind === "answer")) {
          const rec = { t: Date.now(), kind: obj.kind };
          window.__pairSmoke.wsOut.push(rec);
          console.log(`[pairsmoke] wsOut ${obj.kind} t=${rec.t}`);
```

### 2. Match succeeds; SDP gather fails without TURN

Bots **do** match (T2 head):

```
[pairsmoke] matched #1 …
[ruletka.vip] matched with botB · solo
[ruletka.vip] matched with botA · solo
```

Immediately after, product logs the fail-open path when force_relay has empty TURN:

```545:549:ui/webrtc.js
    } else {
      // Fail-open: keep hosts/STUN if TURN missing (never black forever)
      servers = preferFastTurnFirst(raw);
      iceTransportPolicy = "all";
      console.warn("[webrtc] force_relay no TURN — fail-open all");
```

Log quote (T2):

```
[webrtc] force_relay no TURN — fail-open all
```

### 3. Offer gate: first-relay count=0 → rebuild, never emit on wire

Offer path waits for relay in SDP; with no TURN, `n===0` under pure-relay mode → close PC and rebuild (does **not** send signal):

```2854:2876:ui/webrtc.js
        console.info(
          "[webrtc] offer first-relay count=" +
            n + …
        );
        // Pure relay only: rebuild once if still no relay.
        if (n === 0 && !opts._relayRetry && isRelayMediaMode()) {
          console.warn(
            "[webrtc] offer no relay — rebuild pure-relay PC and retry once"
          );
          try {
            this.pc.close();
          } catch (_) {}
          this.pc = null;
          …
          this._offerEmitOk = false;
```

Log quote (T2 thrash unit):

```
[pairsmoke] localSdp offer
[webrtc] offer first-relay count=0 warm=0 multi=0 budget=520
[webrtc] offer no relay — rebuild pure-relay PC and retry once
[webrtc] force_relay no TURN — fail-open all
```

### 4. Counts prove local SDP ≠ wire

| Marker (T2 log) | Count |
|-----------------|------:|
| `force_relay no TURN — fail-open all` | **2089** |
| `offer no relay — rebuild pure-relay PC` | **668** |
| `[pairsmoke] localSdp offer` | **670** |
| `[pairsmoke] wsOut` | **0** |

T1 same pattern: fail-open **2342**, rebuild **751**, localSdp **756**, wsOut **0**.

So: `setLocalDescription(offer)` runs many times; WebSocket `signal`/`offer` **never** leaves the client → harness `wireOffers() === 0`.

### 5. Scorecard (T2 last attempt)

```
hub timing { offerLines: 0, answerLines: 0, mto_ms: null, mta_ms: null, … }
snapshots { A: { matched: …, track: …, out: 0 }, B: { matched: …, track: null, out: 0 } }
SCORECARD {"pass":false,"attempt":5,"m1":{"offers":0,"answers":0,"mto_ms":null,"mta_ms":null,…},"m2":null,
  "fails":["match1@5: expected 1 wire offer, got 0","match1@5: expected 1 wire answer, got 0",…]}
```

Rematch unreachable: match1 never passes → `m2: null`.

## Phone MATCHED is separate

- Phone WEB_PAIR device-smoke: **MATCHED** — `tasks/grok-loop/done/T1-phone-device-smoke-web-pair-RESULT.md` (APK 0.1.366-vc374, exit 0).
- Wiki gotcha **24** already states: local pair-smoke wire 0/0 ≠ phone fail (`knowledge/wiki/gotchas.md`).
- Do **not** fold this harness FAIL into phone / product A/V verdict.

## Explicit non-claims / must-not

- No product ICE rewrite / thrash fix (this note only)
- No invent product `GOAL_MET` or product PASS from phone MATCHED
- No deploy, pool>0, dual MediaSession, force-push
- No re-smoke required for this RESULT

## Root cause (one line)

**`pair-smoke.mjs` + `ROULETTE_TURN=off` → same-LAN force_relay wants pure relay → no TURN → fail-open + first-relay rebuild thrash → many `localSdp offer`, zero `wsOut` → wire 0/0 FAIL.**

## COMPLETE

**COMPLETE** — forensics only; task card moved to `done/`.
