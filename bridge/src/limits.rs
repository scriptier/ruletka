//! Lightweight sliding-window rate limits for bridge clients.

use std::collections::VecDeque;
use std::time::{Duration, Instant};

/// Per-connection sliding window counters.
#[derive(Debug, Default)]
pub struct ClientLimiter {
    messages: VecDeque<Instant>,
    chat: VecDeque<Instant>,
    match_cmds: VecDeque<Instant>, // spin / next
}

#[derive(Clone, Copy, Debug)]
pub struct LimitConfig {
    /// Max WebSocket text messages per window (all types).
    pub max_messages: usize,
    pub message_window: Duration,
    /// Max chat messages per window.
    pub max_chat: usize,
    pub chat_window: Duration,
    /// Max spin/next commands per window.
    pub max_match_cmds: usize,
    pub match_window: Duration,
    /// Max concurrent clients.
    pub max_clients: usize,
    /// Max inbound text frame size (bytes).
    pub max_frame_bytes: usize,
}

impl Default for LimitConfig {
    fn default() -> Self {
        Self {
            max_messages: 60,
            message_window: Duration::from_secs(1),
            max_chat: 8,
            chat_window: Duration::from_secs(5),
            max_match_cmds: 6,
            match_window: Duration::from_secs(3),
            max_clients: 256,
            max_frame_bytes: 96 * 1024,
        }
    }
}

fn prune(q: &mut VecDeque<Instant>, window: Duration, now: Instant) {
    while q
        .front()
        .map(|t| now.duration_since(*t) > window)
        .unwrap_or(false)
    {
        q.pop_front();
    }
}

fn allow(q: &mut VecDeque<Instant>, max: usize, window: Duration, now: Instant) -> bool {
    prune(q, window, now);
    if q.len() >= max {
        return false;
    }
    q.push_back(now);
    true
}

impl ClientLimiter {
    pub fn new() -> Self {
        Self::default()
    }

    /// Any inbound client message.
    pub fn allow_message(&mut self, cfg: &LimitConfig) -> bool {
        allow(
            &mut self.messages,
            cfg.max_messages,
            cfg.message_window,
            Instant::now(),
        )
    }

    pub fn allow_chat(&mut self, cfg: &LimitConfig) -> bool {
        allow(&mut self.chat, cfg.max_chat, cfg.chat_window, Instant::now())
    }

    pub fn allow_match_cmd(&mut self, cfg: &LimitConfig) -> bool {
        allow(
            &mut self.match_cmds,
            cfg.max_match_cmds,
            cfg.match_window,
            Instant::now(),
        )
    }
}
