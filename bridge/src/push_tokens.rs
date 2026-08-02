//! Device push tokens for offline friend-call rings (post-v1 delivery path).
//! Stored beside friends.json as `push_tokens.json` (user_id → token).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushToken {
    pub token: String,
    /// "ios" | "android" | "web" | "expo" | …
    #[serde(default)]
    pub platform: String,
    /// Unix seconds last updated
    #[serde(default)]
    pub updated: u64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct FileShape {
    #[serde(default)]
    pub tokens: HashMap<String, PushToken>,
}

pub fn path_beside_friends(friends_path: &Path) -> PathBuf {
    friends_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("push_tokens.json")
}

pub fn load(path: &Path) -> HashMap<String, PushToken> {
    let Ok(text) = std::fs::read_to_string(path) else {
        return HashMap::new();
    };
    serde_json::from_str::<FileShape>(&text)
        .map(|f| f.tokens)
        .unwrap_or_default()
}

pub fn save(path: &Path, tokens: &HashMap<String, PushToken>) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let body = serde_json::to_string_pretty(&FileShape {
        tokens: tokens.clone(),
    })
    .map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, body).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())
}
