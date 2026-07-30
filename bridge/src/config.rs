//! Public runtime config for browsers (ICE / STUN / TURN).
//!
//! Supports static TURN username/password **or** coturn-style time-limited
//! credentials (`ROULETTE_TURN_SECRET`) so long-lived secrets never sit in the browser.

use hmac::{Hmac, Mac};
use serde::Serialize;
use sha1::Sha1;
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha1 = Hmac<Sha1>;

/// Browser-shaped RTCIceServer entry.
#[derive(Clone, Debug, Serialize)]
pub struct IceServer {
    pub urls: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credential: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct PublicConfig {
    pub mode: String,
    /// RTCConfiguration.iceServers
    pub ice_servers: Vec<IceServer>,
    pub has_turn: bool,
    /// true when using free public Open Relay (demo) TURN
    pub turn_is_open_relay: bool,
    /// When true, credentials are short-lived (re-fetch config periodically).
    pub turn_ephemeral: bool,
    /// Credential TTL seconds when ephemeral (hint for clients).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub turn_ttl_secs: Option<u64>,
    /// Human hints for operators (not secrets).
    pub notes: Vec<String>,
    /// Lightweight security hints for the UI security panel.
    pub security: SecurityHints,
    /// Optional analytics IDs (public; never put secrets here).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub analytics: Option<AnalyticsPublic>,
}

#[derive(Clone, Debug, Serialize, Default)]
pub struct AnalyticsPublic {
    /// Yandex Metrica counter id (digits only), empty = disabled
    #[serde(skip_serializing_if = "Option::is_none")]
    pub yandex_metrica_id: Option<String>,
    /// Google Analytics 4 measurement id (G-XXXX)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ga_measurement_id: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct SecurityHints {
    pub media: String,
    pub signaling: String,
    pub turn_trust: String,
    pub partner_can_record: bool,
}

/// Free public TURN (Open Relay / Metered) — demo-grade, not for production secrets.
pub const OPEN_RELAY_TURN_URLS: &str = "\
turn:openrelay.metered.ca:80,\
turn:openrelay.metered.ca:443,\
turn:openrelay.metered.ca:443?transport=tcp";
pub const OPEN_RELAY_USER: &str = "openrelayproject";
pub const OPEN_RELAY_PASS: &str = "openrelayproject";

/// Operator-held TURN settings (never serialize the secret).
#[derive(Clone, Debug)]
pub struct TurnAuth {
    pub urls: Option<String>,
    pub static_user: Option<String>,
    pub static_pass: Option<String>,
    /// coturn static-auth-secret — enables time-limited REST credentials
    pub secret: Option<String>,
    pub ttl_secs: u64,
    pub is_open_relay: bool,
}

impl TurnAuth {
    pub fn has_turn(&self) -> bool {
        self.urls.as_ref().map(|u| !u.trim().is_empty()).unwrap_or(false)
    }

    pub fn ephemeral(&self) -> bool {
        self.has_turn() && self.secret.as_ref().map(|s| !s.is_empty()).unwrap_or(false)
    }
}

/// Parse comma-separated STUN/TURN URLs into one server entry per URL group.
pub fn parse_urls(csv: &str) -> Vec<String> {
    csv.split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect()
}

/// Resolve TURN from env-style args.
/// - `turn_csv` None or empty + `use_open_relay` → Open Relay
/// - `turn_csv` "off" / "none" / "false" → no TURN
/// - otherwise custom TURN URLs
pub fn resolve_turn(
    turn_csv: Option<&str>,
    turn_user: Option<&str>,
    turn_pass: Option<&str>,
    use_open_relay: bool,
) -> (Option<String>, Option<String>, Option<String>, bool) {
    let raw = turn_csv.map(str::trim).filter(|s| !s.is_empty());
    if let Some(t) = raw {
        let lower = t.to_ascii_lowercase();
        if matches!(lower.as_str(), "off" | "none" | "false" | "0" | "stun") {
            return (None, None, None, false);
        }
        return (
            Some(t.to_string()),
            turn_user.map(str::to_string),
            turn_pass.map(str::to_string),
            false,
        );
    }
    if use_open_relay {
        return (
            Some(OPEN_RELAY_TURN_URLS.into()),
            Some(OPEN_RELAY_USER.into()),
            Some(OPEN_RELAY_PASS.into()),
            true,
        );
    }
    (None, None, None, false)
}

/// coturn REST / static-auth-secret style credentials.
/// username = "{expiry_unix}:{label}", credential = base64(HMAC-SHA1(secret, username))
pub fn turn_rest_credentials(secret: &str, ttl_secs: u64, label: &str) -> (String, String) {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let expiry = now.saturating_add(ttl_secs.max(60));
    let safe_label: String = label
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(32)
        .collect();
    let label = if safe_label.is_empty() {
        "rulet"
    } else {
        &safe_label
    };
    let username = format!("{expiry}:{label}");
    let mut mac =
        HmacSha1::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key length");
    mac.update(username.as_bytes());
    let result = mac.finalize().into_bytes();
    let credential = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, result);
    (username, credential)
}

fn security_hints(has_turn: bool, is_open: bool, ephemeral: bool) -> SecurityHints {
    let turn_trust = if !has_turn {
        "no_turn".into()
    } else if is_open {
        "open_relay_demo".into()
    } else if ephemeral {
        "self_hosted_ephemeral".into()
    } else {
        "self_hosted_static".into()
    };
    SecurityHints {
        media: "webrtc_p2p_srtp".into(),
        signaling: "bridge_wss".into(),
        turn_trust,
        partner_can_record: true,
    }
}

pub fn build_public_config(
    mode: &str,
    stun_csv: &str,
    turn: &TurnAuth,
) -> PublicConfig {
    let mut ice_servers = Vec::new();
    let mut notes = Vec::new();

    let stun = parse_urls(stun_csv);
    if stun.is_empty() {
        ice_servers.push(IceServer {
            urls: vec![
                "stun:stun.l.google.com:19302".into(),
                "stun:stun1.l.google.com:19302".into(),
            ],
            username: None,
            credential: None,
        });
        notes.push("using default Google STUN".into());
    } else {
        ice_servers.push(IceServer {
            urls: stun,
            username: None,
            credential: None,
        });
    }

    let mut has_turn = false;
    let mut ephemeral = false;
    let mut ttl = None;

    if let Some(turn_csv) = turn.urls.as_ref() {
        let urls = parse_urls(turn_csv);
        if !urls.is_empty() {
            has_turn = true;
            let (username, credential) = if let Some(secret) = turn.secret.as_ref().filter(|s| !s.is_empty())
            {
                ephemeral = true;
                ttl = Some(turn.ttl_secs.max(60));
                let (u, c) = turn_rest_credentials(secret, turn.ttl_secs, "web");
                (Some(u), Some(c))
            } else {
                (
                    turn.static_user.clone(),
                    turn.static_pass.clone(),
                )
            };
            ice_servers.push(IceServer {
                urls,
                username,
                credential,
            });
            if turn.is_open_relay {
                notes.push(
                    "TURN: free Open Relay (demo) — set ROULETTE_TURN + ROULETTE_TURN_SECRET for your own coturn"
                        .into(),
                );
            } else if ephemeral {
                notes.push(
                    "TURN: self-hosted with short-lived credentials (coturn static-auth-secret)"
                        .into(),
                );
            } else {
                notes.push("TURN relay configured (helps hard NATs)".into());
                if turn.static_user.is_none() || turn.static_pass.is_none() {
                    notes.push(
                        "TURN without username/password — only works if server allows open auth"
                            .into(),
                    );
                } else {
                    notes.push(
                        "tip: set ROULETTE_TURN_SECRET for time-limited TURN credentials"
                            .into(),
                    );
                }
            }
        }
    } else {
        notes.push("no TURN — video may fail across some NATs/firewalls".into());
        notes.push("tip: leave ROULETTE_OPEN_TURN=1 (default) or set ROULETTE_TURN=…".into());
    }

    notes.push("cam/mic need a secure context: https://, localhost, or a TLS tunnel".into());
    notes.push("partner can always screenshot/record — use Block/Report".into());

    PublicConfig {
        mode: mode.into(),
        ice_servers,
        has_turn,
        turn_is_open_relay: has_turn && turn.is_open_relay,
        turn_ephemeral: ephemeral,
        turn_ttl_secs: ttl,
        notes,
        security: security_hints(has_turn, turn.is_open_relay, ephemeral),
        analytics: None,
    }
}
