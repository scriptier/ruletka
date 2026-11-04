# 548 — Party shapes second critic — RESULT

Status: DONE (read-only review, no product code touched)

## 1. Current hub still allows Party3 vs Solo (3v1 queue)?

**Yes — and it's not just allowed, it's actively driven by a queue-based hunt.**

- `entries_compatible` (`bridge/src/simple.rs:2987-2998`) has an explicit shape gate:
  ```rust
  (QueueEntry::Solo(_), QueueEntry::Party3 { .. })
  | (QueueEntry::Party3 { .. }, QueueEntry::Solo(_)) => true,
  ```
  with the doc comment right above it: *"Allowed: solo↔solo, solo↔party2, solo↔party3, party2↔party2."* Party3 is blocked from matching any other `Party`/`Party3` (line 2997), but Solo↔Party3 (3v1) is explicitly allowed.
- `enqueue_party3` (`bridge/src/simple.rs:5021`, doc comment: *"Three already-connected people browse for one solo stranger (3v1)"*) pushes a `QueueEntry::Party3` onto the real matching queue.
- It's called from the `BrowseTogether` handler (`bridge/src/simple.rs:5894`) whenever a client already in a live 3-way (`session_peers.len() == 2`, phase `Matched`/`FriendCall`) asks to browse — i.e. today's "Find 4th" flow **is** a 3v1 queue hunt, not friend-call-join-only.

So the spec's "Never queue 3v1 (Party3 vs Solo)" and "4th person only via friend call join into a live 3-way" describe a **narrower** product than what's live: today a live 3-way can queue-hunt a random solo stranger for the 4th slot, same mechanism as `try_match` (`simple.rs:5506`, comment at 5535 literally lists "3v1" as allowed). This is the hunt-keep 3-way-hunts-solo mechanic that's called out as HELD in the task — parent should be aware landing the new spec as written is a **behavior removal**, not just a doc/comment fix.

## 2. `stranger_party_blocks_2v2` already blocks stranger-pair vs pair?

**Yes.** `bridge/src/simple.rs:2977-2983`:
```rust
/// Stranger-formed parties only hunt one solo — never party↔party (2v2/3v3).
fn stranger_party_blocks_2v2(&self, left: &QueueEntry, right: &QueueEntry) -> bool {
    let left_party = matches!(left, QueueEntry::Party { .. } | QueueEntry::Party3 { .. });
    let right_party = matches!(right, QueueEntry::Party { .. } | QueueEntry::Party3 { .. });
    left_party && right_party
        && (self.entry_is_stranger_party(left) || self.entry_is_stranger_party(right))
}
```
Called right after `entries_compatible` in `try_match` (`simple.rs:5536-5541`), so any Party/Party3↔Party/Party3 pairing where either side is `stranger_party = true` is filtered out before soft-pref scoring. `stranger_party` is set at `simple.rs:5423` with comment *"Stranger 1v1 → stranger_party; friend call → keep friend link, not stranger_party"* — confirming this flag distinguishes stranger-formed parties from friend-formed ones, and only friend-formed parties can reach 2v2/party↔party matching. This gate already implements the spec's "friend 2v2 allowed, stranger 2v2 not" split; parent doesn't need to add new logic here, just needs to decide whether it also needs to block Party3-side stranger hunting (3v1) which is a **separate** gate (see #1 — that one isn't blocked by `stranger_party_blocks_2v2` since it's Solo↔Party3, not Party↔Party).

## 3. Risks of dropping 3v1 queue (stuck Waiting Party3 leftovers)

- `enqueue_party3` is the only producer of `QueueEntry::Party3`, and it's invoked directly from the `BrowseTogether` handler (`simple.rs:5894`) with no separate feature flag — flipping `entries_compatible`'s Party3 branch to `false` **without** also removing/gating the `enqueue_party3` call site leaves live 3-ways that hit "Find 4th" permanently enqueued as `Party3`, since after the change nothing in `entries_compatible` can ever match a `Party3` (`_ => false` already covers Party3 vs everything except Solo).
- There is no time-based queue eviction visible for `QueueEntry` — `queue_entry_waiting_ok` (`simple.rs:4212-4219`) only checks `Phase::Waiting`, not a timeout. So a stranded `Party3` entry sits in `self.queue` until a member manually cancels/disconnects (`dequeue_client`), not until some idle timer fires. Concretely: three live-3-way users tap "Find 4th," see a perpetual "searching" state with zero chance of a match, and only escape by leaving the screen.
- Client-side (`ui/live.js`) almost certainly has copy/UX built around "searching for a 4th" for this exact BrowseTogether flow (out of scope for this critic to touch/verify — flagging for parent to check before landing, since `Must not` here excludes `ui/live.js`).
- Safer sequencing: gate `enqueue_party3`'s call site (turn "Find 4th" into a no-op / friend-invite prompt) in the same change that flips `entries_compatible`, not as two separate deploys — otherwise there's a window (or a missed spot) where the queue silently accumulates dead `Party3` entries.

## 4. `start_three_person_join` `force_relay: false` — in scope?

**Recommend: out of scope this hop**, and worth flagging that it may be moot: `force_relay` is not a field on `ServerMsg::Matched` or `MatchPeer` anywhere in `bridge/src/protocol.rs` today (checked both struct defs), and the string `force_relay` does not appear anywhere in `bridge/src/simple.rs`. `start_three_person_join` (`simple.rs:7338-7420`) builds its three `ServerMsg::Matched` payloads purely from `peer_for`/`match_peer` with no relay-policy field at all. So if the parent's plan is to literally add `force_relay: false` into this function, that's introducing a **new** wire field — squarely inside `CONNECTIVITY_LOCK` territory (this task's own "Must not" list already excludes ICE/force_relay changes). Recommend parent land the queue-shape fix (#1) standalone and route any `force_relay` wiring through a dedicated ICE-focused task with the connectivity-lock test run first, per CLAUDE.md's `#1 priority` gate.

## Files touched
None — read-only review (`tasks/admin-queue/running/` RESULT + this file only, per OWN).

## Verify commands run
None required by task (read-only citation review); no product code changed. `bridge/src/simple.rs`, `bridge/src/protocol.rs` read via grep/Read only.

## Connect risk
none — no code changed.

COMPLETE
