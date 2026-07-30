//! Lobby state as a mergeable monoid (pure Rust stand-in for a Freenet contract).
//!
//! Merge rules:
//! - `offers` / `leaves`: last-writer-wins per peer by `version`, then `*_ms`
//! - `claims`: grow-only set keyed by `claim_id`
//! - `cleanup`: pure, idempotent sweep of expired / left / over-cap entries

use crate::identity::{verify_offer, SignatureBytes};
use crate::session::SessionId;
use crate::types::{hash_bytes, PeerId, Preferences};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct LobbyConfig {
    pub max_offers: usize,
    pub max_claims: usize,
    /// Offers older than this (relative to network_now) are dead.
    pub offer_ttl_ms: u64,
    pub claim_ttl_ms: u64,
    /// Partner shuffle bucket size (see match_algo).
    pub epoch_ms: u64,
}

impl Default for LobbyConfig {
    fn default() -> Self {
        Self {
            max_offers: 256,
            max_claims: 512,
            offer_ttl_ms: 15_000,
            claim_ttl_ms: 20_000,
            epoch_ms: 15_000,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WaitingOffer {
    pub peer_id: PeerId,
    /// Opaque verifying-key bytes (ed25519).
    pub verifying_key: Vec<u8>,
    pub version: u64,
    pub heartbeat_ms: u64,
    pub prefs: Preferences,
    /// Entropy contributed toward session id derivation.
    pub session_seed: [u8; 32],
    pub sig: SignatureBytes,
}

impl WaitingOffer {
    pub fn signing_body(&self) -> Vec<u8> {
        let mut body = Vec::new();
        body.extend_from_slice(&self.peer_id.0);
        body.extend_from_slice(&self.verifying_key);
        body.extend_from_slice(&self.version.to_le_bytes());
        body.extend_from_slice(&self.heartbeat_ms.to_le_bytes());
        body.extend_from_slice(&self.session_seed);
        body.push(self.prefs.wants_text as u8);
        body.push(self.prefs.wants_video as u8);
        if let Some(ref lang) = self.prefs.lang {
            body.extend_from_slice(lang.as_bytes());
        }
        for t in &self.prefs.tags {
            body.push(0xff);
            body.extend_from_slice(t.as_bytes());
        }
        body
    }

    /// LWW ordering: higher version wins; then newer heartbeat; then peer id.
    pub fn beats(&self, other: &Self) -> bool {
        match self.version.cmp(&other.version) {
            std::cmp::Ordering::Greater => true,
            std::cmp::Ordering::Less => false,
            std::cmp::Ordering::Equal => match self.heartbeat_ms.cmp(&other.heartbeat_ms) {
                std::cmp::Ordering::Greater => true,
                std::cmp::Ordering::Less => false,
                std::cmp::Ordering::Equal => self.peer_id > other.peer_id,
            },
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Claim {
    pub claim_id: [u8; 32],
    pub claimer: PeerId,
    pub target: PeerId,
    pub session_id: SessionId,
    pub created_ms: u64,
    pub sig: SignatureBytes,
}

impl Claim {
    pub fn compute_id(
        claimer: PeerId,
        target: PeerId,
        session_id: SessionId,
        created_ms: u64,
    ) -> [u8; 32] {
        hash_bytes(&[
            b"claim/v1",
            &claimer.0,
            &target.0,
            &session_id.0,
            &created_ms.to_le_bytes(),
        ])
    }

    pub fn signing_body(&self) -> Vec<u8> {
        let mut body = Vec::new();
        body.extend_from_slice(&self.claimer.0);
        body.extend_from_slice(&self.target.0);
        body.extend_from_slice(&self.session_id.0);
        body.extend_from_slice(&self.created_ms.to_le_bytes());
        body
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct LeaveMark {
    pub peer_id: PeerId,
    pub version: u64,
    pub left_ms: u64,
    pub sig: SignatureBytes,
}

impl LeaveMark {
    pub fn beats(&self, other: &Self) -> bool {
        match self.version.cmp(&other.version) {
            std::cmp::Ordering::Greater => true,
            std::cmp::Ordering::Less => false,
            std::cmp::Ordering::Equal => self.left_ms >= other.left_ms,
        }
    }

    pub fn signing_body(&self) -> Vec<u8> {
        let mut body = Vec::new();
        body.extend_from_slice(&self.peer_id.0);
        body.extend_from_slice(&self.version.to_le_bytes());
        body.extend_from_slice(&self.left_ms.to_le_bytes());
        body
    }
}

/// A signed partial update applied into the lobby monoid.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct LobbyDelta {
    pub offers: Vec<WaitingOffer>,
    pub claims: Vec<Claim>,
    pub leaves: Vec<LeaveMark>,
}

impl LobbyDelta {
    pub fn is_empty(&self) -> bool {
        self.offers.is_empty() && self.claims.is_empty() && self.leaves.is_empty()
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct LobbyState {
    pub config: LobbyConfig,
    /// PeerId → latest leave tombstone.
    pub leaves: BTreeMap<PeerId, LeaveMark>,
    /// PeerId → latest offer.
    pub offers: BTreeMap<PeerId, WaitingOffer>,
    /// claim_id → claim (grow-only until cleanup).
    pub claims: BTreeMap<[u8; 32], Claim>,
}

impl Default for LobbyState {
    fn default() -> Self {
        Self::new(LobbyConfig::default())
    }
}

impl LobbyState {
    pub fn new(config: LobbyConfig) -> Self {
        Self {
            config,
            leaves: BTreeMap::new(),
            offers: BTreeMap::new(),
            claims: BTreeMap::new(),
        }
    }

    /// Commutative monoid merge. Order of `merge(a,b)` vs `merge(b,a)` must not matter.
    pub fn merge(&self, other: &Self) -> Self {
        let config = LobbyConfig {
            max_offers: self.config.max_offers.min(other.config.max_offers),
            max_claims: self.config.max_claims.min(other.config.max_claims),
            offer_ttl_ms: self.config.offer_ttl_ms.max(other.config.offer_ttl_ms),
            claim_ttl_ms: self.config.claim_ttl_ms.max(other.config.claim_ttl_ms),
            epoch_ms: self.config.epoch_ms.max(other.config.epoch_ms),
        };

        let mut leaves = self.leaves.clone();
        for (id, mark) in &other.leaves {
            match leaves.get(id) {
                Some(existing) if !mark.beats(existing) => {}
                _ => {
                    leaves.insert(*id, mark.clone());
                }
            }
        }

        let mut offers = self.offers.clone();
        for (id, offer) in &other.offers {
            match offers.get(id) {
                Some(existing) if !offer.beats(existing) => {}
                _ => {
                    offers.insert(*id, offer.clone());
                }
            }
        }

        let mut claims = self.claims.clone();
        for (id, claim) in &other.claims {
            claims.entry(*id).or_insert_with(|| claim.clone());
        }

        Self {
            config,
            leaves,
            offers,
            claims,
        }
    }

    /// Apply a delta as a small patch state and merge.
    pub fn apply_delta(&self, delta: &LobbyDelta) -> Self {
        let mut patch = LobbyState::new(self.config.clone());
        for o in &delta.offers {
            patch.upsert_offer(o.clone());
        }
        for c in &delta.claims {
            patch.insert_claim(c.clone());
        }
        for l in &delta.leaves {
            patch.upsert_leave(l.clone());
        }
        self.merge(&patch).cleanup()
    }

    /// Approximate network time: max heartbeat/claim/leave timestamp seen.
    pub fn network_now_ms(&self) -> u64 {
        let mut now = 0u64;
        for o in self.offers.values() {
            now = now.max(o.heartbeat_ms);
        }
        for c in self.claims.values() {
            now = now.max(c.created_ms);
        }
        for l in self.leaves.values() {
            now = now.max(l.left_ms);
        }
        now
    }

    pub fn is_left(&self, peer: &PeerId, offer_version: u64) -> bool {
        self.leaves
            .get(peer)
            .map(|m| m.version >= offer_version)
            .unwrap_or(false)
    }

    pub fn live_offers(&self, now_ms: u64) -> Vec<&WaitingOffer> {
        self.offers
            .values()
            .filter(|o| {
                !self.is_left(&o.peer_id, o.version)
                    && now_ms.saturating_sub(o.heartbeat_ms) <= self.config.offer_ttl_ms
            })
            .collect()
    }

    /// Mutual claim with agreeing session_id between a and b.
    pub fn mutual_match(&self, a: &PeerId, b: &PeerId) -> Option<SessionId> {
        let a_to_b: Vec<_> = self
            .claims
            .values()
            .filter(|c| c.claimer == *a && c.target == *b)
            .collect();
        let b_to_a: Vec<_> = self
            .claims
            .values()
            .filter(|c| c.claimer == *b && c.target == *a)
            .collect();
        for ca in &a_to_b {
            for cb in &b_to_a {
                if ca.session_id == cb.session_id {
                    return Some(ca.session_id);
                }
            }
        }
        None
    }

    /// All peers currently in a mutual match (either side).
    pub fn matched_peers(&self) -> BTreeSet<PeerId> {
        let mut out = BTreeSet::new();
        for c in self.claims.values() {
            if self.mutual_match(&c.claimer, &c.target).is_some() {
                out.insert(c.claimer);
                out.insert(c.target);
            }
        }
        out
    }

    /// Pure, idempotent cleanup. Safe to run any number of times.
    pub fn cleanup(&self) -> Self {
        let now = self.network_now_ms();
        let mut next = self.clone();

        let offer_ttl = next.config.offer_ttl_ms;
        let left_ids: BTreeSet<PeerId> = next
            .offers
            .iter()
            .filter(|(id, o)| next.is_left(id, o.version))
            .map(|(id, _)| *id)
            .collect();
        next.offers.retain(|id, o| {
            !left_ids.contains(id) && now.saturating_sub(o.heartbeat_ms) <= offer_ttl
        });

        let live: BTreeSet<PeerId> = next.live_offers(now).iter().map(|o| o.peer_id).collect();
        let claim_ttl = next.config.claim_ttl_ms;
        next.claims.retain(|_, c| {
            if now.saturating_sub(c.created_ms) > claim_ttl {
                return false;
            }
            live.contains(&c.claimer) && live.contains(&c.target)
        });

        if next.offers.len() > next.config.max_offers {
            let mut ranked: Vec<_> = next.offers.values().cloned().collect();
            ranked.sort_by(|a, b| {
                b.heartbeat_ms
                    .cmp(&a.heartbeat_ms)
                    .then_with(|| b.version.cmp(&a.version))
                    .then_with(|| b.peer_id.cmp(&a.peer_id))
            });
            ranked.truncate(next.config.max_offers);
            next.offers = ranked.into_iter().map(|o| (o.peer_id, o)).collect();
        }

        if next.claims.len() > next.config.max_claims {
            let mut ranked: Vec<_> = next.claims.values().cloned().collect();
            ranked.sort_by(|a, b| {
                b.created_ms
                    .cmp(&a.created_ms)
                    .then_with(|| b.claim_id.cmp(&a.claim_id))
            });
            ranked.truncate(next.config.max_claims);
            next.claims = ranked.into_iter().map(|c| (c.claim_id, c)).collect();
        }

        next
    }

    /// Soft verify: offer signatures must pass when non-zero; zero sigs allowed in unit tests.
    pub fn verify_soft(&self) -> Result<(), String> {
        for o in self.offers.values() {
            if o.sig.0.iter().any(|&b| b != 0) && !verify_offer(o) {
                return Err(format!("bad offer sig for {}", o.peer_id.short_hex()));
            }
        }
        Ok(())
    }

    pub fn upsert_offer(&mut self, offer: WaitingOffer) {
        match self.offers.get(&offer.peer_id) {
            Some(existing) if !offer.beats(existing) => {}
            _ => {
                self.offers.insert(offer.peer_id, offer);
            }
        }
    }

    pub fn insert_claim(&mut self, claim: Claim) {
        self.claims.entry(claim.claim_id).or_insert(claim);
    }

    pub fn upsert_leave(&mut self, leave: LeaveMark) {
        match self.leaves.get(&leave.peer_id) {
            Some(existing) if !leave.beats(existing) => {}
            _ => {
                self.leaves.insert(leave.peer_id, leave);
            }
        }
    }

    /// Compact summary for Freenet-style delta sync (peer versions + claim ids).
    pub fn summarize(&self) -> LobbySummary {
        LobbySummary {
            offer_versions: self
                .offers
                .iter()
                .map(|(id, o)| (*id, o.version, o.heartbeat_ms))
                .collect(),
            claim_ids: self.claims.keys().copied().collect(),
            leave_versions: self
                .leaves
                .iter()
                .map(|(id, l)| (*id, l.version))
                .collect(),
        }
    }

    /// Full state as delta relative to summary (MVP: send full state if anything differs).
    pub fn delta_from_summary(&self, summary: &LobbySummary) -> LobbyState {
        let mine = self.summarize();
        if mine == *summary {
            return LobbyState::new(self.config.clone());
        }
        // MVP: if out of sync, return full self (receiver merges).
        self.clone()
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct LobbySummary {
    pub offer_versions: Vec<(PeerId, u64, u64)>,
    pub claim_ids: Vec<[u8; 32]>,
    pub leave_versions: Vec<(PeerId, u64)>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::identity::Identity;
    use crate::types::Preferences;

    fn offer(seed: u8, version: u64, heartbeat_ms: u64) -> WaitingOffer {
        let mut s = [0u8; 32];
        s[0] = seed;
        let id = Identity::from_seed(s);
        let mut session_seed = [0u8; 32];
        session_seed[0] = seed;
        id.make_offer(version, heartbeat_ms, Preferences::text_only(), session_seed)
    }

    #[test]
    fn merge_offers_is_commutative() {
        let a = {
            let mut s = LobbyState::new(LobbyConfig::default());
            s.upsert_offer(offer(1, 1, 1000));
            s
        };
        let b = {
            let mut s = LobbyState::new(LobbyConfig::default());
            s.upsert_offer(offer(2, 1, 1000));
            s
        };
        assert_eq!(a.merge(&b), b.merge(&a));
    }

    #[test]
    fn merge_offers_lww_by_version() {
        let old = offer(1, 1, 1000);
        let new = offer(1, 2, 2000);
        let mut a = LobbyState::new(LobbyConfig::default());
        a.upsert_offer(old);
        let mut b = LobbyState::new(LobbyConfig::default());
        b.upsert_offer(new.clone());
        let m = a.merge(&b);
        assert_eq!(m.offers.get(&new.peer_id).unwrap().version, 2);
        assert_eq!(b.merge(&a).offers.get(&new.peer_id).unwrap().version, 2);
    }

    #[test]
    fn cleanup_is_idempotent() {
        let mut s = LobbyState::new(LobbyConfig {
            offer_ttl_ms: 1000,
            ..LobbyConfig::default()
        });
        s.upsert_offer(offer(1, 1, 5000));
        s.upsert_offer(offer(2, 1, 100));
        let once = s.cleanup();
        let twice = once.cleanup();
        assert_eq!(once, twice);
        assert_eq!(once.offers.len(), 1);
    }

    #[test]
    fn leave_removes_offer_on_cleanup() {
        let mut s = LobbyState::new(LobbyConfig::default());
        let o = offer(1, 3, 10_000);
        let mut seed = [0u8; 32];
        seed[0] = 1;
        let id = Identity::from_seed(seed);
        let peer = o.peer_id;
        s.upsert_offer(o);
        s.upsert_leave(id.make_leave(3, 10_001));
        let cleaned = s.cleanup();
        assert!(!cleaned.offers.contains_key(&peer));
    }

    #[test]
    fn mutual_match_detects_pair() {
        let mut seed_a = [0u8; 32];
        seed_a[0] = 1;
        let mut seed_b = [0u8; 32];
        seed_b[0] = 2;
        let alice = Identity::from_seed(seed_a);
        let bob = Identity::from_seed(seed_b);
        let sa = [1u8; 32];
        let sb = [2u8; 32];
        let sid = SessionId::derive(alice.peer_id, bob.peer_id, &sa, &sb);
        let mut s = LobbyState::new(LobbyConfig::default());
        s.upsert_offer(alice.make_offer(1, 1000, Preferences::text_only(), sa));
        s.upsert_offer(bob.make_offer(1, 1000, Preferences::text_only(), sb));
        s.insert_claim(alice.make_claim(bob.peer_id, sid, 1000));
        s.insert_claim(bob.make_claim(alice.peer_id, sid, 1001));
        assert_eq!(s.mutual_match(&alice.peer_id, &bob.peer_id), Some(sid));
        assert!(s.verify_soft().is_ok());
    }

    #[test]
    fn offer_signature_roundtrip() {
        let o = offer(9, 1, 100);
        assert!(verify_offer(&o));
    }
}
