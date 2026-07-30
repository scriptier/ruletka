//! Client agent: Spin → Waiting → Claiming → Matched → Next.

use crate::identity::Identity;
use crate::lobby::{LobbyDelta, LobbyState, WaitingOffer};
use crate::match_algo::{select_partner, session_for_pair, would_select_each_other, MatchEpoch};
use crate::session::{
    ChatMessage, SessionId, SessionMeta, SessionState, SignalKind, SignalMessage,
};
use crate::types::{PeerId, Preferences};
use serde::{Deserialize, Serialize};

#[cfg(feature = "client")]
fn fill_random(buf: &mut [u8]) {
    use rand::RngCore;
    rand::rngs::OsRng.fill_bytes(buf);
}

#[cfg(not(feature = "client"))]
fn fill_random(buf: &mut [u8]) {
    // Deterministic fallback for non-client builds (should not run agents on-chain).
    for (i, b) in buf.iter_mut().enumerate() {
        *b = (i as u8).wrapping_mul(31).wrapping_add(7);
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Phase {
    Idle,
    Waiting,
    Claiming { target: PeerId, session_id: SessionId },
    Matched { partner: PeerId, session_id: SessionId },
}

#[derive(Clone, Debug)]
pub struct Agent {
    pub identity: Identity,
    pub prefs: Preferences,
    pub phase: Phase,
    pub version: u64,
    pub session_seed: [u8; 32],
    pub session: SessionState,
    pub msg_seq: u64,
    /// Local wall clock helper (ms); sim injects time.
    pub now_ms: u64,
}

#[derive(Clone, Debug)]
pub struct TickResult {
    pub lobby_delta: LobbyDelta,
    pub session_messages: Vec<ChatMessage>,
    pub phase: Phase,
    pub events: Vec<String>,
}

impl Default for TickResult {
    fn default() -> Self {
        Self {
            lobby_delta: LobbyDelta::default(),
            session_messages: Vec::new(),
            phase: Phase::Idle,
            events: Vec::new(),
        }
    }
}

impl Agent {
    pub fn new(prefs: Preferences) -> Self {
        #[cfg(feature = "client")]
        let identity = Identity::generate();
        #[cfg(not(feature = "client"))]
        let identity = Identity::from_seed([1u8; 32]);
        let mut session_seed = [0u8; 32];
        fill_random(&mut session_seed);
        Self {
            identity,
            prefs,
            phase: Phase::Idle,
            version: 0,
            session_seed,
            session: SessionState::default(),
            msg_seq: 0,
            now_ms: 0,
        }
    }

    pub fn with_seed(seed: [u8; 32], prefs: Preferences) -> Self {
        let identity = Identity::from_seed(seed);
        let mut session_seed = seed;
        session_seed[31] ^= 0xff;
        Self {
            identity,
            prefs,
            phase: Phase::Idle,
            version: 0,
            session_seed,
            session: SessionState::default(),
            msg_seq: 0,
            now_ms: 0,
        }
    }

    pub fn peer_id(&self) -> PeerId {
        self.identity.peer_id
    }

    pub fn short_id(&self) -> String {
        self.peer_id().short_hex()
    }

    /// Enter the lobby.
    pub fn spin(&mut self, now_ms: u64) -> LobbyDelta {
        self.now_ms = now_ms;
        self.version = self.version.saturating_add(1);
        // Fresh session seed each spin for unlinkability.
        fill_random(&mut self.session_seed);
        self.session = SessionState {
            max_messages: 100,
            max_signals: 64,
            ..Default::default()
        };
        self.msg_seq = 0;
        self.phase = Phase::Waiting;
        let offer = self.current_offer();
        LobbyDelta {
            offers: vec![offer],
            ..Default::default()
        }
    }

    fn current_offer(&self) -> WaitingOffer {
        self.identity.make_offer(
            self.version,
            self.now_ms,
            self.prefs.clone(),
            self.session_seed,
        )
    }

    /// Heartbeat + match logic. Call every ~1–2s while active.
    pub fn tick(&mut self, lobby: &LobbyState, now_ms: u64) -> TickResult {
        self.now_ms = now_ms.max(self.now_ms);
        let mut result = TickResult {
            phase: self.phase.clone(),
            ..Default::default()
        };

        match self.phase.clone() {
            Phase::Idle => {}
            Phase::Waiting | Phase::Claiming { .. } => {
                self.version = self.version.saturating_add(1);
                let offer = self.current_offer();
                result.lobby_delta.offers.push(offer.clone());

                let now = lobby.network_now_ms().max(self.now_ms);
                let epoch = MatchEpoch::from_now(now, lobby.config.epoch_ms);
                let live = lobby.live_offers(now);
                // Include our just-published offer in the live view for selection.
                let mut live_owned: Vec<WaitingOffer> = live.into_iter().cloned().collect();
                if !live_owned.iter().any(|o| o.peer_id == self.peer_id()) {
                    live_owned.push(offer.clone());
                } else {
                    for o in &mut live_owned {
                        if o.peer_id == self.peer_id() {
                            *o = offer.clone();
                        }
                    }
                }
                let live_refs: Vec<&WaitingOffer> = live_owned.iter().collect();
                let matched = lobby.matched_peers();

                if let Some(partner) =
                    select_partner(self.peer_id(), &offer, &live_refs, epoch, &matched)
                {
                    if let Some(their) = live_refs.iter().find(|o| o.peer_id == partner) {
                        if would_select_each_other(&offer, their, &live_refs, epoch, &matched) {
                            let sid = session_for_pair(&offer, their);
                            let claim =
                                self.identity
                                    .make_claim(partner, sid, self.now_ms);
                            result.lobby_delta.claims.push(claim);
                            self.phase = Phase::Claiming {
                                target: partner,
                                session_id: sid,
                            };
                            result
                                .events
                                .push(format!("claiming {}", partner.short_hex()));
                        }
                    }
                }

                // Check mutual match (maybe they claimed us first).
                if let Phase::Claiming {
                    target,
                    session_id,
                } = &self.phase
                {
                    if let Some(sid) = lobby.mutual_match(&self.peer_id(), target) {
                        if sid == *session_id
                            || lobby.mutual_match(&self.peer_id(), target).is_some()
                        {
                            let partner = *target;
                            let sid = lobby
                                .mutual_match(&self.peer_id(), &partner)
                                .unwrap_or(*session_id);
                            self.enter_matched(partner, sid, lobby, &mut result);
                        }
                    }
                } else if let Phase::Waiting = self.phase {
                    // Opportunistic: someone mutually claimed us without us claiming yet.
                    for o in &live_owned {
                        if o.peer_id == self.peer_id() {
                            continue;
                        }
                        if let Some(sid) = lobby.mutual_match(&self.peer_id(), &o.peer_id) {
                            self.enter_matched(o.peer_id, sid, lobby, &mut result);
                            break;
                        }
                    }
                }
            }
            Phase::Matched { .. } => {
                // Session traffic is separate; nothing for lobby unless Next.
            }
        }

        result.phase = self.phase.clone();
        result
    }

    fn enter_matched(
        &mut self,
        partner: PeerId,
        sid: SessionId,
        lobby: &LobbyState,
        result: &mut TickResult,
    ) {
        let leave = self.identity.make_leave(self.version, self.now_ms);
        result.lobby_delta.leaves.push(leave);

        // Build session meta from offers if present.
        let my_offer = lobby.offers.get(&self.peer_id()).cloned();
        let their_offer = lobby.offers.get(&partner).cloned();
        let meta = match (my_offer, their_offer) {
            (Some(a), Some(b)) => SessionMeta::new(
                a.peer_id,
                b.peer_id,
                &a.session_seed,
                &b.session_seed,
                self.now_ms,
            ),
            _ => SessionMeta {
                session_id: sid,
                peer_a: if self.peer_id() <= partner {
                    self.peer_id()
                } else {
                    partner
                },
                peer_b: if self.peer_id() <= partner {
                    partner
                } else {
                    self.peer_id()
                },
                created_ms: self.now_ms,
            },
        };
        self.session.meta = Some(meta);
        self.session.max_messages = 100;
        self.phase = Phase::Matched {
            partner,
            session_id: sid,
        };
        result
            .events
            .push(format!("matched with {}", partner.short_hex()));
    }

    pub fn send_chat(&mut self, body: impl Into<String>) -> Option<ChatMessage> {
        let Phase::Matched { .. } = self.phase else {
            return None;
        };
        self.msg_seq += 1;
        let msg = ChatMessage {
            author: self.peer_id(),
            seq: self.msg_seq,
            sent_ms: self.now_ms,
            body: body.into(),
        };
        self.session.push_message(msg.clone());
        Some(msg)
    }

    /// Publish a WebRTC signaling blob into local session state (push to Freenet separately).
    pub fn send_signal(
        &mut self,
        kind: SignalKind,
        payload: impl Into<String>,
    ) -> Option<SignalMessage> {
        let Phase::Matched { .. } = self.phase else {
            return None;
        };
        self.msg_seq += 1;
        let sig = SignalMessage {
            author: self.peer_id(),
            seq: self.msg_seq,
            sent_ms: self.now_ms,
            kind,
            payload: payload.into(),
        };
        self.session.push_signal(sig.clone());
        Some(sig)
    }

    pub fn is_webrtc_offerer(&self) -> bool {
        self.session
            .meta
            .as_ref()
            .map(|m| m.webrtc_offerer() == self.peer_id())
            .unwrap_or(false)
    }

    /// Leave match and return to idle (caller may spin again).
    pub fn next(&mut self, now_ms: u64) -> LobbyDelta {
        self.now_ms = now_ms;
        let mut delta = LobbyDelta::default();
        if !matches!(self.phase, Phase::Idle) {
            delta.leaves.push(self.identity.make_leave(self.version, now_ms));
        }
        self.phase = Phase::Idle;
        self.session = SessionState::default();
        delta
    }

    pub fn ingest_session(&mut self, remote: &SessionState) {
        self.session = self.session.merge(remote);
    }
}
