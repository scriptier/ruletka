# Freenet Chat Roulette — Lobby & Session Design

Text-first stranger matching on Freenet, with a clear path to WebRTC later.
Inspired by [River](https://github.com/freenet/river) (composable contracts) and your
[PeerRoulette](../PeerRoulette) matching rules (lexicographic offerer, dual claim, heartbeats).

---

## Goals

| Goal | Approach |
|------|----------|
| No matching server | Shared **lobby contract** state everyone can update |
| Eventual consistency | State is a **commutative monoid** (merge in any order) |
| Fair pairing | Deterministic partner selection + **mutual claim** |
| Ephemeral sessions | Short-lived **session contract** (or encrypted DM channel) |
| Media later | Freenet carries **signaling only**; WebRTC carries A/V |
| Ghosts leave | Heartbeats + TTL + post-apply cleanup |

Non-goals for v1: video, global reputation, perfect anonymity, TURN relays.

---

## Components

```
┌──────────────┐   WebSocket    ┌─────────────┐
│  UI (browser)│◄──────────────►│ local node  │
│  + WebRTC*   │                └──────┬──────┘
└──────────────┘                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │ Lobby contract (shared pool)     │
                    │  offers · claims · leaves · bans │
                    └──────────────────┬───────────────┘
                                       │ on mutual match
                                       ▼
                    ┌──────────────────────────────────┐
                    │ Session contract (1:1 ephemeral) │
                    │  text msgs · SDP/ICE (later)     │
                    └──────────────────────────────────┘
```

\* WebRTC is Phase 2; Phase 1 is text only.

| Piece | Trust zone | Role |
|-------|------------|------|
| **Lobby contract** | Network (adversarial) | Who is waiting; who claimed whom |
| **Session contract** | Network | Matched pair messages / signaling |
| **Delegate** | Local only | Ephemeral keys, signing, secrets |
| **UI** | Local browser | Spin / Next / chat / camera |

---

## State machine (client view)

```
                 ┌─────────┐
                 │  Idle   │
                 └────┬────┘
                      │ Spin
                      ▼
                 ┌─────────┐     heartbeat every ~2s
                 │ Waiting │◄──────────────────────┐
                 └────┬────┘                       │
           ┌──────────┼──────────┐                 │
           │ pick partner        │ timeout / no    │
           │ (deterministic)     │ peers           │
           ▼                     └─────────────────┘
     ┌───────────┐
     │ Claiming  │  post Claim(self → other)
     └─────┬─────┘
           │ see mutual claim OR other claims us
           ▼
     ┌───────────┐
     │  Matched  │  open session contract / chat
     └─────┬─────┘
           │ Next / peer left / session expired
           ▼
     leave lobby + optionally re-enter Waiting
```

Network state never stores a single "global FIFO queue." Clients propose; the monoid only stores **signed facts** that merge cleanly.

---

## Lobby monoid design

### Principles

1. **Add facts, don't assign roles centrally.** Peers publish signed records. Merge = union + last-writer-wins on per-peer fields + deterministic cleanup.
2. **Mutual claim is the only match.** A is matched with B iff both signed claims that pair them (or one mutual claim with both signatures — v1 uses two one-sided claims).
3. **TTL everything.** Offers and claims older than `offer_ttl` / `claim_ttl` are inert and swept in `post_apply_cleanup`.
4. **Idempotent cleanup.** `cleanup(S) == cleanup(cleanup(S))` so Freenet can run it a variable number of times without divergence (same lesson as River).

### Top-level state

```text
LobbyState
├── config          // caps, TTLs, lobby id (parameters or LWW owner config)
├── offers          // map PeerId → WaitingOffer   (LWW by version/heartbeat)
├── claims          // set of signed Claim          (add-only until expired)
├── leaves          // map PeerId → LeaveMark       (LWW; tombstones)
└── blocks          // optional peer-local block list published as signed facts
```

Field order for `#[composable]`: `config` → `leaves` → `blocks` → `offers` → `claims`, so cleanup can enforce "left peers cannot claim" after all fields merge.

### Records

#### `WaitingOffer` (per peer, LWW)

```text
peer_id:        PeerId          // hash of verifying key
verifying_key:  VerifyingKey
version:        u64             // strictly increasing for LWW
heartbeat_ms:   u64             // wall-clock ms; refreshed while waiting
capabilities:   { text, video }
prefs:          { lang?, tags? }  // optional sharding later
session_seed:   [u8; 32]        // entropy for deriving session contract params
sig:            Signature       // over all fields above
```

**Merge:** keep the offer with higher `version`; tie-break higher `heartbeat_ms`, then higher key bytes.

**Valid if:** signature ok, peer not left (or leave.version < offer.version), heartbeat within `offer_ttl` of "now" (see clock note).

#### `Claim` (add-only, keyed by claim id)

```text
claim_id:     ClaimId           // hash(claimer || target || session_seed_pair)
claimer:      PeerId
target:       PeerId
session_id:   SessionId         // deterministic from sorted(peer_a, peer_b) + seeds
created_ms:   u64
sig:          Signature         // claimer signs
```

**Merge:** set union by `claim_id` (duplicate id with different bytes → reject in verify).

**Match exists when:**

```text
exists Claim(A→B) and Claim(B→A)
  and both claimers have live offers (or recent offers)
  and session_id agrees on both claims
  and neither has a Leave with version covering the claim time
```

#### `LeaveMark` (per peer, LWW)

```text
peer_id, version, left_ms, sig
```

Used for Next and disconnect. A leave with `version >= offer.version` removes that peer from the waiting set.

### Deterministic partner selection (client algorithm)

Same spirit as PeerRoulette, but over contract state instead of LAN beacons:

```
candidates = all offers where
  live(heartbeat) AND not me AND not blocked AND compatible(prefs)
  AND not already matched in an active mutual claim

if candidates empty → stay Waiting, keep heartbeating

// Stable "random" without coordination:
// hash(my_peer_id || salt) orders the pool; pick the nearest other peer
// that would also pick us under the same rule (stable marriage lite).

// v1 simple rule (good enough for small pools):
partner = min(candidates by PeerId)   // or hash-based shuffle with shared epoch

// Dual-offer race: only the lexicographically smaller PeerId posts Claim first?
// Better: BOTH post Claim(self→partner) once they have selected each other.
// Match completes only on mutual claims (order-independent).
```

**Symmetric selection (recommended v1):**

For each peer P, define:

```
score(P, Q) = H(sorted(P,Q) || epoch_bucket)
partner(P)  = argmin_{Q in candidates(P)} score(P,Q)
              with ties broken by Q's PeerId
```

P claims Q only if `partner(P) == Q`. Then:

- If `partner(Q) == P`, mutual claims appear → match.
- If not, P does not get Q; both recompute after state changes (Q leaves or new peers join).

This is **order-independent**: pure function of the current offer set + epoch. No FIFO server.

`epoch_bucket = floor(now_ms / EPOCH_MS)` (e.g. 15s) so the "random" pairing reshuffles periodically without requiring a leader.

### Clock honesty

Contracts cannot trust wall clocks perfectly. Mitigations:

- Heartbeats must be **non-decreasing** per peer (LWW version already enforces progress).
- TTL is enforced relative to **max observed heartbeat** in the lobby (or median of live offers), not absolute UTC, so a skew-resistant "network now" emerges.
- Reject heartbeats too far in the future vs local clock in the **UI** before publishing; contract only checks signature + monotonic version + caps.

### Caps (config)

| Cap | Purpose |
|-----|---------|
| `max_offers` | Bound state size; evict oldest heartbeats first |
| `offer_ttl_ms` | Ghost removal |
| `claim_ttl_ms` | Abandoned claims |
| `max_claims` | Sybil claim spam |
| `min_heartbeat_interval_ms` | Rate limit versions |

---

## Match → session handoff

On mutual claim with `session_id = S`:

1. UI derives **session contract parameters** from `S` + both verifying keys (content-addressed instance).
2. Either:
   - **A)** Put initial session state (empty messages) if not present, or  
   - **B)** Subscribe; first writer creates state (idempotent empty).
3. Both leave the waiting pool (`LeaveMark` or stop heartbeating + explicit leave).
4. Chat over session contract (signed messages, ring buffer like River).
5. **Next:** leave session + new ephemeral keypair + new offer in lobby.

### Session state (sketch)

```text
SessionState
├── meta: { peer_a, peer_b, created_ms }   // fixed by parameters
├── messages: ring buffer of signed Msg     // composable, capped
└── signaling: ring of signed SignalBlob    // Phase 2 WebRTC SDP/ICE
```

Only `peer_a` and `peer_b` may append (verify signature ∈ {A,B}).

Session contract key/parameters include both public keys so strangers cannot inject.

---

## WebRTC path (Phase 2)

Reuse PeerRoulette media path; replace LAN UDP signaling with session contract:

| PeerRoulette | Freenet Roulette |
|--------------|------------------|
| Multicast beacon | Lobby `WaitingOffer` heartbeat |
| Propose packet | Mutual `Claim` |
| UDP offer/answer/ICE | Session `signaling` messages |
| STUN only | Same (document TURN limits) |

Offerer = lexicographically smaller `PeerId` (same as PeerRoulette) to avoid glare.

---

## Security & abuse (v1 baseline)

| Threat | Mitigation |
|--------|------------|
| Forged offers | ed25519 on every record |
| Ghost peers | TTL + leave |
| Claim spam | cap + claim_ttl + must have live offer |
| Steal match | mutual claim + session_id agreement |
| Sybil flood lobby | caps; later PoW / reputation |
| Harassment | local block list; skip; optional report contract later |
| Metadata leak | lobby is public: waiting is visible; use ephemeral keys every Spin |

Freenet is **not** anonymity by default — treat this like public random chat with disposable ids.

---

## Consistency checklist (must hold)

- [ ] Merge of offers is associative, commutative, idempotent (LWW)
- [ ] Claims are pure set-union (CRDT grow-only set with TTL sweep)
- [ ] `post_apply_cleanup` is pure and idempotent
- [ ] Match predicate is pure function of merged state
- [ ] Two honest peers running the same client algo on same state produce the same partner choice
- [ ] Applying claims in order A-then-B vs B-then-A yields identical end state

---

## Project layout (this repo)

```
freenet-roulette/
├── docs/LOBBY_DESIGN.md          ← this file
├── common/                       ← shared types + match logic + tests
│   └── src/
│       ├── lib.rs
│       ├── types.rs
│       ├── lobby.rs              ← monoid merge + cleanup
│       ├── match_algo.rs         ← deterministic partner selection
│       └── session.rs
├── contracts/lobby/              ← WASM contract (later)
└── contracts/session/            ← WASM contract (later)
```

---

## Implementation phases

1. **Common crate + unit tests** (no Freenet node) — monoid laws, match algo, cleanup  
2. **Lobby WASM contract** via `freenet-scaffold` + `fdev publish`  
3. **Minimal UI** — Spin / wait / matched / text / Next  
4. **Session contract** for messages  
5. **WebRTC signaling** over session + media from PeerRoulette patterns  

---

## Open decisions

1. **One global lobby vs sharded lobbies** (by language/tag) — recommend shards early to bound state.  
2. **Clock model** — max-heartbeat vs client UTC for TTL.  
3. **Session as separate contract vs encrypted DMs inside a long-lived room** — separate is cleaner for roulette.  
4. **Whether leave is required** or silent offer expiry is enough — both; leave is faster for Next.
