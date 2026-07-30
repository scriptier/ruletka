# Client loop (Phase 1 — text)

Pseudocode for the browser UI + local Freenet node. Not runnable as-is; maps 1:1
to `common` APIs.

```text
state: Idle | Waiting | Claiming | Matched

on Spin:
  keypair = generate_ephemeral()          // delegate stores secret
  offer = WaitingOffer { version: 1, heartbeat, prefs, session_seed, sig }
  PUT delta: upsert offer into lobby contract
  state = Waiting

on tick every 2s while Waiting | Claiming:
  offer.version += 1
  offer.heartbeat_ms = now
  re-sign; PUT offer
  lobby = subscribe snapshot
  live = lobby.live_offers(network_now)
  epoch = MatchEpoch::from_now(network_now, config.epoch_ms)
  matched = lobby.matched_peers()
  partner = select_partner(me, my_offer, live, epoch, matched)
  if partner is Some(p):
    their_offer = live.find(p)
    if would_select_each_other(my_offer, their_offer, live, epoch, matched):
      sid = session_for_pair(my_offer, their_offer)
      PUT Claim(me → p, sid)
      state = Claiming

on Claiming:
  if lobby.mutual_match(me, partner) == Some(sid):
    PUT LeaveMark(me, version)
    open Session(sid) subscribe
    state = Matched

on Matched:
  send/receive signed ChatMessage via session contract
  on Next:
    PUT leave session (optional)
    state = Idle → Spin with NEW keypair

on tab close / timeout:
  PUT LeaveMark; stop heartbeats
```

## UI screens

1. **Landing** — Spin button, pref chips (text / language).  
2. **Searching** — pulse animation, cancel.  
3. **Chat** — messages, Next, (later) video tiles.  

## Mapping from PeerRoulette

| PeerRoulette | This client |
|--------------|-------------|
| Multicast beacon | Lobby offer heartbeat |
| `status: matching` | Presence of live offer |
| Propose packet | Mutual claim |
| UDP signaling | Session messages (Phase 2) |
| Lex smaller offerer | `SessionMeta::webrtc_offerer()` |
