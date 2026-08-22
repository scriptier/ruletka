# Spec: party shapes (2v2 / 3-way / invite-only 1v3)

**Status:** active · 2026-08-21  
**Locks:** CONNECTIVITY_LOCK · pool=0 · hunt-keep HELD · no invent MULTI_PASS / product.ok

```text
GOAL: Random matchmaking can form 3-way and 2v2. Never 2v3. Never 1v3
      from the queue. A 4th person joins only when someone in the party
      calls a friend in.
DONE WHEN:
  1) Queue matches: solo↔solo (1v1), party2↔solo (2v1 / 3-way),
     party2↔party2 (2v2) — including two Find-3rd stranger pairs.
  2) Queue does NOT match party3↔solo (3v1 / 1v3) or party2↔party3 (2v3).
  3) Live 3-way BrowseTogether / Find-4th random hunt does not enqueue Party3.
  4) Call-join from a live 3-way (session_peers=2) invites a 4th friend.
     Callee sees 3 remotes (1v3). Cap stays you+3 (never 5).
  5) 1v1 Find 3rd still hunts; first available is solo (2v1) or another
     hunting pair (2v2). Friend 1v1 still 1v1 until Find 3rd.
EVAL:
  - rustc tests on entries_compatible shapes
  - node --check ui/live.js if web join path touched
  - NO APK until tests pass + human says build
MUST NOT: pool>0; force_relay thrash; remount hunt RTC; MediaSession ICE;
          invent MULTI_PASS; enqueue_party3 for random 4th
```

## Shapes

| Shape | People | How it starts | Layout |
|-------|--------|---------------|--------|
| 1v1 | 2 | solo queue / friend call | 2 tiles |
| 3-way | 3 | Find 3rd accept then hunt vs 1 solo | trio |
| 2v2 | 4 | two party2 in queue (friends **or** two Find-3rd 1v1s) | 2×2 / four tiles |
| 1v3 | 4 | **Call a friend into** a live 3-way | you + 3 remotes |
| 2v3 | 5 | **Forbidden** | — |

Find-3rd hunt: **2v1** (party2↔solo) **or** **2v2** (party2↔party2, including two stranger 1v1s). Party3 still never queues (`queue_shape_ok`). Same-LAN 2v2 uses `pair_force_relay` (CONNECTIVITY_LOCK) — never hardcode `force_relay: false`.

## Recommended hop (this run)

**OWN:** `bridge/src/simple.rs` only.

1. `entries_compatible`: Solo↔Party3 = **false** (kill 3v1 queue).
2. `BrowseTogether` on live 3-way: do **not** `enqueue_party3`; tell them to call a friend.
3. `handle_call_friend(join)`: if inviter has **2** session peers, ring as 4th (`keep2`).
4. `start_four_person_join` — mesh 4, cap 5th with error.
5. Unit tests for shape gate.
6. **Verify before APK.** Hub binary is ops/deploy — this hop is code+test; do not `push.sh`.

Web/Android layout already has 4 tiles (`stage-quad`, `MAX_EXTRA_PEERS=3`). Layout polish is a later lane if 4th join works.

## Out

- MediaSession ICE / pool
- Cutting `relayWaitBudgetMs`
- APK / deploy this hop
