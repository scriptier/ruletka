//! Persist friendships, friend codes, blocks, pending requests, abuse bans, and friend DMs.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

/// One stored friend direct message (online or offline delivery).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredDm {
    pub id: String,
    pub from: String,
    pub to: String,
    pub body: String,
    pub ts: u64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct FriendsFile {
    /// user_id → set of friend user_ids (mutual)
    #[serde(default)]
    pub friendships: HashMap<String, HashSet<String>>,
    /// friend_code → user_id
    #[serde(default)]
    pub code_index: HashMap<String, String>,
    /// user_id → last known display name
    #[serde(default)]
    pub names: HashMap<String, String>,
    /// user_id → last known avatar data URL (for friend list when offline)
    #[serde(default)]
    pub avatars: HashMap<String, String>,
    /// user_id → set of blocked user_ids (blocker → blocked)
    #[serde(default)]
    pub blocks: HashMap<String, HashSet<String>>,
    /// Pending friend requests: from_user → set of to_users
    #[serde(default)]
    pub pending: HashMap<String, HashSet<String>>,
    /// target_user_id → set of reporter user_ids (unique reporters for auto-ban)
    #[serde(default)]
    pub report_reporters: HashMap<String, HashSet<String>>,
    /// user_id → ban expiry unix seconds (matchmaking ban from reports)
    #[serde(default)]
    pub match_bans: HashMap<String, u64>,
    /// conversation_key (sorted uid_a|uid_b) → messages (newest last)
    #[serde(default)]
    pub dms: HashMap<String, Vec<StoredDm>>,
    /// user_id → total stars received (public reputation badge)
    #[serde(default)]
    pub star_counts: HashMap<String, u64>,
    /// Directed "from_user|to_user" — each pair may rate once (star or skip)
    #[serde(default)]
    pub star_edges: HashSet<String>,
    /// user_id → active paid star effect (bars, flowers, …) until unix secs
    #[serde(default)]
    pub star_effects: HashMap<String, StarEffectRecord>,
    /// Keys for 1h mutual star bonuses already paid (dedupe both sides ending match).
    /// Format: hour|{sorted_uid_pair}|{match_start_unix}
    #[serde(default)]
    pub hour_star_sessions: HashSet<String>,
    /// user_id → unix when they may Next again (Please stay lock).
    #[serde(default)]
    pub no_skip_until: HashMap<String, u64>,
    /// spender|target → last please_stay spend unix (once per ~30 days per pair).
    #[serde(default)]
    pub please_stay_last: HashMap<String, u64>,
}

/// Cosmetic effect bought with stars (no money). Survives logout until `until`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StarEffectRecord {
    /// "bars" | "flowers" (flowers reserved for later)
    pub kind: String,
    /// Unix seconds when the effect ends
    pub until: u64,
}

/// Directed star edge key (order matters: A→B ≠ B→A).
pub fn star_edge_key(from: &str, to: &str) -> String {
    format!("{from}|{to}")
}

/// Stable conversation key for two user ids (order-independent).
pub fn dm_conv_key(a: &str, b: &str) -> String {
    if a <= b {
        format!("{a}|{b}")
    } else {
        format!("{b}|{a}")
    }
}

pub fn load(path: &Path) -> FriendsFile {
    match std::fs::read_to_string(path) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => FriendsFile::default(),
    }
}

pub fn save(path: &Path, data: &FriendsFile) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("json.tmp");
    let s = serde_json::to_string_pretty(data).unwrap_or_else(|_| "{}".into());
    std::fs::write(&tmp, s)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

pub fn default_path() -> PathBuf {
    PathBuf::from("data/friends.json")
}
