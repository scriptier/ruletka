//! Deterministic partner selection over a set of live offers.
//!
//! Pure function of (me, live offers, epoch). No coordination required.
//! A match completes only when both peers select each other and post mutual claims.

use crate::lobby::WaitingOffer;
use crate::session::SessionId;
use crate::types::{hash_bytes, PeerId};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct MatchEpoch {
    /// `floor(network_now_ms / epoch_ms)` — reshuffles pairings periodically.
    pub bucket: u64,
}

impl MatchEpoch {
    pub fn from_now(network_now_ms: u64, epoch_ms: u64) -> Self {
        let epoch_ms = epoch_ms.max(1);
        Self {
            bucket: network_now_ms / epoch_ms,
        }
    }
}

/// Score for pairing P with Q in this epoch. Lower is better.
fn pair_score(p: PeerId, q: PeerId, epoch: MatchEpoch) -> [u8; 32] {
    let (a, b) = if p <= q { (p, q) } else { (q, p) };
    hash_bytes(&[b"match/v1", &a.0, &b.0, &epoch.bucket.to_le_bytes()])
}

/// Among live candidates compatible with `me`, pick the partner this peer should claim.
pub fn select_partner(
    me: PeerId,
    my_offer: &WaitingOffer,
    live: &[&WaitingOffer],
    epoch: MatchEpoch,
    already_matched: &std::collections::BTreeSet<PeerId>,
) -> Option<PeerId> {
    let mut best: Option<(PeerId, [u8; 32])> = None;

    for other in live {
        if other.peer_id == me {
            continue;
        }
        if already_matched.contains(&other.peer_id) {
            continue;
        }
        if !my_offer.prefs.compatible_with(&other.prefs) {
            continue;
        }

        let score = pair_score(me, other.peer_id, epoch);
        match best {
            None => best = Some((other.peer_id, score)),
            Some((_, best_score)) if score < best_score => {
                best = Some((other.peer_id, score));
            }
            Some((best_id, best_score)) if score == best_score && other.peer_id < best_id => {
                best = Some((other.peer_id, score));
            }
            _ => {}
        }
    }

    best.map(|(id, _)| id)
}

/// True when both peers would select each other under `select_partner`.
pub fn would_select_each_other(
    a: &WaitingOffer,
    b: &WaitingOffer,
    live: &[&WaitingOffer],
    epoch: MatchEpoch,
    already_matched: &std::collections::BTreeSet<PeerId>,
) -> bool {
    let pa = select_partner(a.peer_id, a, live, epoch, already_matched);
    let pb = select_partner(b.peer_id, b, live, epoch, already_matched);
    pa == Some(b.peer_id) && pb == Some(a.peer_id)
}

/// Build the session id once mutual selection is known.
pub fn session_for_pair(a: &WaitingOffer, b: &WaitingOffer) -> SessionId {
    SessionId::derive(a.peer_id, b.peer_id, &a.session_seed, &b.session_seed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::identity::Identity;
    use crate::lobby::{LobbyConfig, LobbyState};
    use crate::types::Preferences;
    use std::collections::BTreeSet;

    fn offer(seed: u8, heartbeat_ms: u64) -> WaitingOffer {
        let mut s = [0u8; 32];
        s[0] = seed;
        let id = Identity::from_seed(s);
        let mut session_seed = [0u8; 32];
        session_seed[0] = seed;
        id.make_offer(1, heartbeat_ms, Preferences::text_only(), session_seed)
    }

    #[test]
    fn two_peers_select_each_other() {
        let a = offer(1, 1000);
        let b = offer(2, 1000);
        let live = vec![&a, &b];
        let epoch = MatchEpoch { bucket: 1 };
        let matched = BTreeSet::new();
        assert!(would_select_each_other(&a, &b, &live, epoch, &matched));
        assert_eq!(
            select_partner(a.peer_id, &a, &live, epoch, &matched),
            Some(b.peer_id)
        );
        assert_eq!(
            select_partner(b.peer_id, &b, &live, epoch, &matched),
            Some(a.peer_id)
        );
    }

    #[test]
    fn selection_is_deterministic() {
        let offers: Vec<_> = (0..5u8).map(|i| offer(i + 10, 5000)).collect();
        let live: Vec<&WaitingOffer> = offers.iter().collect();
        let epoch = MatchEpoch { bucket: 42 };
        let matched = BTreeSet::new();

        let first: Vec<_> = offers
            .iter()
            .map(|o| select_partner(o.peer_id, o, &live, epoch, &matched))
            .collect();
        let second: Vec<_> = offers
            .iter()
            .map(|o| select_partner(o.peer_id, o, &live, epoch, &matched))
            .collect();
        assert_eq!(first, second);
    }

    #[test]
    fn mutual_pairs_are_symmetric() {
        let offers: Vec<_> = (0..8u8).map(|i| offer(i + 20, 10_000)).collect();
        let live: Vec<&WaitingOffer> = offers.iter().collect();
        let epoch = MatchEpoch { bucket: 7 };
        let matched = BTreeSet::new();

        for i in 0..offers.len() {
            for j in (i + 1)..offers.len() {
                if would_select_each_other(&offers[i], &offers[j], &live, epoch, &matched) {
                    assert_eq!(
                        session_for_pair(&offers[i], &offers[j]),
                        session_for_pair(&offers[j], &offers[i])
                    );
                }
            }
        }
    }

    #[test]
    fn end_to_end_claim_flow() {
        let mut lobby = LobbyState::new(LobbyConfig::default());
        let alice = offer(1, 1000);
        let bob = offer(2, 1000);
        lobby.upsert_offer(alice.clone());
        lobby.upsert_offer(bob.clone());

        let now = lobby.network_now_ms();
        let epoch = MatchEpoch::from_now(now, lobby.config.epoch_ms);
        let live = lobby.live_offers(now);
        let matched = lobby.matched_peers();

        assert!(would_select_each_other(&alice, &bob, &live, epoch, &matched));
        let sid = session_for_pair(&alice, &bob);

        let mut sa = [0u8; 32];
        sa[0] = 1;
        let mut sb = [0u8; 32];
        sb[0] = 2;
        let id_a = Identity::from_seed(sa);
        let id_b = Identity::from_seed(sb);

        lobby.insert_claim(id_a.make_claim(bob.peer_id, sid, now));
        lobby.insert_claim(id_b.make_claim(alice.peer_id, sid, now + 1));

        assert_eq!(lobby.mutual_match(&alice.peer_id, &bob.peer_id), Some(sid));
    }
}
