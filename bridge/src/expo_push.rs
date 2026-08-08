//! Expo Push API for offline friend-call rings (Android/iOS via expo-notifications).
//!
//! POST https://exp.host/--/api/v2/push/send
//! Token shape: `ExponentPushToken[…]` or `ExpoPushToken[…]`.

use serde_json::json;

/// True if this looks like an Expo push token (not FCM raw / web JSON).
pub fn is_expo_token(token: &str) -> bool {
    let t = token.trim();
    t.starts_with("ExponentPushToken[")
        || t.starts_with("ExpoPushToken[")
        || (t.starts_with("ExponentPushToken") && t.contains('['))
}

/// Send one friend-call ring via Expo's HTTP API.
pub async fn send_friend_ring(token: &str, payload: &serde_json::Value) -> Result<(), String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("empty expo token".into());
    }
    if !is_expo_token(token) {
        return Err("not an Expo push token".into());
    }

    let title = payload
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Incoming call");
    let body = payload
        .get("body")
        .and_then(|v| v.as_str())
        .or_else(|| payload.get("text").and_then(|v| v.as_str()))
        .unwrap_or("A friend is calling — open ruletka to answer");

    // Expo accepts a single message object or an array
    let msg = json!({
        "to": token,
        "title": title.chars().take(80).collect::<String>(),
        "body": body.chars().take(180).collect::<String>(),
        "sound": "default",
        "priority": "high",
        "channelId": "friend-calls",
        "data": {
            "type": payload.get("type").and_then(|v| v.as_str()).unwrap_or("friend_call_ring"),
            "from_user_id": payload.get("from_user_id").cloned().unwrap_or(json!("")),
            "from_name": payload.get("from_name").cloned().unwrap_or(json!("")),
            "url": payload.get("url").and_then(|v| v.as_str()).unwrap_or("/live"),
        },
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("http client: {e}"))?;

    let resp = client
        .post("https://exp.host/--/api/v2/push/send")
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .header("Accept-Encoding", "gzip, deflate")
        .json(&msg)
        .send()
        .await
        .map_err(|e| format!("expo post: {e}"))?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!(
            "expo HTTP {status}: {}",
            text.chars().take(200).collect::<String>()
        ));
    }
    // Expo returns 200 with errors in body sometimes
    if text.contains("\"status\":\"error\"") || text.contains("\"errors\"") {
        // Still log as soft fail if DeviceNotRegistered etc.
        if text.contains("DeviceNotRegistered") {
            return Err("expo DeviceNotRegistered".into());
        }
        tracing::warn!(
            body = %text.chars().take(240).collect::<String>(),
            "expo push response may include errors"
        );
    }
    Ok(())
}
