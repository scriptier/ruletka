//! In-memory matchmaking + friends + party browse + chat/signal relay.
//!
//! Match shapes (hard caps — max 4 people in a stranger session):
//! - **1v1** solo ↔ solo
//! - **1v2** solo ↔ party of 2
//! - **3v1** solo ↔ party of 3
//! - **2v2** party of 2 ↔ party of 2
//! Parties of 2 or 3 (friends / find-third / join-call groups).

use crate::federation::{
    self, caller_is_offerer, federated_peer_id, parse_federated_peer_id, ClaimRequest,
    ClaimResponse, FedOutbound, FedPeerDesc, FederationInfo, RelayKind, RelayRequest, RoomWaiting,
    PROTOCOL,
};
use crate::friends_store::{self, FriendsFile};
use crate::limits::{ClientLimiter, LimitConfig};
use crate::protocol::{ClientMsg, FriendChatLine, FriendInfo, MatchPeer, ServerMsg};
use crate::push_tokens::{self, PushToken};
use crate::star_ledger::{SpendError, StarLedger};
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
/// Max stored DMs per friend conversation (oldest pruned).
const MAX_DM_PER_CONV: usize = 100;
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
    /// Friend pair or find-third pair browsing for a stranger (1v2 / 2v2).
    Party { a: Uuid, b: Uuid },
    /// Three people already mesh-connected, browsing for one solo (3v1 → 4 total).
    Party3 { a: Uuid, b: Uuid, c: Uuid },
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
    /// Party formed from stranger find-third (not a friend call). Only match solo (1v2), not 2v2.
    stranger_party: bool,
    /// Soft match identity: man | woman | other | ""
    gender: String,
    /// Soft match preference: any | man | woman | ""
    looking: String,
    /// Cosmetic self-chosen flag (ISO alpha-2). Not geolocation.
    flag: String,
    /// Small avatar data URL (jpeg/png/webp). Empty = none.
    avatar: String,
    /// Soft interest tags (allowlisted, max 3). Prefer shared; never hard-filter.
    tags: Vec<String>,
    limiter: ClientLimiter,
    /// Sliding window of report submissions (anti ban-bomb).
    report_times: Vec<Instant>,
    /// When current stranger match began (for avg match length metrics).
    match_started: Option<Instant>,
    /// When this client entered the queue (for avg wait metrics).
    wait_started: Option<Instant>,
    /// After a long match ends: partner user_id eligible for one-time star review.
    pending_rate_uid: Option<String>,
    pending_rate_name: String,
    pending_rate_secs: u64,
}

/// Daily hub counters (persisted as JSONL under data/metrics.jsonl).
#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct DayMetrics {
    pub day: String,
    pub matches: u64,
    pub reports: u64,
    pub blocks: u64,
    pub queue_joins: u64,
    /// Joined queue when no other solo waiters were present.
    pub alone_joins: u64,
    pub peak_online: u64,
    pub peak_waiting: u64,
    /// Sum of completed stranger match durations (seconds) for avg length.
    #[serde(default)]
    pub match_seconds: u64,
    /// Count of match durations recorded (for average).
    #[serde(default)]
    pub match_duration_n: u64,
    /// Friend 1:1 sessions started (accept).
    #[serde(default)]
    pub friend_calls: u64,
    /// Outbound call_friend rings that passed friendship checks.
    #[serde(default)]
    pub call_rings: u64,
    /// Sum of queue wait seconds until match (stranger).
    #[serde(default)]
    pub wait_seconds: u64,
    /// Count of wait durations recorded.
    #[serde(default)]
    pub wait_n: u64,
    /// Mutual 1h star bonuses granted (one event per pair/session).
    #[serde(default)]
    pub star_hour_awards: u64,
    /// Optional gift stars successfully given (RatePartner star=true).
    #[serde(default)]
    pub star_gifts: u64,
    /// Successful star spends (bars/flowers).
    #[serde(default)]
    pub star_spend_ok: u64,
    /// Failed star spends (not enough stars, not in chat, etc.).
    #[serde(default)]
    pub star_spend_fail: u64,
    /// Behind-bars gifts applied.
    #[serde(default)]
    pub star_spend_bars: u64,
    /// Flowers gifts applied.
    #[serde(default)]
    pub star_spend_flowers: u64,
    /// Balloons gifts applied.
    #[serde(default)]
    pub star_spend_balloons: u64,
    /// Confetti gifts applied.
    #[serde(default)]
    pub star_spend_confetti: u64,
    /// Cheap heart gifts applied.
    #[serde(default)]
    pub star_spend_heart: u64,
    /// Premium fireworks gifts applied.
    #[serde(default)]
    pub star_spend_fireworks: u64,
    /// Please stay (no-skip) gifts applied.
    #[serde(default)]
    pub star_spend_please_stay: u64,
    /// Total stars burned on gifts (cost sum).
    #[serde(default)]
    pub star_spent_total: u64,
    /// Client growth funnel (POST /v1/funnel) — invite share/land/request/connected.
    #[serde(default)]
    pub funnel_invite_share: u64,
    #[serde(default)]
    pub funnel_invite_land: u64,
    #[serde(default)]
    pub funnel_invite_request: u64,
    #[serde(default)]
    pub funnel_invite_connected: u64,
    #[serde(default)]
    pub funnel_home_pack_copy: u64,
    #[serde(default)]
    pub funnel_home_pack_live: u64,
    #[serde(default)]
    pub funnel_friend_nudge_show: u64,
    #[serde(default)]
    pub funnel_friend_nudge_accept: u64,
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
    /// last known avatars for offline friends (data URLs)
    known_avatars: HashMap<String, String>,
    /// blocker user_id → blocked user_ids
    blocks: HashMap<String, HashSet<String>>,
    /// pending friend requests: from_user → set of to_users
    pending: HashMap<String, HashSet<String>>,
    /// target_user_id → unique reporters
    report_reporters: HashMap<String, HashSet<String>>,
    /// user_id → ban expiry (unix seconds)
    match_bans: HashMap<String, u64>,
    /// target_user_id → recent report timestamps (unix secs). Memory-only raid detection.
    report_recent: HashMap<String, Vec<u64>>,
    /// In-memory ring of recent matches for admin (not persisted across restart).
    recent_matches: VecDeque<serde_json::Value>,
    /// Friend DMs: conversation_key → messages (newest last)
    dms: HashMap<String, Vec<friends_store::StoredDm>>,
    /// user_id → public star count (cache; authority is star_ledger)
    star_counts: HashMap<String, u64>,
    /// Append-only mint/spend log with hash-chain + spend op_id idempotency
    star_ledger: StarLedger,
    /// user_id → (utc_day, stars_minted_today) — soft anti-sybil cap for natural mints
    mint_day: HashMap<String, (u32, u64)>,
    /// Directed from|to edges (one review per pair)
    star_edges: HashSet<String>,
    /// Directed from|to thanks/vouch (no trust mint)
    vouch_edges: HashSet<String>,
    /// user_id → active star-bought effect until unix
    star_effects: HashMap<String, friends_store::StarEffectRecord>,
    /// Dedupe keys for 1-hour mutual star rewards
    hour_star_sessions: HashSet<String>,
    /// user_id → cannot press Next until this unix (Please stay)
    no_skip_until: HashMap<String, u64>,
    /// spender|target → last please_stay spend unix
    please_stay_last: HashMap<String, u64>,
    queue: VecDeque<QueueEntry>,
    limits: LimitConfig,
    friends_path: PathBuf,
    /// user_id → last known push device token (offline friend rings)
    push_tokens: HashMap<String, PushToken>,
    push_tokens_path: PathBuf,
    /// Optional HTTPS webhook for offline ring delivery (custom push relay / ntfy / etc.)
    push_webhook_url: Option<String>,
    /// Optional HTTPS webhook (Slack/Discord/Telegram bot URL) fired on auto-ban.
    mod_webhook_url: Option<String>,
    /// Federated sessions by session_id
    fed_sessions: HashMap<String, FedSession>,
    /// local client uuid → session_id
    fed_by_client: HashMap<Uuid, String>,
    /// Outbound federation relays (drained by HTTP layer)
    fed_outbox: VecDeque<FedOutbound>,
    /// Pending find-third invite (stranger 1v1 → party of 2). Keyed by either peer for lookup.
    find_third_pending: Option<FindThirdPending>,
    /// Pending “join my live 1v1 as 3rd” ring (inviter keeps talking to `keep`).
    join_call_pending: Option<JoinCallPending>,
    /// In-memory daily metrics (flushed to metrics.jsonl).
    metrics: DayMetrics,
}

/// Invite from A → B to search for a 3rd together.
#[derive(Clone, Debug)]
struct FindThirdPending {
    from: Uuid,
    to: Uuid,
    expires: Instant,
}

/// A is in 1v1 with `keep`, ringing `to` to join without dropping `keep`.
#[derive(Clone, Debug)]
struct JoinCallPending {
    from: Uuid,
    to: Uuid,
    keep: Uuid,
    expires: Instant,
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

/// Allowlisted soft interest tags (keep small; UI + bridge must match).
const ALLOWED_TAGS: &[&str] = &[
    "music", "games", "movies", "tech", "travel", "sports", "art", "chat", "langs", "anime",
];
const MAX_TAGS: usize = 3;

fn normalize_tags(raw: &[String]) -> Vec<String> {
    let mut out = Vec::new();
    for t in raw {
        let key = t.trim().to_ascii_lowercase();
        if key.is_empty() {
            continue;
        }
        if !ALLOWED_TAGS.iter().any(|a| *a == key) {
            continue;
        }
        if out.iter().any(|x| x == &key) {
            continue;
        }
        out.push(key);
        if out.len() >= MAX_TAGS {
            break;
        }
    }
    out
}

/// Soft tags: empty on either side = no preference (ok). Both set → prefer intersection.
fn tags_soft_ok(a: &[String], b: &[String]) -> bool {
    if a.is_empty() || b.is_empty() {
        return true;
    }
    a.iter().any(|t| b.iter().any(|u| u == t))
}

fn utc_day() -> String {
    // Simple YYYY-MM-DD from unix day (UTC)
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let days = secs / 86_400;
    // 1970-01-01 + days — use chrono-free civil date
    // Algorithm from Howard Hinnant (public domain)
    let z = days as i64 + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{:04}-{:02}-{:02}", y, m, d)
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
        Self::with_limits_store_webhook(limits, friends_path, None, None)
    }

    pub fn with_limits_store_webhook(
        limits: LimitConfig,
        friends_path: PathBuf,
        mod_webhook_url: Option<String>,
        push_webhook_url: Option<String>,
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
        let ledger_path = StarLedger::path_beside_friends(&friends_path);
        let star_ledger = match StarLedger::load_or_migrate(ledger_path, &stored.star_counts) {
            Ok(l) => l,
            Err(e) => {
                tracing::error!(error = %e, "star ledger load failed — starting empty (unsafe)");
                StarLedger::empty(StarLedger::path_beside_friends(&friends_path))
            }
        };
        // Ledger is authority for balances (after genesis migration)
        let star_counts = star_ledger.balances_snapshot();
        let webhook = mod_webhook_url
            .map(|s| s.trim().to_string())
            .filter(|s| s.starts_with("https://"));
        if webhook.is_some() {
            tracing::info!("mod webhook enabled for auto-ban events");
        }
        let push_wh = push_webhook_url
            .map(|s| s.trim().to_string())
            .filter(|s| s.starts_with("https://"));
        if push_wh.is_some() {
            tracing::info!("push webhook enabled for offline friend rings");
        }
        let push_tokens_path = push_tokens::path_beside_friends(&friends_path);
        let push_tokens = push_tokens::load(&push_tokens_path);
        if !push_tokens.is_empty() {
            tracing::info!(
                n = push_tokens.len(),
                path = %push_tokens_path.display(),
                "loaded push tokens"
            );
        }
        let hub = Self {
            clients: HashMap::new(),
            by_user: HashMap::new(),
            code_index: stored.code_index,
            friendships: stored.friendships,
            known_names: stored.names,
            known_avatars: stored.avatars,
            blocks: stored.blocks,
            pending: stored.pending,
            report_reporters: stored.report_reporters,
            match_bans: stored.match_bans,
            report_recent: HashMap::new(),
            recent_matches: VecDeque::new(),
            dms: stored.dms,
            star_counts,
            star_ledger,
            mint_day: HashMap::new(),
            star_edges: stored.star_edges,
            vouch_edges: stored.vouch_edges,
            star_effects: stored.star_effects,
            hour_star_sessions: stored.hour_star_sessions,
            no_skip_until: stored.no_skip_until,
            please_stay_last: stored.please_stay_last,
            queue: VecDeque::new(),
            limits,
            friends_path,
            push_tokens,
            push_tokens_path,
            push_webhook_url: push_wh,
            mod_webhook_url: webhook,
            fed_sessions: HashMap::new(),
            fed_by_client: HashMap::new(),
            fed_outbox: VecDeque::new(),
            find_third_pending: None,
            join_call_pending: None,
            metrics: DayMetrics {
                day: utc_day(),
                ..DayMetrics::default()
            },
        };
        // Persist reconciled star_counts so friends.json cache matches ledger
        hub.persist_friends();
        hub
    }

    fn persist_push_tokens(&self) {
        if let Err(e) = push_tokens::save(&self.push_tokens_path, &self.push_tokens) {
            tracing::warn!(error = %e, "push_tokens save failed");
        }
    }

    fn fire_push_webhook(&self, payload: serde_json::Value) {
        let Some(url) = self.push_webhook_url.clone() else {
            return;
        };
        let text = payload
            .get("text")
            .and_then(|v| v.as_str())
            .unwrap_or("ruletka friend call")
            .to_string();
        tokio::spawn(async move {
            let body = webhook_body_for_url(&url, &text, &payload);
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(8))
                .build();
            let Ok(client) = client else {
                return;
            };
            let _ = client.post(&url).json(&body).send().await;
        });
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
            avatars: self.known_avatars.clone(),
            blocks: self.blocks.clone(),
            pending: self.pending.clone(),
            report_reporters: self.report_reporters.clone(),
            match_bans: self.match_bans.clone(),
            dms: self.dms.clone(),
            star_counts: self.star_counts.clone(),
            star_edges: self.star_edges.clone(),
            vouch_edges: self.vouch_edges.clone(),
            star_effects: self.star_effects.clone(),
            hour_star_sessions: self.hour_star_sessions.clone(),
            no_skip_until: self.no_skip_until.clone(),
            please_stay_last: self.please_stay_last.clone(),
        };
        if let Err(e) = friends_store::save(&self.friends_path, &data) {
            tracing::warn!(error = %e, "failed to save friends store");
        }
    }

    fn friend_info_for(&self, fuid: &str) -> FriendInfo {
        let online = self.by_user.contains_key(fuid);
        let (name, code, short, avatar) = if let Some(&cid) = self.by_user.get(fuid) {
            let fc = &self.clients[&cid];
            (
                fc.name.clone(),
                fc.friend_code.clone(),
                fc.short_id.clone(),
                fc.avatar.clone(),
            )
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
            let avatar = self.known_avatars.get(fuid).cloned().unwrap_or_default();
            (name, code, fuid.chars().take(8).collect(), avatar)
        };
        let (last_msg, last_msg_ts) = self.last_dm_preview_for(fuid);
        // Friends list shows public trust (peer gifts), not spendable balance
        let stars = self.effective_trust_for(fuid);
        FriendInfo {
            user_id: fuid.to_string(),
            name,
            friend_code: code,
            short_id: short,
            online,
            last_msg,
            last_msg_ts,
            avatar,
            stars,
            mutual_star: false,
            mutual_thanks: false,
        }
    }

    /// Mutual post-chat ★ gifts (trust ledger edges both ways).
    fn mutual_star_bond(&self, a: &str, b: &str) -> bool {
        self.star_ledger.has_trust_edge(a, b) && self.star_ledger.has_trust_edge(b, a)
    }

    /// Mutual thanks/vouch (no trust mint).
    fn mutual_thanks_bond(&self, a: &str, b: &str) -> bool {
        let ab = friends_store::star_edge_key(a, b);
        let ba = friends_store::star_edge_key(b, a);
        self.vouch_edges.contains(&ab) && self.vouch_edges.contains(&ba)
    }

    /// Minimum chat length before a star review is offered (normal path).
    const STAR_MIN_SECS: u64 = 15 * 60;
    /// First few unique partners: shorter rate window so cold-start users see ★.
    const STAR_FIRST_RATE_SECS: u64 = 5 * 60;
    /// How many unique outgoing rate edges still use the short window.
    const STAR_FIRST_RATE_SLOTS: usize = 3;
    /// Both conversationalists earn +1 star automatically after this long (1 hour).
    /// Optional extra gifts (RatePartner) still work separately (once per pair).
    const STAR_HOUR_BONUS_SECS: u64 = 60 * 60;

    /// Count of directed star reviews this user already completed (gift or skip).
    fn outgoing_star_rate_count(&self, user_id: &str) -> usize {
        if user_id.is_empty() {
            return 0;
        }
        let prefix = format!("{user_id}|");
        self.star_edges
            .iter()
            .filter(|e| e.starts_with(&prefix))
            .count()
    }

    /// Seconds of live chat required before RatePrompt for this user.
    fn rate_min_secs_for(&self, user_id: &str) -> u64 {
        if self.outgoing_star_rate_count(user_id) < Self::STAR_FIRST_RATE_SLOTS {
            Self::STAR_FIRST_RATE_SECS
        } else {
            Self::STAR_MIN_SECS
        }
    }

    /// How many short-window slots remain (0 = always full 15 min).
    fn early_rates_left_for(&self, user_id: &str) -> u32 {
        let used = self.outgoing_star_rate_count(user_id);
        Self::STAR_FIRST_RATE_SLOTS.saturating_sub(used) as u32
    }
    /// Quiet easter-egg: chat with site owner (Драконов) — not advertised in UI.
    const OWNER_EGG_TIER1_SECS: u64 = 2 * 60;
    const OWNER_EGG_TIER1_STARS: u64 = 5;
    const OWNER_EGG_TIER2_SECS: u64 = 15 * 60;
    const OWNER_EGG_TIER2_STARS: u64 = 15;
    const OWNER_EGG_TIER3_SECS: u64 = 60 * 60;
    const OWNER_EGG_TIER3_STARS: u64 = 30;

    /// Spendable balance (ledger) — gifts, cosmetics.
    fn stars_for(&self, user_id: &str) -> u64 {
        self.star_ledger.balance(user_id)
    }

    /// Raw peer-gift trust (before decay / gifter floors).
    fn trust_for(&self, user_id: &str) -> u64 {
        self.star_ledger.trust_for(user_id)
    }

    fn trust_gifters_for(&self, user_id: &str) -> u32 {
        self.star_ledger.trust_gifters(user_id)
    }

    /// Privacy-light gifter chips (initial + flag) for the Stars social-proof strip.
    fn trust_giver_chips_for(&self, user_id: &str, limit: usize) -> Vec<crate::protocol::TrustGiverChip> {
        use crate::protocol::TrustGiverChip;
        let lim = limit.max(1).min(12);
        let mut chips = Vec::new();
        for from in self.star_ledger.trust_giver_ids(user_id) {
            if chips.len() >= lim {
                break;
            }
            let name = self
                .known_names
                .get(&from)
                .cloned()
                .filter(|n| !n.is_empty() && n != "anon")
                .or_else(|| {
                    self.by_user
                        .get(&from)
                        .and_then(|cid| self.clients.get(cid))
                        .map(|c| c.name.clone())
                        .filter(|n| !n.is_empty() && n != "anon")
                })
                .unwrap_or_default();
            let flag = self
                .by_user
                .get(&from)
                .and_then(|cid| self.clients.get(cid))
                .map(|c| c.flag.clone())
                .unwrap_or_default();
            let initial = if !name.is_empty() {
                name.chars()
                    .next()
                    .map(|c| c.to_uppercase().to_string())
                    .unwrap_or_else(|| "★".into())
            } else {
                // Fallback: first alphanumeric of uid, not full id
                from.chars()
                    .find(|c| c.is_ascii_alphanumeric())
                    .map(|c| c.to_ascii_uppercase().to_string())
                    .unwrap_or_else(|| "★".into())
            };
            chips.push(TrustGiverChip { initial, flag });
        }
        chips
    }

    /// Soft decay start / full (days since last trust activity).
    const TRUST_DECAY_START_DAYS: u64 = 45;
    const TRUST_DECAY_FULL_DAYS: u64 = 180;
    /// Max fraction of trust lost to idle decay (50%).
    const TRUST_DECAY_MAX_PCT: u64 = 50;
    /// Distinct gifters required for trusted / senior report tiers.
    const TRUSTED_MIN_GIFTERS: u32 = 5;
    const SENIOR_MIN_GIFTERS: u32 = 12;

    /// Apply soft idle decay to raw trust (does not mutate ledger).
    fn decayed_trust(&self, user_id: &str, raw: u64) -> u64 {
        if raw == 0 || user_id.is_empty() {
            return 0;
        }
        let last = self.star_ledger.trust_last_ts(user_id);
        if last == 0 {
            // Legacy gifts without timestamps — no decay
            return raw;
        }
        let now = Self::unix_now();
        if now <= last {
            return raw;
        }
        let days = (now - last) / 86_400;
        if days < Self::TRUST_DECAY_START_DAYS {
            return raw;
        }
        let span = Self::TRUST_DECAY_FULL_DAYS
            .saturating_sub(Self::TRUST_DECAY_START_DAYS)
            .max(1);
        let overdue = (days - Self::TRUST_DECAY_START_DAYS).min(span);
        let lost_pct = Self::TRUST_DECAY_MAX_PCT.saturating_mul(overdue) / span;
        let keep_pct = 100u64.saturating_sub(lost_pct);
        raw.saturating_mul(keep_pct) / 100
    }

    /// Effective trust for report weight, shields, match rank, public tier.
    /// Applies soft decay then gifter-diversity floors (cannot claim senior on 1 friend).
    fn effective_trust_for(&self, user_id: &str) -> u64 {
        let raw = self.trust_for(user_id);
        let decayed = self.decayed_trust(user_id, raw);
        let g = self.trust_gifters_for(user_id);
        // Cap effective score so report tiers need enough unique gifters
        if g < Self::TRUSTED_MIN_GIFTERS {
            return decayed.min(Self::TRUSTED_REPORTER_STARS.saturating_sub(1));
        }
        if g < Self::SENIOR_MIN_GIFTERS {
            return decayed.min(Self::SENIOR_REPORTER_STARS.saturating_sub(1));
        }
        decayed
    }

    /// Ban clawback: burn some balance + trust so banned users don't keep Senior power.
    fn clawback_on_ban(&mut self, user_id: &str, ban_reason: &str) {
        if user_id.is_empty() {
            return;
        }
        let bal = self.stars_for(user_id);
        let trust = self.trust_for(user_id);
        if bal == 0 && trust == 0 {
            return;
        }
        // ~25% balance (cap 100), ~35% trust (cap 80) — at least 1 if any
        let mut burn_bal = ((bal as u128) * 25 / 100) as u64;
        if bal > 0 && burn_bal == 0 {
            burn_bal = 1;
        }
        burn_bal = burn_bal.min(100).min(bal);
        let mut burn_trust = ((trust as u128) * 35 / 100) as u64;
        if trust > 0 && burn_trust == 0 {
            burn_trust = 1;
        }
        burn_trust = burn_trust.min(80).min(trust);
        if burn_bal == 0 && burn_trust == 0 {
            return;
        }
        let r = ban_reason
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
            .take(32)
            .collect::<String>();
        let reason = format!("clawback:ban:{}", if r.is_empty() { "report" } else { &r });
        let op = format!(
            "claw|{}|{}|{}",
            user_id,
            Self::unix_now(),
            reason.chars().take(24).collect::<String>()
        );
        match self
            .star_ledger
            .clawback(user_id, burn_bal, burn_trust, &reason, &op)
        {
            Ok((ev, new_bal)) => {
                if new_bal == 0 {
                    self.star_counts.remove(user_id);
                } else {
                    self.star_counts.insert(user_id.to_string(), new_bal);
                }
                self.persist_friends();
                tracing::info!(
                    seq = ev.seq,
                    %user_id,
                    burn_bal,
                    burn_trust,
                    new_bal,
                    trust_after = self.trust_for(user_id),
                    %reason,
                    "star/trust clawback on ban"
                );
            }
            Err(e) => {
                tracing::warn!(error = %e, %user_id, "clawback failed");
            }
        }
    }

    /// Admin graph: mutual gift edges + low-diversity high-trust flags.
    fn trust_graph_stats(&self) -> serde_json::Value {
        let edges = self.star_ledger.trust_edges_snapshot();
        let edge_set: std::collections::HashSet<&str> =
            edges.iter().map(|s| s.as_str()).collect();
        let mut mutual = 0u32;
        let mut seen_pairs = std::collections::HashSet::new();
        for e in &edges {
            let Some((a, b)) = e.split_once('|') else {
                continue;
            };
            if a.is_empty() || b.is_empty() || a == b {
                continue;
            }
            let rev = format!("{b}|{a}");
            if edge_set.contains(rev.as_str()) {
                let key = if a < b {
                    format!("{a}|{b}")
                } else {
                    format!("{b}|{a}")
                };
                if seen_pairs.insert(key) {
                    mutual += 1;
                }
            }
        }
        // High raw trust but not enough unique gifters for tier
        let mut low_diversity: Vec<serde_json::Value> = Vec::new();
        for (uid, raw) in self.star_ledger.trust_snapshot() {
            if uid.is_empty() || raw == 0 {
                continue;
            }
            let g = self.trust_gifters_for(&uid);
            let eff = self.effective_trust_for(&uid);
            let capped = eff < raw
                && (raw >= Self::TRUSTED_REPORTER_STARS || raw >= 50);
            if !capped && g >= Self::TRUSTED_MIN_GIFTERS {
                continue;
            }
            if raw < 50 && g >= 2 {
                continue;
            }
            if raw >= Self::TRUSTED_REPORTER_STARS && g < Self::TRUSTED_MIN_GIFTERS
                || raw >= Self::SENIOR_REPORTER_STARS && g < Self::SENIOR_MIN_GIFTERS
                || (raw >= 50 && g < 3)
            {
                low_diversity.push(serde_json::json!({
                    "user_id": uid,
                    "trust": raw,
                    "trust_effective": eff,
                    "gifters": g,
                    "name": self.known_names.get(&uid).cloned().unwrap_or_default(),
                }));
            }
        }
        low_diversity.sort_by(|a, b| {
            let ta = a.get("trust").and_then(|v| v.as_u64()).unwrap_or(0);
            let tb = b.get("trust").and_then(|v| v.as_u64()).unwrap_or(0);
            tb.cmp(&ta)
        });
        low_diversity.truncate(12);
        serde_json::json!({
            "trust_edges": edges.len(),
            "mutual_pairs": mutual,
            "trusted_min_gifters": Self::TRUSTED_MIN_GIFTERS,
            "senior_min_gifters": Self::SENIOR_MIN_GIFTERS,
            "decay_start_days": Self::TRUST_DECAY_START_DAYS,
            "decay_full_days": Self::TRUST_DECAY_FULL_DAYS,
            "low_diversity": low_diversity,
        })
    }

    /// Soft daily cap on *natural* mints (rate/hour/egg). Admin adjusts bypass.
    const DAILY_MINT_CAP: u64 = 40;

    fn utc_day_num() -> u32 {
        (Self::unix_now() / 86_400) as u32
    }

    fn mint_budget_remaining(&self, user_id: &str) -> u64 {
        let day = Self::utc_day_num();
        match self.mint_day.get(user_id) {
            Some((d, used)) if *d == day => Self::DAILY_MINT_CAP.saturating_sub(*used),
            _ => Self::DAILY_MINT_CAP,
        }
    }

    fn record_mint_day(&mut self, user_id: &str, amount: u64) {
        if user_id.is_empty() || amount == 0 {
            return;
        }
        let day = Self::utc_day_num();
        let entry = self.mint_day.entry(user_id.to_string()).or_insert((day, 0));
        if entry.0 != day {
            *entry = (day, 0);
        }
        entry.1 = entry.1.saturating_add(amount);
    }

    /// Credit stars via append-only ledger (mint). `reason` is audit metadata.
    fn add_stars(&mut self, user_id: &str, n: u64, reason: &str) -> u64 {
        self.ledger_mint("", user_id, n, reason, "")
    }

    /// Peer post-chat gift: credits balance + trust on `to`, attributes `from`.
    fn add_stars_from(&mut self, from: &str, to: &str, n: u64, reason: &str) -> u64 {
        self.ledger_mint(from, to, n, reason, "")
    }

    fn ledger_mint(
        &mut self,
        from: &str,
        user_id: &str,
        n: u64,
        reason: &str,
        session: &str,
    ) -> u64 {
        if user_id.is_empty() || n == 0 {
            return self.stars_for(user_id);
        }
        // Daily soft cap (admin: / adjust: reasons bypass)
        let bypass_cap = reason.starts_with("admin:")
            || reason.starts_with("adjust:")
            || reason == "genesis_snapshot";
        let mut amount = n;
        if !bypass_cap {
            let left = self.mint_budget_remaining(user_id);
            if left == 0 {
                tracing::info!(%user_id, reason, n, "star mint blocked by daily cap");
                return self.stars_for(user_id);
            }
            if amount > left {
                tracing::info!(
                    %user_id,
                    reason,
                    requested = n,
                    allowed = left,
                    "star mint clipped by daily cap"
                );
                amount = left;
            }
        }
        match self
            .star_ledger
            .mint_from(from, user_id, amount, reason, session)
        {
            Ok((ev, bal)) => {
                if bal == 0 {
                    self.star_counts.remove(user_id);
                } else {
                    self.star_counts.insert(user_id.to_string(), bal);
                }
                if !bypass_cap {
                    self.record_mint_day(user_id, amount);
                }
                tracing::debug!(
                    seq = ev.seq,
                    %user_id,
                    from,
                    n = amount,
                    reason,
                    bal,
                    trust = self.trust_for(user_id),
                    "star mint"
                );
                bal
            }
            Err(e) => {
                tracing::error!(error = %e, %user_id, n = amount, reason, "star mint ledger failed");
                // Fail closed: do not mutate cache if ledger write failed
                self.stars_for(user_id)
            }
        }
    }

    /// Admin grant — always writes `adjust` with reason `admin:…` (bypasses daily mint cap).
    pub fn admin_grant_stars(
        &mut self,
        user_id: &str,
        amount: u64,
        reason: &str,
    ) -> Result<u64, String> {
        let uid = user_id.trim();
        if uid.is_empty() {
            return Err("user_id required".into());
        }
        if amount == 0 || amount > 10_000 {
            return Err("amount must be 1..=10000".into());
        }
        let note = {
            let r = reason.trim();
            if r.is_empty() {
                "admin:grant".to_string()
            } else if r.starts_with("admin:") {
                r.chars().take(80).collect()
            } else {
                format!("admin:{}", r.chars().take(64).collect::<String>())
            }
        };
        match self.star_ledger.adjust(uid, amount, &note) {
            Ok((ev, bal)) => {
                if bal == 0 {
                    self.star_counts.remove(uid);
                } else {
                    self.star_counts.insert(uid.to_string(), bal);
                }
                self.persist_friends();
                // Push live balance to connected client (hello_ok only runs once per session).
                if let Some(&cid) = self.by_user.get(uid) {
                    let trust = self.trust_for(uid);
                    self.send(
                        cid,
                        ServerMsg::RateResult {
                            ok: true,
                            user_id: uid.to_string(),
                            star: true,
                            amount,
                            stars: bal,
                            trust,
                            message: format!("admin grant · ★{amount} (balance ★{bal})"),
                            from_user_id: String::new(),
                            from_name: String::new(),
                        },
                    );
                }
                tracing::info!(
                    seq = ev.seq,
                    %uid,
                    amount,
                    bal,
                    reason = %note,
                    "admin star grant"
                );
                Ok(bal)
            }
            Err(e) => Err(format!("ledger: {e}")),
        }
    }

    /// Ledger tip + top balances / trust for admin metrics.
    pub fn stars_ledger_snapshot(&self) -> serde_json::Value {
        let mut rows: Vec<(String, u64)> = self
            .star_ledger
            .balances_snapshot()
            .into_iter()
            .filter(|(k, v)| !k.is_empty() && *v > 0)
            .collect();
        rows.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
        let total: u64 = rows.iter().map(|(_, v)| *v).sum();
        let top: Vec<serde_json::Value> = rows
            .iter()
            .take(12)
            .map(|(u, s)| {
                serde_json::json!({
                    "user_id": u,
                    "stars": s,
                    "trust": self.trust_for(u),
                    "trust_gifters": self.trust_gifters_for(u),
                    "name": self.known_names.get(u).cloned().unwrap_or_default(),
                })
            })
            .collect();
        let mut trust_rows: Vec<(String, u64)> = self
            .star_ledger
            .trust_snapshot()
            .into_iter()
            .filter(|(k, v)| !k.is_empty() && *v > 0)
            .collect();
        trust_rows.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
        let total_trust: u64 = trust_rows.iter().map(|(_, v)| *v).sum();
        let top_trust: Vec<serde_json::Value> = trust_rows
            .iter()
            .take(12)
            .map(|(u, t)| {
                serde_json::json!({
                    "user_id": u,
                    "trust": t,
                    "trust_effective": self.effective_trust_for(u),
                    "stars": self.stars_for(u),
                    "trust_gifters": self.trust_gifters_for(u),
                    "name": self.known_names.get(u).cloned().unwrap_or_default(),
                })
            })
            .collect();
        let graph = self.trust_graph_stats();
        serde_json::json!({
            "seq": self.star_ledger.seq(),
            "tip_hash": self.star_ledger.tip_hash(),
            "users_with_stars": rows.len(),
            "total_stars": total,
            "users_with_trust": trust_rows.len(),
            "total_trust": total_trust,
            "daily_mint_cap": Self::DAILY_MINT_CAP,
            "trusted_min_gifters": Self::TRUSTED_MIN_GIFTERS,
            "senior_min_gifters": Self::SENIOR_MIN_GIFTERS,
            "top": top,
            "top_trust": top_trust,
            "graph": graph,
        })
    }

    /// Debit stars for a gift. Returns Ok(new_balance) or Err(message).
    fn ledger_spend(
        &mut self,
        from: &str,
        to: &str,
        amount: u64,
        reason: &str,
        op_id: &str,
        session: &str,
    ) -> Result<u64, String> {
        match self
            .star_ledger
            .spend(from, to, amount, reason, op_id, session)
        {
            Ok((ev, bal)) => {
                if bal == 0 {
                    self.star_counts.remove(from);
                } else {
                    self.star_counts.insert(from.to_string(), bal);
                }
                tracing::debug!(
                    seq = ev.seq,
                    %from,
                    %to,
                    amount,
                    reason,
                    op_id,
                    bal,
                    "star spend"
                );
                Ok(bal)
            }
            Err(SpendError::AlreadyApplied { from_balance }) => {
                // Keep cache in sync
                if from_balance == 0 {
                    self.star_counts.remove(from);
                } else {
                    self.star_counts.insert(from.to_string(), from_balance);
                }
                Err(format!("already_applied:{from_balance}"))
            }
            Err(SpendError::Insufficient { have, need }) => {
                Err(format!("need {need} stars (you have {have})"))
            }
            Err(SpendError::Empty) => Err("invalid spend".into()),
            Err(SpendError::Io(e)) => {
                tracing::error!(error = %e, "star spend ledger io failed");
                Err("ledger write failed".into())
            }
        }
    }

    fn unix_now() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    }

    /// Default mid-tier gift cost / duration (reputation only — no money).
    const EFFECT_COST_STARS: u64 = 5;
    const EFFECT_DURATION_SECS: u64 = 15;

    fn normalize_effect_kind(raw: &str) -> Option<&'static str> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "bars" | "jail" | "fence" => Some("bars"),
            "flowers" | "flower" => Some("flowers"),
            "balloons" | "balloon" | "party" => Some("balloons"),
            "confetti" | "confet" | "celebrate" => Some("confetti"),
            "heart" | "hearts" | "wave" | "love" => Some("heart"),
            "fireworks" | "firework" | "mega" | "show" => Some("fireworks"),
            // Please stay: partner cannot Next for 15s (30★, once/month per pair)
            "please_stay" | "pleasestay" | "stay" | "dont_skip" | "no_skip" | "hold" => {
                Some("please_stay")
            }
            _ => None,
        }
    }

    /// (cost stars, duration seconds) per gift kind.
    fn effect_cost_duration(kind: &str) -> (u64, u64) {
        match kind {
            "heart" => (1, 8),
            "fireworks" => (15, 20),
            "please_stay" => (30, 15),
            _ => (Self::EFFECT_COST_STARS, Self::EFFECT_DURATION_SECS),
        }
    }

    /// Cooldown between Please stay spends on the same person (~30 days).
    const PLEASE_STAY_COOLDOWN_SECS: u64 = 30 * 24 * 60 * 60;

    /// True if this user currently cannot press Next (Please stay lock).
    fn is_no_skip_active(&mut self, user_id: &str) -> bool {
        if user_id.is_empty() {
            return false;
        }
        let now = Self::unix_now();
        match self.no_skip_until.get(user_id).copied() {
            Some(until) if until > now => true,
            Some(_) => {
                self.no_skip_until.remove(user_id);
                false
            }
            None => false,
        }
    }

    fn no_skip_secs_left(&self, user_id: &str) -> u64 {
        let now = Self::unix_now();
        self.no_skip_until
            .get(user_id)
            .copied()
            .filter(|u| *u > now)
            .map(|u| u - now)
            .unwrap_or(0)
    }

    /// Active effect for user if still running (clears expired from memory lazily).
    /// Returns (kind, until, level).
    fn active_effect_for(&mut self, user_id: &str) -> (String, u64, u32) {
        if user_id.is_empty() {
            return (String::new(), 0, 1);
        }
        let now = Self::unix_now();
        let expired = self
            .star_effects
            .get(user_id)
            .map(|e| e.until <= now)
            .unwrap_or(true);
        if expired {
            if self.star_effects.remove(user_id).is_some() {
                // Soft persist occasionally — only when something expired
                self.persist_friends();
            }
            return (String::new(), 0, 1);
        }
        self.star_effects
            .get(user_id)
            .map(|e| (e.kind.clone(), e.until, e.level.max(1) as u32))
            .unwrap_or_else(|| (String::new(), 0, 1))
    }

    fn active_effect_ro(&self, user_id: &str) -> (String, u64, u32) {
        if user_id.is_empty() {
            return (String::new(), 0, 1);
        }
        let now = Self::unix_now();
        match self.star_effects.get(user_id) {
            Some(e) if e.until > now => (e.kind.clone(), e.until, e.level.max(1) as u32),
            _ => (String::new(), 0, 1),
        }
    }

    /// Notify target + anyone currently matched with them about an effect.
    fn broadcast_star_effect(
        &self,
        target_uid: &str,
        effect: &str,
        until: u64,
        cost: u64,
        spender_uid: &str,
        spender_name: &str,
        spender_stars: u64,
        ok: bool,
        message: &str,
        level: u32,
    ) {
        let target_stars = self.stars_for(target_uid);
        let msg = ServerMsg::StarEffect {
            ok,
            user_id: target_uid.to_string(),
            effect: effect.to_string(),
            until,
            level: level.max(1).min(3),
            cost,
            spender_stars,
            target_stars,
            message: message.to_string(),
            from_user_id: spender_uid.to_string(),
            from_name: spender_name.to_string(),
        };
        // Target (if online)
        if let Some(&tid) = self.by_user.get(target_uid) {
            self.send(tid, msg.clone());
        }
        // Spender
        if let Some(&sid) = self.by_user.get(spender_uid) {
            self.send(sid, msg.clone());
        }
        // Anyone in a session with the target
        if let Some(&tid) = self.by_user.get(target_uid) {
            if let Some(tc) = self.clients.get(&tid) {
                let peers: Vec<Uuid> = tc.session_peers.iter().copied().collect();
                for pid in peers {
                    if let Some(pc) = self.clients.get(&pid) {
                        if pc.user_id != *spender_uid && pc.user_id != *target_uid {
                            self.send(pid, msg.clone());
                        }
                    }
                }
            }
        }
    }

    fn handle_spend_stars(
        &mut self,
        id: Uuid,
        to_user_id: String,
        effect_raw: String,
        op_id: String,
    ) {
        let Some(kind) = Self::normalize_effect_kind(&effect_raw) else {
            self.metrics_inc_star_spend(&effect_raw, false, 0);
            self.send(
                id,
                ServerMsg::StarEffect {
                    ok: false,
                    user_id: to_user_id,
                    effect: effect_raw,
                    until: 0,
                    level: 1,
                    cost: 0,
                    spender_stars: 0,
                    target_stars: 0,
                    message: "unknown effect".into(),
                    from_user_id: String::new(),
                    from_name: String::new(),
                },
            );
            return;
        };
        let to_user_id = to_user_id.trim().to_string();
        let op_id = op_id.trim().chars().take(80).collect::<String>();
        let Some(c) = self.clients.get(&id) else {
            return;
        };
        let me_uid = c.user_id.clone();
        let me_name = c.name.clone();
        let my_stars = self.stars_for(&me_uid);

        if me_uid.is_empty() || to_user_id.is_empty() || to_user_id == me_uid {
            self.metrics_inc_star_spend(kind, false, 0);
            self.send(
                id,
                ServerMsg::StarEffect {
                    ok: false,
                    user_id: to_user_id.clone(),
                    effect: kind.into(),
                    until: 0,
                    level: 1,
                    cost: 0,
                    spender_stars: my_stars,
                    target_stars: 0,
                    message: "invalid target".into(),
                    from_user_id: me_uid,
                    from_name: me_name,
                },
            );
            return;
        }

        // Idempotent retry: same client op_id already committed in ledger
        if !op_id.is_empty() && self.star_ledger.has_spend_op(&op_id) {
            let bal = self.stars_for(&me_uid);
            let (eff, until, eff_level) = self.active_effect_ro(&to_user_id);
            let until_out = if kind == "please_stay" {
                self.no_skip_until
                    .get(&to_user_id)
                    .copied()
                    .unwrap_or(0)
            } else {
                until
            };
            let effect_out = if kind == "please_stay" {
                kind.to_string()
            } else if !eff.is_empty() {
                eff
            } else {
                kind.to_string()
            };
            self.broadcast_star_effect(
                &to_user_id,
                &effect_out,
                until_out,
                Self::effect_cost_duration(kind).0,
                &me_uid,
                &me_name,
                bal,
                true,
                "already applied",
                eff_level,
            );
            return;
        }

        // Must be currently matched / in call with them (anti-harass spam from queue)
        let them_online = self.by_user.get(&to_user_id).copied();
        let in_session = them_online
            .and_then(|tid| {
                let ca = self.clients.get(&id)?;
                Some(
                    ca.partner == Some(tid)
                        || ca.friend_call == Some(tid)
                        || ca.session_peers.contains(&tid),
                )
            })
            .unwrap_or(false);
        if !in_session {
            self.metrics_inc_star_spend(kind, false, 0);
            self.send(
                id,
                ServerMsg::StarEffect {
                    ok: false,
                    user_id: to_user_id.clone(),
                    effect: kind.into(),
                    until: 0,
                    level: 1,
                    cost: 0,
                    spender_stars: my_stars,
                    target_stars: self.stars_for(&to_user_id),
                    message: "only during a live chat".into(),
                    from_user_id: me_uid,
                    from_name: me_name,
                },
            );
            return;
        }

        let (cost, dur_secs) = Self::effect_cost_duration(kind);
        if my_stars < cost {
            self.metrics_inc_star_spend(kind, false, 0);
            self.send(
                id,
                ServerMsg::StarEffect {
                    ok: false,
                    user_id: to_user_id.clone(),
                    effect: kind.into(),
                    until: 0,
                    level: 1,
                    cost: 0,
                    spender_stars: my_stars,
                    target_stars: self.stars_for(&to_user_id),
                    message: format!("need {} stars (you have {})", cost, my_stars),
                    from_user_id: me_uid,
                    from_name: me_name,
                },
            );
            return;
        }

        let now = Self::unix_now();

        // Please stay: once per month on the same person; no stacking/extend.
        if kind == "please_stay" {
            let edge = friends_store::star_edge_key(&me_uid, &to_user_id);
            if let Some(last) = self.please_stay_last.get(&edge).copied() {
                let elapsed = now.saturating_sub(last);
                if elapsed < Self::PLEASE_STAY_COOLDOWN_SECS {
                    let left = Self::PLEASE_STAY_COOLDOWN_SECS - elapsed;
                    let days = (left / 86_400).max(1);
                    self.metrics_inc_star_spend(kind, false, 0);
                    self.send(
                        id,
                        ServerMsg::StarEffect {
                            ok: false,
                            user_id: to_user_id.clone(),
                            effect: kind.into(),
                            until: 0,
                    level: 1,
                            cost: 0,
                            spender_stars: my_stars,
                            target_stars: self.stars_for(&to_user_id),
                            message: format!(
                                "please stay already used on them · try again in ~{} days",
                                days
                            ),
                            from_user_id: me_uid,
                            from_name: me_name,
                        },
                    );
                    return;
                }
            }
            if self
                .no_skip_until
                .get(&to_user_id)
                .copied()
                .unwrap_or(0)
                > now
            {
                self.metrics_inc_star_spend(kind, false, 0);
                self.send(
                    id,
                    ServerMsg::StarEffect {
                        ok: false,
                        user_id: to_user_id.clone(),
                        effect: kind.into(),
                        until: 0,
                    level: 1,
                        cost: 0,
                        spender_stars: my_stars,
                        target_stars: self.stars_for(&to_user_id),
                        message: "please stay already active".into(),
                        from_user_id: me_uid,
                        from_name: me_name,
                    },
                );
                return;
            }
        }

        // Deduct via append-only ledger (idempotent when op_id set)
        let reason = format!("spend:{kind}");
        let new_bal = match self.ledger_spend(
            &me_uid,
            &to_user_id,
            cost,
            &reason,
            &op_id,
            "",
        ) {
            Ok(bal) => bal,
            Err(msg) if msg.starts_with("already_applied:") => {
                // Retry with same op_id: do not re-apply effect, return current state
                let bal: u64 = msg
                    .trim_start_matches("already_applied:")
                    .parse()
                    .unwrap_or_else(|_| self.stars_for(&me_uid));
                let (eff, until, eff_level) = self.active_effect_ro(&to_user_id);
                let ns = self.no_skip_secs_left(&to_user_id);
                let effect_out = if kind == "please_stay" {
                    kind.to_string()
                } else if !eff.is_empty() {
                    eff
                } else {
                    kind.to_string()
                };
                let until_out = if kind == "please_stay" {
                    let now = Self::unix_now();
                    self.no_skip_until
                        .get(&to_user_id)
                        .copied()
                        .unwrap_or(now)
                } else {
                    until
                };
                let _ = ns;
                self.broadcast_star_effect(
                    &to_user_id,
                    &effect_out,
                    until_out,
                    cost,
                    &me_uid,
                    &me_name,
                    bal,
                    true,
                    "already applied",
                    eff_level,
                );
                return;
            }
            Err(msg) => {
                self.metrics_inc_star_spend(kind, false, 0);
                self.send(
                    id,
                    ServerMsg::StarEffect {
                        ok: false,
                        user_id: to_user_id.clone(),
                        effect: kind.into(),
                        until: 0,
                    level: 1,
                        cost: 0,
                        spender_stars: self.stars_for(&me_uid),
                        target_stars: self.stars_for(&to_user_id),
                        message: msg,
                        from_user_id: me_uid,
                        from_name: me_name,
                    },
                );
                return;
            }
        };

        let until;
        let message;
        let mut stack_level: u8 = 1;
        if kind == "please_stay" {
            // Separate from cosmetic overlays (bars/flowers…) so they can coexist.
            until = now.saturating_add(dur_secs);
            self.no_skip_until
                .insert(to_user_id.clone(), until);
            let edge = friends_store::star_edge_key(&me_uid, &to_user_id);
            self.please_stay_last.insert(edge, now);
            message = format!("please stay · {}s — they can't skip", dur_secs);
        } else {
            let prev = self.star_effects.get(&to_user_id).cloned();
            let extended = prev
                .as_ref()
                .map(|e| e.kind == kind && e.until > now)
                .unwrap_or(false);
            // Same-kind respend: raise intensity L1→L2→L3 and extend timer
            stack_level = if extended {
                prev.as_ref()
                    .map(|e| e.level.max(1).saturating_add(1).min(3))
                    .unwrap_or(1)
            } else {
                1
            };
            let base = match &prev {
                Some(e) if e.kind == kind && e.until > now => e.until,
                _ => now,
            };
            // Higher stacks last a bit longer (+3s per level above 1)
            let bonus = (stack_level.saturating_sub(1) as u64) * 3;
            until = base.saturating_add(dur_secs.saturating_add(bonus));
            self.star_effects.insert(
                to_user_id.clone(),
                friends_store::StarEffectRecord {
                    kind: kind.to_string(),
                    until,
                    level: stack_level,
                },
            );
            let lvl_tag = if stack_level >= 2 {
                format!(" · ×{stack_level}")
            } else {
                String::new()
            };
            message = if kind == "flowers" {
                if extended {
                    format!("+{dur_secs}s flowers extended{lvl_tag}")
                } else {
                    format!("flowers for {dur_secs}s{lvl_tag}")
                }
            } else if kind == "balloons" {
                if extended {
                    format!("+{dur_secs}s balloons extended{lvl_tag}")
                } else {
                    format!("balloons for {dur_secs}s{lvl_tag}")
                }
            } else if kind == "confetti" {
                if extended {
                    format!("+{dur_secs}s confetti burst extended{lvl_tag}")
                } else {
                    format!("confetti burst · {dur_secs}s{lvl_tag}")
                }
            } else if kind == "heart" {
                if extended {
                    format!("+{dur_secs}s hearts extended{lvl_tag}")
                } else {
                    format!("hearts for {dur_secs}s{lvl_tag}")
                }
            } else if kind == "fireworks" {
                if extended {
                    format!("+{dur_secs}s fireworks extended{lvl_tag}")
                } else {
                    format!("fireworks for {dur_secs}s{lvl_tag}")
                }
            } else if extended {
                format!("+{dur_secs}s bars extended{lvl_tag}")
            } else {
                format!("behind bars for {dur_secs}s{lvl_tag}")
            };
        }
        self.persist_friends();

        self.metrics_inc_star_spend(kind, true, cost);

        tracing::info!(
            %me_uid,
            %to_user_id,
            kind,
            until,
            level = stack_level,
            cost,
            remaining = new_bal,
            "star effect applied"
        );

        self.broadcast_star_effect(
            &to_user_id,
            kind,
            until,
            cost,
            &me_uid,
            &me_name,
            new_bal,
            true,
            &message,
            stack_level as u32,
        );
    }

    /// Resolve partner connection for star logic (1:1 partner / friend / session peer).
    fn star_partner_of(&self, id: Uuid) -> Option<(Uuid, String, String)> {
        let c = self.clients.get(&id)?;
        let them_id = c
            .partner
            .or(c.friend_call)
            .or_else(|| c.session_peers.iter().next().copied())?;
        if them_id == id {
            return None;
        }
        let them = self.clients.get(&them_id)?;
        let them_uid = them.user_id.clone();
        let them_name = display_label(them);
        if them_uid.is_empty() {
            return None;
        }
        Some((them_id, them_uid, them_name))
    }

    /// Cap hour_star_sessions growth (hour + senior-talk + owner-egg dedupe keys).
    fn trim_hour_star_sessions(&mut self) {
        if self.hour_star_sessions.len() > 6000 {
            let drop_n = self.hour_star_sessions.len() - 5000;
            let drain: Vec<String> = self
                .hour_star_sessions
                .iter()
                .take(drop_n)
                .cloned()
                .collect();
            for k in drain {
                self.hour_star_sessions.remove(&k);
            }
        }
    }

    /// True if display name is the site owner (Драконов / Dragonov). Case-insensitive.
    /// Intentional easter egg — do not surface this in client copy or docs.
    fn is_owner_egg_name(name: &str) -> bool {
        let n: String = name
            .trim()
            .chars()
            .flat_map(|c| c.to_lowercase())
            .collect();
        matches!(
            n.as_str(),
            "драконов" | "dragonov" | "drakonov" | "draconov"
        )
    }

    /// Stars for chatting with the owner this long (highest tier only). 0 = none.
    fn owner_egg_amount_for_secs(secs: u64) -> u64 {
        if secs >= Self::OWNER_EGG_TIER3_SECS {
            Self::OWNER_EGG_TIER3_STARS
        } else if secs >= Self::OWNER_EGG_TIER2_SECS {
            Self::OWNER_EGG_TIER2_STARS
        } else if secs >= Self::OWNER_EGG_TIER1_SECS {
            Self::OWNER_EGG_TIER1_STARS
        } else {
            0
        }
    }

    /// Resolve a stable display name for egg matching (live client + known_names).
    fn egg_name_for_uid(&self, uid: &str, live_name: &str) -> String {
        if Self::is_owner_egg_name(live_name) {
            return live_name.to_string();
        }
        self.known_names
            .get(uid)
            .cloned()
            .unwrap_or_else(|| live_name.to_string())
    }

    /// Quiet easter egg: visitor who talked to owner (Драконов) earns tiered ★ once per match.
    /// 2m→5 · 15m→15 · 1h→30. Owner does not receive this bonus. No UI advertising.
    fn try_award_owner_talk_egg(&mut self, id: Uuid) {
        let Some(c) = self.clients.get(&id) else {
            return;
        };
        let started = c.match_started;
        let secs = started.map(|t| t.elapsed().as_secs()).unwrap_or(0);
        let amount = Self::owner_egg_amount_for_secs(secs);
        if amount == 0 {
            return;
        }
        let me_uid = c.user_id.clone();
        let me_name = c.name.clone();
        if me_uid.is_empty() {
            return;
        }
        let Some((_them_id, them_uid, them_name_live)) = self.star_partner_of(id) else {
            return;
        };
        if them_uid == me_uid {
            return;
        }
        let them_name = self.egg_name_for_uid(&them_uid, &them_name_live);
        let me_is_owner = Self::is_owner_egg_name(&me_name)
            || Self::is_owner_egg_name(&self.egg_name_for_uid(&me_uid, &me_name));
        let them_is_owner = Self::is_owner_egg_name(&them_name);

        // Only the visitor talking *to* the owner gets the egg.
        let (visitor_uid, _owner_uid) = if them_is_owner && !me_is_owner {
            (me_uid.clone(), them_uid.clone())
        } else if me_is_owner && !them_is_owner {
            // Partner side is evaluating while owner is still connected —
            // award the other person (visitor), not the owner.
            (them_uid.clone(), me_uid.clone())
        } else {
            return;
        };

        let started_unix = Self::unix_now().saturating_sub(secs);
        let pair = friends_store::dm_conv_key(&me_uid, &them_uid);
        let egg_key = format!("owner|{pair}|{started_unix}");
        if self.hour_star_sessions.contains(&egg_key) {
            return;
        }
        // Claim egg + senior-talk so the public senior +3 does not stack on top of egg.
        let early_key = format!("seniortalk|{pair}|{started_unix}");
        self.hour_star_sessions.insert(egg_key);
        self.hour_star_sessions.insert(early_key);
        self.trim_hour_star_sessions();

        let new_bal = self.add_stars(&visitor_uid, amount, "mint:owner_egg");
        self.metrics_inc_star_hour();
        self.persist_friends();
        // Keep log opaque-ish (no "owner easter egg" string in public paths).
        tracing::info!(
            %visitor_uid,
            secs,
            amount,
            new_bal,
            "long-chat bonus (special host)"
        );
        if let Some(&cid) = self.by_user.get(&visitor_uid) {
            // Generic message → client shows ordinary received-stars toast (no host name).
            self.send(
                cid,
                ServerMsg::RateResult {
                    ok: true,
                    user_id: visitor_uid,
                    star: true,
                    amount,
                    stars: new_bal,
                    trust: 0,
                    message: "chat reward".into(),
                    from_user_id: String::new(),
                    from_name: String::new(),
                },
            );
        }
    }

    /// Auto hour reward for `me` given both **trust** scores.
    /// Talking to a senior (250+ trust): normal (&lt;100) → +3, trusted (100–249) → +2, else +1.
    fn hour_reward_amount_for(me_trust: u64, them_trust: u64) -> u64 {
        if them_trust >= Self::SENIOR_REPORTER_STARS {
            if me_trust < Self::TRUSTED_REPORTER_STARS {
                return 3;
            }
            if me_trust < Self::SENIOR_REPORTER_STARS {
                return 2;
            }
        }
        1
    }

    /// After ≥1 hour together, both earn stars automatically (once per match).
    /// Tier-aware: normal+senior → normal +3; trusted+senior → trusted +2; else +1 each.
    /// Senior may still gift more via RatePartner (up to 3★).
    fn try_award_hour_chat_stars(&mut self, id: Uuid) {
        let Some(c) = self.clients.get(&id) else {
            return;
        };
        let started = c.match_started;
        let secs = started.map(|t| t.elapsed().as_secs()).unwrap_or(0);
        if secs < Self::STAR_HOUR_BONUS_SECS {
            return;
        }
        let me_uid = c.user_id.clone();
        if me_uid.is_empty() {
            return;
        }
        let Some((_them_id, them_uid, them_name)) = self.star_partner_of(id) else {
            return;
        };
        if them_uid == me_uid {
            return;
        }
        let started_unix = Self::unix_now().saturating_sub(secs);
        let pair = friends_store::dm_conv_key(&me_uid, &them_uid);
        let key = format!("hour|{pair}|{started_unix}");
        if self.hour_star_sessions.contains(&key) {
            return;
        }
        // Claim early senior-talk key so we do not double-pay +3
        let early_key = format!("seniortalk|{pair}|{started_unix}");
        self.hour_star_sessions.insert(key);
        self.hour_star_sessions.insert(early_key);
        self.trim_hour_star_sessions();

        let me_s0 = self.effective_trust_for(&me_uid);
        let them_s0 = self.effective_trust_for(&them_uid);
        let me_amt = Self::hour_reward_amount_for(me_s0, them_s0);
        let them_amt = Self::hour_reward_amount_for(them_s0, me_s0);
        let sess = format!("hour|{pair}|{started_unix}");
        let me_stars = self.ledger_mint("", &me_uid, me_amt, "mint:hour_bonus", &sess);
        let them_stars =
            self.ledger_mint("", &them_uid, them_amt, "mint:hour_bonus", &sess);
        self.metrics_inc_star_hour();
        self.persist_friends();
        tracing::info!(
            %me_uid,
            %them_uid,
            secs,
            me_amt,
            them_amt,
            me_stars,
            them_stars,
            "1h mutual star bonus (tier-aware)"
        );
        let me_msg = if me_amt >= 3 {
            "hour chat reward · talked to senior"
        } else if me_amt >= 2 {
            "hour chat reward · trusted with senior"
        } else {
            "hour chat reward"
        };
        let them_msg = if them_amt >= 3 {
            "hour chat reward · talked to senior"
        } else if them_amt >= 2 {
            "hour chat reward · trusted with senior"
        } else {
            "hour chat reward"
        };
        if let Some(&cid) = self.by_user.get(&me_uid) {
            self.send(
                cid,
                ServerMsg::RateResult {
                    ok: true,
                    user_id: me_uid.clone(),
                    star: true,
                    amount: me_amt,
                    stars: me_stars,
                    trust: 0,
                    message: me_msg.into(),
                    from_user_id: String::new(),
                    from_name: String::new(),
                },
            );
        }
        if let Some(&tid) = self.by_user.get(&them_uid) {
            self.send(
                tid,
                ServerMsg::RateResult {
                    ok: true,
                    user_id: them_uid.clone(),
                    star: true,
                    amount: them_amt,
                    stars: them_stars,
                    trust: 0,
                    message: them_msg.into(),
                    from_user_id: String::new(),
                    from_name: String::new(),
                },
            );
        }
        let _ = them_name;
    }

    /// Normal (&lt;100★) talked to senior (250+) for ≥15 min but left before 1h:
    /// award +3 once per match (not stacked with hour senior boost).
    fn try_award_senior_talk_boost(&mut self, id: Uuid) {
        let Some(c) = self.clients.get(&id) else {
            return;
        };
        let started = c.match_started;
        let secs = started.map(|t| t.elapsed().as_secs()).unwrap_or(0);
        if secs < Self::STAR_MIN_SECS {
            return;
        }
        let me_uid = c.user_id.clone();
        if me_uid.is_empty() {
            return;
        }
        let Some((_them_id, them_uid, _them_name)) = self.star_partner_of(id) else {
            return;
        };
        if them_uid == me_uid {
            return;
        }
        let started_unix = Self::unix_now().saturating_sub(secs);
        let pair = friends_store::dm_conv_key(&me_uid, &them_uid);
        let hour_key = format!("hour|{pair}|{started_unix}");
        let early_key = format!("seniortalk|{pair}|{started_unix}");
        if self.hour_star_sessions.contains(&hour_key)
            || self.hour_star_sessions.contains(&early_key)
        {
            return;
        }

        let me_s = self.effective_trust_for(&me_uid);
        let them_s = self.effective_trust_for(&them_uid);
        let (boost_uid, boost_amt) = if me_s < Self::TRUSTED_REPORTER_STARS
            && them_s >= Self::SENIOR_REPORTER_STARS
        {
            (me_uid.clone(), 3u64)
        } else if them_s < Self::TRUSTED_REPORTER_STARS
            && me_s >= Self::SENIOR_REPORTER_STARS
        {
            (them_uid.clone(), 3u64)
        } else {
            return;
        };

        self.hour_star_sessions.insert(early_key);
        self.trim_hour_star_sessions();
        let new_bal = self.add_stars(&boost_uid, boost_amt, "mint:senior_talk");
        self.persist_friends();
        tracing::info!(
            %boost_uid,
            secs,
            boost_amt,
            new_bal,
            "senior-talk boost (+3 for normal after ≥15m with senior)"
        );
        if let Some(&cid) = self.by_user.get(&boost_uid) {
            self.send(
                cid,
                ServerMsg::RateResult {
                    ok: true,
                    user_id: boost_uid,
                    star: true,
                    amount: boost_amt,
                    stars: new_bal,
                    trust: 0,
                    message: "senior talk reward".into(),
                    from_user_id: String::new(),
                    from_name: String::new(),
                },
            );
        }
    }

    /// After a match/call ends:
    /// 1) ≥1 hour → tier-aware auto stars
    /// 2) ≥15 min normal+senior (no hour) → normal +3
    /// 3) quiet host easter egg (if applicable)
    /// 4) long enough chat → optional gift (up to 1/2/3 by giver tier)
    ///    First 3 unique partners: 5 min; after that: 15 min.
    fn arm_star_rating(&mut self, id: Uuid) {
        // Mutual hour bonus first (works even if gift already used)
        self.try_award_hour_chat_stars(id);
        // Early leave after 15m with a senior (if hour did not fire)
        self.try_award_senior_talk_boost(id);
        // Quiet host chat bonus (not advertised)
        self.try_award_owner_talk_egg(id);

        let Some(c) = self.clients.get(&id) else {
            return;
        };
        let started = c.match_started;
        let secs = started
            .map(|t| t.elapsed().as_secs())
            .unwrap_or(0);
        let me_uid = c.user_id.clone();
        if me_uid.is_empty() {
            return;
        }
        let need = self.rate_min_secs_for(&me_uid);
        if secs < need {
            return;
        }
        let Some((_them_id, them_uid, them_name)) = self.star_partner_of(id) else {
            return;
        };
        if them_uid == me_uid {
            return;
        }
        let edge = friends_store::star_edge_key(&me_uid, &them_uid);
        if self.star_edges.contains(&edge) {
            return; // already gifted/skipped this person
        }
        let early = need < Self::STAR_MIN_SECS;
        if let Some(c) = self.clients.get_mut(&id) {
            c.pending_rate_uid = Some(them_uid.clone());
            c.pending_rate_name = them_name.clone();
            c.pending_rate_secs = secs;
        }
        let max_gift = self.max_post_chat_gift(&me_uid);
        self.send(
            id,
            ServerMsg::RatePrompt {
                user_id: them_uid,
                name: them_name,
                duration_secs: secs,
                max_gift,
                early,
                min_secs: need,
            },
        );
    }

    /// Max free stars a user may gift after a long chat (effective trust tier).
    /// Normal → 1 · Trusted (100+) → 2 · Senior (250+) → 3.
    fn max_post_chat_gift(&self, user_id: &str) -> u64 {
        let s = self.effective_trust_for(user_id);
        if s >= Self::SENIOR_REPORTER_STARS {
            3
        } else if s >= Self::TRUSTED_REPORTER_STARS {
            2
        } else {
            1
        }
    }

    fn handle_rate_partner(
        &mut self,
        id: Uuid,
        target_uid: String,
        star: bool,
        amount: u64,
        thanks: bool,
    ) {
        let target_uid = target_uid.trim().to_string();
        let Some(c) = self.clients.get(&id) else {
            return;
        };
        let me_uid = c.user_id.clone();
        if me_uid.is_empty() || target_uid.is_empty() || target_uid == me_uid {
            self.send(
                id,
                ServerMsg::RateResult {
                    ok: false,
                    user_id: target_uid,
                    star: false,
                    amount: 0,
                    stars: 0,
                    trust: 0,
                    message: "invalid rating".into(),
                    from_user_id: String::new(),
                    from_name: String::new(),
                },
            );
            return;
        }
        let pending_uid = c.pending_rate_uid.clone();
        let pending_secs = c.pending_rate_secs;
        if pending_uid.as_deref() != Some(target_uid.as_str()) {
            self.send(
                id,
                ServerMsg::RateResult {
                    ok: false,
                    user_id: target_uid,
                    star: false,
                    amount: 0,
                    stars: 0,
                    trust: 0,
                    message: "no review available for this person".into(),
                    from_user_id: String::new(),
                    from_name: String::new(),
                },
            );
            return;
        }
        let need = self.rate_min_secs_for(&me_uid);
        if pending_secs < need {
            let need_m = (need + 59) / 60;
            self.send(
                id,
                ServerMsg::RateResult {
                    ok: false,
                    user_id: target_uid,
                    star: false,
                    amount: 0,
                    stars: 0,
                    trust: 0,
                    message: format!("chat too short for a star (need {need_m} minutes)"),
                    from_user_id: String::new(),
                    from_name: String::new(),
                },
            );
            return;
        }
        let edge = friends_store::star_edge_key(&me_uid, &target_uid);
        if self.star_edges.contains(&edge) {
            self.send(
                id,
                ServerMsg::RateResult {
                    ok: false,
                    user_id: target_uid.clone(),
                    star: false,
                    amount: 0,
                    stars: self.stars_for(&target_uid),
                    trust: 0,
                    message: "already reviewed".into(),
                    from_user_id: String::new(),
                    from_name: String::new(),
                },
            );
            // clear pending so UI stops
            if let Some(c) = self.clients.get_mut(&id) {
                c.pending_rate_uid = None;
                c.pending_rate_secs = 0;
            }
            return;
        }
        self.star_edges.insert(edge);
        let max_gift = self.max_post_chat_gift(&me_uid);
        let gift_n = if star {
            let raw = if amount == 0 { 1 } else { amount };
            raw.clamp(1, max_gift)
        } else {
            0
        };
        // Thanks/vouch only when not gifting (star wins if both set)
        let did_thanks = !star && thanks;
        if did_thanks {
            self.vouch_edges
                .insert(friends_store::star_edge_key(&me_uid, &target_uid));
        }
        let new_stars = if gift_n > 0 {
            self.add_stars_from(&me_uid, &target_uid, gift_n, "mint:rate_partner")
        } else {
            self.stars_for(&target_uid)
        };
        let new_trust = self.trust_for(&target_uid);
        if gift_n > 0 {
            // Count once per review action (not per star) for gift metrics
            self.metrics_inc_star_gift();
        }
        if let Some(c) = self.clients.get_mut(&id) {
            c.pending_rate_uid = None;
            c.pending_rate_name.clear();
            c.pending_rate_secs = 0;
        }
        self.persist_friends();
        let gave = gift_n > 0;
        let me_name = self
            .clients
            .get(&id)
            .map(|c| c.name.clone())
            .filter(|n| !n.is_empty() && n != "anon")
            .unwrap_or_else(|| "someone".into());
        let msg_self = if gave {
            if gift_n == 1 {
                "star given".into()
            } else {
                format!("{gift_n} stars given")
            }
        } else if did_thanks {
            "thanks sent".into()
        } else {
            "skipped".into()
        };
        self.send(
            id,
            ServerMsg::RateResult {
                ok: true,
                user_id: target_uid.clone(),
                star: gave,
                amount: gift_n,
                stars: new_stars,
                trust: new_trust,
                message: msg_self,
                from_user_id: me_uid.clone(),
                from_name: me_name.clone(),
            },
        );
        // Live-update target if online (their local badge / friends list)
        if gave {
            if let Some(&tid) = self.by_user.get(&target_uid) {
                self.send(
                    tid,
                    ServerMsg::RateResult {
                        ok: true,
                        user_id: target_uid.clone(),
                        star: true,
                        amount: gift_n,
                        stars: new_stars,
                        trust: new_trust,
                        message: if gift_n == 1 {
                            "you received a star".into()
                        } else {
                            format!("you received {gift_n} stars")
                        },
                        from_user_id: me_uid.clone(),
                        from_name: me_name.clone(),
                    },
                );
            }
        } else if did_thanks {
            if let Some(&tid) = self.by_user.get(&target_uid) {
                self.send(
                    tid,
                    ServerMsg::RateResult {
                        ok: true,
                        user_id: me_uid.clone(),
                        star: false,
                        amount: 0,
                        stars: self.stars_for(&target_uid),
                        trust: self.trust_for(&target_uid),
                        message: "someone thanked you".into(),
                        from_user_id: me_uid.clone(),
                        from_name: me_name.clone(),
                    },
                );
            }
        }
        if gave || did_thanks {
            self.push_friends_list(id);
            if let Some(&tid) = self.by_user.get(&target_uid) {
                self.push_friends_list(tid);
            }
        }
        tracing::info!(
            %me_uid,
            %target_uid,
            star = gave,
            amount = gift_n,
            max_gift,
            thanks = did_thanks,
            stars = new_stars,
            trust = new_trust,
            "partner rated"
        );
    }

    /// Last DM involving `fuid` across any conversation they share with someone.
    /// Used only for friend list previews — we need the peer context from call site.
    fn last_dm_preview_for_pair(&self, a: &str, b: &str) -> (String, u64) {
        let key = friends_store::dm_conv_key(a, b);
        if let Some(list) = self.dms.get(&key) {
            if let Some(m) = list.last() {
                let preview: String = m.body.chars().take(80).collect();
                return (preview, m.ts);
            }
        }
        (String::new(), 0)
    }

    fn last_dm_preview_for(&self, _fuid: &str) -> (String, u64) {
        // Filled per-pair in push_friends_list; keep default empty here for other callers.
        (String::new(), 0)
    }

    fn are_mutual_friends(&self, a: &str, b: &str) -> bool {
        self.friendships
            .get(a)
            .map(|s| s.contains(b))
            .unwrap_or(false)
            && self
                .friendships
                .get(b)
                .map(|s| s.contains(a))
                .unwrap_or(false)
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
        if a.is_empty() || b.is_empty() || a == b {
            return;
        }
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

    /// Fallback unique *reporter count* before auto match-ban (generic/other).
    /// Brigade-resistant v1: ban score uses **1 point per independent reporter**
    /// for non-underage reasons (stars/trust no longer buy ×2/×3 ban artillery).
    const REPORT_BAN_THRESHOLD: usize = 4;
    /// Default ban length when generic threshold is hit (3 days).
    const REPORT_BAN_SECS: u64 = 3 * 24 * 3600;
    /// Max reports one user may file per rolling hour (anti abuse / raid).
    const REPORT_RATE_PER_HOUR: usize = 8;
    /// Reputation trust for trusted *label* (UI / soft rank — not ban ×2).
    const TRUSTED_REPORTER_STARS: u64 = 100;
    /// Historical trusted weight (UI only; ban scoring caps at 1 for non-underage).
    const TRUSTED_REPORT_WEIGHT: u32 = 2;
    /// Reputation trust for senior *label*.
    const SENIOR_REPORTER_STARS: u64 = 250;
    /// Historical senior weight (UI only).
    const SENIOR_REPORT_WEIGHT: u32 = 3;
    /// Raid: ≥N reports on one target within this window → soft-handle, no permanent.
    const REPORT_RAID_WINDOW_SECS: u64 = 15 * 60;
    const REPORT_RAID_SPIKE_N: usize = 6;
    /// Cap ban length under raid spike (seconds).
    const REPORT_RAID_BAN_CAP_SECS: u64 = 48 * 3600;
    /// Permanent escalate needs at least this many unique reporters (not one feud).
    const REPORT_PERMANENT_MIN_REPORTERS: usize = 3;

    /// Severity → (score needed, ban duration secs).
    /// Underage: single report → long restriction (safety priority).
    /// Explicit: 3 independent reporters → 90 days (was 2 weighted / easy brigade).
    /// Permanent only via multi-reporter escalate or admin — not stream raids.
    fn report_severity(reason: &str) -> (usize, u64) {
        let r = reason.trim().to_ascii_lowercase();
        match r.as_str() {
            "underage" => (1, 30 * 24 * 3600),
            // Human/AI explicit: need broader consensus than a stream chat raid
            "explicit" | "explicit_ai" => (3, 90 * 24 * 3600),
            "harassment" | "hate" => (3, 14 * 24 * 3600),
            "spam" | "scam" => (4, 7 * 24 * 3600),
            // Politics / flags / "don't like them" land here — higher bar
            _ => (Self::REPORT_BAN_THRESHOLD, Self::REPORT_BAN_SECS),
        }
    }

    /// Minimum distinct reporters required for auto-ban (in addition to score).
    fn min_unique_reporters(reason: &str) -> usize {
        let r = reason.trim().to_ascii_lowercase();
        match r.as_str() {
            "underage" => 1,
            "explicit" | "explicit_ai" => 3,
            "harassment" | "hate" => 3,
            "spam" | "scam" => 4,
            _ => 4,
        }
    }

    /// Permanent match ban far-future unix (~year 2200).
    const PERMANENT_BAN_UNTIL: u64 = 7_258_118_400;
    /// Max recent matches kept for /v1/admin/recent_matches.
    const MAX_RECENT_MATCHES: usize = 80;

    /// Display / audit weight from effective trust (1 / 2 / 3).
    /// Ban scoring no longer multiplies by this for non-underage (brigade-resistant v1).
    fn report_weight_for(&self, reporter_uid: &str) -> u32 {
        let trust = self.effective_trust_for(reporter_uid);
        if trust >= Self::SENIOR_REPORTER_STARS {
            Self::SENIOR_REPORT_WEIGHT
        } else if trust >= Self::TRUSTED_REPORTER_STARS {
            Self::TRUSTED_REPORT_WEIGHT
        } else {
            1
        }
    }

    /// Extra ban-score needed when the *target* is high effective trust (harder to ban).
    /// Not applied to underage reports (safety takes priority).
    fn target_reputation_shield(target_trust: u64) -> usize {
        if target_trust >= Self::SENIOR_REPORTER_STARS {
            3 // 250+ need broader consensus (with flat weights)
        } else if target_trust >= Self::TRUSTED_REPORTER_STARS {
            1
        } else {
            0
        }
    }

    /// Weight this reporter contributes toward auto-banning this target.
    /// Brigade-resistant v1:
    /// - Underage: full tier weight (1–3) — safety first.
    /// - Other reasons: **max 1** per reporter (stars cannot buy ban power).
    /// - Mutual feud (they already reported you): **0** toward auto-ban.
    /// - Two seniors still cannot cancel each other via auto-ban (0).
    fn report_weight_against(
        &self,
        reporter_uid: &str,
        target_uid: &str,
        underage: bool,
    ) -> u32 {
        if reporter_uid.is_empty() || reporter_uid == target_uid {
            return 0;
        }
        let base = self.report_weight_for(reporter_uid);
        if underage {
            return base;
        }
        // Mutual report war: if target already reported this reporter, no ban ammo
        if self
            .report_reporters
            .get(reporter_uid)
            .map(|s| s.contains(target_uid))
            .unwrap_or(false)
        {
            return 0;
        }
        let r_trust = self.effective_trust_for(reporter_uid);
        let t_trust = self.effective_trust_for(target_uid);
        // Seniors cannot cancel each other out via auto match-ban
        if r_trust >= Self::SENIOR_REPORTER_STARS && t_trust >= Self::SENIOR_REPORTER_STARS {
            return 0;
        }
        // Flat weight: trust is not ban artillery
        1
    }

    /// Record a report timestamp for raid-spike detection (memory only).
    fn note_report_time(&mut self, target_uid: &str, now: u64) -> usize {
        let times = self.report_recent.entry(target_uid.to_string()).or_default();
        times.push(now);
        times.retain(|t| now.saturating_sub(*t) <= Self::REPORT_RAID_WINDOW_SECS);
        // Cap memory per target
        if times.len() > 64 {
            let drop_n = times.len() - 64;
            times.drain(0..drop_n);
        }
        times.len()
    }

    fn is_raid_spike(&self, target_uid: &str, now: u64) -> bool {
        self.report_recent
            .get(target_uid)
            .map(|times| {
                times
                    .iter()
                    .filter(|t| now.saturating_sub(**t) <= Self::REPORT_RAID_WINDOW_SECS)
                    .count()
                    >= Self::REPORT_RAID_SPIKE_N
            })
            .unwrap_or(false)
    }

    /// Sum of unique reporters' effective weights against this target.
    fn report_score_for_target(&self, target_uid: &str, underage: bool) -> u32 {
        self.report_reporters
            .get(target_uid)
            .map(|set| {
                set.iter()
                    .map(|uid| self.report_weight_against(uid, target_uid, underage))
                    .sum()
            })
            .unwrap_or(0)
    }

    fn is_blocked_pair_conn(&self, a: Uuid, b: Uuid) -> bool {
        let (Some(ca), Some(cb)) = (self.clients.get(&a), self.clients.get(&b)) else {
            return true;
        };
        self.is_blocked_pair_uid(&ca.user_id, &cb.user_id)
    }

    fn entry_is_stranger_party(&self, e: &QueueEntry) -> bool {
        match e {
            QueueEntry::Party { a, b } => {
                self.clients.get(a).map(|c| c.stranger_party).unwrap_or(false)
                    || self.clients.get(b).map(|c| c.stranger_party).unwrap_or(false)
            }
            QueueEntry::Party3 { a, b, c } => [a, b, c].iter().any(|id| {
                self.clients
                    .get(id)
                    .map(|cl| cl.stranger_party)
                    .unwrap_or(false)
            }),
            _ => false,
        }
    }

    /// Stranger-formed parties only hunt one solo — never party↔party (2v2/3v3).
    fn stranger_party_blocks_2v2(&self, left: &QueueEntry, right: &QueueEntry) -> bool {
        let left_party = matches!(left, QueueEntry::Party { .. } | QueueEntry::Party3 { .. });
        let right_party = matches!(right, QueueEntry::Party { .. } | QueueEntry::Party3 { .. });
        left_party
            && right_party
            && (self.entry_is_stranger_party(left) || self.entry_is_stranger_party(right))
    }

    /// Entries may match only if no member of left is blocked vs any member of right.
    /// Allowed: solo↔solo, solo↔party2, solo↔party3, party2↔party2. No party3↔party*.
    fn entries_compatible(&self, left: &QueueEntry, right: &QueueEntry) -> bool {
        // Shape gate
        let shape_ok = match (left, right) {
            (QueueEntry::Solo(_), QueueEntry::Solo(_)) => true,
            (QueueEntry::Solo(_), QueueEntry::Party { .. })
            | (QueueEntry::Party { .. }, QueueEntry::Solo(_)) => true,
            (QueueEntry::Solo(_), QueueEntry::Party3 { .. })
            | (QueueEntry::Party3 { .. }, QueueEntry::Solo(_)) => true,
            (QueueEntry::Party { .. }, QueueEntry::Party { .. }) => true,
            // Party3 only matches solos (3v1), never other parties
            (QueueEntry::Party3 { .. }, _) | (_, QueueEntry::Party3 { .. }) => false,
        };
        if !shape_ok {
            return false;
        }
        let left_ids = Self::queue_entry_ids(left);
        let right_ids = Self::queue_entry_ids(right);
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
            }
        }
        true
    }

    /// Solo↔solo just ended this pair — deprioritize, but still allow when alone.
    fn is_last_partner_rematch(&self, left: &QueueEntry, right: &QueueEntry) -> bool {
        let (QueueEntry::Solo(a), QueueEntry::Solo(b)) = (left, right) else {
            return false;
        };
        let last_a = self.clients.get(a).and_then(|c| c.last_partner);
        let last_b = self.clients.get(b).and_then(|c| c.last_partner);
        last_a == Some(*b) || last_b == Some(*a)
    }

    /// Soft gender + interest tags for solo↔solo. Empty tags = no preference.
    /// Never hard-filters the pool (try_match falls back when no soft pair).
    fn entries_prefs_soft_ok(&self, left: &QueueEntry, right: &QueueEntry) -> bool {
        match (left, right) {
            (QueueEntry::Solo(a), QueueEntry::Solo(b)) => {
                let (Some(ca), Some(cb)) = (self.clients.get(a), self.clients.get(b)) else {
                    return false;
                };
                looking_accepts(&ca.looking, &cb.gender)
                    && looking_accepts(&cb.looking, &ca.gender)
                    && tags_soft_ok(&ca.tags, &cb.tags)
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
                        || !tags_soft_ok(&cs.tags, &cp.tags)
                    {
                        return false;
                    }
                }
                true
            }
            (QueueEntry::Solo(s), QueueEntry::Party3 { a, b, c })
            | (QueueEntry::Party3 { a, b, c }, QueueEntry::Solo(s)) => {
                let Some(cs) = self.clients.get(s) else {
                    return false;
                };
                for pid in [a, b, c] {
                    let Some(cp) = self.clients.get(pid) else {
                        return false;
                    };
                    if !looking_accepts(&cs.looking, &cp.gender)
                        || !looking_accepts(&cp.looking, &cs.gender)
                        || !tags_soft_ok(&cs.tags, &cp.tags)
                    {
                        return false;
                    }
                }
                true
            }
            _ => true,
        }
    }

    /// Representative **effective** trust for a queue entry (solo / party max).
    fn entry_trust(&self, e: &QueueEntry) -> u64 {
        match e {
            QueueEntry::Solo(id) => self
                .clients
                .get(id)
                .map(|c| self.effective_trust_for(&c.user_id))
                .unwrap_or(0),
            QueueEntry::Party3 { a, b, c } => {
                [*a, *b, *c]
                    .iter()
                    .filter_map(|id| self.clients.get(id))
                    .map(|c| self.effective_trust_for(&c.user_id))
                    .max()
                    .unwrap_or(0)
            }
            QueueEntry::Party { a, b } => {
                let ta = self
                    .clients
                    .get(a)
                    .map(|c| self.effective_trust_for(&c.user_id))
                    .unwrap_or(0);
                let tb = self
                    .clients
                    .get(b)
                    .map(|c| self.effective_trust_for(&c.user_id))
                    .unwrap_or(0);
                ta.max(tb)
            }
        }
    }

    /// Soft ranking among gender/tag-compatible pairs (never hard-blocks).
    /// Higher = preferred. Deprioritizes new↔new; lightly boosts known/trusted.
    /// Only meaningful when several soft candidates exist (empty pool: FIFO).
    fn pair_trust_rank(&self, left: &QueueEntry, right: &QueueEntry) -> i32 {
        let ta = self.entry_trust(left);
        let tb = self.entry_trust(right);
        let mut score: i32 = 0;
        // Prefer mixed or known pairs over two brand-new (trust 0) strangers
        if ta == 0 && tb == 0 {
            score -= 50;
        } else if (ta == 0) != (tb == 0) {
            // One new + one known — good onboarding
            score += 25;
        } else {
            score += 8;
        }
        // Tiny priority for high-trust when pool is busy (waiting solos ≥ 3)
        let busy = self.waiting_solo_count() >= 3;
        if busy {
            if ta >= Self::SENIOR_REPORTER_STARS || tb >= Self::SENIOR_REPORTER_STARS {
                score += 12;
            } else if ta >= Self::TRUSTED_REPORTER_STARS || tb >= Self::TRUSTED_REPORTER_STARS {
                score += 6;
            }
        }
        // Slight preference for higher min trust (less spammy pairings)
        let min_t = ta.min(tb).min(50) as i32;
        score += min_t / 10;
        score
    }

    fn metrics_path(&self) -> PathBuf {
        self.friends_path
            .parent()
            .map(|p| p.join("metrics.jsonl"))
            .unwrap_or_else(|| PathBuf::from("data/metrics.jsonl"))
    }

    fn metrics_roll_day(&mut self) {
        let today = utc_day();
        if self.metrics.day.is_empty() {
            self.metrics.day = today.clone();
        }
        if self.metrics.day != today {
            self.metrics_flush();
            self.metrics = DayMetrics {
                day: today,
                ..DayMetrics::default()
            };
        }
    }

    fn metrics_flush(&self) {
        if self.metrics.day.is_empty() {
            return;
        }
        let path = self.metrics_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        // Rewrite file: keep other days, replace today's line
        let mut rows: Vec<DayMetrics> = Vec::new();
        if let Ok(text) = std::fs::read_to_string(&path) {
            for line in text.lines() {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }
                if let Ok(row) = serde_json::from_str::<DayMetrics>(line) {
                    if row.day != self.metrics.day {
                        rows.push(row);
                    }
                }
            }
        }
        rows.push(self.metrics.clone());
        rows.sort_by(|a, b| a.day.cmp(&b.day));
        // Keep last ~90 days
        let skip = rows.len().saturating_sub(90);
        let body: String = rows
            .into_iter()
            .skip(skip)
            .filter_map(|r| serde_json::to_string(&r).ok())
            .map(|s| s + "\n")
            .collect();
        let _ = std::fs::write(&path, body);
    }

    fn metrics_touch_peaks(&mut self) {
        self.metrics_roll_day();
        let online = self.online() as u64;
        let waiting = self.waiting_count() as u64;
        if online > self.metrics.peak_online {
            self.metrics.peak_online = online;
        }
        if waiting > self.metrics.peak_waiting {
            self.metrics.peak_waiting = waiting;
        }
    }

    fn metrics_inc_match(&mut self) {
        self.metrics_roll_day();
        self.metrics.matches = self.metrics.matches.saturating_add(1);
        self.metrics_touch_peaks();
        if self.metrics.matches % 5 == 0 {
            self.metrics_flush();
        }
    }

    /// Record length of a completed stranger match (seconds).
    fn metrics_record_match_duration(&mut self, started: Option<Instant>) {
        let Some(t0) = started else {
            return;
        };
        let secs = t0.elapsed().as_secs().min(86_400);
        if secs == 0 {
            return;
        }
        self.metrics_roll_day();
        self.metrics.match_seconds = self.metrics.match_seconds.saturating_add(secs);
        self.metrics.match_duration_n = self.metrics.match_duration_n.saturating_add(1);
    }

    fn metrics_record_wait(&mut self, started: Option<Instant>) {
        let Some(t0) = started else {
            return;
        };
        let secs = t0.elapsed().as_secs().min(86_400);
        self.metrics_roll_day();
        self.metrics.wait_seconds = self.metrics.wait_seconds.saturating_add(secs);
        self.metrics.wait_n = self.metrics.wait_n.saturating_add(1);
    }

    fn metrics_inc_friend_call(&mut self) {
        self.metrics_roll_day();
        self.metrics.friend_calls = self.metrics.friend_calls.saturating_add(1);
        if self.metrics.friend_calls % 3 == 0 {
            self.metrics_flush();
        }
    }

    /// Public growth funnel events from the UI (rate-limit at HTTP layer).
    pub fn metrics_inc_funnel(&mut self, event: &str) -> bool {
        self.metrics_roll_day();
        let e = event.trim().to_ascii_lowercase().replace('-', "_");
        match e.as_str() {
            "funnel_invite_share" | "friend_invite_share" | "empty_alone_invite_share" => {
                self.metrics.funnel_invite_share =
                    self.metrics.funnel_invite_share.saturating_add(1);
            }
            "funnel_invite_land" | "friend_invite_deep_link" | "invite_landing_open" => {
                self.metrics.funnel_invite_land =
                    self.metrics.funnel_invite_land.saturating_add(1);
            }
            "funnel_invite_request" => {
                self.metrics.funnel_invite_request =
                    self.metrics.funnel_invite_request.saturating_add(1);
            }
            "funnel_invite_connected" => {
                self.metrics.funnel_invite_connected =
                    self.metrics.funnel_invite_connected.saturating_add(1);
            }
            "home_invite_pack_copy" => {
                self.metrics.funnel_home_pack_copy =
                    self.metrics.funnel_home_pack_copy.saturating_add(1);
            }
            "home_invite_pack_live" => {
                self.metrics.funnel_home_pack_live =
                    self.metrics.funnel_home_pack_live.saturating_add(1);
            }
            "friend_nudge_show" => {
                self.metrics.funnel_friend_nudge_show =
                    self.metrics.funnel_friend_nudge_show.saturating_add(1);
            }
            "friend_nudge_accept" => {
                self.metrics.funnel_friend_nudge_accept =
                    self.metrics.funnel_friend_nudge_accept.saturating_add(1);
            }
            _ => return false,
        }
        let total = self.metrics.funnel_invite_share
            + self.metrics.funnel_invite_land
            + self.metrics.funnel_home_pack_copy;
        if total % 10 == 0 {
            self.metrics_flush();
        }
        true
    }

    fn metrics_inc_call_ring(&mut self) {
        self.metrics_roll_day();
        self.metrics.call_rings = self.metrics.call_rings.saturating_add(1);
    }

    fn take_wait_started(&mut self, id: Uuid) -> Option<Instant> {
        self.clients.get_mut(&id).and_then(|c| c.wait_started.take())
    }

    fn metrics_inc_report(&mut self) {
        self.metrics_roll_day();
        self.metrics.reports = self.metrics.reports.saturating_add(1);
        self.metrics_flush();
    }

    fn metrics_inc_block(&mut self) {
        self.metrics_roll_day();
        self.metrics.blocks = self.metrics.blocks.saturating_add(1);
        if self.metrics.blocks % 3 == 0 {
            self.metrics_flush();
        }
    }

    fn metrics_inc_queue_join(&mut self, alone: bool) {
        self.metrics_roll_day();
        self.metrics.queue_joins = self.metrics.queue_joins.saturating_add(1);
        if alone {
            self.metrics.alone_joins = self.metrics.alone_joins.saturating_add(1);
        }
        self.metrics_touch_peaks();
    }

    fn metrics_inc_star_hour(&mut self) {
        self.metrics_roll_day();
        self.metrics.star_hour_awards = self.metrics.star_hour_awards.saturating_add(1);
        if self.metrics.star_hour_awards % 3 == 0 {
            self.metrics_flush();
        }
    }

    fn metrics_inc_star_gift(&mut self) {
        self.metrics_roll_day();
        self.metrics.star_gifts = self.metrics.star_gifts.saturating_add(1);
        if self.metrics.star_gifts % 5 == 0 {
            self.metrics_flush();
        }
    }

    fn metrics_inc_star_spend(&mut self, kind: &str, ok: bool, cost: u64) {
        self.metrics_roll_day();
        if ok {
            self.metrics.star_spend_ok = self.metrics.star_spend_ok.saturating_add(1);
            self.metrics.star_spent_total =
                self.metrics.star_spent_total.saturating_add(cost);
            if kind == "bars" {
                self.metrics.star_spend_bars =
                    self.metrics.star_spend_bars.saturating_add(1);
            } else if kind == "flowers" {
                self.metrics.star_spend_flowers =
                    self.metrics.star_spend_flowers.saturating_add(1);
            } else if kind == "balloons" {
                self.metrics.star_spend_balloons =
                    self.metrics.star_spend_balloons.saturating_add(1);
            } else if kind == "confetti" {
                self.metrics.star_spend_confetti =
                    self.metrics.star_spend_confetti.saturating_add(1);
            } else if kind == "heart" {
                self.metrics.star_spend_heart =
                    self.metrics.star_spend_heart.saturating_add(1);
            } else if kind == "fireworks" {
                self.metrics.star_spend_fireworks =
                    self.metrics.star_spend_fireworks.saturating_add(1);
            } else if kind == "please_stay" {
                self.metrics.star_spend_please_stay =
                    self.metrics.star_spend_please_stay.saturating_add(1);
            }
        } else {
            self.metrics.star_spend_fail = self.metrics.star_spend_fail.saturating_add(1);
        }
        if (self.metrics.star_spend_ok + self.metrics.star_spend_fail) % 5 == 0 {
            self.metrics_flush();
        }
    }

    /// Snapshot for admin / health (today + recent history).
    pub fn metrics_snapshot(&mut self) -> serde_json::Value {
        self.metrics_roll_day();
        self.metrics_touch_peaks();
        self.metrics_flush();
        let path = self.metrics_path();
        let mut history: Vec<DayMetrics> = Vec::new();
        if let Ok(text) = std::fs::read_to_string(&path) {
            for line in text.lines().rev() {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }
                if let Ok(row) = serde_json::from_str::<DayMetrics>(line) {
                    history.push(row);
                }
                if history.len() >= 14 {
                    break;
                }
            }
        }
        history.reverse();
        let joins = self.metrics.queue_joins.max(1);
        let alone_pct = ((self.metrics.alone_joins as f64 / joins as f64) * 1000.0).round() / 10.0;
        let avg_match_sec = if self.metrics.match_duration_n > 0 {
            (self.metrics.match_seconds / self.metrics.match_duration_n) as u64
        } else {
            0
        };
        let avg_wait_sec = if self.metrics.wait_n > 0 {
            (self.metrics.wait_seconds / self.metrics.wait_n) as u64
        } else {
            0
        };
        let ring_to_call_pct = if self.metrics.call_rings > 0 {
            ((self.metrics.friend_calls as f64 / self.metrics.call_rings as f64) * 1000.0).round()
                / 10.0
        } else {
            0.0
        };
        serde_json::json!({
            "today": self.metrics,
            "today_extras": {
                "alone_pct": alone_pct,
                "avg_match_sec": avg_match_sec,
                "avg_wait_sec": avg_wait_sec,
                "friend_calls": self.metrics.friend_calls,
                "call_rings": self.metrics.call_rings,
                "ring_to_call_pct": ring_to_call_pct,
                "funnel": {
                    "invite_share": self.metrics.funnel_invite_share,
                    "invite_land": self.metrics.funnel_invite_land,
                    "invite_request": self.metrics.funnel_invite_request,
                    "invite_connected": self.metrics.funnel_invite_connected,
                    "home_pack_copy": self.metrics.funnel_home_pack_copy,
                    "home_pack_live": self.metrics.funnel_home_pack_live,
                    "friend_nudge_show": self.metrics.funnel_friend_nudge_show,
                    "friend_nudge_accept": self.metrics.funnel_friend_nudge_accept,
                },
            },
            "stars_ledger": self.stars_ledger_snapshot(),
            "history": history,
            "path": path.display().to_string(),
        })
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
            c.match_started = Some(Instant::now());
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

        let (eff, eff_until, eff_level) = self.active_effect_ro(&remote.user_id);
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
            stars: self.stars_for(&remote.user_id),
            trust: self.effective_trust_for(&remote.user_id),
            trust_gifters: self.trust_gifters_for(&remote.user_id),
            effect: eff,
            effect_until: eff_until,
            effect_level: eff_level,
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
                        from_user_id: String::new(),
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
                QueueEntry::Party { a, .. } | QueueEntry::Party3 { a, .. } => {
                    self.room_of(*a) == *room
                }
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
                stranger_party: false,
                gender: String::new(),
                looking: "any".into(),
                flag: String::new(),
                avatar: String::new(),
                tags: Vec::new(),
                limiter: ClientLimiter::new(),
                report_times: Vec::new(),
                match_started: None,
                wait_started: None,
                pending_rate_uid: None,
                pending_rate_name: String::new(),
                pending_rate_secs: 0,
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
            stars: 0,
            trust: 0,
            trust_effective: 0,
            trust_gifters: 0,
            trust_givers: Vec::new(),
            trust_last_ts: 0,
            effect: String::new(),
            effect_until: 0,
            effect_level: 1,
            // Pre-identity connect: treat as full early-rate budget
            rate_min_secs: Self::STAR_FIRST_RATE_SECS,
            early_rates_left: Self::STAR_FIRST_RATE_SLOTS as u32,
        })
    }

    pub fn notify_join(&mut self) {
        self.broadcast_lobby_info();
    }

    pub fn remove_client(&mut self, id: Uuid) {
        self.dequeue_client(id);
        self.clear_fed_for_client(id);
        // Pending find-third invites involving this client
        if let Some(p) = self.find_third_pending.clone() {
            if p.from == id || p.to == id {
                self.find_third_pending = None;
                let other = if p.from == id { p.to } else { p.from };
                self.send(
                    other,
                    ServerMsg::FindThirdResult {
                        ok: false,
                        reason: "left".into(),
                    },
                );
            }
        }
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

        // 3-way leave FIRST (while party_with / session_peers still intact).
        // end_friend_call would wipe mate state and prevent "keep remaining + 3rd".
        let kept_pair =
            self.leave_keep_remaining_pair(id, "partner left — still chatting");
        if kept_pair {
            // Remaining pair was collapsed to solo 1v1 (or party re-queued).
            // Do not end_friend_call on the mate — that would kick them out of the keep.
            if let Some(fid) = friend_call {
                // Only clear the leaving side's friend_call flag (mate already reconfigured)
                if let Some(c) = self.clients.get_mut(&id) {
                    if c.friend_call == Some(fid) {
                        c.friend_call = None;
                    }
                }
            }
        } else {
            // End friend call (pure 1:1 friend leave)
            if let Some(fid) = friend_call {
                self.end_friend_call(fid, "friend disconnected");
            }
            // Dissolve party (searching, no 3rd yet, or non-trio)
            if let Some(pid) = party_with {
                let online = self.clients.len().saturating_sub(1);
                if let Some(p) = self.clients.get_mut(&pid) {
                    p.party_with = None;
                    p.stranger_party = false;
                    if p.friend_call == Some(id) {
                        p.friend_call = None;
                    }
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
        let me = c.user_id.clone();
        let mut friends = Vec::new();
        let mut seen_friends = HashSet::new();
        if let Some(set) = self.friendships.get(&me) {
            for fuid in set {
                if fuid.is_empty() || fuid == &me || !seen_friends.insert(fuid.clone()) {
                    continue;
                }
                let mut info = self.friend_info_for(fuid);
                let (last_msg, last_msg_ts) = self.last_dm_preview_for_pair(&me, fuid);
                info.last_msg = last_msg;
                info.last_msg_ts = last_msg_ts;
                info.mutual_star = self.mutual_star_bond(&me, fuid);
                info.mutual_thanks = self.mutual_thanks_bond(&me, fuid);
                friends.push(info);
            }
        }
        friends.sort_by(|a, b| b.online.cmp(&a.online).then(a.name.cmp(&b.name)));

        // Incoming: others who requested me (deduped)
        let mut incoming_requests = Vec::new();
        let mut seen_in = HashSet::new();
        for (from, tos) in &self.pending {
            if from == &me || !tos.contains(&me) {
                continue;
            }
            // Skip if already friends
            if self
                .friendships
                .get(&me)
                .map(|s| s.contains(from))
                .unwrap_or(false)
            {
                continue;
            }
            if !seen_in.insert(from.clone()) {
                continue;
            }
            incoming_requests.push(self.friend_info_for(from));
        }
        incoming_requests.sort_by(|a, b| a.name.cmp(&b.name));

        // Outgoing: I requested others (deduped; skip already-friends)
        let mut outgoing_requests = Vec::new();
        let mut seen_out = HashSet::new();
        if let Some(tos) = self.pending.get(&me) {
            for to in tos {
                if to.is_empty() || to == &me || !seen_out.insert(to.clone()) {
                    continue;
                }
                if self
                    .friendships
                    .get(&me)
                    .map(|s| s.contains(to))
                    .unwrap_or(false)
                {
                    continue;
                }
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
            QueueEntry::Party3 { a, b, c } => *a != id && *b != id && *c != id,
        });
    }

    fn queue_entry_ids(e: &QueueEntry) -> Vec<Uuid> {
        match e {
            QueueEntry::Solo(id) => vec![*id],
            QueueEntry::Party { a, b } => vec![*a, *b],
            QueueEntry::Party3 { a, b, c } => vec![*a, *b, *c],
        }
    }

    fn queue_entry_waiting_ok(&self, e: &QueueEntry) -> bool {
        Self::queue_entry_ids(e).into_iter().all(|id| {
            self.clients
                .get(&id)
                .map(|c| c.phase == Phase::Waiting)
                .unwrap_or(false)
        })
    }

    fn queue_entry_room(&self, e: &QueueEntry) -> String {
        match e {
            QueueEntry::Solo(id) => self.room_of(*id),
            QueueEntry::Party { a, .. } | QueueEntry::Party3 { a, .. } => self.room_of(*a),
        }
    }

    fn unmatch_one(&mut self, id: Uuid, detail: &str) {
        // Star review before clearing partner / match_started
        self.arm_star_rating(id);
        self.dequeue_client(id);
        self.clear_fed_for_client(id);
        let party = self.clients.get(&id).and_then(|c| c.party_with);
        // Capture match duration before clearing match state
        let started = self.clients.get(&id).and_then(|c| {
            if c.phase == Phase::Matched {
                c.match_started
            } else {
                None
            }
        });
        self.metrics_record_match_duration(started);
        if let Some(c) = self.clients.get_mut(&id) {
            c.partner = None;
            c.session_peers.clear();
            c.session_id = None;
            c.match_started = None;
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

    /// After someone leaves a 3-way (party of 2 + stranger), keep the other two as solo 1v1
    /// so they can keep chatting and optionally Find 3rd again.
    /// Returns true if remaining peers were reconfigured (caller should only clear `leaving`).
    fn leave_keep_remaining_pair(&mut self, leaving: Uuid, detail: &str) -> bool {
        let (party_mate, session_peers, friend_call, phase) = {
            let Some(c) = self.clients.get(&leaving) else {
                return false;
            };
            (
                c.party_with,
                c.session_peers.clone(),
                c.friend_call,
                c.phase,
            )
        };

        // Case A: leaving is a party/teammate member (has party_with)
        if let Some(mate) = party_mate {
            if !self.clients.contains_key(&mate) {
                return false;
            }
            // Stranger = other session peer (the 3rd) — not the party mate
            let stranger = session_peers.iter().copied().find(|&p| p != mate);
            if let Some(s) = stranger {
                if self.clients.contains_key(&s) {
                    tracing::info!(%leaving, %mate, %s, "trio collapse: keep mate+stranger as 1v1");
                    // Clear friend-call link to leaving without idling the mate
                    if friend_call == Some(mate) || self.clients.get(&mate).and_then(|c| c.friend_call) == Some(leaving)
                    {
                        if let Some(c) = self.clients.get_mut(&mate) {
                            if c.friend_call == Some(leaving) {
                                c.friend_call = None;
                            }
                        }
                    }
                    if let Some(c) = self.clients.get_mut(&s) {
                        c.session_peers.retain(|x| *x != leaving);
                    }
                    self.collapse_to_solo_1v1(mate, s, detail);
                    return true;
                }
            }
            // Still searching as party (no 3rd yet) — mate goes idle (or stays friend if linked)
            if let Some(p) = self.clients.get_mut(&mate) {
                p.party_with = None;
                p.stranger_party = false;
                p.partner = None;
                p.session_peers.clear();
                p.session_id = None;
                if p.friend_call == Some(leaving) {
                    p.friend_call = None;
                }
                p.phase = Phase::Idle;
            }
            self.dequeue_client(mate);
            self.status(mate, "party partner left");
            return true;
        }

        // Case A2: leaving has no party_with but is in a 3-peer session as solo 3rd's peer —
        // also handle when session has 2 peers and one is party-linked through the other side.
        // Case B: leaving is the solo 3rd in a 1v2 — re-queue the original party
        if session_peers.len() == 2 && matches!(phase, Phase::Matched) {
            let peers: Vec<Uuid> = session_peers.iter().copied().collect();
            let a = peers[0];
            let b = peers[1];
            let linked = self
                .clients
                .get(&a)
                .map(|c| c.party_with == Some(b))
                .unwrap_or(false)
                || self
                    .clients
                    .get(&b)
                    .map(|c| c.party_with == Some(a))
                    .unwrap_or(false);
            if linked && self.clients.contains_key(&a) && self.clients.contains_key(&b) {
                tracing::info!(%leaving, %a, %b, "trio: stranger left — party searches again");
                for p in [a, b] {
                    if let Some(c) = self.clients.get_mut(&p) {
                        c.session_peers.retain(|x| *x != leaving);
                        c.partner = c.party_with;
                        c.phase = Phase::Waiting;
                    }
                }
                self.enqueue_party(a, b);
                self.notify_party_browse_searching(a, b);
                self.status(a, "stranger left — looking for a 3rd again");
                self.status(b, "stranger left — looking for a 3rd again");
                self.broadcast_lobby_info();
                self.try_match();
                return true;
            }
            // Not a linked party pair — but still two remaining peers in session: keep them as 1v1
            // (e.g. mis-flagged party_with). Prefer keep-chat over full disconnect.
            if self.clients.contains_key(&a)
                && self.clients.contains_key(&b)
                && a != leaving
                && b != leaving
            {
                tracing::info!(%leaving, %a, %b, "trio collapse: keep remaining session peers as 1v1");
                self.collapse_to_solo_1v1(a, b, detail);
                return true;
            }
        }

        false
    }

    /// Convert two clients into a normal solo 1v1 match (clear party flags).
    fn collapse_to_solo_1v1(&mut self, a: Uuid, b: Uuid, detail: &str) {
        self.dequeue_client(a);
        self.dequeue_client(b);
        for id in [a, b] {
            if let Some(c) = self.clients.get_mut(&id) {
                c.party_with = None;
                c.stranger_party = false;
                // Leaving a friend-party 1v2: drop friend_call so UI is stranger 1v1 with Find 3rd
                // (they can re-friend later). Keeps collapse path consistent.
                c.friend_call = None;
            }
        }
        // Fresh solo matched — both get mode=solo so Find 3rd is available again
        self.start_solo_match(a, b);
        // Status after Matched so clients treat "still chatting" without tearing media first
        self.status(a, detail);
        self.status(b, detail);
    }

    /// Re-send party_browse Matched (teammate only) while hunting for another 3rd.
    fn notify_party_browse_searching(&mut self, a: Uuid, b: Uuid) {
        for (me, them) in [(a, b), (b, a)] {
            let (peer, label) = {
                let Some(ca) = self.clients.get(&me) else {
                    continue;
                };
                let Some(cb) = self.clients.get(&them) else {
                    continue;
                };
                let role = if ca.stranger_party || cb.stranger_party {
                    "teammate"
                } else {
                    "friend"
                };
                (self.match_peer(ca, cb, role, self.effect_snapshot_for(&cb.user_id).0, self.effect_snapshot_for(&cb.user_id).1, self.effect_snapshot_for(&cb.user_id).2), display_label(cb))
            };
            let offerer = peer.is_offerer;
            self.send(
                me,
                ServerMsg::Matched {
                    partner_short: label,
                    session_id: format!("party-search-{me}"),
                    session_key: format!("party:{me}:{them}"),
                    is_offerer: offerer,
                    room: self.room_of(me),
                    mode: "party_browse".into(),
                    your_role: "party".into(),
                    peers: vec![peer],
                },
            );
        }
    }

    fn end_friend_call(&mut self, id: Uuid, reason: &str) {
        let other = self.clients.get(&id).and_then(|c| c.friend_call);
        // Star review while partner + match_started still set
        self.arm_star_rating(id);
        if let Some(oid) = other {
            self.arm_star_rating(oid);
        }
        if let Some(c) = self.clients.get_mut(&id) {
            c.friend_call = None;
            c.party_with = None;
            c.partner = None;
            c.session_peers.clear();
            c.match_started = None;
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
                c.match_started = None;
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

    /// Build match payload for `to` as seen by `from`.
    /// Badge number = spendable balance; `trust` = reputation for tier chrome.
    fn match_peer(
        &self,
        from: &Client,
        to: &Client,
        role: &str,
        effect: String,
        effect_until: u64,
        effect_level: u32,
    ) -> MatchPeer {
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
            stars: self.stars_for(&to.user_id),
            trust: self.effective_trust_for(&to.user_id),
            trust_gifters: self.trust_gifters_for(&to.user_id),
            effect,
            effect_until,
            effect_level: effect_level.max(1).min(3),
        }
    }

    /// Active cosmetic effect snapshot for match payloads: (kind, until, level).
    fn effect_snapshot_for(&self, user_id: &str) -> (String, u64, u32) {
        self.active_effect_ro(user_id)
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
                (self.match_peer(ca, cb, "friend", self.effect_snapshot_for(&cb.user_id).0, self.effect_snapshot_for(&cb.user_id).1, self.effect_snapshot_for(&cb.user_id).2), display_label(cb))
            };
            if let Some(c) = self.clients.get_mut(&me) {
                c.phase = Phase::FriendCall;
                c.friend_call = Some(them);
                c.partner = Some(them);
                c.session_peers = HashSet::from([them]);
                c.session_id = Some(session_id.clone());
                c.party_with = None;
                c.match_started = Some(Instant::now());
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
        self.metrics_inc_friend_call();
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
                self.match_peer(cs, ca, "party", self.effect_snapshot_for(&ca.user_id).0, self.effect_snapshot_for(&ca.user_id).1, self.effect_snapshot_for(&ca.user_id).2),
                self.match_peer(cs, cb, "party", self.effect_snapshot_for(&cb.user_id).0, self.effect_snapshot_for(&cb.user_id).1, self.effect_snapshot_for(&cb.user_id).2),
            ]
        };
        // Party member A: stranger + teammate B (friend or find-third partner)
        let mate_role = if self.clients.get(&a).map(|c| c.stranger_party).unwrap_or(false)
            || self.clients.get(&b).map(|c| c.stranger_party).unwrap_or(false)
        {
            "teammate"
        } else {
            "friend"
        };
        let a_peers = {
            let ca = self.clients.get(&a).unwrap();
            let cs = self.clients.get(&solo).unwrap();
            let cb = self.clients.get(&b).unwrap();
            vec![
                self.match_peer(ca, cs, "stranger", self.effect_snapshot_for(&cs.user_id).0, self.effect_snapshot_for(&cs.user_id).1, self.effect_snapshot_for(&cs.user_id).2),
                self.match_peer(ca, cb, mate_role, self.effect_snapshot_for(&cb.user_id).0, self.effect_snapshot_for(&cb.user_id).1, self.effect_snapshot_for(&cb.user_id).2),
            ]
        };
        let b_peers = {
            let cb = self.clients.get(&b).unwrap();
            let cs = self.clients.get(&solo).unwrap();
            let ca = self.clients.get(&a).unwrap();
            vec![
                self.match_peer(cb, cs, "stranger", self.effect_snapshot_for(&cs.user_id).0, self.effect_snapshot_for(&cs.user_id).1, self.effect_snapshot_for(&cs.user_id).2),
                self.match_peer(cb, ca, mate_role, self.effect_snapshot_for(&ca.user_id).0, self.effect_snapshot_for(&ca.user_id).1, self.effect_snapshot_for(&ca.user_id).2),
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
                c.match_started = Some(Instant::now());
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
        {
            let us = self
                .clients
                .get(&solo)
                .map(|c| c.user_id.clone())
                .unwrap_or_default();
            let ua = self
                .clients
                .get(&a)
                .map(|c| c.user_id.clone())
                .unwrap_or_default();
            let ub = self
                .clients
                .get(&b)
                .map(|c| c.user_id.clone())
                .unwrap_or_default();
            let ns = self
                .clients
                .get(&solo)
                .map(display_label)
                .unwrap_or_default();
            let na = self
                .clients
                .get(&a)
                .map(display_label)
                .unwrap_or_default();
            let nb = self
                .clients
                .get(&b)
                .map(display_label)
                .unwrap_or_default();
            // Record solo vs each party member for ban triage
            self.push_recent_match("party_1v2", &us, &ua, &ns, &na);
            if ub != ua {
                self.push_recent_match("party_1v2", &us, &ub, &ns, &nb);
            }
        }
        tracing::info!(%solo, %a, %b, "party vs solo matched (1v2)");
        self.broadcast_lobby_info();
    }

    /// Party of 2 vs party of 2 (2v2). Each side already has a friend WebRTC link.
    fn start_party_vs_party(&mut self, a1: Uuid, a2: Uuid, b1: Uuid, b2: Uuid) {
        let room = self.room_of(a1);
        let (session_id, session_key) = {
            let ca1 = self.clients.get(&a1).unwrap();
            let ca2 = self.clients.get(&a2).unwrap();
            let cb1 = self.clients.get(&b1).unwrap();
            let cb2 = self.clients.get(&b2).unwrap();
            Self::make_session_id(&[
                &ca1.peer_id,
                &ca2.peer_id,
                &cb1.peer_id,
                &cb2.peer_id,
                "2v2",
            ])
        };

        // Peers for each: two strangers on the other team + friend teammate
        let peers_for = |me: Uuid, friend: Uuid, o1: Uuid, o2: Uuid| -> Vec<MatchPeer> {
            let c_me = self.clients.get(&me).unwrap();
            let c_f = self.clients.get(&friend).unwrap();
            let c_o1 = self.clients.get(&o1).unwrap();
            let c_o2 = self.clients.get(&o2).unwrap();
            vec![
                self.match_peer(c_me, c_o1, "stranger", self.effect_snapshot_for(&c_o1.user_id).0, self.effect_snapshot_for(&c_o1.user_id).1, self.effect_snapshot_for(&c_o1.user_id).2),
                self.match_peer(c_me, c_o2, "stranger", self.effect_snapshot_for(&c_o2.user_id).0, self.effect_snapshot_for(&c_o2.user_id).1, self.effect_snapshot_for(&c_o2.user_id).2),
                self.match_peer(c_me, c_f, "friend", self.effect_snapshot_for(&c_f.user_id).0, self.effect_snapshot_for(&c_f.user_id).1, self.effect_snapshot_for(&c_f.user_id).2),
            ]
        };

        let a1_peers = peers_for(a1, a2, b1, b2);
        let a2_peers = peers_for(a2, a1, b1, b2);
        let b1_peers = peers_for(b1, b2, a1, a2);
        let b2_peers = peers_for(b2, b1, a1, a2);

        let label_ab = format!(
            "{}+{}",
            display_label(&self.clients[&a1]),
            display_label(&self.clients[&a2])
        );
        let label_cd = format!(
            "{}+{}",
            display_label(&self.clients[&b1]),
            display_label(&self.clients[&b2])
        );

        let set_matched =
            |clients: &mut HashMap<Uuid, Client>, id: Uuid, peers: &[Uuid], party: Uuid| {
                if let Some(c) = clients.get_mut(&id) {
                    c.phase = Phase::Matched;
                    c.session_id = Some(session_id.clone());
                    c.session_peers = peers.iter().copied().collect();
                    c.partner = peers.first().copied();
                    c.party_with = Some(party);
                    c.match_started = Some(Instant::now());
                }
            };
        set_matched(&mut self.clients, a1, &[b1, b2, a2], a2);
        set_matched(&mut self.clients, a2, &[b1, b2, a1], a1);
        set_matched(&mut self.clients, b1, &[a1, a2, b2], b2);
        set_matched(&mut self.clients, b2, &[a1, a2, b1], b1);

        let send_party = |hub: &mut SimpleHub,
                          id: Uuid,
                          partner_short: String,
                          peers: Vec<MatchPeer>| {
            let is_offerer = peers
                .iter()
                .any(|p| p.is_offerer && p.role == "stranger");
            hub.send(
                id,
                ServerMsg::Matched {
                    partner_short,
                    session_id: session_id.clone(),
                    session_key: session_key.clone(),
                    is_offerer,
                    room: room.clone(),
                    mode: "party_browse".into(),
                    your_role: "party".into(),
                    peers,
                },
            );
        };

        send_party(self, a1, label_cd.clone(), a1_peers);
        send_party(self, a2, label_cd, a2_peers);
        send_party(self, b1, label_ab.clone(), b1_peers);
        send_party(self, b2, label_ab, b2_peers);

        tracing::info!(%a1, %a2, %b1, %b2, "party vs party matched (2v2)");
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
                (self.match_peer(ca, cb, "stranger", self.effect_snapshot_for(&cb.user_id).0, self.effect_snapshot_for(&cb.user_id).1, self.effect_snapshot_for(&cb.user_id).2), display_label(cb))
            };
            if let Some(c) = self.clients.get_mut(&me) {
                c.phase = Phase::Matched;
                c.partner = Some(them);
                c.session_peers = HashSet::from([them]);
                c.session_id = Some(session_id.clone());
                c.last_partner = Some(them);
                c.match_started = Some(Instant::now());
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
        let (ua, ub) = {
            let ca = self.clients.get(&a);
            let cb = self.clients.get(&b);
            (
                ca.map(|c| c.user_id.clone()).unwrap_or_default(),
                cb.map(|c| c.user_id.clone()).unwrap_or_default(),
            )
        };
        let (na, nb) = {
            let ca = self.clients.get(&a);
            let cb = self.clients.get(&b);
            (
                ca.map(display_label).unwrap_or_default(),
                cb.map(display_label).unwrap_or_default(),
            )
        };
        tracing::info!(%a, %b, user_a = %ua, user_b = %ub, "solo matched");
        self.push_recent_match("solo", &ua, &ub, &na, &nb);
        self.broadcast_lobby_info();
    }

    fn enqueue_solo(&mut self, id: Uuid) {
        self.dequeue_client(id);
        if !self.queue.iter().any(|e| matches!(e, QueueEntry::Solo(x) if *x == id)) {
            self.queue.push_back(QueueEntry::Solo(id));
        }
    }

    fn enqueue_party(&mut self, a: Uuid, b: Uuid) {
        let now = Instant::now();
        if let Some(c) = self.clients.get_mut(&a) {
            if c.wait_started.is_none() {
                c.wait_started = Some(now);
            }
        }
        if let Some(c) = self.clients.get_mut(&b) {
            if c.wait_started.is_none() {
                c.wait_started = Some(now);
            }
        }
        self.dequeue_client(a);
        self.dequeue_client(b);
        // canonical order for queue entry
        let (qa, qb) = if a.as_bytes() < b.as_bytes() {
            (a, b)
        } else {
            (b, a)
        };
        self.queue.push_back(QueueEntry::Party { a: qa, b: qb });
        if let Some(c) = self.clients.get_mut(&a) {
            c.phase = Phase::Waiting;
            c.party_with = Some(b);
            // Keep media session with partner while searching
            c.session_peers = HashSet::from([b]);
            c.partner = Some(b);
        }
        if let Some(c) = self.clients.get_mut(&b) {
            c.phase = Phase::Waiting;
            c.party_with = Some(a);
            c.session_peers = HashSet::from([a]);
            c.partner = Some(a);
        }
    }

    /// Three already-connected people browse for one solo stranger (3v1).
    fn enqueue_party3(&mut self, a: Uuid, b: Uuid, c: Uuid) {
        let now = Instant::now();
        let mut ids = [a, b, c];
        ids.sort_by_key(|u| *u.as_bytes());
        let (qa, qb, qc) = (ids[0], ids[1], ids[2]);
        for id in [a, b, c] {
            if let Some(cl) = self.clients.get_mut(&id) {
                if cl.wait_started.is_none() {
                    cl.wait_started = Some(now);
                }
            }
            self.dequeue_client(id);
        }
        self.queue
            .push_back(QueueEntry::Party3 { a: qa, b: qb, c: qc });
        for id in [a, b, c] {
            let mates: HashSet<Uuid> = [a, b, c].into_iter().filter(|x| *x != id).collect();
            if let Some(cl) = self.clients.get_mut(&id) {
                cl.phase = Phase::Waiting;
                cl.session_peers = mates.clone();
                cl.partner = mates.iter().next().copied();
                // Primary "party_with" = first mate (UI may show one hangup target)
                cl.party_with = mates.iter().next().copied();
            }
        }
        // Notify all three they're co-searching for a 4th
        self.notify_party3_browse_searching(a, b, c);
    }

    fn notify_party3_browse_searching(&mut self, a: Uuid, b: Uuid, c: Uuid) {
        let room = self.room_of(a);
        let (session_id, session_key) = {
            let ca = self.clients.get(&a).map(|x| x.peer_id.clone()).unwrap_or_default();
            let cb = self.clients.get(&b).map(|x| x.peer_id.clone()).unwrap_or_default();
            let cc = self.clients.get(&c).map(|x| x.peer_id.clone()).unwrap_or_default();
            Self::make_session_id(&[&ca, &cb, &cc, "p3search"])
        };
        for (me, others) in [
            (a, vec![b, c]),
            (b, vec![a, c]),
            (c, vec![a, b]),
        ] {
            let peers: Vec<_> = {
                let Some(cm) = self.clients.get(&me) else {
                    continue;
                };
                others
                    .iter()
                    .filter_map(|&oid| {
                        let co = self.clients.get(&oid)?;
                        let snap = self.effect_snapshot_for(&co.user_id);
                        let role = if cm.friend_call == Some(oid)
                            || co.friend_call == Some(me)
                        {
                            "friend"
                        } else {
                            "teammate"
                        };
                        Some(self.match_peer(cm, co, role, snap.0, snap.1, snap.2))
                    })
                    .collect()
            };
            if peers.is_empty() {
                continue;
            }
            self.send(
                me,
                ServerMsg::Matched {
                    partner_short: "searching…".into(),
                    session_id: session_id.clone(),
                    session_key: session_key.clone(),
                    is_offerer: false,
                    room: room.clone(),
                    mode: "party_browse".into(),
                    your_role: "party".into(),
                    peers,
                },
            );
            self.status(me, "party of 3 — searching for a stranger (3v1)");
        }
    }

    /// Solo S ↔ party of 3 (A,B,C). Four people total. Max session size.
    fn start_party3_vs_solo(&mut self, solo: Uuid, a: Uuid, b: Uuid, c: Uuid) {
        let room = self.room_of(solo);
        let (session_id, session_key) = {
            let cs = self.clients.get(&solo).unwrap();
            let ca = self.clients.get(&a).unwrap();
            let cb = self.clients.get(&b).unwrap();
            let cc = self.clients.get(&c).unwrap();
            Self::make_session_id(&[
                &cs.peer_id,
                &ca.peer_id,
                &cb.peer_id,
                &cc.peer_id,
                "p3",
            ])
        };
        let snap = |uid: &str| self.effect_snapshot_for(uid);
        let mate_role = if [a, b, c].iter().any(|id| {
            self.clients
                .get(id)
                .map(|cl| cl.stranger_party)
                .unwrap_or(false)
        }) {
            "teammate"
        } else {
            "friend"
        };

        let solo_peers = {
            let cs = self.clients.get(&solo).unwrap();
            [a, b, c]
                .iter()
                .map(|&pid| {
                    let cp = self.clients.get(&pid).unwrap();
                    let s = snap(&cp.user_id);
                    self.match_peer(cs, cp, "party", s.0, s.1, s.2)
                })
                .collect::<Vec<_>>()
        };

        let party_peers_for = |me: Uuid, m1: Uuid, m2: Uuid| {
            let cm = self.clients.get(&me).unwrap();
            let cs = self.clients.get(&solo).unwrap();
            let c1 = self.clients.get(&m1).unwrap();
            let c2 = self.clients.get(&m2).unwrap();
            let ss = snap(&cs.user_id);
            let s1 = snap(&c1.user_id);
            let s2 = snap(&c2.user_id);
            vec![
                self.match_peer(cm, cs, "stranger", ss.0, ss.1, ss.2),
                self.match_peer(cm, c1, mate_role, s1.0, s1.1, s1.2),
                self.match_peer(cm, c2, mate_role, s2.0, s2.1, s2.2),
            ]
        };
        let a_peers = party_peers_for(a, b, c);
        let b_peers = party_peers_for(b, a, c);
        let c_peers = party_peers_for(c, a, b);

        let set_matched =
            |clients: &mut HashMap<Uuid, Client>, id: Uuid, peers: &[Uuid], party: Option<Uuid>| {
                if let Some(cl) = clients.get_mut(&id) {
                    cl.phase = Phase::Matched;
                    cl.session_id = Some(session_id.clone());
                    cl.session_peers = peers.iter().copied().collect();
                    cl.partner = peers.first().copied();
                    cl.party_with = party;
                    cl.match_started = Some(Instant::now());
                }
            };
        set_matched(&mut self.clients, solo, &[a, b, c], None);
        set_matched(&mut self.clients, a, &[solo, b, c], Some(b));
        set_matched(&mut self.clients, b, &[solo, a, c], Some(a));
        set_matched(&mut self.clients, c, &[solo, a, b], Some(a));

        let partner_short_solo = format!(
            "{}+{}+{}",
            display_label(&self.clients[&a]),
            display_label(&self.clients[&b]),
            display_label(&self.clients[&c])
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
        for (pid, peers) in [(a, a_peers), (b, b_peers), (c, c_peers)] {
            self.send(
                pid,
                ServerMsg::Matched {
                    partner_short: display_label(&self.clients[&solo]),
                    session_id: session_id.clone(),
                    session_key: session_key.clone(),
                    is_offerer: peers.iter().any(|p| p.is_offerer && p.role == "stranger"),
                    room: room.clone(),
                    mode: "party_browse".into(),
                    your_role: "party".into(),
                    peers,
                },
            );
        }
        {
            let us = self.clients.get(&solo).map(|x| x.user_id.clone()).unwrap_or_default();
            let ns = self.clients.get(&solo).map(display_label).unwrap_or_default();
            for pid in [a, b, c] {
                let uid = self.clients.get(&pid).map(|x| x.user_id.clone()).unwrap_or_default();
                let name = self.clients.get(&pid).map(display_label).unwrap_or_default();
                self.push_recent_match("party_3v1", &us, &uid, &ns, &name);
            }
        }
        tracing::info!(%solo, %a, %b, %c, "party3 vs solo matched (3v1)");
        self.broadcast_lobby_info();
    }

    const FIND_THIRD_TTL_SECS: u64 = 30;

    fn clear_find_third_involving(&mut self, id: Uuid) {
        if let Some(p) = &self.find_third_pending {
            if p.from == id || p.to == id {
                self.find_third_pending = None;
            }
        }
    }

    fn expire_find_third_if_needed(&mut self) {
        let Some(p) = self.find_third_pending.clone() else {
            return;
        };
        if Instant::now() < p.expires {
            return;
        }
        self.find_third_pending = None;
        self.send(
            p.from,
            ServerMsg::FindThirdResult {
                ok: false,
                reason: "expired".into(),
            },
        );
        self.send(
            p.to,
            ServerMsg::FindThirdResult {
                ok: false,
                reason: "expired".into(),
            },
        );
    }

    /// True if both are in a mutual stranger 1v1 (not friend call, not already party).
    fn is_stranger_1v1_pair(&self, a: Uuid, b: Uuid) -> bool {
        let (Some(ca), Some(cb)) = (self.clients.get(&a), self.clients.get(&b)) else {
            return false;
        };
        if ca.phase != Phase::Matched || cb.phase != Phase::Matched {
            return false;
        }
        if ca.friend_call.is_some() || cb.friend_call.is_some() {
            return false;
        }
        if ca.party_with.is_some() || cb.party_with.is_some() {
            return false;
        }
        ca.session_peers.len() == 1
            && cb.session_peers.len() == 1
            && ca.session_peers.contains(&b)
            && cb.session_peers.contains(&a)
    }

    /// Mutual friend call 1v1 (Find 3rd / browse-together path).
    fn is_friend_call_1v1_pair(&self, a: Uuid, b: Uuid) -> bool {
        let (Some(ca), Some(cb)) = (self.clients.get(&a), self.clients.get(&b)) else {
            return false;
        };
        if ca.friend_call != Some(b) || cb.friend_call != Some(a) {
            return false;
        }
        if ca.party_with.is_some() || cb.party_with.is_some() {
            return false;
        }
        // FriendCall phase, or still Matched after soft transitions
        matches!(ca.phase, Phase::FriendCall | Phase::Matched)
            && matches!(cb.phase, Phase::FriendCall | Phase::Matched)
    }

    /// Stranger 1v1 or friend call 1v1 — both can invite Find 3rd.
    fn is_find_third_eligible_pair(&self, a: Uuid, b: Uuid) -> bool {
        self.is_stranger_1v1_pair(a, b) || self.is_friend_call_1v1_pair(a, b)
    }

    fn handle_find_third_invite(&mut self, id: Uuid) {
        self.expire_find_third_if_needed();
        let Some(partner) = self.clients.get(&id).and_then(|c| {
            if c.session_peers.len() == 1 {
                c.session_peers.iter().next().copied()
            } else {
                c.partner.or(c.friend_call)
            }
        }) else {
            self.send(
                id,
                ServerMsg::Error {
                    message: "need an active 1v1 match to invite".into(),
                },
            );
            return;
        };
        if !self.is_find_third_eligible_pair(id, partner) {
            let already_group = self
                .clients
                .get(&id)
                .map(|c| c.session_peers.len() >= 2 || c.party_with.is_some())
                .unwrap_or(false);
            let msg = if already_group {
                "already in a group (max 3 via Find 3rd). For 4 people: two pairs Browse together → 2v2 match"
            } else {
                "find third only during a 1v1 call (friend or stranger)"
            };
            self.send(
                id,
                ServerMsg::Error {
                    message: msg.into(),
                },
            );
            return;
        }
        if self.find_third_pending.is_some() {
            self.send(
                id,
                ServerMsg::FindThirdResult {
                    ok: false,
                    reason: "busy".into(),
                },
            );
            return;
        }
        let (from_uid, from_name) = {
            let c = self.clients.get(&id).unwrap();
            (c.user_id.clone(), c.name.clone())
        };
        self.find_third_pending = Some(FindThirdPending {
            from: id,
            to: partner,
            expires: Instant::now() + Duration::from_secs(Self::FIND_THIRD_TTL_SECS),
        });
        self.send(
            partner,
            ServerMsg::FindThirdIncoming {
                from_user_id: from_uid,
                from_name,
            },
        );
        self.status(id, "find-third invite sent — waiting");
        tracing::info!(%id, %partner, "find_third invite");
    }

    fn handle_find_third_respond(&mut self, id: Uuid, accept: bool) {
        self.expire_find_third_if_needed();
        let Some(p) = self.find_third_pending.clone() else {
            self.send(
                id,
                ServerMsg::FindThirdResult {
                    ok: false,
                    reason: "expired".into(),
                },
            );
            return;
        };
        if p.to != id {
            self.send(
                id,
                ServerMsg::FindThirdResult {
                    ok: false,
                    reason: "error".into(),
                },
            );
            return;
        }
        self.find_third_pending = None;
        if !accept {
            self.send(
                p.from,
                ServerMsg::FindThirdResult {
                    ok: false,
                    reason: "declined".into(),
                },
            );
            self.send(
                id,
                ServerMsg::FindThirdResult {
                    ok: false,
                    reason: "declined".into(),
                },
            );
            self.status(p.from, "partner declined find-third");
            return;
        }
        let is_friend_pair = self.is_friend_call_1v1_pair(p.from, p.to);
        if !is_friend_pair && !self.is_stranger_1v1_pair(p.from, p.to) {
            for x in [p.from, p.to] {
                self.send(
                    x,
                    ServerMsg::FindThirdResult {
                        ok: false,
                        reason: "left".into(),
                    },
                );
            }
            return;
        }
        // Stranger 1v1 → stranger_party; friend call → keep friend link, not stranger_party
        if !is_friend_pair {
            for x in [p.from, p.to] {
                if let Some(c) = self.clients.get_mut(&x) {
                    c.stranger_party = true;
                }
            }
        }
        self.enqueue_party(p.from, p.to);
        // Notify both: accepted + re-matched as party_browse with teammate/friend only
        let mate_role = if is_friend_pair { "friend" } else { "teammate" };
        for (me, them) in [(p.from, p.to), (p.to, p.from)] {
            let peer = {
                let ca = self.clients.get(&me).unwrap();
                let cb = self.clients.get(&them).unwrap();
                self.match_peer(
                    ca,
                    cb,
                    mate_role,
                    self.effect_snapshot_for(&cb.user_id).0,
                    self.effect_snapshot_for(&cb.user_id).1,
                    self.effect_snapshot_for(&cb.user_id).2,
                )
            };
            let label = display_label(self.clients.get(&them).unwrap());
            let offerer = peer.is_offerer;
            self.send(
                me,
                ServerMsg::FindThirdResult {
                    ok: true,
                    reason: "accepted".into(),
                },
            );
            self.send(
                me,
                ServerMsg::Matched {
                    partner_short: label,
                    session_id: self
                        .clients
                        .get(&me)
                        .and_then(|c| c.session_id.clone())
                        .unwrap_or_else(|| format!("trio-{}", me)),
                    session_key: format!("trio:{}:{}", me, them),
                    is_offerer: offerer,
                    room: self.room_of(me),
                    mode: "party_browse".into(),
                    your_role: "party".into(),
                    peers: vec![peer],
                },
            );
            self.status(me, "find-third — looking for a 3rd");
        }
        self.broadcast_lobby_info();
        self.try_match();
        tracing::info!(
            a = %p.from,
            b = %p.to,
            friend = is_friend_pair,
            "find_third accepted — party searching"
        );
    }

    fn handle_find_third_cancel(&mut self, id: Uuid) {
        self.expire_find_third_if_needed();
        let Some(p) = self.find_third_pending.clone() else {
            return;
        };
        if p.from != id {
            return;
        }
        self.find_third_pending = None;
        self.send(
            p.from,
            ServerMsg::FindThirdResult {
                ok: false,
                reason: "cancelled".into(),
            },
        );
        self.send(
            p.to,
            ServerMsg::FindThirdResult {
                ok: false,
                reason: "cancelled".into(),
            },
        );
    }

    fn try_match(&mut self) {
        let mut steps = self.queue.len().saturating_mul(4).max(8);
        while self.queue.len() >= 1 && steps > 0 {
            steps -= 1;
            let Some(first) = self.queue.pop_front() else { break };

            // Validate first entry still waiting
            if !self.queue_entry_waiting_ok(&first) {
                continue;
            }

            let room = self.queue_entry_room(&first);

            // Find compatible second entry:
            // 1) soft gender/tags prefs (not last partner) — best trust rank wins
            // 2) any non-last-partner
            // 3) last partner (rematch) — only when no one else is waiting
            //    (hard-blocking rematch left 2-person pools stuck until refresh)
            // Trust rank is soft only: never blocks matching when pool is empty.
            let mut best_soft: Option<(usize, i32)> = None;
            let mut found_fallback = None;
            let mut rematch_fallback = None;
            for (i, e) in self.queue.iter().enumerate() {
                if self.queue_entry_room(e) != room {
                    continue;
                }
                if !self.queue_entry_waiting_ok(e) {
                    continue;
                }
                // Allowed: 1v1, 1v2, 3v1, 2v2 (see entries_compatible).
                if !self.entries_compatible(&first, e) {
                    continue;
                }
                if self.stranger_party_blocks_2v2(&first, e) {
                    continue;
                }
                let rematch = self.is_last_partner_rematch(&first, e);
                if rematch {
                    if rematch_fallback.is_none() {
                        rematch_fallback = Some(i);
                    }
                    continue;
                }
                if self.entries_prefs_soft_ok(&first, e) {
                    let rank = self.pair_trust_rank(&first, e);
                    match best_soft {
                        Some((_, best)) if rank <= best => {}
                        _ => best_soft = Some((i, rank)),
                    }
                    continue;
                }
                if found_fallback.is_none() {
                    found_fallback = Some(i);
                }
            }
            let found_idx = best_soft
                .map(|(i, _)| i)
                .or(found_fallback)
                .or(rematch_fallback);

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
                    let wa = self.take_wait_started(a);
                    let wb = self.take_wait_started(b);
                    self.metrics_record_wait(wa);
                    self.metrics_record_wait(wb);
                    self.start_solo_match(a, b);
                    self.metrics_inc_match();
                }
                (QueueEntry::Solo(s), QueueEntry::Party { a, b })
                | (QueueEntry::Party { a, b }, QueueEntry::Solo(s)) => {
                    let ws = self.take_wait_started(s);
                    let wa = self.take_wait_started(a);
                    let wb = self.take_wait_started(b);
                    self.metrics_record_wait(ws);
                    self.metrics_record_wait(wa);
                    self.metrics_record_wait(wb);
                    self.start_party_vs_solo(s, a, b);
                    self.metrics_inc_match();
                }
                (QueueEntry::Solo(s), QueueEntry::Party3 { a, b, c })
                | (QueueEntry::Party3 { a, b, c }, QueueEntry::Solo(s)) => {
                    for id in [s, a, b, c] {
                        let w = self.take_wait_started(id);
                        self.metrics_record_wait(w);
                    }
                    self.start_party3_vs_solo(s, a, b, c);
                    self.metrics_inc_match();
                }
                (QueueEntry::Party { a: a1, b: a2 }, QueueEntry::Party { a: b1, b: b2 }) => {
                    for id in [a1, a2, b1, b2] {
                        let w = self.take_wait_started(id);
                        self.metrics_record_wait(w);
                    }
                    self.start_party_vs_party(a1, a2, b1, b2);
                    self.metrics_inc_match();
                }
                // Unreachable if entries_compatible is correct
                _ => {
                    tracing::warn!("try_match: unexpected pair shape — requeue");
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
            c.wait_started = Some(Instant::now());
        }
        // Alone = no other solo waiters before we join (self not waiting yet)
        let alone = self.waiting_solo_count() == 0;
        self.enqueue_solo(id);
        self.metrics_inc_queue_join(alone);
        self.status(id, detail);
        self.broadcast_lobby_info();
        self.try_match();
    }

    fn clear_match_state(&mut self, id: Uuid) {
        self.clear_match_state_with_partner_msg(id, "partner hit Next — searching again");
    }

    fn clear_match_state_with_partner_msg(&mut self, id: Uuid, partner_msg: &str) {
        // Rate opportunity for leaver before peers cleared
        self.arm_star_rating(id);
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
            c.match_started = None;
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
        self.clear_find_third_involving(id);

        // Leaving a 3-way FIRST — keep remaining two as 1v1 before ending friend call
        if self.leave_keep_remaining_pair(id, "partner left — still chatting") {
            if let Some(c) = self.clients.get_mut(&id) {
                c.phase = Phase::Idle;
                c.party_with = None;
                c.stranger_party = false;
                c.partner = None;
                c.session_peers.clear();
                c.session_id = None;
                c.friend_call = None;
            }
            self.dequeue_client(id);
            self.status(id, "stopped — idle");
            self.broadcast_lobby_info();
            return;
        }

        if self.clients.get(&id).and_then(|c| c.friend_call).is_some() {
            self.end_friend_call(id, "stopped");
            return;
        }

        if let Some(pid) = self.clients.get(&id).and_then(|c| c.party_with) {
            // Drop party link and leave stranger queue/match
            if let Some(c) = self.clients.get_mut(&id) {
                c.party_with = None;
                c.stranger_party = false;
            }
            if let Some(p) = self.clients.get_mut(&pid) {
                p.party_with = None;
                p.stranger_party = false;
            }
        }
        self.clear_match_state_with_partner_msg(id, "partner stopped");
        if let Some(c) = self.clients.get_mut(&id) {
            c.phase = Phase::Idle;
            c.party_with = None;
            c.stranger_party = false;
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
                tags,
            } => {
                self.handle_hello(id, user_id, name, gender, looking, flag, avatar, tags);
            }
            ClientMsg::SetPrefs {
                gender,
                looking,
                flag,
                avatar,
                tags,
            } => {
                self.handle_set_prefs(id, gender, looking, flag, avatar, tags);
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
                // Please stay: target cannot Next until the timer ends (server-enforced).
                let me_uid = self
                    .clients
                    .get(&id)
                    .map(|c| c.user_id.clone())
                    .unwrap_or_default();
                if self.is_no_skip_active(&me_uid) {
                    let left = self.no_skip_secs_left(&me_uid);
                    self.status(
                        id,
                        format!("please stay active — can't skip for {left}s more"),
                    );
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
            ClientMsg::FindThirdInvite => self.handle_find_third_invite(id),
            ClientMsg::FindThirdRespond { accept } => self.handle_find_third_respond(id, accept),
            ClientMsg::FindThirdCancel => self.handle_find_third_cancel(id),
            ClientMsg::RatePartner {
                user_id,
                star,
                amount,
                thanks,
            } => {
                self.handle_rate_partner(id, user_id, star, amount, thanks);
            }
            ClientMsg::SpendStars {
                to_user_id,
                effect,
                op_id,
            } => {
                self.handle_spend_stars(id, to_user_id, effect, op_id);
            }
            ClientMsg::BrowseTogether { room } => {
                let room = if room.trim().is_empty() {
                    self.room_of(id)
                } else {
                    normalize_room(&room)
                };
                // —— Party of 3 already mesh-connected → hunt solo (3v1) ——
                let session: Vec<Uuid> = self
                    .clients
                    .get(&id)
                    .map(|c| c.session_peers.iter().copied().collect())
                    .unwrap_or_default();
                let in_live_3 = matches!(
                    self.clients.get(&id).map(|c| c.phase),
                    Some(Phase::Matched) | Some(Phase::FriendCall)
                ) && session.len() == 2;
                if in_live_3 {
                    let b = session[0];
                    let c = session[1];
                    // All three must still share the session
                    let ok_b = self
                        .clients
                        .get(&b)
                        .map(|cl| {
                            cl.session_peers.contains(&id) && cl.session_peers.contains(&c)
                        })
                        .unwrap_or(false);
                    let ok_c = self
                        .clients
                        .get(&c)
                        .map(|cl| {
                            cl.session_peers.contains(&id) && cl.session_peers.contains(&b)
                        })
                        .unwrap_or(false);
                    if ok_b && ok_c {
                        for pid in [id, b, c] {
                            if let Some(cl) = self.clients.get_mut(&pid) {
                                cl.room = room.clone();
                            }
                        }
                        self.enqueue_party3(id, b, c);
                        self.broadcast_lobby_info();
                        self.try_match();
                        return;
                    }
                }
                // —— Classic: friend call pair (party of 2) ——
                let Some(fid) = self.clients.get(&id).and_then(|c| c.friend_call) else {
                    self.send(
                        id,
                        ServerMsg::Error {
                            message: "call a friend first, or form a group of 3 then search"
                                .into(),
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
            ClientMsg::CallFriend { user_id, join } => {
                self.handle_call_friend(id, user_id, join)
            }
            ClientMsg::RegisterPush {
                token,
                platform,
                clear,
            } => self.handle_register_push(id, token, platform, clear),
            ClientMsg::CallRespond { user_id, accept } => {
                self.handle_call_respond(id, user_id, accept)
            }
            ClientMsg::CallCancel { user_id } => self.handle_call_cancel(id, user_id),
            ClientMsg::HangupFriend => {
                if self.clients.get(&id).and_then(|c| c.friend_call).is_some() {
                    self.end_friend_call(id, "friend hung up");
                } else {
                    self.status(id, "not in a friend call");
                }
            }
            ClientMsg::Chat { body } => self.handle_chat(id, body),
            ClientMsg::FriendChat { to_user_id, body } => {
                self.handle_friend_chat(id, to_user_id, body)
            }
            ClientMsg::FriendChatHistory { with_user_id } => {
                self.handle_friend_chat_history(id, with_user_id)
            }
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
        tags: Vec<String>,
    ) {
        let g = normalize_gender(&gender);
        let l = normalize_looking(&looking);
        let f = normalize_flag(&flag);
        let a = normalize_avatar(&avatar);
        let tags = normalize_tags(&tags);
        let uid = self.clients.get(&id).map(|c| c.user_id.clone());
        if let Some(c) = self.clients.get_mut(&id) {
            c.gender = g;
            c.looking = l;
            c.flag = f;
            c.avatar = a.clone();
            c.tags = tags;
        }
        if let Some(uid) = uid {
            if a.is_empty() {
                self.known_avatars.remove(&uid);
            } else {
                self.known_avatars.insert(uid.clone(), a);
            }
            self.persist_friends();
            // Refresh friends' lists so they see the new avatar
            self.notify_friends_of_user(&uid);
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
        tags: Vec<String>,
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
        let tags = normalize_tags(&tags);

        // Kick previous connection for same user (one live tab per identity).
        // Opening live.html twice / two browsers with the same export causes the
        // old tab to drop mid-call — looks like “one person in one browser, 3rd in another”.
        if let Some(old) = self.by_user.get(&user_id).copied() {
            if old != id {
                self.send(
                    old,
                    ServerMsg::Error {
                        message: "session opened in another tab or browser — this tab was disconnected. Use only one live window per identity.".into(),
                    },
                );
                self.status(
                    old,
                    "disconnected — opened elsewhere",
                );
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
            c.avatar = avatar.clone();
            c.tags = tags;
        }
        self.by_user.insert(user_id.clone(), id);
        self.code_index.insert(code.clone(), user_id.clone());
        if !name.is_empty() && name != "anon" {
            self.known_names.insert(user_id.clone(), name.clone());
        }
        if !avatar.is_empty() {
            self.known_avatars.insert(user_id.clone(), avatar);
        }
        self.persist_friends();

        let peer_id = self.clients[&id].peer_id.clone();
        let short_id = self.clients[&id].short_id.clone();
        let my_stars = self.stars_for(&user_id);
        let my_trust = self.trust_for(&user_id);
        let my_trust_effective = self.effective_trust_for(&user_id);
        let my_trust_gifters = self.trust_gifters_for(&user_id);
        let my_trust_givers = self.trust_giver_chips_for(&user_id, 8);
        let my_trust_last_ts = self.star_ledger.trust_last_ts(&user_id);
        let (my_eff, my_eff_until, my_eff_level) = self.active_effect_for(&user_id);
        let rate_min_secs = self.rate_min_secs_for(&user_id);
        let early_rates_left = self.early_rates_left_for(&user_id);
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
                stars: my_stars,
                trust: my_trust,
                trust_effective: my_trust_effective,
                trust_gifters: my_trust_gifters,
                trust_givers: my_trust_givers,
                trust_last_ts: my_trust_last_ts,
                effect: my_eff,
                effect_until: my_eff_until,
                effect_level: my_eff_level,
                rate_min_secs,
                early_rates_left,
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
        let (threshold, mut ban_secs) = Self::report_severity(&reason_s);
        let is_ai = reason_s.eq_ignore_ascii_case("explicit_ai");
        let is_underage = reason_s.eq_ignore_ascii_case("underage");
        // Effective trust for labels/shields — ban score is mostly 1/reporter (v1)
        let reporter_stars = self.effective_trust_for(&reporter.0);
        let target_stars = self.effective_trust_for(&user_id);
        let reporter_weight = self.report_weight_for(&reporter.0);
        let applied_weight =
            self.report_weight_against(&reporter.0, &user_id, is_underage);
        let trusted = reporter_weight >= Self::TRUSTED_REPORT_WEIGHT;
        let senior = reporter_weight >= Self::SENIOR_REPORT_WEIGHT;
        let peer_blocked = !is_underage
            && reporter_stars >= Self::SENIOR_REPORTER_STARS
            && target_stars >= Self::SENIOR_REPORTER_STARS;
        let mutual_feud = !is_underage
            && self
                .report_reporters
                .get(&reporter.0)
                .map(|s| s.contains(&user_id))
                .unwrap_or(false);
        let peer_damped = !is_underage
            && !peer_blocked
            && !mutual_feud
            && applied_weight < reporter_weight;

        // Unique reporters → score with peer protection + target shield
        let reporters = self.report_reporters.entry(user_id.clone()).or_default();
        reporters.insert(reporter.0.clone());
        let report_count = reporters.len();
        let report_score = self.report_score_for_target(&user_id, is_underage);
        let now_unix = Self::now_unix();
        let recent_n = self.note_report_time(&user_id, now_unix);
        let raid_spike = !is_underage && recent_n >= Self::REPORT_RAID_SPIKE_N;
        // AI-only: +1. High-rep targets: +shield (except underage).
        let mut effective_threshold = threshold;
        if is_ai {
            effective_threshold = effective_threshold.saturating_add(1);
        }
        if !is_underage {
            effective_threshold = effective_threshold
                .saturating_add(Self::target_reputation_shield(target_stars));
        }
        let min_reps = Self::min_unique_reporters(&reason_s);
        let score_ok = report_score as usize >= effective_threshold;
        let diversity_ok = report_count >= min_reps;
        let mut banned = false;
        let mut escalate_permanent = false;
        let mut ban_until: u64 = 0;
        if score_ok && diversity_ok {
            let prev = self.match_bans.get(&user_id).copied().unwrap_or(0);
            // Explicit second strike → permanent only with enough independent reporters
            // and not during a raid spike (stream brigades).
            let is_explicit_kind = reason_s.eq_ignore_ascii_case("explicit")
                || reason_s.eq_ignore_ascii_case("explicit_ai");
            escalate_permanent = is_explicit_kind
                && prev > 0
                && report_count >= Self::REPORT_PERMANENT_MIN_REPORTERS
                && !raid_spike;
            if raid_spike {
                ban_secs = ban_secs.min(Self::REPORT_RAID_BAN_CAP_SECS);
            }
            let until = if escalate_permanent {
                Self::PERMANENT_BAN_UNTIL
            } else {
                now_unix.saturating_add(ban_secs)
            };
            if until > prev {
                self.match_bans.insert(user_id.clone(), until);
                banned = true;
                ban_until = until;
                // Strip some ★ / trust so banned accounts don't keep Senior power
                self.clawback_on_ban(&user_id, &reason_s);
                tracing::warn!(
                    target = %user_id,
                    reporters = report_count,
                    score = report_score,
                    threshold = effective_threshold,
                    min_reps,
                    target_stars,
                    reason = %reason_s,
                    until,
                    permanent = escalate_permanent,
                    raid_spike,
                    recent_n,
                    "auto match-ban after independent reports"
                );
                let short = if user_id.len() > 14 {
                    format!("{}…", &user_id[..12])
                } else {
                    user_id.clone()
                };
                self.fire_mod_webhook(serde_json::json!({
                    "event": if raid_spike { "auto_ban_raid" } else { "auto_ban" },
                    "text": format!(
                        "ruletka auto-ban: {short} reason={reason_s} score={report_score}/{effective_threshold} reporters={report_count} ban_secs={ban_secs} raid={raid_spike}"
                    ),
                    "target_user_id": user_id,
                    "target_name": target_name,
                    "target_stars": target_stars,
                    "reason": reason_s,
                    "unique_reporters": report_count,
                    "report_score": report_score,
                    "threshold": effective_threshold,
                    "min_unique_reporters": min_reps,
                    "ban_secs": ban_secs,
                    "until": until,
                    "ai_assisted": is_ai,
                    "raid_spike": raid_spike,
                    "recent_reports_window": recent_n,
                    "permanent": escalate_permanent,
                    "last_reporter_trusted": trusted,
                    "last_reporter_senior": senior,
                    "last_reporter_weight": reporter_weight,
                    "last_reporter_applied_weight": applied_weight,
                    "last_reporter_stars": reporter_stars,
                    "mutual_feud": mutual_feud,
                }));
            }
        } else if raid_spike && score_ok && !diversity_ok {
            // Score high but not enough independent reporters — stream raid suspect
            tracing::warn!(
                target = %user_id,
                reporters = report_count,
                score = report_score,
                recent_n,
                reason = %reason_s,
                "report raid spike — no auto-ban (await diversity / ops)"
            );
            self.fire_mod_webhook(serde_json::json!({
                "event": "raid_spike",
                "text": format!(
                    "ruletka raid spike (no ban): {} reason={} score={}/{} reporters={}/{} recent={}",
                    if user_id.len() > 14 { format!("{}…", &user_id[..12]) } else { user_id.clone() },
                    reason_s, report_score, effective_threshold, report_count, min_reps, recent_n
                ),
                "target_user_id": user_id,
                "target_name": target_name,
                "reason": reason_s,
                "unique_reporters": report_count,
                "report_score": report_score,
                "threshold": effective_threshold,
                "min_unique_reporters": min_reps,
                "recent_reports_window": recent_n,
            }));
        }
        self.persist_friends();

        let line = serde_json::json!({
            "t": now_ms,
            "reporter_user_id": reporter.0,
            "reporter_name": reporter.1,
            "reporter_short": reporter.2,
            "reporter_stars": reporter_stars,
            "reporter_weight": reporter_weight,
            "reporter_applied_weight": applied_weight,
            "reporter_trusted": trusted,
            "reporter_senior": senior,
            "peer_blocked": peer_blocked,
            "peer_damped": peer_damped,
            "mutual_feud": mutual_feud,
            "target_user_id": user_id,
            "target_name": target_name,
            "target_stars": target_stars,
            "target_shield": if is_underage { 0 } else { Self::target_reputation_shield(target_stars) },
            "reason": reason_s,
            "unique_reporters": report_count,
            "min_unique_reporters": min_reps,
            "report_score": report_score,
            "threshold": effective_threshold,
            "ai_assisted": is_ai,
            "raid_spike": raid_spike,
            "recent_reports_window": recent_n,
            "auto_banned": banned,
            "permanent": escalate_permanent,
            "ban_secs": if banned { ban_secs } else { 0 },
            "until": ban_until,
            "brigade_v1": true,
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
        self.metrics_inc_report();
        let status_msg = if banned && escalate_permanent {
            "report received — user permanently restricted"
        } else if banned && raid_spike {
            "report received — user restricted (short; raid-like spike)"
        } else if banned {
            "report received — user restricted"
        } else if mutual_feud {
            "report received — mutual reports don't auto-ban either side"
        } else if peer_blocked {
            "report received — seniors cannot auto-ban each other (needs broader consensus)"
        } else if raid_spike {
            "report received — many reports in a short window; needs more independent reporters"
        } else if peer_damped {
            "report received — each person counts as one toward restriction (stars don't amplify bans)"
        } else {
            "report received — thank you (flags/politics alone are not ban grounds)"
        };
        self.status(id, status_msg);
        // Structured feedback so the client can show weight / progress
        self.send(
            id,
            ServerMsg::ReportResult {
                ok: true,
                auto_banned: banned,
                reporter_weight,
                applied_weight,
                report_score,
                threshold: effective_threshold as u32,
                message: status_msg.into(),
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
    /// `secs == 0` (or ≥ 100 years) → permanent (until year ~2200).
    pub fn admin_ban(&mut self, user_id: &str, secs: u64) -> bool {
        let user_id = user_id.trim().to_string();
        if user_id.is_empty() {
            return false;
        }
        let permanent = secs == 0 || secs >= 100 * 365 * 24 * 3600;
        let until = if permanent {
            Self::PERMANENT_BAN_UNTIL
        } else {
            Self::now_unix().saturating_add(secs.max(60))
        };
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
            self.status(
                tid,
                if permanent {
                    "permanently restricted"
                } else {
                    "temporarily restricted"
                },
            );
        }
        tracing::warn!(%user_id, until, permanent, "admin ban");
        true
    }

    /// In-memory recent matches for operator triage (not persisted).
    pub fn admin_recent_matches(&self, limit: usize) -> Vec<serde_json::Value> {
        let lim = limit.clamp(1, 100);
        self.recent_matches
            .iter()
            .rev()
            .take(lim)
            .cloned()
            .collect()
    }

    fn push_recent_match(
        &mut self,
        mode: &str,
        user_a: &str,
        user_b: &str,
        name_a: &str,
        name_b: &str,
    ) {
        if user_a.is_empty() && user_b.is_empty() {
            return;
        }
        let entry = serde_json::json!({
            "ts": Self::now_unix(),
            "mode": mode,
            "user_a": user_a,
            "user_b": user_b,
            "name_a": name_a,
            "name_b": name_b,
        });
        self.recent_matches.push_back(entry);
        while self.recent_matches.len() > Self::MAX_RECENT_MATCHES {
            self.recent_matches.pop_front();
        }
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
        self.metrics_inc_block();

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

    /// True if client is in a pure 1v1 (friend call or stranger) that can invite a 3rd.
    fn live_1v1_partner(&self, id: Uuid) -> Option<Uuid> {
        let c = self.clients.get(&id)?;
        if c.party_with.is_some() {
            return None;
        }
        if c.session_peers.len() > 1 {
            return None;
        }
        if let Some(f) = c.friend_call {
            if matches!(c.phase, Phase::FriendCall | Phase::Matched) {
                return Some(f);
            }
        }
        if matches!(c.phase, Phase::Matched) && c.session_peers.len() == 1 {
            return c.session_peers.iter().next().copied();
        }
        if let Some(p) = c.partner {
            if matches!(c.phase, Phase::Matched | Phase::FriendCall) {
                return Some(p);
            }
        }
        None
    }

    fn expire_join_call_if_needed(&mut self) {
        let Some(p) = self.join_call_pending.clone() else {
            return;
        };
        if Instant::now() < p.expires {
            return;
        }
        self.join_call_pending = None;
        self.send(
            p.from,
            ServerMsg::CallEnded {
                reason: "no answer".into(),
            },
        );
        self.send(
            p.to,
            ServerMsg::CallEnded {
                reason: "invite expired".into(),
            },
        );
        self.status(p.from, "join invite expired");
    }

    fn handle_call_friend(&mut self, id: Uuid, user_id: String, join: bool) {
        self.expire_join_call_if_needed();
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
                "only friends can call — send a request and wait for accept"
            };
            tracing::info!(%my_uid, target = %user_id, %msg, "call_friend rejected");
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
            tracing::info!(%my_uid, target = %user_id, "call_friend: friend offline");
            // Offline ring path: if they registered a push token, fire webhook / record attempt
            if let Some(tok) = self.push_tokens.get(&user_id).cloned() {
                let text = format!(
                    "ruletka: {} is calling you — open the app to answer",
                    my_name
                );
                self.fire_push_webhook(serde_json::json!({
                    "type": "friend_call_ring",
                    "text": text,
                    "to_user_id": user_id,
                    "from_user_id": my_uid,
                    "from_name": my_name,
                    "token": tok.token,
                    "platform": tok.platform,
                }));
                self.metrics_inc_call_ring();
                self.send(
                    id,
                    ServerMsg::Error {
                        message: "friend offline — notification sent".into(),
                    },
                );
                self.status(id, "friend offline — ring notification sent");
            } else {
                self.send(
                    id,
                    ServerMsg::Error {
                        message: "friend offline".into(),
                    },
                );
            }
            // Refresh caller's friends list so UI drops stale "online"
            self.push_friends_list(id);
            return;
        };

        // ——— Invite into current 1v1 as 3rd (do not hang up the other person) ———
        if join {
            let Some(keep) = self.live_1v1_partner(id) else {
                self.send(
                    id,
                    ServerMsg::Error {
                        message: "join invite needs an active 1v1 call first".into(),
                    },
                );
                return;
            };
            if keep == oid {
                self.send(
                    id,
                    ServerMsg::Error {
                        message: "already in a call with them".into(),
                    },
                );
                return;
            }
            // Target must be free
            if !matches!(
                self.clients.get(&oid).map(|c| c.phase),
                Some(Phase::Idle) | None
            ) {
                // Idle only — also allow if not Matched/FriendCall/Waiting
                let busy = matches!(
                    self.clients.get(&oid).map(|c| c.phase),
                    Some(Phase::FriendCall) | Some(Phase::Matched) | Some(Phase::Waiting)
                );
                if busy {
                    self.send(
                        id,
                        ServerMsg::Error {
                            message: "friend is busy — they must be free to join your call".into(),
                        },
                    );
                    return;
                }
            }
            if self.join_call_pending.is_some() || self.find_third_pending.is_some() {
                self.send(
                    id,
                    ServerMsg::Error {
                        message: "another invite is already pending".into(),
                    },
                );
                return;
            }
            let with_name = self
                .clients
                .get(&keep)
                .map(|c| display_label(c))
                .unwrap_or_else(|| "partner".into());
            let with_uid = self
                .clients
                .get(&keep)
                .map(|c| c.user_id.clone())
                .unwrap_or_default();
            self.join_call_pending = Some(JoinCallPending {
                from: id,
                to: oid,
                keep,
                expires: Instant::now() + Duration::from_secs(45),
            });
            self.send(
                oid,
                ServerMsg::CallIncoming {
                    from_user_id: my_uid,
                    from_name: my_name,
                    from_short: my_short,
                    from_peer: my_peer,
                    from_code: my_code,
                    join: true,
                    with_user_id: with_uid,
                    with_name,
                },
            );
            self.metrics_inc_call_ring();
            self.status(id, "inviting friend to join your call…");
            tracing::info!(%id, target = %oid, keep = %keep, "join_call invite");
            return;
        }

        // ——— Classic private call (replaces current session) ———
        // Caller already in a friend call — hang up first
        if self.clients.get(&id).and_then(|c| c.friend_call).is_some() {
            self.end_friend_call(id, "left to call another friend");
        }
        // Caller in a stranger match or party search — leave cleanly so ring works
        if matches!(
            self.clients.get(&id).map(|c| c.phase),
            Some(Phase::Matched) | Some(Phase::Waiting)
        ) {
            self.stop_matchmaking(id);
        }
        // Target already talking: pure 1v1 → ring them so they can *add you* without
        // dropping their partner. Group / party sessions still reject.
        if matches!(
            self.clients.get(&oid).map(|c| c.phase),
            Some(Phase::FriendCall) | Some(Phase::Matched)
        ) {
            let multi = self
                .clients
                .get(&oid)
                .map(|c| c.session_peers.len() >= 2 || c.party_with.is_some())
                .unwrap_or(false);
            if multi || self.live_1v1_partner(oid).is_none() {
                let msg = if multi {
                    "friend is busy in a group call — hang up first. Invite them with Call while you are free, or use Find stranger together for 3."
                } else {
                    "friend is busy in another call"
                };
                self.send(
                    id,
                    ServerMsg::Error {
                        message: msg.into(),
                    },
                );
                return;
            }
            // Pure 1v1 — ring as “add me to your call” (callee keeps their partner)
            let keep = self.live_1v1_partner(oid).unwrap();
            if keep == id {
                self.send(
                    id,
                    ServerMsg::Error {
                        message: "already in a call with them".into(),
                    },
                );
                return;
            }
            if self.join_call_pending.is_some() || self.find_third_pending.is_some() {
                self.send(
                    id,
                    ServerMsg::Error {
                        message: "another invite is already pending".into(),
                    },
                );
                return;
            }
            let with_name = self
                .clients
                .get(&keep)
                .map(display_label)
                .unwrap_or_else(|| "partner".into());
            let with_uid = self
                .clients
                .get(&keep)
                .map(|c| c.user_id.clone())
                .unwrap_or_default();
            // Pending: from=caller, to=busy callee, keep=callee's current partner.
            // On accept, callee hosts: start_three_person_join(callee, keep, caller).
            self.join_call_pending = Some(JoinCallPending {
                from: id,
                to: oid,
                keep,
                expires: Instant::now() + Duration::from_secs(45),
            });
            self.send(
                oid,
                ServerMsg::CallIncoming {
                    from_user_id: my_uid,
                    from_name: my_name,
                    from_short: my_short,
                    from_peer: my_peer,
                    from_code: my_code,
                    join: true,
                    with_user_id: with_uid,
                    with_name,
                },
            );
            self.metrics_inc_call_ring();
            self.status(id, "calling — they can add you without hanging up…");
            tracing::info!(%id, target = %oid, keep = %keep, "call_friend → add-to-busy-1v1");
            return;
        }
        self.join_call_pending = None;
        self.send(
            oid,
            ServerMsg::CallIncoming {
                from_user_id: my_uid,
                from_name: my_name,
                from_short: my_short,
                from_peer: my_peer,
                from_code: my_code,
                join: false,
                with_user_id: String::new(),
                with_name: String::new(),
            },
        );
        self.metrics_inc_call_ring();
        self.status(id, "calling friend…");
    }

    /// After C accepts join invite: keep A–B media, mesh C with both.
    fn start_three_person_join(&mut self, a: Uuid, b: Uuid, c: Uuid) {
        // a = inviter, b = keep (already with a), c = joiner
        let (session_id, session_key) = {
            let ca = self.clients.get(&a).unwrap();
            let cb = self.clients.get(&b).unwrap();
            let cc = self.clients.get(&c).unwrap();
            Self::make_session_id(&[&ca.peer_id, &cb.peer_id, &cc.peer_id, "join3"])
        };
        let ab_friend = self.clients.get(&a).and_then(|x| x.friend_call) == Some(b)
            || self.clients.get(&b).and_then(|x| x.friend_call) == Some(a);
        let ab_role = if ab_friend { "friend" } else { "teammate" };

        // Update session state — do not clear A–B WebRTC
        for (id, peers, party) in [
            (a, vec![b, c], Some(b)),
            (b, vec![a, c], Some(a)),
            (c, vec![a, b], None),
        ] {
            if let Some(cl) = self.clients.get_mut(&id) {
                cl.phase = Phase::Matched;
                cl.session_id = Some(session_id.clone());
                cl.session_peers = peers.iter().copied().collect();
                cl.partner = peers.first().copied();
                cl.party_with = party;
                cl.stranger_party = false;
                cl.match_started = Some(Instant::now());
                // Keep friend_call between a–b only
                if id == c {
                    cl.friend_call = None;
                }
            }
        }

        // Payloads: A & B stay "party" layout (mate + joiner as party role on 3rd tile)
        // C is "solo" vs two party members (split 1v2 layout)
        let peer_for = |from: Uuid, to: Uuid, role: &str| {
            let ca = self.clients.get(&from).unwrap();
            let cb = self.clients.get(&to).unwrap();
            let snap = self.effect_snapshot_for(&cb.user_id);
            self.match_peer(ca, cb, role, snap.0, snap.1, snap.2)
        };

        let a_peers = vec![
            peer_for(a, b, ab_role),
            peer_for(a, c, "party"), // layout: 3rd column
        ];
        let b_peers = vec![
            peer_for(b, a, ab_role),
            peer_for(b, c, "party"),
        ];
        let c_peers = vec![peer_for(c, a, "party"), peer_for(c, b, "party")];

        self.send(
            a,
            ServerMsg::Matched {
                partner_short: display_label(self.clients.get(&c).unwrap()),
                session_id: session_id.clone(),
                session_key: session_key.clone(),
                is_offerer: a_peers.iter().any(|p| p.is_offerer && p.user_id == self.clients[&c].user_id),
                room: self.room_of(a),
                mode: "party_browse".into(),
                your_role: "party".into(),
                peers: a_peers,
            },
        );
        self.send(
            b,
            ServerMsg::Matched {
                partner_short: display_label(self.clients.get(&c).unwrap()),
                session_id: session_id.clone(),
                session_key: session_key.clone(),
                is_offerer: b_peers.iter().any(|p| p.is_offerer && p.user_id == self.clients[&c].user_id),
                room: self.room_of(b),
                mode: "party_browse".into(),
                your_role: "party".into(),
                peers: b_peers,
            },
        );
        self.send(
            c,
            ServerMsg::Matched {
                partner_short: format!(
                    "{}+{}",
                    display_label(self.clients.get(&a).unwrap()),
                    display_label(self.clients.get(&b).unwrap())
                ),
                session_id,
                session_key,
                is_offerer: c_peers.iter().any(|p| p.is_offerer),
                room: self.room_of(c),
                mode: "party_browse".into(),
                your_role: "solo".into(),
                peers: c_peers,
            },
        );
        self.status(a, "friend joined your call");
        self.status(b, "friend joined the call");
        self.status(c, "you joined their call");
        tracing::info!(%a, %b, %c, "three_person_join started");
        self.broadcast_lobby_info();
    }

    fn handle_register_push(
        &mut self,
        id: Uuid,
        token: String,
        platform: String,
        clear: bool,
    ) {
        let Some(me) = self.clients.get(&id) else {
            return;
        };
        let uid = me.user_id.clone();
        if uid.is_empty() {
            self.send(
                id,
                ServerMsg::PushRegistered {
                    ok: false,
                    message: "hello first".into(),
                },
            );
            return;
        }
        if clear || token.trim().is_empty() {
            self.push_tokens.remove(&uid);
            self.persist_push_tokens();
            self.send(
                id,
                ServerMsg::PushRegistered {
                    ok: true,
                    message: "cleared".into(),
                },
            );
            return;
        }
        let tok = token.chars().take(512).collect::<String>();
        let plat = platform.chars().take(32).collect::<String>();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        self.push_tokens.insert(
            uid,
            PushToken {
                token: tok,
                platform: if plat.is_empty() {
                    "unknown".into()
                } else {
                    plat
                },
                updated: now,
            },
        );
        self.persist_push_tokens();
        self.send(
            id,
            ServerMsg::PushRegistered {
                ok: true,
                message: "registered".into(),
            },
        );
    }

    /// Caller hung up while the target was still ringing.
    fn handle_call_cancel(&mut self, id: Uuid, user_id: String) {
        let Some(me) = self.clients.get(&id) else {
            return;
        };
        let my_uid = me.user_id.clone();
        if my_uid.is_empty() || user_id.is_empty() {
            return;
        }
        // Clear join-invite if this was a join ring
        if let Some(p) = self.join_call_pending.clone() {
            if p.from == id {
                self.join_call_pending = None;
            }
        }
        // Tell callee the ring is over (if they still have that incoming UI).
        if let Some(&oid) = self.by_user.get(&user_id) {
            self.send(
                oid,
                ServerMsg::CallEnded {
                    reason: "caller cancelled".into(),
                },
            );
        }
        self.status(id, "call cancelled");
        tracing::info!(%my_uid, target = %user_id, "call_cancel");
    }

    fn handle_call_respond(&mut self, id: Uuid, from_user_id: String, accept: bool) {
        self.expire_join_call_if_needed();
        let Some(&caller) = self.by_user.get(&from_user_id) else {
            self.send(
                id,
                ServerMsg::Error {
                    message: "caller offline".into(),
                },
            );
            return;
        };

        // Join-existing-call path (invite 3rd without dropping the other person).
        // Two shapes:
        //  A) Outbound invite: host=caller already with keep; guest=id free → mesh (caller, keep, id)
        //  B) Inbound ring to busy host: host=id already with keep; guest=caller free → mesh (id, keep, caller)
        if let Some(p) = self.join_call_pending.clone() {
            if p.to == id && p.from == caller {
                self.join_call_pending = None;
                if !accept {
                    self.send(
                        caller,
                        ServerMsg::CallEnded {
                            reason: "join declined".into(),
                        },
                    );
                    self.status(caller, "join declined");
                    return;
                }
                if !self.clients.contains_key(&p.keep) || !self.clients.contains_key(&caller) {
                    self.send(
                        id,
                        ServerMsg::Error {
                            message: "call ended — try again".into(),
                        },
                    );
                    return;
                }
                // Friendship still required with inviter
                let my_uid = self
                    .clients
                    .get(&id)
                    .map(|c| c.user_id.clone())
                    .unwrap_or_default();
                let i_have = self
                    .friendships
                    .get(&my_uid)
                    .map(|s| s.contains(&from_user_id))
                    .unwrap_or(false);
                let they_have = self
                    .friendships
                    .get(&from_user_id)
                    .map(|s| s.contains(&my_uid))
                    .unwrap_or(false);
                if !i_have || !they_have {
                    self.send(
                        id,
                        ServerMsg::Error {
                            message: "not friends — only friends can join".into(),
                        },
                    );
                    self.send(
                        caller,
                        ServerMsg::CallEnded {
                            reason: "join failed — not friends".into(),
                        },
                    );
                    return;
                }
                // B) Accepting while *you* already host a pure 1v1 → keep partner, caller joins
                if let Some(keep) = self.live_1v1_partner(id) {
                    if keep != caller {
                        if matches!(
                            self.clients.get(&caller).map(|c| c.phase),
                            Some(Phase::Waiting)
                        ) {
                            self.stop_matchmaking(caller);
                        } else if self
                            .clients
                            .get(&caller)
                            .and_then(|c| c.friend_call)
                            .is_some()
                            && self.clients.get(&caller).and_then(|c| c.friend_call) != Some(id)
                        {
                            self.end_friend_call(caller, "left to join another call");
                        } else if matches!(
                            self.clients.get(&caller).map(|c| c.phase),
                            Some(Phase::Matched)
                        ) {
                            self.stop_matchmaking(caller);
                        }
                        self.start_three_person_join(id, keep, caller);
                        return;
                    }
                }
                // A) Guest accepts invite into host's call (guest may need to leave first)
                if matches!(
                    self.clients.get(&id).map(|c| c.phase),
                    Some(Phase::FriendCall) | Some(Phase::Matched) | Some(Phase::Waiting)
                ) {
                    if self.clients.get(&id).and_then(|c| c.friend_call).is_some() {
                        self.end_friend_call(id, "left to join another call");
                    }
                    if matches!(
                        self.clients.get(&id).map(|c| c.phase),
                        Some(Phase::Matched) | Some(Phase::Waiting)
                    ) {
                        self.stop_matchmaking(id);
                    }
                }
                if !self.clients.contains_key(&p.keep) {
                    self.send(
                        id,
                        ServerMsg::Error {
                            message: "call ended — try again".into(),
                        },
                    );
                    return;
                }
                self.start_three_person_join(caller, p.keep, id);
                return;
            }
        }

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
        // Only mutual friends may start a direct call (never strangers)
        let my_uid = self
            .clients
            .get(&id)
            .map(|c| c.user_id.clone())
            .unwrap_or_default();
        let i_have = self
            .friendships
            .get(&my_uid)
            .map(|s| s.contains(&from_user_id))
            .unwrap_or(false);
        let they_have = self
            .friendships
            .get(&from_user_id)
            .map(|s| s.contains(&my_uid))
            .unwrap_or(false);
        if my_uid.is_empty() || !i_have || !they_have {
            tracing::info!(
                %my_uid,
                caller = %from_user_id,
                "call_respond accept rejected — not mutual friends"
            );
            self.send(
                id,
                ServerMsg::Error {
                    message: "not friends — only friends can call".into(),
                },
            );
            self.send(
                caller,
                ServerMsg::CallEnded {
                    reason: "call failed — not friends".into(),
                },
            );
            return;
        }
        if self.is_blocked_pair_uid(&my_uid, &from_user_id) {
            self.send(
                id,
                ServerMsg::Error {
                    message: "cannot call — user is blocked".into(),
                },
            );
            self.send(
                caller,
                ServerMsg::CallEnded {
                    reason: "call failed".into(),
                },
            );
            return;
        }
        // Callee already in a pure 1v1 (stranger or friend) — add caller as 3rd
        // instead of hanging up the current conversationalist.
        if let Some(keep) = self.live_1v1_partner(id) {
            if keep != caller {
                if self.clients.get(&caller).and_then(|c| c.friend_call).is_some() {
                    if self.clients.get(&caller).and_then(|c| c.friend_call) != Some(id) {
                        self.end_friend_call(caller, "left previous friend call");
                    }
                }
                if matches!(
                    self.clients.get(&caller).map(|c| c.phase),
                    Some(Phase::Matched) | Some(Phase::Waiting)
                ) {
                    self.stop_matchmaking(caller);
                } else {
                    self.dequeue_client(caller);
                }
                self.join_call_pending = None;
                self.start_three_person_join(id, keep, caller);
                return;
            }
        }
        // Drop any stranger/queue/party state so friend 1:1 can start cleanly
        if self.clients.get(&id).and_then(|c| c.friend_call).is_some() {
            self.end_friend_call(id, "left previous friend call");
        }
        if self.clients.get(&caller).and_then(|c| c.friend_call).is_some() {
            // Shouldn't happen mid-ring, but be safe
            if self.clients.get(&caller).and_then(|c| c.friend_call) != Some(id) {
                self.end_friend_call(caller, "left previous friend call");
            }
        }
        for cid in [id, caller] {
            if matches!(
                self.clients.get(&cid).map(|c| c.phase),
                Some(Phase::Matched) | Some(Phase::Waiting)
            ) {
                self.stop_matchmaking(cid);
            } else {
                self.dequeue_client(cid);
            }
        }
        self.join_call_pending = None;
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
                let from_user_id = self
                    .clients
                    .get(&id)
                    .map(|c| c.user_id.clone())
                    .unwrap_or_default();
                let chat = ServerMsg::Chat {
                    author: author.clone(),
                    body: body.clone(),
                    from_user_id,
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
        let (author, from_user_id, targets) = match self.clients.get(&id) {
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
                (author, c.user_id.clone(), t)
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
            from_user_id,
        };
        self.send(id, chat.clone());
        for t in targets {
            self.send(t, chat.clone());
        }
    }

    /// Friend direct message — works when peer is offline (stored + delivered later via history).
    fn handle_friend_chat(&mut self, id: Uuid, to_user_id: String, body: String) {
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
        let to_user_id = to_user_id.trim().to_string();
        if to_user_id.is_empty() {
            return;
        }
        let Some(me) = self.clients.get(&id).map(|c| c.user_id.clone()) else {
            return;
        };
        if me == to_user_id {
            self.send(
                id,
                ServerMsg::Error {
                    message: "cannot message yourself".into(),
                },
            );
            return;
        }
        if !self.are_mutual_friends(&me, &to_user_id) {
            self.send(
                id,
                ServerMsg::Error {
                    message: "can only message mutual friends".into(),
                },
            );
            return;
        }
        if self.is_blocked_pair_uid(&me, &to_user_id) {
            self.send(
                id,
                ServerMsg::Error {
                    message: "cannot message — user is blocked".into(),
                },
            );
            return;
        }
        let from_name = self
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
        let ts = Self::now_unix();
        let msg_id = Uuid::new_v4().to_string();
        let key = friends_store::dm_conv_key(&me, &to_user_id);
        let stored = friends_store::StoredDm {
            id: msg_id.clone(),
            from: me.clone(),
            to: to_user_id.clone(),
            body: body.clone(),
            ts,
        };
        {
            let list = self.dms.entry(key).or_default();
            list.push(stored);
            while list.len() > MAX_DM_PER_CONV {
                list.remove(0);
            }
        }
        self.persist_friends();

        let wire = ServerMsg::FriendChat {
            id: msg_id,
            from_user_id: me,
            from_name,
            to_user_id: to_user_id.clone(),
            body,
            ts,
        };
        // Echo to sender
        self.send(id, wire.clone());
        // Live deliver if online
        if let Some(&tid) = self.by_user.get(&to_user_id) {
            self.send(tid, wire);
            // Refresh friend list previews for both
            self.push_friends_list(tid);
        }
        self.push_friends_list(id);
    }

    fn handle_friend_chat_history(&mut self, id: Uuid, with_user_id: String) {
        let with_user_id = with_user_id.trim().to_string();
        let Some(me) = self.clients.get(&id).map(|c| c.user_id.clone()) else {
            return;
        };
        if with_user_id.is_empty() || me == with_user_id {
            self.send(
                id,
                ServerMsg::FriendChatHistory {
                    with_user_id,
                    messages: vec![],
                },
            );
            return;
        }
        if !self.are_mutual_friends(&me, &with_user_id) {
            self.send(
                id,
                ServerMsg::Error {
                    message: "can only load chat with mutual friends".into(),
                },
            );
            return;
        }
        let key = friends_store::dm_conv_key(&me, &with_user_id);
        let messages: Vec<FriendChatLine> = self
            .dms
            .get(&key)
            .map(|list| {
                list.iter()
                    .map(|m| {
                        let from_name = if let Some(&cid) = self.by_user.get(&m.from) {
                            let c = &self.clients[&cid];
                            if c.name.is_empty() || c.name == "anon" {
                                c.short_id.clone()
                            } else {
                                c.name.clone()
                            }
                        } else {
                            self.known_names
                                .get(&m.from)
                                .cloned()
                                .filter(|n| !n.is_empty())
                                .unwrap_or_else(|| m.from.chars().take(8).collect())
                        };
                        FriendChatLine {
                            id: m.id.clone(),
                            from_user_id: m.from.clone(),
                            from_name,
                            body: m.body.clone(),
                            ts: m.ts,
                        }
                    })
                    .collect()
            })
            .unwrap_or_default();
        self.send(
            id,
            ServerMsg::FriendChatHistory {
                with_user_id,
                messages,
            },
        );
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
