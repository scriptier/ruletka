//! Persist friendships, friend codes, blocks, pending requests, and abuse bans.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

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
