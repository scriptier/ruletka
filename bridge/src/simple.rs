//! In-memory matchmaking + friends + party-of-2 browse + chat/signal relay.

use crate::federation::{
    self, caller_is_offerer, federated_peer_id, parse_federated_peer_id, ClaimRequest,
    ClaimResponse, FedOutbound, FedPeerDesc, FederationInfo, RelayKind, RelayRequest, RoomWaiting,
    PROTOCOL,
};
use crate::friends_store::{self, FriendsFile};
use crate::limits::{ClientLimiter, LimitConfig};
use crate::protocol::{ClientMsg, FriendInfo, MatchPeer, ServerMsg};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::PathBuf;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use uuid::Uuid;

/// Shape JSON body for common chat webhook providers.
fn webhook_body_for_url(
    url: &str,
    text: &str,
    payload: &serde_json::Value,
) -> serde_json::Value {
    let lower = url.to_ascii_lowercase();
    // Telegram Bot API sendMessage — chat_id may be in query string
    // e.g. https://api.telegram.org/botTOKEN/sendMessage?chat_id=-100123
    if lower.contains("api.telegram.org") && lower.contains("/sendmessage") {
        let chat_id = url
            .split(['?', '&'])
            .skip(1)
            .find_map(|pair| {
                let mut it = pair.splitn(2, '=');
                let k = it.next()?;
                let v = it.next()?;
                if k == "chat_id" && !v.is_empty() {
                    Some(v.to_string())
                } else {
                    None
                }
            })
            .unwrap_or_default();
        if !chat_id.is_empty() {
            return serde_json::json!({
                "chat_id": chat_id,
                "text": text,
                "disable_web_page_preview": true,
            });
        }
        return serde_json::json!({
            "text": text,
            "disable_web_page_preview": true,
        });
    }
    // Discord incoming webhook
    if lower.contains("discord.com/api/webhooks") || lower.contains("discordapp.com/api/webhooks") {
        return serde_json::json!({
            "content": text.chars().take(1900).collect::<String>(),
        });
    }
    // Slack incoming webhook
    if lower.contains("hooks.slack.com") {
        return serde_json::json!({ "text": text });
    }
    // Generic / custom handlers
    serde_json::json!({
        "text": text,
        "content": text,
        "ruletka": payload,
    })
}

/// Active cross-bridge session (local browser ↔ remote hub peer).
struct FedSession {
    session_id: String,
    session_key: String,
    local_client: Uuid,
    local_peer_id: String,
    remote_peer_id: String,
    remote_base_url: String,
    #[allow(dead_code)]
    remote_instance: String,
}

const MAX_CHAT_CHARS: usize = 500;
const MAX_SIGNAL_BYTES: usize = 64 * 1024;
const MAX_SIGNAL_KIND: usize = 32;
const MAX_ROOM_CHARS: usize = 64;
const MAX_NAME_CHARS: usize = 32;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Phase {
    Idle,
    Waiting,
    /// 1:1 with a friend
    FriendCall,
    /// In stranger match (solo or as party)
    Matched,
}

/// One slot in the match queue: solo client or a party of two.
#[derive(Clone, Debug)]
enum QueueEntry {
    Solo(Uuid),
    Party { a: Uuid, b: Uuid },
}

pub struct Client {
    pub short_id: String,
    pub peer_id: String,
    pub user_id: String,
    pub name: String,
    pub friend_code: String,
    pub out: mpsc::UnboundedSender<ServerMsg>,
    phase: Phase,
    /// 1:1 partner (friend call or solo match)
    partner: Option<Uuid>,
    /// Active multi-party session peer set (excluding self)
    session_peers: HashSet<Uuid>,
    session_id: Option<String>,
    last_partner: Option<Uuid>,
    room: String,
    /// Friend currently in call with us
    friend_call: Option<Uuid>,
    /// Other party member when browsing together
    party_with: Option<Uuid>,
    /// Soft match identity: man | woman | other | ""
    gender: String,
    /// Soft match preference: any | man | woman | ""
    looking: String,
    /// Cosmetic self-chosen flag (ISO alpha-2). Not geolocation.
    flag: String,
    /// Small avatar data URL (jpeg/png/webp). Empty = none.
    avatar: String,
    limiter: ClientLimiter,
    /// Sliding window of report submissions (anti ban-bomb).
    report_times: Vec<Instant>,
}

pub struct SimpleHub {
    clients: HashMap<Uuid, Client>,
    /// connection uuid by persistent user_id (online only)
    by_user: HashMap<String, Uuid>,
    /// friend_code → user_id
    code_index: HashMap<String, String>,
    /// undirected friendships
    friendships: HashMap<String, HashSet<String>>,
    /// last known names for offline friends
    known_names: HashMap<String, String>,
    /// blocker user_id → blocked user_ids
    blocks: HashMap<String, HashSet<String>>,
    /// pending friend requests: from_user → set of to_users
    pending: HashMap<String, HashSet<String>>,
    /// target_user_id → unique reporters
    report_reporters: HashMap<String, HashSet<String>>,
    /// user_id → ban expiry (unix seconds)
    match_bans: HashMap<String, u64>,
    queue: VecDeque<QueueEntry>,
    limits: LimitConfig,
    friends_path: PathBuf,
    /// Optional HTTPS webhook (Slack/Discord/Telegram bot URL) fired on auto-ban.
    mod_webhook_url: Option<String>,
    /// Federated sessions by session_id
    fed_sessions: HashMap<String, FedSession>,
    /// local client uuid → session_id
    fed_by_client: HashMap<Uuid, String>,
    /// Outbound federation relays (drained by HTTP layer)
    fed_outbox: VecDeque<FedOutbound>,
}

fn normalize_room(raw: &str) -> String {
    let s = raw.trim();
    if s.is_empty() {
        return String::new();
    }
    s.chars().take(MAX_ROOM_CHARS).collect()
}

fn normalize_name(raw: &str) -> String {
    let s = raw.trim();
    if s.is_empty() {
        return "anon".into();
    }
    s.chars().take(MAX_NAME_CHARS).collect()
}

fn friend_code_for(user_id: &str) -> String {
    let mut h = Sha256::new();
    h.update(b"friend-code/v1");
    h.update(user_id.as_bytes());
    let d = h.finalize();
    // 8 hex chars — easy to share
    d.iter()
        .take(4)
        .map(|b| format!("{b:02X}"))
        .collect::<String>()
}

fn normalize_gender(raw: &str) -> String {
    match raw.trim().to_lowercase().as_str() {
        "man" | "male" | "m" => "man".into(),
        "woman" | "female" | "f" | "w" => "woman".into(),
        "other" | "nb" | "nonbinary" | "non-binary" => "other".into(),
        _ => String::new(),
    }
}

fn normalize_looking(raw: &str) -> String {
    match raw.trim().to_lowercase().as_str() {
        "man" | "male" | "m" => "man".into(),
        "woman" | "female" | "f" | "w" => "woman".into(),
        "any" | "all" | "" => "any".into(),
        _ => "any".into(),
    }
}

/// Cosmetic flag only: ISO 3166-1 alpha-2 or empty. Never derived from IP/GPS.
fn normalize_flag(raw: &str) -> String {
    let s: String = raw
        .trim()
        .chars()
        .filter(|c| c.is_ascii_alphabetic())
        .take(2)
        .collect::<String>()
        .to_uppercase();
    if s.len() == 2 {
        s
    } else {
        String::new()
    }
}

/// Tiny profile picture as data URL only. Cap size to keep WS payloads light.
const MAX_AVATAR_CHARS: usize = 48_000;

fn normalize_avatar(raw: &str) -> String {
    let s = raw.trim();
    if s.is_empty() {
        return String::new();
    }
    if s.len() > MAX_AVATAR_CHARS {
        return String::new();
    }
    let lower = s.to_ascii_lowercase();
    let ok = lower.starts_with("data:image/jpeg;base64,")
        || lower.starts_with("data:image/jpg;base64,")
        || lower.starts_with("data:image/png;base64,")
        || lower.starts_with("data:image/webp;base64,");
    if !ok {
        return String::new();
    }
    // Reject obvious non-base64 junk / injection
    if s.chars().any(|c| c.is_control() || c == ' ' || c == '\n' || c == '\r') {
        return String::new();
    }
    s.to_string()
}

/// Soft preference: empty/any accepts all; unknown other gender is allowed (soft).
fn looking_accepts(looking: &str, other_gender: &str) -> bool {
    let l = if looking.is_empty() { "any" } else { looking };
    if l == "any" {
        return true;
    }
    if other_gender.is_empty() {
        return true;
    }
    l == other_gender
}

fn peer_id_hex(id: Uuid) -> String {
    id.as_bytes()
        .iter()
        .fold(String::new(), |mut s, b| {
            use std::fmt::Write;
            let _ = write!(s, "{b:02x}");
            s
        })
}

fn hex_short(bytes: &[u8]) -> String {
    bytes
        .iter()
        .take(8)
        .fold(String::new(), |mut s, b| {
            use std::fmt::Write;
            let _ = write!(s, "{b:02x}");
            s
        })
}

fn display_label(c: &Client) -> String {
    if c.name.is_empty() || c.name == "anon" {
        c.short_id.clone()
    } else {
        c.name.clone()
    }
}

impl SimpleHub {
    pub fn new() -> Self {
        Self::with_limits_and_store(LimitConfig::default(), friends_store::default_path())
    }

    pub fn with_limits(limits: LimitConfig) -> Self {
        Self::with_limits_and_store(limits, friends_store::default_path())
    }

    pub fn with_limits_and_store(limits: LimitConfig, friends_path: PathBuf) -> Self {
        Self::with_limits_store_webhook(limits, friends_path, None)
    }

    pub fn with_limits_store_webhook(
        limits: LimitConfig,
        friends_path: PathBuf,
        mod_webhook_url: Option<String>,
    ) -> Self {
        let stored = friends_store::load(&friends_path);
        if !stored.friendships.is_empty()
            || !stored.code_index.is_empty()
            || !stored.blocks.is_empty()
            || !stored.pending.is_empty()
            || !stored.match_bans.is_empty()
        {
            tracing::info!(
                path = %friends_path.display(),
                friendships = stored.friendships.len(),
                codes = stored.code_index.len(),
                blocks = stored.blocks.values().map(|s| s.len()).sum::<usize>(),
                pending = stored.pending.values().map(|s| s.len()).sum::<usize>(),
                bans = stored.match_bans.len(),
                "loaded friends store"
            );
        }
        let webhook = mod_webhook_url
            .map(|s| s.trim().to_string())
            .filter(|s| s.starts_with("https://"));
        if webhook.is_some() {
            tracing::info!("mod webhook enabled for auto-ban events");
        }
        Self {
            clients: HashMap::new(),
            by_user: HashMap::new(),
            code_index: stored.code_index,
            friendships: stored.friendships,
            known_names: stored.names,
            blocks: stored.blocks,
            pending: stored.pending,
            report_reporters: stored.report_reporters,
            match_bans: stored.match_bans,
            queue: VecDeque::new(),
            limits,
            friends_path,
            mod_webhook_url: webhook,
            fed_sessions: HashMap::new(),
            fed_by_client: HashMap::new(),
            fed_outbox: VecDeque::new(),
        }
    }

    fn fire_mod_webhook(&self, payload: serde_json::Value) {
        let Some(url) = self.mod_webhook_url.clone() else {
            return;
        };
        tokio::spawn(async move {
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(8))
                .build();
            let Ok(client) = client else {
                return;
            };
            let text = payload
                .get("text")
                .and_then(|v| v.as_str())
                .unwrap_or("ruletka auto-ban")
                .to_string();

            // Build provider-shaped bodies:
            // - Telegram: …/botTOKEN/sendMessage?chat_id=ID  → {chat_id, text, disable_web_page_preview}
            // - Discord: hooks.discord.com / discord.com/api/webhooks → {content}
            // - Slack: hooks.slack.com → {text}
            // - Generic: text + content + ruletka JSON
            let body = webhook_body_for_url(&url, &text, &payload);
            match client.post(&url).json(&body).send().await {
                Ok(resp) if !resp.status().is_success() => {
                    let status = resp.status();
                    let body_txt = resp.text().await.unwrap_or_default();
                    tracing::warn!(
                        %status,
                        body = %body_txt.chars().take(200).collect::<String>(),
                        "mod webhook non-success"
                    );
                }
                Err(e) => tracing::warn!(error = %e, "mod webhook post failed"),
                _ => {}
            }
        });
    }

    fn persist_friends(&self) {
        let data = FriendsFile {
            friendships: self.friendships.clone(),
            code_index: self.code_index.clone(),
            names: self.known_names.clone(),
            blocks: self.blocks.clone(),
            pending: self.pending.clone(),
            report_reporters: self.report_reporters.clone(),
            match_bans: self.match_bans.clone(),
        };
        if let Err(e) = friends_store::save(&self.friends_path, &data) {
            tracing::warn!(error = %e, "failed to save friends store");
        }
    }

    fn friend_info_for(&self, fuid: &str) -> FriendInfo {
        let online = self.by_user.contains_key(fuid);
        let (name, code, short) = if let Some(&cid) = self.by_user.get(fuid) {
            let fc = &self.clients[&cid];
            (fc.name.clone(), fc.friend_code.clone(), fc.short_id.clone())
        } else {
            let code = self
                .code_index
                .iter()
                .find(|(_, u)| *u == fuid)
                .map(|(c, _)| c.clone())
                .unwrap_or_default();
            let name = self
                .known_names
                .get(fuid)
                .cloned()
                .filter(|n| !n.is_empty() && n != "anon")
                .unwrap_or_else(|| "friend".into());
            (name, code, fuid.chars().take(8).collect())
        };
        FriendInfo {
            user_id: fuid.to_string(),
            name,
            friend_code: code,
            short_id: short,
            online,
        }
    }

    fn clear_pending_pair(&mut self, a: &str, b: &str) {
        if let Some(set) = self.pending.get_mut(a) {
            set.remove(b);
            if set.is_empty() {
                self.pending.remove(a);
            }
        }
        if let Some(set) = self.pending.get_mut(b) {
            set.remove(a);
            if set.is_empty() {
                self.pending.remove(b);
            }
        }
    }

    fn establish_friendship(&mut self, a: &str, b: &str) {
        self.clear_pending_pair(a, b);
        self.friendships
            .entry(a.to_string())
            .or_default()
            .insert(b.to_string());
        self.friendships
            .entry(b.to_string())
            .or_default()
            .insert(a.to_string());
    }

    /// Either direction: if A blocked B or B blocked A, they must not match.
    fn is_blocked_pair_uid(&self, a: &str, b: &str) -> bool {
        if a.is_empty() || b.is_empty() || a == b {
            return false;
        }
        self.blocks
            .get(a)
            .map(|s| s.contains(b))
            .unwrap_or(false)
            || self
                .blocks
                .get(b)
                .map(|s| s.contains(a))
                .unwrap_or(false)
    }

    fn now_unix() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    }

    /// Temporary matchmaking ban from multi-reporter abuse signal.
    fn is_match_banned(&self, user_id: &str) -> bool {
        if user_id.is_empty() {
            return false;
        }
        match self.match_bans.get(user_id) {
            Some(&until) if until > Self::now_unix() => true,
            _ => false,
        }
    }

    fn is_match_banned_conn(&self, id: Uuid) -> bool {
        self.clients
            .get(&id)
            .map(|c| self.is_match_banned(&c.user_id))
            .unwrap_or(false)
    }

    /// Fallback unique reporters before auto match-ban (generic/other).
    const REPORT_BAN_THRESHOLD: usize = 3;
    /// Default ban length when generic threshold is hit (3 days).
    const REPORT_BAN_SECS: u64 = 3 * 24 * 3600;
    /// Max reports one user may file per rolling hour (anti abuse).
    const REPORT_RATE_PER_HOUR: usize = 12;

    /// Severity → (unique reporters needed, ban duration secs).
    /// Underage: single independent report → long restriction (ops review via log).
    fn report_severity(reason: &str) -> (usize, u64) {
        let r = reason.trim().to_ascii_lowercase();
        match r.as_str() {
            "underage" => (1, 30 * 24 * 3600),
            "explicit" | "explicit_ai" => (2, 7 * 24 * 3600),
            "harassment" | "hate" => (2, 7 * 24 * 3600),
            "spam" | "scam" => (3, 3 * 24 * 3600),
            _ => (Self::REPORT_BAN_THRESHOLD, Self::REPORT_BAN_SECS),
        }
    }

    fn is_blocked_pair_conn(&self, a: Uuid, b: Uuid) -> bool {
        let (Some(ca), Some(cb)) = (self.clients.get(&a), self.clients.get(&b)) else {
            return true;
        };
        self.is_blocked_pair_uid(&ca.user_id, &cb.user_id)
    }

    /// Entries may match only if no member of left is blocked vs any member of right.
    fn entries_compatible(&self, left: &QueueEntry, right: &QueueEntry) -> bool {
        let left_ids: Vec<Uuid> = match left {
            QueueEntry::Solo(id) => vec![*id],
            QueueEntry::Party { a, b } => vec![*a, *b],
        };
        let right_ids: Vec<Uuid> = match right {
            QueueEntry::Solo(id) => vec![*id],
            QueueEntry::Party { a, b } => vec![*a, *b],
        };
        for a in &left_ids {
            if self.is_match_banned_conn(*a) {
                return false;
            }
            for b in &right_ids {
                if self.is_match_banned_conn(*b) {
                    return false;
                }
                if self.is_blocked_pair_conn(*a, *b) {
                    return false;
                }
                // Avoid immediate rematch with last partner (solo↔solo)
                if matches!(left, QueueEntry::Solo(_)) && matches!(right, QueueEntry::Solo(_)) {
                    let last_a = self.clients.get(a).and_then(|c| c.last_partner);
                    let last_b = self.clients.get(b).and_then(|c| c.last_partner);
                    if last_a == Some(*b) || last_b == Some(*a) {
                        return false;
                    }
                }
            }
        }
        true
    }

    /// Soft gender prefs for solo↔solo. Parties always pass (prefers don't apply).
    fn entries_prefs_soft_ok(&self, left: &QueueEntry, right: &QueueEntry) -> bool {
        match (left, right) {
            (QueueEntry::Solo(a), QueueEntry::Solo(b)) => {
                let (Some(ca), Some(cb)) = (self.clients.get(a), self.clients.get(b)) else {
                    return false;
                };
                looking_accepts(&ca.looking, &cb.gender)
                    && looking_accepts(&cb.looking, &ca.gender)
            }
            // Party browse: soft prefs only on the solo stranger vs each party member
            (QueueEntry::Solo(s), QueueEntry::Party { a, b })
            | (QueueEntry::Party { a, b }, QueueEntry::Solo(s)) => {
                let Some(cs) = self.clients.get(s) else {
                    return false;
                };
                for pid in [a, b] {
                    let Some(cp) = self.clients.get(pid) else {
                        return false;
                    };
                    if !looking_accepts(&cs.looking, &cp.gender)
                        || !looking_accepts(&cp.looking, &cs.gender)
                    {
                        return false;
                    }
                }
                true
            }
            _ => true,
        }
    }

    fn deny_if_match_banned(&mut self, id: Uuid) -> bool {
        let banned = self
            .clients
            .get(&id)
            .map(|c| {
                let uid = c.user_id.clone();
                self.is_match_banned(&uid)
            })
            .unwrap_or(false);
        if banned {
            self.send(
                id,
                ServerMsg::Error {
                    message: "temporarily restricted due to multiple reports — try again later"
                        .into(),
                },
            );
            self.status(id, "restricted — cannot match right now");
            true
        } else {
            false
        }
    }

    pub fn friendship_count(&self) -> usize {
        self.friendships.values().map(|s| s.len()).sum::<usize>() / 2
    }

    pub fn block_edge_count(&self) -> usize {
        self.blocks.values().map(|s| s.len()).sum()
    }

    pub fn fed_session_count(&self) -> usize {
        self.fed_sessions.len()
    }

    pub fn online(&self) -> usize {
        self.clients.len()
    }

    pub fn waiting_count(&self) -> usize {
        self.queue.len()
    }

    pub fn waiting_solo_count(&self) -> usize {
        self.queue
            .iter()
            .filter(|e| matches!(e, QueueEntry::Solo(_)))
            .count()
    }

    pub fn federation_info(&self, instance_id: &str, accepts_claims: bool, public_base: &str) -> FederationInfo {
        let mut by_room: HashMap<String, usize> = HashMap::new();
        for e in &self.queue {
            if let QueueEntry::Solo(id) = e {
                if self
                    .clients
                    .get(id)
                    .map(|c| c.phase == Phase::Waiting)
                    .unwrap_or(false)
                {
                    *by_room.entry(self.room_of(*id)).or_default() += 1;
                }
            }
        }
        let mut rooms: Vec<RoomWaiting> = by_room
            .into_iter()
            .map(|(room, waiting_solo)| RoomWaiting { room, waiting_solo })
            .collect();
        rooms.sort_by(|a, b| a.room.cmp(&b.room));
        FederationInfo {
            protocol: PROTOCOL.into(),
            instance_id: instance_id.into(),
            online: self.clients.len(),
            waiting_solo: self.waiting_solo_count(),
            waiting_total: self.queue.len(),
            accepts_claims,
            rooms,
            public_base: public_base.into(),
        }
    }

    pub fn drain_fed_outbox(&mut self) -> Vec<FedOutbound> {
        self.fed_outbox.drain(..).collect()
    }

    /// First solo waiter not already in a fed session (for outbound claim attempts).
    pub fn pick_waiting_solo_for_federation(&self) -> Option<(Uuid, String, FedPeerDesc)> {
        for e in &self.queue {
            if let QueueEntry::Solo(id) = e {
                if self.fed_by_client.contains_key(id) {
                    continue;
                }
                let Some(c) = self.clients.get(id) else { continue };
                if c.phase != Phase::Waiting {
                    continue;
                }
                return Some((
                    *id,
                    c.room.clone(),
                    FedPeerDesc {
                        peer_id: c.peer_id.clone(),
                        short_id: c.short_id.clone(),
                        user_id: c.user_id.clone(),
                        name: display_label(c),
                    },
                ));
            }
        }
        None
    }

    /// Another hub claims one of our waiting solo peers.
    pub fn federation_claim(
        &mut self,
        req: ClaimRequest,
    ) -> Result<ClaimResponse, (u16, String)> {
        let room = normalize_room(&req.room);
        let caller_base = federation::normalize_base(&req.caller_base_url);
        if caller_base.is_empty() {
            return Err((400, "caller_base_url required".into()));
        }
        if req.remote_peer.peer_id.is_empty() {
            return Err((400, "remote_peer.peer_id required".into()));
        }

        // Find first compatible solo waiter in room
        let mut found: Option<Uuid> = None;
        for e in &self.queue {
            if let QueueEntry::Solo(id) = e {
                if self.room_of(*id) != room {
                    continue;
                }
                if self
                    .clients
                    .get(id)
                    .map(|c| c.phase == Phase::Waiting)
                    .unwrap_or(false)
                    && !self.fed_by_client.contains_key(id)
                {
                    found = Some(*id);
                    break;
                }
            }
        }
        let Some(local_id) = found else {
            return Err((404, "no free solo peer".into()));
        };

        let local_desc = {
            let c = self.clients.get(&local_id).unwrap();
            FedPeerDesc {
                peer_id: c.peer_id.clone(),
                short_id: c.short_id.clone(),
                user_id: c.user_id.clone(),
                name: display_label(c),
            }
        };

        let session_id = Uuid::new_v4().to_string();
        let session_key = {
            let mut h = Sha256::new();
            h.update(b"fed-session/");
            h.update(session_id.as_bytes());
            hex_short(&h.finalize())
        };
        let offerer = caller_is_offerer(&req.remote_peer.peer_id, &local_desc.peer_id);

        self.dequeue_client(local_id);
        self.start_federated_match(
            local_id,
            &session_id,
            &session_key,
            &req.remote_peer,
            &caller_base,
            &req.caller_instance_id,
            !offerer, // local is offerer if caller is not
        );

        Ok(ClaimResponse {
            protocol: PROTOCOL.into(),
            session_id,
            session_key,
            claimed_peer: local_desc,
            caller_is_offerer: offerer,
        })
    }

    /// We successfully claimed a peer on a remote hub for our local waiter.
    pub fn federation_apply_claim(
        &mut self,
        local_id: Uuid,
        remote_base: &str,
        remote_instance: &str,
        resp: ClaimResponse,
    ) -> Result<(), String> {
        let Some(c) = self.clients.get(&local_id) else {
            return Err("local client gone".into());
        };
        if c.phase != Phase::Waiting {
            return Err("local not waiting".into());
        }
        if self.fed_by_client.contains_key(&local_id) {
            return Err("already federated".into());
        }
        self.dequeue_client(local_id);
        self.start_federated_match(
            local_id,
            &resp.session_id,
            &resp.session_key,
            &resp.claimed_peer,
            &federation::normalize_base(remote_base),
            remote_instance,
            resp.caller_is_offerer,
        );
        Ok(())
    }

    fn start_federated_match(
        &mut self,
        local_id: Uuid,
        session_id: &str,
        session_key: &str,
        remote: &FedPeerDesc,
        remote_base: &str,
        remote_instance: &str,
        local_is_offerer: bool,
    ) {
        let local_peer_id = self
            .clients
            .get(&local_id)
            .map(|c| c.peer_id.clone())
            .unwrap_or_default();
        let remote_fed = federated_peer_id(session_id, &remote.peer_id);
        let room = self.room_of(local_id);
        let label = if remote.name.is_empty() {
            remote.short_id.clone()
        } else {
            remote.name.clone()
        };

        if let Some(c) = self.clients.get_mut(&local_id) {
            c.phase = Phase::Matched;
            c.partner = None;
            c.session_peers.clear();
            c.session_id = Some(session_id.to_string());
            c.party_with = None;
            c.friend_call = None;
        }

        self.fed_sessions.insert(
            session_id.to_string(),
            FedSession {
                session_id: session_id.to_string(),
                session_key: session_key.to_string(),
                local_client: local_id,
                local_peer_id: local_peer_id.clone(),
                remote_peer_id: remote.peer_id.clone(),
                remote_base_url: remote_base.to_string(),
                remote_instance: remote_instance.to_string(),
            },
        );
        self.fed_by_client
            .insert(local_id, session_id.to_string());

        let peer = MatchPeer {
            peer_id: remote_fed,
            short_id: remote.short_id.clone(),
            user_id: remote.user_id.clone(),
            name: label.clone(),
            is_offerer: local_is_offerer,
            role: "stranger".into(),
            friend_code: String::new(),
            flag: String::new(),
            avatar: String::new(),
        };
        self.send(
            local_id,
            ServerMsg::Matched {
                partner_short: label,
                session_id: session_id.to_string(),
                session_key: session_key.to_string(),
                is_offerer: local_is_offerer,
                room,
                mode: "solo".into(),
                your_role: "solo".into(),
                peers: vec![peer],
            },
        );
        tracing::info!(
            %local_id,
            session = %session_id,
            remote = %remote.short_id,
            "federated match started"
        );
        self.broadcast_lobby_info();
    }

    pub fn federation_relay_inbound(&mut self, req: RelayRequest) -> Result<(), (u16, String)> {
        let Some(sess) = self.fed_sessions.get(&req.session_id) else {
            return Err((404, "unknown session".into()));
        };
        let local_id = sess.local_client;
        if !self.clients.contains_key(&local_id) {
            return Err((404, "local peer offline".into()));
        }
        match req.kind {
            RelayKind::Signal => {
                let from = if req.from_peer.is_empty() {
                    federated_peer_id(&req.session_id, &sess.remote_peer_id)
                } else {
                    req.from_peer.clone()
                };
                self.send(
                    local_id,
                    ServerMsg::Signal {
                        author: req.author.clone(),
                        kind: req.signal_kind.clone(),
                        payload: req.payload.clone(),
                        from_peer: from,
                    },
                );
            }
            RelayKind::Chat => {
                let author = if req.author.is_empty() {
                    "peer".into()
                } else {
                    req.author.clone()
                };
                self.send(
                    local_id,
                    ServerMsg::Chat {
                        author,
                        body: req.body.clone(),
                    },
                );
            }
        }
        Ok(())
    }

    fn clear_fed_for_client(&mut self, id: Uuid) {
        if let Some(sid) = self.fed_by_client.remove(&id) {
            self.fed_sessions.remove(&sid);
        }
    }

    pub fn max_clients(&self) -> usize {
        self.limits.max_clients
    }

    pub fn max_frame_bytes(&self) -> usize {
        self.limits.max_frame_bytes
    }

    fn send(&self, id: Uuid, msg: ServerMsg) {
        if let Some(c) = self.clients.get(&id) {
            let _ = c.out.send(msg);
        }
    }

    fn room_of(&self, id: Uuid) -> String {
        self.clients
            .get(&id)
            .map(|c| c.room.clone())
            .unwrap_or_default()
    }

    fn queue_waiting_in_room(&self, room: &str) -> usize {
        self.queue
            .iter()
            .filter(|e| match e {
                QueueEntry::Solo(id) => self.room_of(*id) == *room,
                QueueEntry::Party { a, .. } => self.room_of(*a) == *room,
            })
            .count()
    }

    fn status(&self, id: Uuid, detail: impl Into<String>) {
        if let Some(c) = self.clients.get(&id) {
            let phase = match c.phase {
                Phase::Idle => "idle",
                Phase::Waiting => "waiting",
                Phase::FriendCall => "friend_call",
                Phase::Matched => "matched",
            };
            let room = c.room.clone();
            let room_waiting = self.queue_waiting_in_room(&room);
            let _ = c.out.send(ServerMsg::Status {
                phase: phase.into(),
                offers: room_waiting,
                detail: detail.into(),
                waiting_peers: room_waiting,
                online: self.clients.len(),
                room,
            });
        }
    }

    fn broadcast_lobby_info(&self) {
        for id in self.clients.keys().copied().collect::<Vec<_>>() {
            let room = self.room_of(id);
            let room_waiting = self.queue_waiting_in_room(&room);
            self.send(
                id,
                ServerMsg::LobbyInfo {
                    waiting_peers: self.queue.len(),
                    online: self.clients.len(),
                    offers: room_waiting,
                    room,
                    room_waiting,
                },
            );
        }
    }

    pub fn try_add_client(
        &mut self,
        id: Uuid,
        out: mpsc::UnboundedSender<ServerMsg>,
    ) -> Result<ServerMsg, String> {
        if self.clients.len() >= self.limits.max_clients {
            return Err(format!(
                "server full (max {} clients)",
                self.limits.max_clients
            ));
        }
        // Temporary until Hello provides user_id
        let peer_id = peer_id_hex(id);
        let short_id = peer_id.chars().take(8).collect::<String>();
        let temp_user = id.to_string();
        let code = friend_code_for(&temp_user);
        self.clients.insert(
            id,
            Client {
                short_id: short_id.clone(),
                peer_id: peer_id.clone(),
                user_id: temp_user.clone(),
                name: "anon".into(),
                friend_code: code.clone(),
                out,
                phase: Phase::Idle,
                partner: None,
                session_peers: HashSet::new(),
                session_id: None,
                last_partner: None,
                room: String::new(),
                friend_call: None,
                party_with: None,
                gender: String::new(),
                looking: "any".into(),
                flag: String::new(),
                avatar: String::new(),
                limiter: ClientLimiter::new(),
                report_times: Vec::new(),
            },
        );
        // by_user/code_index set on Hello with persistent user_id (not ephemeral uuid)
        self.by_user.insert(temp_user.clone(), id);
        Ok(ServerMsg::HelloOk {
            client_id: id.to_string(),
            short_id,
            peer_id,
            user_id: id.to_string(),
            friend_code: code,
            name: "anon".into(),
            media: "webrtc-p2p".into(),
            signaling: "bridge".into(),
        })
    }

    pub fn notify_join(&mut self) {
        self.broadcast_lobby_info();
    }

    pub fn remove_client(&mut self, id: Uuid) {
        self.dequeue_client(id);
        self.clear_fed_for_client(id);
        let (user_id, friend_call, party_with, session_peers, partner) =
            if let Some(c) = self.clients.get(&id) {
                (
                    c.user_id.clone(),
                    c.friend_call,
                    c.party_with,
                    c.session_peers.clone(),
                    c.partner,
                )
            } else {
                return;
            };

        // End friend call
        if let Some(fid) = friend_call {
            self.end_friend_call(fid, "friend disconnected");
        }
        // Dissolve party
        if let Some(pid) = party_with {
            let online = self.clients.len().saturating_sub(1);
            if let Some(p) = self.clients.get_mut(&pid) {
                p.party_with = None;
                if p.phase == Phase::Waiting {
                    p.phase = Phase::Idle;
                }
                let room = p.room.clone();
                let _ = p.out.send(ServerMsg::Status {
                    phase: "idle".into(),
                    offers: 0,
                    detail: "party partner left".into(),
                    waiting_peers: 0,
                    online,
                    room,
                });
            }
            self.dequeue_client(pid);
        }
        // Notify multi-session peers
        for pid in session_peers {
            self.unmatch_one(pid, "partner disconnected — searching again");
        }
        if let Some(pid) = partner {
            if !self
                .clients
                .get(&id)
                .map(|c| c.session_peers.contains(&pid))
                .unwrap_or(false)
            {
                self.unmatch_one(pid, "partner disconnected — searching again");
            }
        }

        if let Some(c) = self.clients.remove(&id) {
            self.by_user.remove(&c.user_id);
            // keep code_index for re-add when they return
            let _ = user_id;
        }
        self.push_friends_presence_related(&[]); // refresh all is heavy; notify friends of this user
        self.notify_friends_of_user(&user_id);
        self.broadcast_lobby_info();
        self.try_match();
    }

    fn notify_friends_of_user(&self, user_id: &str) {
        if let Some(set) = self.friendships.get(user_id) {
            for fid in set {
                if let Some(&cid) = self.by_user.get(fid) {
                    self.push_friends_list(cid);
                }
            }
        }
    }

    fn push_friends_presence_related(&self, _ids: &[Uuid]) {}

    fn push_friends_list(&self, id: Uuid) {
        let Some(c) = self.clients.get(&id) else { return };
        let blocked: Vec<String> = self
            .blocks
            .get(&c.user_id)
            .map(|s| {
                let mut v: Vec<_> = s.iter().cloned().collect();
                v.sort();
                v
            })
            .unwrap_or_default();
        let mut friends = Vec::new();
        if let Some(set) = self.friendships.get(&c.user_id) {
            for fuid in set {
                friends.push(self.friend_info_for(fuid));
            }
        }
        friends.sort_by(|a, b| b.online.cmp(&a.online).then(a.name.cmp(&b.name)));

        // Incoming: others who requested me
        let mut incoming_requests = Vec::new();
        for (from, tos) in &self.pending {
            if tos.contains(&c.user_id) {
                incoming_requests.push(self.friend_info_for(from));
            }
        }
        incoming_requests.sort_by(|a, b| a.name.cmp(&b.name));

        // Outgoing: I requested others
        let mut outgoing_requests = Vec::new();
        if let Some(tos) = self.pending.get(&c.user_id) {
            for to in tos {
                outgoing_requests.push(self.friend_info_for(to));
            }
        }
        outgoing_requests.sort_by(|a, b| a.name.cmp(&b.name));

        self.send(
            id,
            ServerMsg::Friends {
                friends,
                friend_code: c.friend_code.clone(),
                blocked,
                incoming_requests,
                outgoing_requests,
            },
        );
    }

    fn dequeue_client(&mut self, id: Uuid) {
        self.queue.retain(|e| match e {
            QueueEntry::Solo(x) => *x != id,
            QueueEntry::Party { a, b } => *a != id && *b != id,
        });
    }

    fn unmatch_one(&mut self, id: Uuid, detail: &str) {
        self.dequeue_client(id);
        self.clear_fed_for_client(id);
        let party = self.clients.get(&id).and_then(|c| c.party_with);
        if let Some(c) = self.clients.get_mut(&id) {
            c.partner = None;
            c.session_peers.clear();
            c.session_id = None;
            // Stay party if still browsing
            if c.party_with.is_some() {
                c.phase = Phase::Waiting;
            } else if c.friend_call.is_some() {
                c.phase = Phase::FriendCall;
            } else {
                c.phase = Phase::Idle;
            }
        }
        self.status(id, detail);
        // Re-queue party together
        if let Some(pid) = party {
            if self.clients.contains_key(&id) && self.clients.contains_key(&pid) {
                self.enqueue_party(id, pid);
            }
        }
    }

    fn end_friend_call(&mut self, id: Uuid, reason: &str) {
        let other = self.clients.get(&id).and_then(|c| c.friend_call);
        if let Some(c) = self.clients.get_mut(&id) {
            c.friend_call = None;
            c.party_with = None;
            c.partner = None;
            c.session_peers.clear();
            c.phase = Phase::Idle;
        }
        self.dequeue_client(id);
        self.send(
            id,
            ServerMsg::CallEnded {
                reason: reason.into(),
            },
        );
        self.status(id, reason);
        if let Some(oid) = other {
            if let Some(c) = self.clients.get_mut(&oid) {
                c.friend_call = None;
                c.party_with = None;
                c.partner = None;
                c.session_peers.clear();
                c.phase = Phase::Idle;
            }
            self.dequeue_client(oid);
            self.send(
                oid,
                ServerMsg::CallEnded {
                    reason: reason.into(),
                },
            );
            self.status(oid, reason);
        }
    }

    fn make_session_id(parts: &[&str]) -> (String, String) {
        let mut sorted: Vec<&str> = parts.to_vec();
        sorted.sort();
        let mut hasher = Sha256::new();
        hasher.update(b"session/simple/v2");
        for p in &sorted {
            hasher.update(p.as_bytes());
        }
        hasher.update(
            &std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0)
                .to_le_bytes(),
        );
        let digest = hasher.finalize();
        let session_id = digest.iter().map(|b| format!("{b:02x}")).collect::<String>();
        (session_id.clone(), format!("simple:{session_id}"))
    }

    fn match_peer(from: &Client, to: &Client, role: &str) -> MatchPeer {
        MatchPeer {
            peer_id: to.peer_id.clone(),
            short_id: to.short_id.clone(),
            user_id: to.user_id.clone(),
            name: to.name.clone(),
            is_offerer: from.peer_id < to.peer_id,
            role: role.into(),
            friend_code: to.friend_code.clone(),
            flag: to.flag.clone(),
            avatar: to.avatar.clone(),
        }
    }

    fn start_friend_session(&mut self, a: Uuid, b: Uuid) {
        let (session_id, session_key) = {
            let ca = self.clients.get(&a).unwrap();
            let cb = self.clients.get(&b).unwrap();
            Self::make_session_id(&[&ca.peer_id, &cb.peer_id])
        };

        for (me, them) in [(a, b), (b, a)] {
            let (peer, label) = {
                let ca = self.clients.get(&me).unwrap();
                let cb = self.clients.get(&them).unwrap();
                (Self::match_peer(ca, cb, "friend"), display_label(cb))
            };
            if let Some(c) = self.clients.get_mut(&me) {
                c.phase = Phase::FriendCall;
                c.friend_call = Some(them);
                c.partner = Some(them);
                c.session_peers = HashSet::from([them]);
                c.session_id = Some(session_id.clone());
                c.party_with = None;
            }
            let offerer = peer.is_offerer;
            self.send(
                me,
                ServerMsg::Matched {
                    partner_short: label,
                    session_id: session_id.clone(),
                    session_key: session_key.clone(),
                    is_offerer: offerer,
                    room: self.room_of(me),
                    mode: "friend".into(),
                    your_role: "friend".into(),
                    peers: vec![peer],
                },
            );
        }
        tracing::info!(%a, %b, "friend call started");
    }

    fn start_party_vs_solo(&mut self, solo: Uuid, a: Uuid, b: Uuid) {
        let room = self.room_of(solo);
        let (session_id, session_key) = {
            let cs = self.clients.get(&solo).unwrap();
            let ca = self.clients.get(&a).unwrap();
            let cb = self.clients.get(&b).unwrap();
            Self::make_session_id(&[&cs.peer_id, &ca.peer_id, &cb.peer_id, "party"])
        };

        // Solo peers: A and B as strangers (party members)
        let solo_peers = {
            let cs = self.clients.get(&solo).unwrap();
            let ca = self.clients.get(&a).unwrap();
            let cb = self.clients.get(&b).unwrap();
            vec![
                Self::match_peer(cs, ca, "party"),
                Self::match_peer(cs, cb, "party"),
            ]
        };
        // Party member A: stranger + friend B (friend already connected — still list for demux)
        let a_peers = {
            let ca = self.clients.get(&a).unwrap();
            let cs = self.clients.get(&solo).unwrap();
            let cb = self.clients.get(&b).unwrap();
            vec![
                Self::match_peer(ca, cs, "stranger"),
                Self::match_peer(ca, cb, "friend"),
            ]
        };
        let b_peers = {
            let cb = self.clients.get(&b).unwrap();
            let cs = self.clients.get(&solo).unwrap();
            let ca = self.clients.get(&a).unwrap();
            vec![
                Self::match_peer(cb, cs, "stranger"),
                Self::match_peer(cb, ca, "friend"),
            ]
        };

        let set_matched = |clients: &mut HashMap<Uuid, Client>,
                           id: Uuid,
                           peers: &[Uuid],
                           party: Option<Uuid>| {
            if let Some(c) = clients.get_mut(&id) {
                c.phase = Phase::Matched;
                c.session_id = Some(session_id.clone());
                c.session_peers = peers.iter().copied().collect();
                c.partner = peers.first().copied();
                c.party_with = party;
            }
        };
        set_matched(&mut self.clients, solo, &[a, b], None);
        set_matched(&mut self.clients, a, &[solo, b], Some(b));
        set_matched(&mut self.clients, b, &[solo, a], Some(a));

        let partner_short_solo = format!(
            "{}+{}",
            display_label(&self.clients[&a]),
            display_label(&self.clients[&b])
        );
        self.send(
            solo,
            ServerMsg::Matched {
                partner_short: partner_short_solo,
                session_id: session_id.clone(),
                session_key: session_key.clone(),
                is_offerer: solo_peers.iter().any(|p| p.is_offerer),
                room: room.clone(),
                mode: "party_browse".into(),
                your_role: "solo".into(),
                peers: solo_peers,
            },
        );
        self.send(
            a,
            ServerMsg::Matched {
                partner_short: display_label(&self.clients[&solo]),
                session_id: session_id.clone(),
                session_key: session_key.clone(),
                is_offerer: a_peers.iter().any(|p| p.is_offerer && p.role == "stranger"),
                room: room.clone(),
                mode: "party_browse".into(),
                your_role: "party".into(),
                peers: a_peers,
            },
        );
        self.send(
            b,
            ServerMsg::Matched {
                partner_short: display_label(&self.clients[&solo]),
                session_id,
                session_key,
                is_offerer: b_peers.iter().any(|p| p.is_offerer && p.role == "stranger"),
                room,
                mode: "party_browse".into(),
                your_role: "party".into(),
                peers: b_peers,
            },
        );
        tracing::info!(%solo, %a, %b, "party vs solo matched");
        self.broadcast_lobby_info();
    }

    fn start_solo_match(&mut self, a: Uuid, b: Uuid) {
        let room = self.room_of(a);
        let (session_id, session_key) = {
            let ca = self.clients.get(&a).unwrap();
            let cb = self.clients.get(&b).unwrap();
            Self::make_session_id(&[&ca.peer_id, &cb.peer_id])
        };
        for (me, them) in [(a, b), (b, a)] {
            let (peer, label) = {
                let ca = self.clients.get(&me).unwrap();
                let cb = self.clients.get(&them).unwrap();
                (Self::match_peer(ca, cb, "stranger"), display_label(cb))
            };
            if let Some(c) = self.clients.get_mut(&me) {
                c.phase = Phase::Matched;
                c.partner = Some(them);
                c.session_peers = HashSet::from([them]);
                c.session_id = Some(session_id.clone());
                c.last_partner = Some(them);
            }
            let offerer = peer.is_offerer;
            self.send(
                me,
                ServerMsg::Matched {
                    partner_short: label,
                    session_id: session_id.clone(),
                    session_key: session_key.clone(),
                    is_offerer: offerer,
                    room: room.clone(),
                    mode: "solo".into(),
                    your_role: "solo".into(),
                    peers: vec![peer],
                },
            );
        }
        tracing::info!(%a, %b, "solo matched");
        self.broadcast_lobby_info();
    }

    fn enqueue_solo(&mut self, id: Uuid) {
        self.dequeue_client(id);
        if !self.queue.iter().any(|e| matches!(e, QueueEntry::Solo(x) if *x == id)) {
            self.queue.push_back(QueueEntry::Solo(id));
        }
    }

    fn enqueue_party(&mut self, a: Uuid, b: Uuid) {
        self.dequeue_client(a);
        self.dequeue_client(b);
        // canonical order
        let (a, b) = if a.as_bytes() < b.as_bytes() {
            (a, b)
        } else {
            (b, a)
        };
        self.queue.push_back(QueueEntry::Party { a, b });
        if let Some(c) = self.clients.get_mut(&a) {
            c.phase = Phase::Waiting;
            c.party_with = Some(b);
        }
        if let Some(c) = self.clients.get_mut(&b) {
            c.phase = Phase::Waiting;
            c.party_with = Some(a);
        }
    }

    fn try_match(&mut self) {
        let mut steps = self.queue.len().saturating_mul(4).max(8);
        while self.queue.len() >= 1 && steps > 0 {
            steps -= 1;
            let Some(first) = self.queue.pop_front() else { break };

            // Validate first entry still waiting
            let first_ok = match &first {
                QueueEntry::Solo(id) => self
                    .clients
                    .get(id)
                    .map(|c| c.phase == Phase::Waiting)
                    .unwrap_or(false),
                QueueEntry::Party { a, b } => {
                    self.clients
                        .get(a)
                        .map(|c| c.phase == Phase::Waiting)
                        .unwrap_or(false)
                        && self
                            .clients
                            .get(b)
                            .map(|c| c.phase == Phase::Waiting)
                            .unwrap_or(false)
                }
            };
            if !first_ok {
                continue;
            }

            let room = match &first {
                QueueEntry::Solo(id) => self.room_of(*id),
                QueueEntry::Party { a, .. } => self.room_of(*a),
            };

            // Find compatible second entry — prefer soft gender prefs, then any
            let mut found_idx = None;
            let mut found_fallback = None;
            for (i, e) in self.queue.iter().enumerate() {
                let eroom = match e {
                    QueueEntry::Solo(id) => self.room_of(*id),
                    QueueEntry::Party { a, .. } => self.room_of(*a),
                };
                if eroom != room {
                    continue;
                }
                let ok = match e {
                    QueueEntry::Solo(id) => self
                        .clients
                        .get(id)
                        .map(|c| c.phase == Phase::Waiting)
                        .unwrap_or(false),
                    QueueEntry::Party { a, b } => {
                        self.clients
                            .get(a)
                            .map(|c| c.phase == Phase::Waiting)
                            .unwrap_or(false)
                            && self
                                .clients
                                .get(b)
                                .map(|c| c.phase == Phase::Waiting)
                                .unwrap_or(false)
                    }
                };
                if !ok {
                    continue;
                }
                // Party only matches solo (not another party)
                match (&first, e) {
                    (QueueEntry::Party { .. }, QueueEntry::Party { .. }) => continue,
                    _ => {
                        if !self.entries_compatible(&first, e) {
                            continue;
                        }
                        if self.entries_prefs_soft_ok(&first, e) {
                            found_idx = Some(i);
                            break;
                        }
                        if found_fallback.is_none() {
                            found_fallback = Some(i);
                        }
                    }
                }
            }
            if found_idx.is_none() {
                found_idx = found_fallback;
            }

            let Some(i) = found_idx else {
                self.queue.push_back(first);
                if steps < self.queue.len() {
                    break;
                }
                continue;
            };
            let second = self.queue.remove(i).unwrap();

            match (first, second) {
                (QueueEntry::Solo(a), QueueEntry::Solo(b)) => {
                    self.start_solo_match(a, b);
                }
                (QueueEntry::Solo(s), QueueEntry::Party { a, b })
                | (QueueEntry::Party { a, b }, QueueEntry::Solo(s)) => {
                    self.start_party_vs_solo(s, a, b);
                }
                (QueueEntry::Party { a, b }, QueueEntry::Party { .. }) => {
                    // Shouldn't happen; requeue first party
                    self.queue.push_back(QueueEntry::Party { a, b });
                }
            }
        }
    }

    fn enter_waiting_solo(&mut self, id: Uuid, room: String, detail: &str) {
        // Leave matches but keep friend call? Solo spin leaves friend call.
        if self.clients.get(&id).and_then(|c| c.friend_call).is_some() {
            self.end_friend_call(id, "left friend call to browse alone");
        }
        self.clear_match_state(id);
        if let Some(c) = self.clients.get_mut(&id) {
            c.room = room;
            c.phase = Phase::Waiting;
            c.party_with = None;
        }
        self.enqueue_solo(id);
        self.status(id, detail);
        self.broadcast_lobby_info();
        self.try_match();
    }

    fn clear_match_state(&mut self, id: Uuid) {
        self.clear_match_state_with_partner_msg(id, "partner hit Next — searching again");
    }

    fn clear_match_state_with_partner_msg(&mut self, id: Uuid, partner_msg: &str) {
        let peers: Vec<Uuid> = self
            .clients
            .get(&id)
            .map(|c| c.session_peers.iter().copied().collect())
            .unwrap_or_default();
        self.dequeue_client(id);
        self.clear_fed_for_client(id);
        if let Some(c) = self.clients.get_mut(&id) {
            c.partner = None;
            c.session_peers.clear();
            c.session_id = None;
            if c.phase == Phase::Matched || c.phase == Phase::Waiting {
                c.phase = Phase::Idle;
            }
        }
        for p in peers {
            // Don't tear down friend-call media to party mate mid requeue carefully
            let is_friend = self.clients.get(&id).and_then(|c| c.friend_call) == Some(p)
                || self.clients.get(&id).and_then(|c| c.party_with) == Some(p);
            if is_friend {
                continue;
            }
            self.unmatch_one(p, partner_msg);
        }
    }

    /// Leave waiting queue and/or stranger match; do not re-queue.
    fn stop_matchmaking(&mut self, id: Uuid) {
        if self.clients.get(&id).and_then(|c| c.friend_call).is_some() {
            self.end_friend_call(id, "stopped");
        }
        if self.clients.get(&id).and_then(|c| c.party_with).is_some() {
            // Drop party link and leave stranger queue/match
            if let Some(c) = self.clients.get_mut(&id) {
                c.party_with = None;
            }
        }
        self.clear_match_state_with_partner_msg(id, "partner stopped");
        if let Some(c) = self.clients.get_mut(&id) {
            c.phase = Phase::Idle;
            c.party_with = None;
            c.friend_call = None;
        }
        self.status(id, "stopped — idle");
        self.broadcast_lobby_info();
    }

    pub fn handle(&mut self, id: Uuid, msg: ClientMsg) {
        if let Some(c) = self.clients.get_mut(&id) {
            if !c.limiter.allow_message(&self.limits) {
                let _ = c.out.send(ServerMsg::Error {
                    message: "rate limited — slow down".into(),
                });
                return;
            }
        } else {
            return;
        }

        match msg {
            ClientMsg::Hello {
                user_id,
                name,
                gender,
                looking,
                flag,
                avatar,
            } => {
                self.handle_hello(id, user_id, name, gender, looking, flag, avatar);
            }
            ClientMsg::SetPrefs {
                gender,
                looking,
                flag,
                avatar,
            } => {
                self.handle_set_prefs(id, gender, looking, flag, avatar);
            }
            ClientMsg::Ping => self.send(id, ServerMsg::Pong),
            ClientMsg::SetRoom { room } => {
                let room = normalize_room(&room);
                if let Some(c) = self.clients.get_mut(&id) {
                    if c.phase == Phase::Matched {
                        self.send(
                            id,
                            ServerMsg::Error {
                                message: "leave match before changing room".into(),
                            },
                        );
                        return;
                    }
                    c.room = room;
                }
                self.status(id, "room set");
                self.broadcast_lobby_info();
            }
            ClientMsg::Spin { room } => {
                if self.deny_if_match_banned(id) {
                    return;
                }
                if !self.allow_match_cmd(id) {
                    return;
                }
                let room = if room.trim().is_empty() {
                    self.room_of(id)
                } else {
                    normalize_room(&room)
                };
                // If in party, spin as party
                if let Some(pid) = self.clients.get(&id).and_then(|c| c.party_with) {
                    self.party_requeue(id, pid, room, "party spun into lobby");
                } else {
                    self.enter_waiting_solo(id, room, "spun into lobby");
                }
            }
            ClientMsg::Next { room } => {
                if self.deny_if_match_banned(id) {
                    return;
                }
                if !self.allow_match_cmd(id) {
                    return;
                }
                let room = if room.trim().is_empty() {
                    self.room_of(id)
                } else {
                    normalize_room(&room)
                };
                if let Some(pid) = self.clients.get(&id).and_then(|c| c.party_with) {
                    // Next as party: leave stranger, requeue party
                    self.party_leave_stranger_and_requeue(id, pid, room);
                } else if self.clients.get(&id).and_then(|c| c.friend_call).is_some() {
                    // In friend call without party — just stay
                    self.status(id, "in friend call — use Browse together");
                } else {
                    self.enter_waiting_solo(id, room, "next — searching again");
                }
            }
            ClientMsg::Stop => {
                self.stop_matchmaking(id);
            }
            ClientMsg::BrowseTogether { room } => {
                let room = if room.trim().is_empty() {
                    self.room_of(id)
                } else {
                    normalize_room(&room)
                };
                let Some(fid) = self.clients.get(&id).and_then(|c| c.friend_call) else {
                    self.send(
                        id,
                        ServerMsg::Error {
                            message: "call a friend first".into(),
                        },
                    );
                    return;
                };
                // Confirm mutual friend call
                if self.clients.get(&fid).and_then(|c| c.friend_call) != Some(id) {
                    self.send(
                        id,
                        ServerMsg::Error {
                            message: "friend call not active".into(),
                        },
                    );
                    return;
                }
                if let Some(c) = self.clients.get_mut(&id) {
                    c.room = room.clone();
                }
                if let Some(c) = self.clients.get_mut(&fid) {
                    c.room = room.clone();
                }
                self.enqueue_party(id, fid);
                self.status(id, "browsing together — searching");
                self.status(fid, "browsing together — searching");
                self.broadcast_lobby_info();
                self.try_match();
            }
            ClientMsg::AddFriend { code } => self.handle_add_friend(id, code),
            ClientMsg::AcceptFriend { user_id } => self.handle_accept_friend(id, user_id),
            ClientMsg::DeclineFriend { user_id } => self.handle_decline_friend(id, user_id),
            ClientMsg::RemoveFriend { user_id } => self.handle_remove_friend(id, user_id),
            ClientMsg::BlockUser { user_id } => self.handle_block_user(id, user_id),
            ClientMsg::UnblockUser { user_id } => self.handle_unblock_user(id, user_id),
            ClientMsg::ReportUser { user_id, reason } => {
                self.handle_report_user(id, user_id, reason)
            }
            ClientMsg::CallFriend { user_id } => self.handle_call_friend(id, user_id),
            ClientMsg::CallRespond { user_id, accept } => {
                self.handle_call_respond(id, user_id, accept)
            }
            ClientMsg::HangupFriend => {
                if self.clients.get(&id).and_then(|c| c.friend_call).is_some() {
                    self.end_friend_call(id, "friend hung up");
                } else {
                    self.status(id, "not in a friend call");
                }
            }
            ClientMsg::Chat { body } => self.handle_chat(id, body),
            ClientMsg::Signal { kind, payload, to } => self.handle_signal(id, kind, payload, to),
        }
    }

    fn allow_match_cmd(&mut self, id: Uuid) -> bool {
        if let Some(c) = self.clients.get_mut(&id) {
            if !c.limiter.allow_match_cmd(&self.limits) {
                self.send(
                    id,
                    ServerMsg::Error {
                        message: "rate limited — too many spin/next".into(),
                    },
                );
                return false;
            }
        }
        true
    }

    fn party_requeue(&mut self, a: Uuid, b: Uuid, room: String, detail: &str) {
        // Clear stranger sessions only
        for id in [a, b] {
            let strangers: Vec<Uuid> = self
                .clients
                .get(&id)
                .map(|c| {
                    c.session_peers
                        .iter()
                        .copied()
                        .filter(|p| Some(*p) != c.party_with && Some(*p) != c.friend_call)
                        .collect()
                })
                .unwrap_or_default();
            for s in strangers {
                self.unmatch_one(s, "party moved on — searching again");
            }
            if let Some(c) = self.clients.get_mut(&id) {
                c.room = room.clone();
                // Keep friend session peers
                if let Some(f) = c.friend_call {
                    c.session_peers = HashSet::from([f]);
                    c.partner = Some(f);
                }
            }
        }
        self.enqueue_party(a, b);
        self.status(a, detail);
        self.status(b, detail);
        self.broadcast_lobby_info();
        self.try_match();
    }

    fn party_leave_stranger_and_requeue(&mut self, a: Uuid, b: Uuid, room: String) {
        self.party_requeue(a, b, room, "next together — searching again");
    }

    fn handle_set_prefs(
        &mut self,
        id: Uuid,
        gender: String,
        looking: String,
        flag: String,
        avatar: String,
    ) {
        let g = normalize_gender(&gender);
        let l = normalize_looking(&looking);
        let f = normalize_flag(&flag);
        let a = normalize_avatar(&avatar);
        if let Some(c) = self.clients.get_mut(&id) {
            c.gender = g;
            c.looking = l;
            c.flag = f;
            c.avatar = a;
        }
        self.status(id, "match prefs updated");
        // Re-try match if waiting — soft prefs may unlock a pair
        if self
            .clients
            .get(&id)
            .map(|c| c.phase == Phase::Waiting)
            .unwrap_or(false)
        {
            self.try_match();
        }
    }

    fn handle_hello(
        &mut self,
        id: Uuid,
        user_id: String,
        name: String,
        gender: String,
        looking: String,
        flag: String,
        avatar: String,
    ) {
        let user_id = if user_id.trim().is_empty() {
            id.to_string()
        } else {
            user_id.trim().chars().take(64).collect()
        };
        let name = normalize_name(&name);
        let code = friend_code_for(&user_id);
        let gender = normalize_gender(&gender);
        let looking = normalize_looking(&looking);
        let flag = normalize_flag(&flag);
        let avatar = normalize_avatar(&avatar);

        // Kick previous connection for same user
        if let Some(old) = self.by_user.get(&user_id).copied() {
            if old != id {
                self.remove_client(old);
            }
        }

        let old_user = self.clients.get(&id).map(|c| c.user_id.clone());
        let ephemeral = id.to_string();
        if let Some(ref ou) = old_user {
            if ou != &user_id {
                self.by_user.remove(ou);
            }
        }
        // Drop ephemeral connection-uuid codes so invites always use stable user codes
        self.code_index.retain(|_, u| u != &ephemeral);
        if let Some(ref ou) = old_user {
            if ou != &user_id {
                self.code_index.retain(|_, u| u != ou);
            }
        }

        if let Some(c) = self.clients.get_mut(&id) {
            c.user_id = user_id.clone();
            c.name = name.clone();
            c.friend_code = code.clone();
            c.gender = gender;
            c.looking = looking;
            c.flag = flag;
            c.avatar = avatar;
        }
        self.by_user.insert(user_id.clone(), id);
        self.code_index.insert(code.clone(), user_id.clone());
        if !name.is_empty() && name != "anon" {
            self.known_names.insert(user_id.clone(), name.clone());
        }
        self.persist_friends();

        let peer_id = self.clients[&id].peer_id.clone();
        let short_id = self.clients[&id].short_id.clone();
        self.send(
            id,
            ServerMsg::HelloOk {
                client_id: id.to_string(),
                short_id,
                peer_id,
                user_id: user_id.clone(),
                friend_code: code,
                name,
                media: "webrtc-p2p".into(),
                signaling: "bridge".into(),
            },
        );
        self.push_friends_list(id);
        self.notify_friends_of_user(&user_id);
        self.broadcast_lobby_info();
    }

    fn handle_add_friend(&mut self, id: Uuid, code: String) {
        let code = code.trim().to_uppercase().replace('-', "");
        let Some(c) = self.clients.get(&id) else { return };
        let me = c.user_id.clone();
        let my_name = c.name.clone();
        let my_code = c.friend_code.clone();
        if code == c.friend_code {
            self.send(
                id,
                ServerMsg::Error {
                    message: "cannot add yourself".into(),
                },
            );
            return;
        }
        let Some(other_uid) = self.code_index.get(&code).cloned() else {
            self.send(
                id,
                ServerMsg::Error {
                    message: "unknown friend code (friend must connect once)".into(),
                },
            );
            return;
        };
        if self.is_blocked_pair_uid(&me, &other_uid) {
            self.send(
                id,
                ServerMsg::Error {
                    message: "cannot add — user is blocked (unblock first)".into(),
                },
            );
            return;
        }
        if self
            .friendships
            .get(&me)
            .map(|s| s.contains(&other_uid))
            .unwrap_or(false)
        {
            self.status(id, "already friends");
            self.push_friends_list(id);
            return;
        }
        // remember names
        if !my_name.is_empty() && my_name != "anon" {
            self.known_names.insert(me.clone(), my_name.clone());
        }
        if let Some(&oid) = self.by_user.get(&other_uid) {
            if let Some(c) = self.clients.get(&oid) {
                if !c.name.is_empty() {
                    self.known_names.insert(other_uid.clone(), c.name.clone());
                }
            }
        }

        // Reciprocal: they already requested us → auto-accept both ways
        let they_requested = self
            .pending
            .get(&other_uid)
            .map(|s| s.contains(&me))
            .unwrap_or(false);
        if they_requested {
            self.establish_friendship(&me, &other_uid);
            self.persist_friends();
            self.push_friends_list(id);
            if let Some(&oid) = self.by_user.get(&other_uid) {
                self.push_friends_list(oid);
            }
            self.status(id, "friend added");
            if let Some(&oid) = self.by_user.get(&other_uid) {
                self.status(oid, "friend added");
            }
            return;
        }

        // Already pending from us?
        if self
            .pending
            .get(&me)
            .map(|s| s.contains(&other_uid))
            .unwrap_or(false)
        {
            self.status(id, "friend request already sent");
            self.push_friends_list(id);
            return;
        }

        self.pending
            .entry(me.clone())
            .or_default()
            .insert(other_uid.clone());
        self.persist_friends();
        self.push_friends_list(id);
        if let Some(&oid) = self.by_user.get(&other_uid) {
            self.push_friends_list(oid);
            self.send(
                oid,
                ServerMsg::FriendRequest {
                    from_user_id: me.clone(),
                    from_name: if my_name.is_empty() {
                        my_code.clone()
                    } else {
                        my_name
                    },
                    from_code: my_code,
                },
            );
        }
        self.status(id, "friend request sent");
    }

    fn handle_accept_friend(&mut self, id: Uuid, user_id: String) {
        let user_id = user_id.trim().to_string();
        let Some(me) = self.clients.get(&id).map(|c| c.user_id.clone()) else {
            return;
        };
        let has = self
            .pending
            .get(&user_id)
            .map(|s| s.contains(&me))
            .unwrap_or(false);
        if !has {
            self.send(
                id,
                ServerMsg::Error {
                    message: "no pending request from that user".into(),
                },
            );
            return;
        }
        if self.is_blocked_pair_uid(&me, &user_id) {
            self.send(
                id,
                ServerMsg::Error {
                    message: "cannot accept — user is blocked".into(),
                },
            );
            return;
        }
        self.establish_friendship(&me, &user_id);
        self.persist_friends();
        self.push_friends_list(id);
        if let Some(&oid) = self.by_user.get(&user_id) {
            self.push_friends_list(oid);
            self.status(oid, "friend request accepted");
        }
        self.status(id, "friend added");
    }

    fn handle_decline_friend(&mut self, id: Uuid, user_id: String) {
        let user_id = user_id.trim().to_string();
        let Some(me) = self.clients.get(&id).map(|c| c.user_id.clone()) else {
            return;
        };
        // Cancel outgoing or decline incoming
        self.clear_pending_pair(&me, &user_id);
        self.persist_friends();
        self.push_friends_list(id);
        if let Some(&oid) = self.by_user.get(&user_id) {
            self.push_friends_list(oid);
        }
        self.status(id, "friend request declined");
    }

    fn handle_remove_friend(&mut self, id: Uuid, user_id: String) {
        let Some(me) = self.clients.get(&id).map(|c| c.user_id.clone()) else {
            return;
        };
        if let Some(set) = self.friendships.get_mut(&me) {
            set.remove(&user_id);
        }
        if let Some(set) = self.friendships.get_mut(&user_id) {
            set.remove(&me);
        }
        self.clear_pending_pair(&me, &user_id);
        self.persist_friends();
        self.push_friends_list(id);
        if let Some(&oid) = self.by_user.get(&user_id) {
            self.push_friends_list(oid);
        }
        self.status(id, "friend removed");
    }

    fn handle_report_user(&mut self, id: Uuid, user_id: String, reason: String) {
        let user_id = user_id.trim().to_string();
        let reason = reason.trim().chars().take(64).collect::<String>();
        if user_id.is_empty() {
            return;
        }
        let Some(reporter) = self.clients.get(&id).map(|c| {
            (
                c.user_id.clone(),
                c.name.clone(),
                c.short_id.clone(),
            )
        }) else {
            return;
        };
        if reporter.0 == user_id {
            self.send(
                id,
                ServerMsg::Error {
                    message: "cannot report yourself".into(),
                },
            );
            return;
        }

        // Rate-limit reporters so ban-bombing is harder
        if let Some(c) = self.clients.get_mut(&id) {
            let now = Instant::now();
            c.report_times
                .retain(|t| now.duration_since(*t) < Duration::from_secs(3600));
            if c.report_times.len() >= Self::REPORT_RATE_PER_HOUR {
                self.send(
                    id,
                    ServerMsg::Error {
                        message: "too many reports — try again later".into(),
                    },
                );
                return;
            }
            c.report_times.push(now);
        }

        let target_name = self
            .by_user
            .get(&user_id)
            .and_then(|tid| self.clients.get(tid))
            .map(|c| c.name.clone())
            .unwrap_or_default();
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let reason_s = if reason.is_empty() {
            "other".to_string()
        } else {
            reason
        };
        let (threshold, ban_secs) = Self::report_severity(&reason_s);
        let is_ai = reason_s.eq_ignore_ascii_case("explicit_ai");

        // Unique reporters → auto match-ban after severity threshold
        let reporters = self.report_reporters.entry(user_id.clone()).or_default();
        reporters.insert(reporter.0.clone());
        let report_count = reporters.len();
        // AI-only signals need one extra unique reporter (reduces false-positive bans)
        let effective_threshold = if is_ai {
            threshold.saturating_add(1)
        } else {
            threshold
        };
        let mut banned = false;
        if report_count >= effective_threshold {
            let until = Self::now_unix().saturating_add(ban_secs);
            let prev = self.match_bans.get(&user_id).copied().unwrap_or(0);
            if until > prev {
                self.match_bans.insert(user_id.clone(), until);
                banned = true;
                tracing::warn!(
                    target = %user_id,
                    reporters = report_count,
                    threshold = effective_threshold,
                    reason = %reason_s,
                    until,
                    "auto match-ban after reports"
                );
                let short = if user_id.len() > 14 {
                    format!("{}…", &user_id[..12])
                } else {
                    user_id.clone()
                };
                self.fire_mod_webhook(serde_json::json!({
                    "event": "auto_ban",
                    "text": format!(
                        "ruletka auto-ban: {short} reason={reason_s} reporters={report_count} ban_secs={ban_secs}"
                    ),
                    "target_user_id": user_id,
                    "target_name": target_name,
                    "reason": reason_s,
                    "unique_reporters": report_count,
                    "threshold": effective_threshold,
                    "ban_secs": ban_secs,
                    "until": until,
                    "ai_assisted": is_ai,
                }));
            }
        }
        self.persist_friends();

        let line = serde_json::json!({
            "t": now_ms,
            "reporter_user_id": reporter.0,
            "reporter_name": reporter.1,
            "reporter_short": reporter.2,
            "target_user_id": user_id,
            "target_name": target_name,
            "reason": reason_s,
            "unique_reporters": report_count,
            "threshold": effective_threshold,
            "ai_assisted": is_ai,
            "auto_banned": banned,
            "ban_secs": if banned { ban_secs } else { 0 },
        });
        tracing::warn!(%line, "user report");
        if let Some(path) = self.reports_path() {
            if let Ok(mut f) = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&path)
            {
                use std::io::Write;
                let _ = writeln!(f, "{line}");
            }
        }
        // If target is online and newly banned, kick them out of queue/match
        if banned {
            if let Some(&tid) = self.by_user.get(&user_id) {
                self.dequeue_client(tid);
                if self.clients.get(&tid).map(|c| c.phase == Phase::Matched).unwrap_or(false) {
                    self.unmatch_one(tid, "restricted due to reports");
                }
                self.status(tid, "temporarily restricted due to reports");
            }
        }
        self.status(
            id,
            if banned {
                "report received — user restricted"
            } else {
                "report received — thank you"
            },
        );
    }

    fn reports_path(&self) -> Option<std::path::PathBuf> {
        let base = self
            .friends_path
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| std::path::PathBuf::from("data"));
        Some(base.join("reports.jsonl"))
    }

    pub fn reports_file_path(&self) -> std::path::PathBuf {
        self.reports_path()
            .unwrap_or_else(|| std::path::PathBuf::from("data/reports.jsonl"))
    }

    /// Active match bans: user_id → until_unix_secs
    pub fn admin_bans(&self) -> Vec<serde_json::Value> {
        let now = Self::now_unix();
        let mut out: Vec<serde_json::Value> = self
            .match_bans
            .iter()
            .filter(|(_, until)| **until > now)
            .map(|(uid, until)| {
                let name = self.known_names.get(uid).cloned().unwrap_or_default();
                let reporters = self
                    .report_reporters
                    .get(uid)
                    .map(|s| s.len())
                    .unwrap_or(0);
                serde_json::json!({
                    "user_id": uid,
                    "name": name,
                    "until": until,
                    "remaining_secs": until.saturating_sub(now),
                    "unique_reporters": reporters,
                })
            })
            .collect();
        out.sort_by(|a, b| {
            let au = a.get("until").and_then(|v| v.as_u64()).unwrap_or(0);
            let bu = b.get("until").and_then(|v| v.as_u64()).unwrap_or(0);
            bu.cmp(&au)
        });
        out
    }

    pub fn admin_unban(&mut self, user_id: &str) -> bool {
        let user_id = user_id.trim();
        if user_id.is_empty() {
            return false;
        }
        let removed = self.match_bans.remove(user_id).is_some();
        // Keep report history; operator can re-ban if needed
        if removed {
            self.persist_friends();
            tracing::info!(%user_id, "admin unban");
        }
        removed
    }

    /// Manual match ban (seconds from now).
    pub fn admin_ban(&mut self, user_id: &str, secs: u64) -> bool {
        let user_id = user_id.trim().to_string();
        if user_id.is_empty() {
            return false;
        }
        let until = Self::now_unix().saturating_add(secs.max(60));
        self.match_bans.insert(user_id.clone(), until);
        self.persist_friends();
        if let Some(&tid) = self.by_user.get(&user_id) {
            self.dequeue_client(tid);
            if self
                .clients
                .get(&tid)
                .map(|c| c.phase == Phase::Matched)
                .unwrap_or(false)
            {
                self.unmatch_one(tid, "restricted by operator");
            }
            self.status(tid, "temporarily restricted");
        }
        tracing::warn!(%user_id, until, "admin ban");
        true
    }

    pub fn admin_report_targets(&self) -> Vec<serde_json::Value> {
        let now = Self::now_unix();
        let mut out: Vec<_> = self
            .report_reporters
            .iter()
            .map(|(uid, set)| {
                let banned_until = self.match_bans.get(uid).copied().unwrap_or(0);
                serde_json::json!({
                    "user_id": uid,
                    "name": self.known_names.get(uid).cloned().unwrap_or_default(),
                    "unique_reporters": set.len(),
                    "banned": banned_until > now,
                    "banned_until": if banned_until > now { banned_until } else { 0 },
                })
            })
            .collect();
        out.sort_by(|a, b| {
            let an = a
                .get("unique_reporters")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            let bn = b
                .get("unique_reporters")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            bn.cmp(&an)
        });
        out
    }

    fn handle_block_user(&mut self, id: Uuid, user_id: String) {
        let user_id = user_id.trim().to_string();
        if user_id.is_empty() {
            return;
        }
        let Some(me) = self.clients.get(&id).map(|c| c.user_id.clone()) else {
            return;
        };
        if me == user_id {
            self.send(
                id,
                ServerMsg::Error {
                    message: "cannot block yourself".into(),
                },
            );
            return;
        }

        // Drop friendship + pending both ways
        if let Some(set) = self.friendships.get_mut(&me) {
            set.remove(&user_id);
        }
        if let Some(set) = self.friendships.get_mut(&user_id) {
            set.remove(&me);
        }
        self.clear_pending_pair(&me, &user_id);
        self.blocks
            .entry(me.clone())
            .or_default()
            .insert(user_id.clone());
        self.persist_friends();

        // If currently matched / friend-call with them, end and requeue
        let partner_conn = self.by_user.get(&user_id).copied();
        let my_friend = self.clients.get(&id).and_then(|c| c.friend_call);
        let my_partner = self.clients.get(&id).and_then(|c| c.partner);
        let session_peers: Vec<Uuid> = self
            .clients
            .get(&id)
            .map(|c| c.session_peers.iter().copied().collect())
            .unwrap_or_default();

        let friend_is_target = my_friend
            .and_then(|f| self.clients.get(&f).map(|x| x.user_id == user_id))
            .unwrap_or(false);
        let partner_is_target = my_partner
            .and_then(|p| self.clients.get(&p).map(|x| x.user_id == user_id))
            .unwrap_or(false);
        let session_has_target = session_peers.iter().any(|p| {
            self.clients
                .get(p)
                .map(|x| x.user_id == user_id)
                .unwrap_or(false)
        });

        if friend_is_target {
            self.end_friend_call(id, "blocked");
        } else if partner_is_target || session_has_target {
            let my_room = self.room_of(id);
            let other = partner_conn.or(my_partner);
            if let Some(pid) = other {
                if self.clients.contains_key(&pid) {
                    let their_room = self.room_of(pid);
                    self.unmatch_one(pid, "partner blocked you — searching again");
                    self.enter_waiting_solo(pid, their_room, "searching again");
                }
            }
            self.enter_waiting_solo(id, my_room, "blocked — finding someone else");
        }

        self.push_friends_list(id);
        if let Some(pid) = partner_conn {
            self.push_friends_list(pid);
        }
        self.status(id, "user blocked");
    }

    fn handle_unblock_user(&mut self, id: Uuid, user_id: String) {
        let user_id = user_id.trim().to_string();
        let Some(me) = self.clients.get(&id).map(|c| c.user_id.clone()) else {
            return;
        };
        if let Some(set) = self.blocks.get_mut(&me) {
            set.remove(&user_id);
            if set.is_empty() {
                self.blocks.remove(&me);
            }
        }
        self.persist_friends();
        self.push_friends_list(id);
        self.status(id, "user unblocked");
    }

    fn handle_call_friend(&mut self, id: Uuid, user_id: String) {
        let Some(me) = self.clients.get(&id) else { return };
        let my_uid = me.user_id.clone();
        let my_name = me.name.clone();
        let my_short = me.short_id.clone();
        let my_peer = me.peer_id.clone();
        let my_code = me.friend_code.clone();

        // Mutual friendship required (both must have accepted)
        let i_have = self
            .friendships
            .get(&my_uid)
            .map(|s| s.contains(&user_id))
            .unwrap_or(false);
        let they_have = self
            .friendships
            .get(&user_id)
            .map(|s| s.contains(&my_uid))
            .unwrap_or(false);
        if !i_have || !they_have {
            let pending_in = self
                .pending
                .get(&user_id)
                .map(|s| s.contains(&my_uid))
                .unwrap_or(false);
            let pending_out = self
                .pending
                .get(&my_uid)
                .map(|s| s.contains(&user_id))
                .unwrap_or(false);
            let msg = if pending_out {
                "friend request pending — wait for them to accept"
            } else if pending_in {
                "accept their friend request first"
            } else {
                "not friends — send a request and wait for accept"
            };
            self.send(
                id,
                ServerMsg::Error {
                    message: msg.into(),
                },
            );
            return;
        }
        if self.is_blocked_pair_uid(&my_uid, &user_id) {
            self.send(
                id,
                ServerMsg::Error {
                    message: "cannot call — user is blocked".into(),
                },
            );
            return;
        }
        let Some(&oid) = self.by_user.get(&user_id) else {
            self.send(
                id,
                ServerMsg::Error {
                    message: "friend offline".into(),
                },
            );
            return;
        };
        if self.clients.get(&id).map(|c| c.phase) != Some(Phase::Idle)
            && self.clients.get(&id).map(|c| c.phase) != Some(Phase::Waiting)
        {
            // allow call from idle primarily
        }
        if matches!(
            self.clients.get(&oid).map(|c| c.phase),
            Some(Phase::FriendCall) | Some(Phase::Matched)
        ) {
            self.send(
                id,
                ServerMsg::Error {
                    message: "friend is busy".into(),
                },
            );
            return;
        }
        self.send(
            oid,
            ServerMsg::CallIncoming {
                from_user_id: my_uid,
                from_name: my_name,
                from_short: my_short,
                from_peer: my_peer,
                from_code: my_code,
            },
        );
        self.status(id, "calling friend…");
    }

    fn handle_call_respond(&mut self, id: Uuid, from_user_id: String, accept: bool) {
        let Some(&caller) = self.by_user.get(&from_user_id) else {
            self.send(
                id,
                ServerMsg::Error {
                    message: "caller offline".into(),
                },
            );
            return;
        };
        if !accept {
            self.send(
                caller,
                ServerMsg::CallEnded {
                    reason: "call declined".into(),
                },
            );
            self.status(caller, "call declined");
            return;
        }
        // Leave queues
        self.dequeue_client(id);
        self.dequeue_client(caller);
        self.start_friend_session(caller, id);
    }

    fn handle_chat(&mut self, id: Uuid, body: String) {
        if let Some(c) = self.clients.get_mut(&id) {
            if !c.limiter.allow_chat(&self.limits) {
                self.send(
                    id,
                    ServerMsg::Error {
                        message: "rate limited — chat too fast".into(),
                    },
                );
                return;
            }
        }
        let body = body.trim();
        if body.is_empty() {
            return;
        }
        if body.chars().count() > MAX_CHAT_CHARS {
            self.send(
                id,
                ServerMsg::Error {
                    message: format!("chat too long (max {MAX_CHAT_CHARS} chars)"),
                },
            );
            return;
        }
        let body = body.to_string();
        // Federated chat relay
        if let Some(sid) = self.fed_by_client.get(&id).cloned() {
            if let Some(sess) = self.fed_sessions.get(&sid) {
                let author = self
                    .clients
                    .get(&id)
                    .map(|c| {
                        if c.name.is_empty() || c.name == "anon" {
                            c.short_id.clone()
                        } else {
                            c.name.clone()
                        }
                    })
                    .unwrap_or_else(|| "anon".into());
                let remote_base = sess.remote_base_url.clone();
                let session_id = sess.session_id.clone();
                let chat = ServerMsg::Chat {
                    author: author.clone(),
                    body: body.clone(),
                };
                self.send(id, chat);
                self.fed_outbox.push_back(FedOutbound {
                    base_url: remote_base,
                    request: RelayRequest {
                        session_id,
                        kind: RelayKind::Chat,
                        from_peer: String::new(),
                        to_peer: String::new(),
                        signal_kind: String::new(),
                        payload: String::new(),
                        author,
                        body,
                    },
                });
                return;
            }
        }
        let (author, targets) = match self.clients.get(&id) {
            Some(c)
                if c.phase == Phase::Matched
                    || c.phase == Phase::FriendCall =>
            {
                let mut t: Vec<Uuid> = c.session_peers.iter().copied().collect();
                if t.is_empty() {
                    if let Some(p) = c.partner {
                        t.push(p);
                    }
                }
                // Prefer display name so conversationalists see who you are
                let author = if c.name.is_empty() || c.name == "anon" {
                    c.short_id.clone()
                } else {
                    c.name.clone()
                };
                (author, t)
            }
            _ => {
                self.send(
                    id,
                    ServerMsg::Error {
                        message: "not matched".into(),
                    },
                );
                return;
            }
        };
        let chat = ServerMsg::Chat {
            author: author.clone(),
            body,
        };
        self.send(id, chat.clone());
        for t in targets {
            self.send(t, chat.clone());
        }
    }

    fn handle_signal(&mut self, id: Uuid, kind: String, payload: String, to: String) {
        if kind.len() > MAX_SIGNAL_KIND || payload.len() > MAX_SIGNAL_BYTES {
            self.send(
                id,
                ServerMsg::Error {
                    message: "signal too large".into(),
                },
            );
            return;
        }

        // Federated signal path
        let fed_to = parse_federated_peer_id(&to);
        let in_fed = self.fed_by_client.contains_key(&id);
        if in_fed || fed_to.is_some() {
            let Some(sid) = self.fed_by_client.get(&id).cloned() else {
                self.send(
                    id,
                    ServerMsg::Error {
                        message: "not matched".into(),
                    },
                );
                return;
            };
            let Some(sess) = self.fed_sessions.get(&sid) else {
                return;
            };
            let from_fed = federated_peer_id(&sess.session_id, &sess.local_peer_id);
            let to_peer = if to.is_empty() {
                federated_peer_id(&sess.session_id, &sess.remote_peer_id)
            } else {
                to.clone()
            };
            let author = self
                .clients
                .get(&id)
                .map(|c| c.short_id.clone())
                .unwrap_or_default();
            let remote_base = sess.remote_base_url.clone();
            let session_id = sess.session_id.clone();
            self.fed_outbox.push_back(FedOutbound {
                base_url: remote_base,
                request: RelayRequest {
                    session_id,
                    kind: RelayKind::Signal,
                    from_peer: from_fed,
                    to_peer,
                    signal_kind: kind,
                    payload,
                    author,
                    body: String::new(),
                },
            });
            return;
        }

        let (author, from_peer, targets) = match self.clients.get(&id) {
            Some(c)
                if c.phase == Phase::Matched
                    || c.phase == Phase::FriendCall =>
            {
                let mut targets = Vec::new();
                if !to.is_empty() {
                    // resolve peer_id to uuid
                    if let Some((&uid, _)) = self
                        .clients
                        .iter()
                        .find(|(_, cl)| cl.peer_id == to || cl.short_id == to)
                    {
                        if c.session_peers.contains(&uid)
                            || c.partner == Some(uid)
                            || c.friend_call == Some(uid)
                        {
                            targets.push(uid);
                        }
                    }
                } else {
                    targets = c.session_peers.iter().copied().collect();
                    if targets.is_empty() {
                        if let Some(p) = c.partner {
                            targets.push(p);
                        }
                    }
                }
                (c.short_id.clone(), c.peer_id.clone(), targets)
            }
            _ => {
                self.send(
                    id,
                    ServerMsg::Error {
                        message: "not matched".into(),
                    },
                );
                return;
            }
        };
        for t in targets {
            self.send(
                t,
                ServerMsg::Signal {
                    author: author.clone(),
                    kind: kind.clone(),
                    payload: payload.clone(),
                    from_peer: from_peer.clone(),
                },
            );
        }
    }
}

impl Default for SimpleHub {
    fn default() -> Self {
        Self::new()
    }
}
