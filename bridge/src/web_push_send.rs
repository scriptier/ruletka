//! Native Web Push delivery for offline friend-call rings (platform=web).
//!
//! Env (set in data/vapid.env on the hub):
//! - `ROULETTE_VAPID_PRIVATE` — URL-safe base64 (no pad) raw P-256 private key
//! - `ROULETTE_VAPID_PUBLIC`  — optional; derived from private when empty
//! - `ROULETTE_VAPID_SUBJECT` — `mailto:` or `https:` contact claim (default mailto:support@ruletka.vip)

use base64::engine::general_purpose::{URL_SAFE, URL_SAFE_NO_PAD};
use base64::Engine;
use serde::Deserialize;
use web_push::{
    ContentEncoding, IsahcWebPushClient, SubscriptionInfo, Urgency, VapidSignatureBuilder,
    WebPushClient, WebPushMessageBuilder,
};

/// Server-side VAPID material (never serialize / never put in /config.json except public).
#[derive(Clone, Debug)]
pub struct VapidKeys {
    /// URL-safe base64 (no pad) raw private key bytes
    pub private_b64: String,
    /// URL-safe base64 (no pad) uncompressed public key for PushManager
    pub public_b64: String,
    /// JWT `sub` claim
    pub subject: String,
}

#[derive(Debug, Deserialize)]
struct WebSubKeys {
    p256dh: String,
    auth: String,
}

/// Browser `PushSubscription.toJSON()` shape (also accepts nested keys only).
#[derive(Debug, Deserialize)]
struct WebSubscription {
    endpoint: String,
    #[serde(default)]
    keys: Option<WebSubKeys>,
    #[serde(default)]
    p256dh: Option<String>,
    #[serde(default)]
    auth: Option<String>,
}

/// Load VAPID from environment. Returns None if private key missing/invalid.
pub fn load_from_env() -> Option<VapidKeys> {
    let private_b64 = std::env::var("ROULETTE_VAPID_PRIVATE")
        .unwrap_or_default()
        .trim()
        .to_string();
    if private_b64.is_empty() {
        return None;
    }
    // Validate private + derive public if needed
    let partial = match VapidSignatureBuilder::from_base64_no_sub(&private_b64) {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!(error = %e, "ROULETTE_VAPID_PRIVATE invalid — web push disabled");
            return None;
        }
    };
    let mut public_b64 = std::env::var("ROULETTE_VAPID_PUBLIC")
        .unwrap_or_default()
        .trim()
        .to_string();
    if public_b64.is_empty() {
        let raw = partial.get_public_key();
        public_b64 = URL_SAFE_NO_PAD.encode(raw);
    }
    let subject = std::env::var("ROULETTE_VAPID_SUBJECT")
        .unwrap_or_default()
        .trim()
        .to_string();
    let subject = if subject.is_empty() {
        "mailto:support@ruletka.vip".into()
    } else {
        subject
    };
    Some(VapidKeys {
        private_b64,
        public_b64,
        subject,
    })
}

fn parse_subscription(token: &str) -> Result<SubscriptionInfo, String> {
    let t = token.trim();
    if t.is_empty() {
        return Err("empty subscription".into());
    }
    // Prefer full JSON from PushSubscription.toJSON()
    if t.starts_with('{') {
        let sub: WebSubscription =
            serde_json::from_str(t).map_err(|e| format!("subscription json: {e}"))?;
        let (p256dh, auth) = if let Some(k) = sub.keys {
            (k.p256dh, k.auth)
        } else {
            (
                sub.p256dh.unwrap_or_default(),
                sub.auth.unwrap_or_default(),
            )
        };
        if sub.endpoint.is_empty() || p256dh.is_empty() || auth.is_empty() {
            return Err("subscription missing endpoint/keys".into());
        }
        return Ok(SubscriptionInfo::new(sub.endpoint, p256dh, auth));
    }
    // Compact: endpoint|p256dh|auth
    let parts: Vec<&str> = t.splitn(3, '|').collect();
    if parts.len() == 3 {
        return Ok(SubscriptionInfo::new(
            parts[0].to_string(),
            parts[1].to_string(),
            parts[2].to_string(),
        ));
    }
    Err("unrecognized web push token shape".into())
}

/// Encode public key for logging / config (strip any padding variants).
pub fn normalize_public_b64(s: &str) -> String {
    let t = s.trim();
    // Accept padded URL-safe
    if let Ok(bytes) = URL_SAFE_NO_PAD.decode(t) {
        return URL_SAFE_NO_PAD.encode(bytes);
    }
    if let Ok(bytes) = URL_SAFE.decode(t) {
        return URL_SAFE_NO_PAD.encode(bytes);
    }
    t.to_string()
}

/// Send one friend-call ring to a stored web PushSubscription JSON.
pub async fn send_friend_ring(
    vapid: &VapidKeys,
    token: &str,
    payload: &serde_json::Value,
) -> Result<(), String> {
    let subscription_info = parse_subscription(token)?;

    let mut sig_builder = VapidSignatureBuilder::from_base64(&vapid.private_b64, &subscription_info)
        .map_err(|e| format!("vapid builder: {e}"))?;
    sig_builder.add_claim("sub", vapid.subject.as_str());
    let signature = sig_builder
        .build()
        .map_err(|e| format!("vapid sign: {e}"))?;

    let body = serde_json::to_vec(payload).map_err(|e| format!("payload encode: {e}"))?;

    let mut builder = WebPushMessageBuilder::new(&subscription_info);
    builder.set_payload(ContentEncoding::Aes128Gcm, &body);
    builder.set_vapid_signature(signature);
    builder.set_urgency(Urgency::High);
    // TTL ~5 min — friend rings are short-lived
    builder.set_ttl(300);

    let message = builder.build().map_err(|e| format!("message build: {e}"))?;
    let client = IsahcWebPushClient::new().map_err(|e| format!("push client: {e}"))?;
    client
        .send(message)
        .await
        .map_err(|e| format!("push send: {e}"))?;
    Ok(())
}
