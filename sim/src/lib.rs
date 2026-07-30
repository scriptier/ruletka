//! In-memory shared lobby + session bus for local multi-peer demos.

use freenet_roulette_common::{
    Agent, ChatMessage, LobbyDelta, LobbyState, Phase, Preferences, SessionId, SessionState,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PeerView {
    pub id: String,
    pub phase: String,
    pub partner: Option<String>,
    pub messages: Vec<ChatLine>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatLine {
    pub author: String,
    pub body: String,
    pub sent_ms: u64,
}

pub struct Simulator {
    pub lobby: LobbyState,
    pub sessions: BTreeMap<SessionId, SessionState>,
    pub agents: Vec<Agent>,
    pub now_ms: u64,
}

impl Simulator {
    pub fn new() -> Self {
        Self {
            lobby: LobbyState::default(),
            sessions: BTreeMap::new(),
            agents: Vec::new(),
            now_ms: 1_000,
        }
    }

    pub fn add_peer(&mut self, seed: u8, prefs: Preferences) -> usize {
        let mut s = [0u8; 32];
        s[0] = seed;
        let agent = Agent::with_seed(s, prefs);
        self.agents.push(agent);
        self.agents.len() - 1
    }

    pub fn add_random_peer(&mut self, prefs: Preferences) -> usize {
        self.agents.push(Agent::new(prefs));
        self.agents.len() - 1
    }

    pub fn spin(&mut self, idx: usize) {
        self.now_ms += 100;
        let delta = self.agents[idx].spin(self.now_ms);
        self.apply_lobby_delta(delta);
    }

    pub fn next(&mut self, idx: usize) {
        self.now_ms += 100;
        let delta = self.agents[idx].next(self.now_ms);
        self.apply_lobby_delta(delta);
    }

    pub fn tick_all(&mut self) {
        self.now_ms += 500;
        // Snapshot lobby for all agents, collect deltas, then apply.
        let lobby = self.lobby.clone();
        let mut deltas = Vec::new();
        for agent in &mut self.agents {
            let tr = agent.tick(&lobby, self.now_ms);
            deltas.push(tr.lobby_delta);
        }
        for d in deltas {
            self.apply_lobby_delta(d);
        }
        // Second pass: detect matches against updated lobby.
        let lobby = self.lobby.clone();
        let mut deltas = Vec::new();
        for agent in &mut self.agents {
            if matches!(agent.phase, Phase::Claiming { .. } | Phase::Waiting) {
                let tr = agent.tick(&lobby, self.now_ms);
                deltas.push(tr.lobby_delta);
            }
        }
        for d in deltas {
            self.apply_lobby_delta(d);
        }

        // Sync sessions for matched agents.
        for agent in &mut self.agents {
            if let Phase::Matched { session_id, .. } = agent.phase {
                let entry = self
                    .sessions
                    .entry(session_id)
                    .or_insert_with(|| SessionState {
                        meta: agent.session.meta.clone(),
                        max_messages: 100,
                        max_signals: 64,
                        messages: vec![],
                        signals: vec![],
                    });
                *entry = entry.merge(&agent.session);
                agent.ingest_session(entry);
            }
        }
    }

    pub fn chat(&mut self, idx: usize, body: &str) -> Option<ChatMessage> {
        self.now_ms += 10;
        self.agents[idx].now_ms = self.now_ms;
        let msg = self.agents[idx].send_chat(body)?;
        if let Phase::Matched { session_id, .. } = self.agents[idx].phase {
            let entry = self
                .sessions
                .entry(session_id)
                .or_insert_with(|| SessionState {
                    meta: self.agents[idx].session.meta.clone(),
                    max_messages: 100,
                    max_signals: 64,
                    messages: vec![],
                    signals: vec![],
                });
            entry.push_message(msg.clone());
            // Push to both participants.
            for agent in &mut self.agents {
                if let Phase::Matched {
                    session_id: sid, ..
                } = agent.phase
                {
                    if sid == session_id {
                        agent.ingest_session(entry);
                    }
                }
            }
        }
        Some(msg)
    }

    fn apply_lobby_delta(&mut self, delta: LobbyDelta) {
        if delta.is_empty() {
            return;
        }
        self.lobby = self.lobby.apply_delta(&delta);
    }

    pub fn views(&self) -> Vec<PeerView> {
        self.agents
            .iter()
            .map(|a| {
                let (phase, partner) = match &a.phase {
                    Phase::Idle => ("idle".into(), None),
                    Phase::Waiting => ("waiting".into(), None),
                    Phase::Claiming { target, .. } => {
                        ("claiming".into(), Some(target.short_hex()))
                    }
                    Phase::Matched { partner, .. } => {
                        ("matched".into(), Some(partner.short_hex()))
                    }
                };
                let messages = a
                    .session
                    .messages
                    .iter()
                    .map(|m| ChatLine {
                        author: m.author.short_hex(),
                        body: m.body.clone(),
                        sent_ms: m.sent_ms,
                    })
                    .collect();
                PeerView {
                    id: a.short_id(),
                    phase,
                    partner,
                    messages,
                }
            })
            .collect()
    }

    /// Run until at least one pair is matched or max ticks.
    pub fn run_until_match(&mut self, max_ticks: usize) -> bool {
        for _ in 0..max_ticks {
            self.tick_all();
            if self
                .agents
                .iter()
                .any(|a| matches!(a.phase, Phase::Matched { .. }))
            {
                return true;
            }
        }
        false
    }
}

impl Default for Simulator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use freenet_roulette_common::Preferences;

    #[test]
    fn two_peers_match_and_chat() {
        let mut sim = Simulator::new();
        sim.add_peer(1, Preferences::text_only());
        sim.add_peer(2, Preferences::text_only());
        sim.spin(0);
        sim.spin(1);
        assert!(sim.run_until_match(20), "expected a match");
        sim.chat(0, "hello stranger").unwrap();
        sim.chat(1, "hi!").unwrap();
        let views = sim.views();
        assert_eq!(views[0].phase, "matched");
        assert_eq!(views[1].phase, "matched");
        assert!(views[0].messages.len() >= 1);
        assert!(views[1].messages.len() >= 1);
    }
}
