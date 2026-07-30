//! Cross-bridge federation (nextface-fed/1): claim free peers + relay signals/chat.

use serde::{Deserialize, Serialize};
use std::time::Duration;

pub const PROTOCOL: &str = "nextface-fed/1";

#[derive(Clone, Debug)]
pub struct FederationConfig {
    pub instance_id: String,
    /// Shared secret for claim/relay. Empty = read-only info, no claims.
    pub token: String,
    /// Peer bridge base URLs (no trailing slash).
    pub peers: Vec<String>,
    /// Our public base URL so peers can relay back to us.
    pub public_base: String,
}

impl FederationConfig {
    pub fn accepts_claims(&self) -> bool {
        !self.token.is_empty()
    }

    pub fn enabled_outbound(&self) -> bool {
        self.accepts_claims() && !self.peers.is_empty() && !self.public_base.is_empty()
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RoomWaiting {
    pub room: String,
    pub waiting_solo: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FederationInfo {
    pub protocol: String,
    pub instance_id: String,
    pub online: usize,
    pub waiting_solo: usize,
    pub waiting_total: usize,
    pub accepts_claims: bool,
    pub rooms: Vec<RoomWaiting>,
    #[serde(default)]
    pub public_base: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FedPeerDesc {
    pub peer_id: String,
    pub short_id: String,
    pub user_id: String,
    pub name: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ClaimRequest {
    #[serde(default)]
    pub room: String,
    pub caller_instance_id: String,
    pub caller_base_url: String,
    pub remote_peer: FedPeerDesc,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ClaimResponse {
    pub protocol: String,
    pub session_id: String,
    pub session_key: String,
    pub claimed_peer: FedPeerDesc,
    /// True if the **caller** should create the WebRTC offer.
    pub caller_is_offerer: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RelayKind {
    Signal,
    Chat,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RelayRequest {
    pub session_id: String,
    pub kind: RelayKind,
    #[serde(default)]
    pub from_peer: String,
    #[serde(default)]
    pub to_peer: String,
    #[serde(default)]
    pub signal_kind: String,
    #[serde(default)]
    pub payload: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub body: String,
}

/// Outbound message the hub wants the HTTP layer to deliver.
#[derive(Clone, Debug)]
pub struct FedOutbound {
    pub base_url: String,
    pub request: RelayRequest,
}

pub fn federated_peer_id(session_id: &str, original_peer_id: &str) -> String {
    format!("fed/{session_id}/{original_peer_id}")
}

pub fn parse_federated_peer_id(fed: &str) -> Option<(String, String)> {
    // fed/{session}/{peer_id} — peer_id may contain no slashes in our ids (hex uuid)
    let rest = fed.strip_prefix("fed/")?;
    let (session, peer) = rest.split_once('/')?;
    if session.is_empty() || peer.is_empty() {
        return None;
    }
    Some((session.to_string(), peer.to_string()))
}

pub fn caller_is_offerer(caller_peer_id: &str, claimed_peer_id: &str) -> bool {
    caller_peer_id < claimed_peer_id
}

pub fn normalize_base(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

pub fn auth_ok(cfg: &FederationConfig, header: Option<&str>) -> bool {
    if !cfg.accepts_claims() {
        return false;
    }
    let Some(h) = header else {
        return false;
    };
    let h = h.trim();
    if let Some(b) = h.strip_prefix("Bearer ").or_else(|| h.strip_prefix("bearer ")) {
        return b.trim() == cfg.token;
    }
    // Also accept raw token
    h == cfg.token
}

/// HTTP client helpers (reqwest).
pub async fn fetch_info(base: &str) -> Result<FederationInfo, String> {
    let url = format!("{}/v1/federation/info", normalize_base(base));
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("info HTTP {}", res.status()));
    }
    res.json().await.map_err(|e| e.to_string())
}

pub async fn post_claim(
    base: &str,
    token: &str,
    body: &ClaimRequest,
) -> Result<ClaimResponse, String> {
    let url = format!("{}/v1/federation/claim", normalize_base(base));
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;
    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {token}"))
        .json(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status();
    if status.as_u16() == 404 {
        return Err("no_peer".into());
    }
    if !status.is_success() {
        let t = res.text().await.unwrap_or_default();
        return Err(format!("claim HTTP {status}: {t}"));
    }
    res.json().await.map_err(|e| e.to_string())
}

pub async fn post_relay(base: &str, token: &str, body: &RelayRequest) -> Result<(), String> {
    let url = format!("{}/v1/federation/relay", normalize_base(base));
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;
    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {token}"))
        .json(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status();
    if !status.is_success() {
        let t = res.text().await.unwrap_or_default();
        return Err(format!("relay HTTP {status}: {t}"));
    }
    Ok(())
}
