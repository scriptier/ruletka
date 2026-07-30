use crate::types::{hash_bytes, PeerId};
use serde::{Deserialize, Serialize};

/// Content-addressed session identity for a matched pair.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct SessionId(pub [u8; 32]);

impl SessionId {
    /// Deterministic from sorted peer ids + both session seeds.
    /// Both peers compute the same id without coordination.
    pub fn derive(a: PeerId, b: PeerId, seed_a: &[u8; 32], seed_b: &[u8; 32]) -> Self {
        let (p1, s1, p2, s2) = if a <= b {
            (a, seed_a, b, seed_b)
        } else {
            (b, seed_b, a, seed_a)
        };
        Self(hash_bytes(&[
            b"session/v1",
            &p1.0,
            &p2.0,
            s1,
            s2,
        ]))
    }

    pub fn short_hex(&self) -> String {
        hex::encode(&self.0[..4])
    }
}

/// Parameters for the session Freenet contract (content-addressed instance).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SessionParams {
    pub session_id: SessionId,
    pub peer_a: PeerId,
    pub peer_b: PeerId,
}

impl SessionParams {
    pub fn new(session_id: SessionId, a: PeerId, b: PeerId) -> Self {
        let (peer_a, peer_b) = if a <= b { (a, b) } else { (b, a) };
        Self {
            session_id,
            peer_a,
            peer_b,
        }
    }

    pub fn allows(&self, author: PeerId) -> bool {
        author == self.peer_a || author == self.peer_b
    }

    pub fn to_cbor(&self) -> Result<Vec<u8>, String> {
        let mut buf = Vec::new();
        ciborium::ser::into_writer(self, &mut buf).map_err(|e| e.to_string())?;
        Ok(buf)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SessionMeta {
    pub session_id: SessionId,
    pub peer_a: PeerId,
    pub peer_b: PeerId,
    pub created_ms: u64,
}

impl SessionMeta {
    pub fn new(a: PeerId, b: PeerId, seed_a: &[u8; 32], seed_b: &[u8; 32], created_ms: u64) -> Self {
        let (peer_a, peer_b) = if a <= b { (a, b) } else { (b, a) };
        let session_id = SessionId::derive(a, b, seed_a, seed_b);
        Self {
            session_id,
            peer_a,
            peer_b,
            created_ms,
        }
    }

    pub fn contains(&self, peer: PeerId) -> bool {
        self.peer_a == peer || self.peer_b == peer
    }

    /// Lexicographically smaller peer creates the WebRTC offer (glare avoidance).
    pub fn webrtc_offerer(&self) -> PeerId {
        self.peer_a // already sorted
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChatMessage {
    pub author: PeerId,
    pub seq: u64,
    pub sent_ms: u64,
    pub body: String,
}

/// WebRTC signaling blob carried over the session contract (not media).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum SignalKind {
    /// SDP offer (from lex-smaller peer / `webrtc_offerer`)
    Offer,
    /// SDP answer
    Answer,
    /// Trickle ICE candidate
    Ice,
    /// Hang up / Next from media side
    Bye,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SignalMessage {
    pub author: PeerId,
    pub seq: u64,
    pub sent_ms: u64,
    pub kind: SignalKind,
    /// SDP or ICE JSON payload (browser-native strings).
    pub payload: String,
}

/// Minimal session state: text + WebRTC signaling CRDTs.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct SessionState {
    pub meta: Option<SessionMeta>,
    pub messages: Vec<ChatMessage>,
    /// WebRTC SDP/ICE ring (Phase 2). Merged like messages.
    #[serde(default)]
    pub signals: Vec<SignalMessage>,
    pub max_messages: usize,
    #[serde(default = "default_max_signals")]
    pub max_signals: usize,
}

fn default_max_signals() -> usize {
    64
}

impl SessionState {
    pub fn push_message(&mut self, msg: ChatMessage) {
        if let Some(meta) = &self.meta {
            if !meta.contains(msg.author) {
                return;
            }
        }
        self.messages.push(msg);
        let cap = if self.max_messages == 0 {
            100
        } else {
            self.max_messages
        };
        if self.messages.len() > cap {
            let drain = self.messages.len() - cap;
            self.messages.drain(0..drain);
        }
    }

    pub fn push_signal(&mut self, sig: SignalMessage) {
        if let Some(meta) = &self.meta {
            if !meta.contains(sig.author) {
                return;
            }
        }
        self.signals.push(sig);
        let cap = if self.max_signals == 0 {
            64
        } else {
            self.max_signals
        };
        if self.signals.len() > cap {
            let drain = self.signals.len() - cap;
            self.signals.drain(0..drain);
        }
    }

    /// Merge: same meta required; messages/signals union by (author, seq), then sort + cap.
    pub fn merge(&self, other: &Self) -> Self {
        let meta = match (&self.meta, &other.meta) {
            (Some(a), Some(b)) if a.session_id == b.session_id => Some(a.clone()),
            (Some(a), None) => Some(a.clone()),
            (None, Some(b)) => Some(b.clone()),
            (Some(a), Some(b)) => {
                // Divergent sessions should not merge; prefer lower session id for determinism
                // in tests only — production contract would reject.
                if a.session_id <= b.session_id {
                    Some(a.clone())
                } else {
                    Some(b.clone())
                }
            }
            (None, None) => None,
        };

        let max_messages = self.max_messages.max(other.max_messages).max(100);
        let max_signals = self.max_signals.max(other.max_signals).max(64);

        let mut map = std::collections::BTreeMap::new();
        for m in self.messages.iter().chain(other.messages.iter()) {
            map.insert((m.author, m.seq), m.clone());
        }
        let mut messages: Vec<_> = map.into_values().collect();
        messages.sort_by(|a, b| {
            a.sent_ms
                .cmp(&b.sent_ms)
                .then_with(|| a.seq.cmp(&b.seq))
                .then_with(|| a.author.cmp(&b.author))
        });
        if messages.len() > max_messages {
            let drain = messages.len() - max_messages;
            messages.drain(0..drain);
        }

        let mut sig_map = std::collections::BTreeMap::new();
        for s in self.signals.iter().chain(other.signals.iter()) {
            sig_map.insert((s.author, s.seq), s.clone());
        }
        let mut signals: Vec<_> = sig_map.into_values().collect();
        signals.sort_by(|a, b| {
            a.sent_ms
                .cmp(&b.sent_ms)
                .then_with(|| a.seq.cmp(&b.seq))
                .then_with(|| a.author.cmp(&b.author))
        });
        if signals.len() > max_signals {
            let drain = signals.len() - max_signals;
            signals.drain(0..drain);
        }

        Self {
            meta,
            messages,
            signals,
            max_messages,
            max_signals,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_id_is_order_independent() {
        let a = PeerId::from_seed("alice");
        let b = PeerId::from_seed("bob");
        let sa = [1u8; 32];
        let sb = [2u8; 32];
        assert_eq!(
            SessionId::derive(a, b, &sa, &sb),
            SessionId::derive(b, a, &sb, &sa)
        );
    }

    #[test]
    fn message_merge_is_commutative() {
        let a = PeerId::from_seed("alice");
        let b = PeerId::from_seed("bob");
        let meta = SessionMeta::new(a, b, &[1; 32], &[2; 32], 0);
        let mut s1 = SessionState {
            meta: Some(meta.clone()),
            messages: vec![],
            signals: vec![],
            max_messages: 50,
            max_signals: 32,
        };
        let mut s2 = s1.clone();
        s1.push_message(ChatMessage {
            author: a,
            seq: 1,
            sent_ms: 10,
            body: "hi".into(),
        });
        s2.push_message(ChatMessage {
            author: b,
            seq: 1,
            sent_ms: 11,
            body: "yo".into(),
        });
        s1.push_signal(SignalMessage {
            author: a,
            seq: 1,
            sent_ms: 12,
            kind: SignalKind::Offer,
            payload: "v=0".into(),
        });
        s2.push_signal(SignalMessage {
            author: b,
            seq: 1,
            sent_ms: 13,
            kind: SignalKind::Answer,
            payload: "v=0".into(),
        });
        assert_eq!(s1.merge(&s2), s2.merge(&s1));
        let m = s1.merge(&s2);
        assert_eq!(m.messages.len(), 2);
        assert_eq!(m.signals.len(), 2);
    }
}
