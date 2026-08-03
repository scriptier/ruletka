//! Browser bridge for Chat Roulette.
//!
//! Default mode: **simple** — in-memory match queue + WebSocket chat/signal relay.
//! Binds `0.0.0.0:8790` by default so LAN / tunnel clients can connect.
//! ICE (STUN/TURN) is published at `GET /config.json` for the browser UI.
//! Cross-bridge federation: `docs/INTEROP.md` (`nextface-fed/1`).
//!
//! Media is browser WebRTC P2P; the bridge only does match + signaling.

mod config;
mod federation;
mod friends_store;
mod limits;
mod protocol;
mod push_tokens;
mod simple;
mod star_ledger;

use axum::{
    body::Body,
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    http::{header, HeaderMap, HeaderValue, Method, StatusCode, Uri},
    response::{Html, IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use clap::{Parser, ValueEnum};
use config::{build_public_config, AnalyticsPublic, PublicConfig, TurnAuth};
use federation::{
    auth_ok, normalize_base, post_claim, post_relay, ClaimRequest, FedOutbound, FederationConfig,
    FederationInfo, RelayRequest, PROTOCOL,
};
use futures::{SinkExt, StreamExt};
use limits::LimitConfig;
use protocol::{ClientMsg, ServerMsg};
use simple::SimpleHub;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Mutex};
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use tower::ServiceExt;
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

/// Public brand for a request Host (Telegram/Facebook crawlers never run JS).
fn brand_from_host(host: &str) -> &'static str {
    let h = host.split(':').next().unwrap_or(host).to_ascii_lowercase();
    let h = h.strip_prefix("www.").unwrap_or(&h);
    if h == "ruletka.me" || h.ends_with(".ruletka.me") {
        "ruletka.me"
    } else {
        "ruletka.vip"
    }
}

fn is_html_path(path: &str) -> bool {
    let p = path.split('?').next().unwrap_or(path);
    p.ends_with(".html") || p.ends_with(".htm") || p == "/" || p.is_empty()
}

fn is_branded_text_path(path: &str) -> bool {
    let p = path.split('?').next().unwrap_or(path);
    is_html_path(p)
        || p == "/manifest.webmanifest"
        || p.ends_with("/manifest.webmanifest")
        || p == "/robots.txt"
        || p.ends_with("/robots.txt")
        || p == "/sitemap.xml"
        || p.ends_with("/sitemap.xml")
}

/// Rewrite absolute/site brand strings for the active host.
fn brand_html(body: &str, brand: &str) -> String {
    if brand == "ruletka.vip" {
        return body.to_string();
    }
    // Prefer longer tokens first
    body.replace("https://ruletka.vip", "https://ruletka.me")
        .replace("http://ruletka.vip", "https://ruletka.me")
        .replace("ruletka.vip", "ruletka.me")
}

/// Host-aware UI: HTML (+ PWA manifest) get brand rewrites so previews match the URL.
async fn branded_ui(
    State(state): State<AppState>,
    method: Method,
    uri: Uri,
    headers: HeaderMap,
) -> Response {
    if method != Method::GET && method != Method::HEAD {
        return StatusCode::METHOD_NOT_ALLOWED.into_response();
    }
    let host = headers
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let brand = brand_from_host(host);
    let path = uri.path();

    // Build request for ServeDir (path only)
    let req = axum::http::Request::builder()
        .method(Method::GET)
        .uri(uri.clone())
        .body(Body::empty())
        .unwrap_or_else(|_| axum::http::Request::new(Body::empty()));

    if is_branded_text_path(path) {
        // Default brand (ruletka.vip): serve files directly — no full-file rewrite.
        // Cuts TTFB vs reading multi‑100KB HTML into a String on every request.
        if brand == "ruletka.vip" {
            let svc = ServeDir::new(&state.ui_dir).append_index_html_on_directories(true);
            return match svc.oneshot(req).await {
                Ok(mut r) => {
                    r.headers_mut().insert(
                        header::CACHE_CONTROL,
                        HeaderValue::from_static("public, max-age=60"),
                    );
                    r.into_response()
                }
                Err(_) => StatusCode::NOT_FOUND.into_response(),
            };
        }

        // Alternate hosts (.me etc.): rewrite brand strings in HTML/manifest.
        let rel = if path == "/" || path.is_empty() {
            "index.html".to_string()
        } else {
            path.trim_start_matches('/').to_string()
        };
        // Block path traversal
        if rel.contains("..") || rel.starts_with('/') {
            return StatusCode::NOT_FOUND.into_response();
        }
        let full = state.ui_dir.join(&rel);
        let Ok(canon_ui) = tokio::fs::canonicalize(&state.ui_dir).await else {
            return StatusCode::NOT_FOUND.into_response();
        };
        let Ok(canon_file) = tokio::fs::canonicalize(&full).await else {
            // try ServeDir for missing (fallback 404)
            let svc = ServeDir::new(&state.ui_dir).append_index_html_on_directories(true);
            return match svc.oneshot(req).await {
                Ok(r) => r.into_response(),
                Err(_) => StatusCode::NOT_FOUND.into_response(),
            };
        };
        if !canon_file.starts_with(&canon_ui) {
            return StatusCode::NOT_FOUND.into_response();
        }
        match tokio::fs::read(&canon_file).await {
            Ok(bytes) => {
                let raw = String::from_utf8_lossy(&bytes);
                let out = brand_html(&raw, brand);
                let ctype = if rel.ends_with("manifest.webmanifest") {
                    Some("application/manifest+json; charset=utf-8")
                } else if rel.ends_with("robots.txt") {
                    Some("text/plain; charset=utf-8")
                } else if rel.ends_with("sitemap.xml") {
                    Some("application/xml; charset=utf-8")
                } else {
                    None
                };
                let mut res = if let Some(ct) = ctype {
                    (
                        [(header::CONTENT_TYPE, HeaderValue::from_static(ct))],
                        out,
                    )
                        .into_response()
                } else {
                    Html(out).into_response()
                };
                // Short cache so brand/host switches pick up quickly
                res.headers_mut().insert(
                    header::CACHE_CONTROL,
                    HeaderValue::from_static("public, max-age=60"),
                );
                res
            }
            Err(_) => StatusCode::NOT_FOUND.into_response(),
        }
    } else {
        let svc = ServeDir::new(&state.ui_dir).append_index_html_on_directories(true);
        match svc.oneshot(req).await {
            Ok(r) => r.into_response(),
            Err(_) => StatusCode::NOT_FOUND.into_response(),
        }
    }
}

/// iOS Universal Links — `ROULETTE_IOS_TEAM_ID` required for a live applinks entry.
/// Optional static file: `ui/.well-known/apple-app-site-association`.
async fn apple_app_site_association(State(state): State<AppState>) -> Response {
    let team = std::env::var("ROULETTE_IOS_TEAM_ID").unwrap_or_default();
    let team = team.trim().to_string();
    let bundle = std::env::var("ROULETTE_IOS_BUNDLE_ID")
        .unwrap_or_else(|_| "vip.ruletka.app".into());
    let bundle = bundle.trim().to_string();

    let body = if !team.is_empty() {
        let app_id = format!("{team}.{bundle}");
        serde_json::json!({
            "applinks": {
                "apps": [],
                "details": [{
                    "appID": app_id,
                    "paths": [
                        "/live.html",
                        "/live.html*",
                        "/live",
                        "/live*"
                    ]
                }]
            },
            "webcredentials": {
                "apps": [app_id]
            }
        })
        .to_string()
    } else if let Ok(bytes) = tokio::fs::read(
        state
            .ui_dir
            .join(".well-known/apple-app-site-association"),
    )
    .await
    {
        String::from_utf8_lossy(&bytes).into_owned()
    } else {
        // Valid empty document so crawlers get 200 JSON (not 404)
        r#"{"applinks":{"apps":[],"details":[]}}"#.to_string()
    };

    (
        [
            (
                header::CONTENT_TYPE,
                HeaderValue::from_static("application/json"),
            ),
            (
                header::CACHE_CONTROL,
                HeaderValue::from_static("public, max-age=300"),
            ),
        ],
        body,
    )
        .into_response()
}

/// Android App Links — `ROULETTE_ANDROID_SHA256` (colon-hex fingerprint of signing cert).
async fn assetlinks_json(State(state): State<AppState>) -> Response {
    let package = std::env::var("ROULETTE_ANDROID_PACKAGE")
        .unwrap_or_else(|_| "vip.ruletka.app".into());
    let package = package.trim().to_string();
    let sha = std::env::var("ROULETTE_ANDROID_SHA256").unwrap_or_default();
    let sha = sha.trim().to_string();

    let body = if !sha.is_empty() {
        serde_json::json!([{
            "relation": ["delegate_permission/common.handle_all_urls"],
            "target": {
                "namespace": "android_app",
                "package_name": package,
                "sha256_cert_fingerprints": [sha]
            }
        }])
        .to_string()
    } else if let Ok(bytes) =
        tokio::fs::read(state.ui_dir.join(".well-known/assetlinks.json")).await
    {
        String::from_utf8_lossy(&bytes).into_owned()
    } else {
        "[]".to_string()
    };

    (
        [
            (
                header::CONTENT_TYPE,
                HeaderValue::from_static("application/json"),
            ),
            (
                header::CACHE_CONTROL,
                HeaderValue::from_static("public, max-age=300"),
            ),
        ],
        body,
    )
        .into_response()
}

#[derive(Clone, Copy, Debug, ValueEnum, Default)]
enum Mode {
    /// In-memory matchmaking (recommended for product / demos).
    #[default]
    Simple,
    /// Freenet lobby + session contracts (requires --features freenet).
    #[cfg(feature = "freenet")]
    Freenet,
}

#[derive(Parser)]
#[command(
    name = "roulette-bridge",
    about = "Chat Roulette bridge: simple match server (default) or Freenet"
)]
struct Args {
    /// Bind address. Use 0.0.0.0 for LAN/tunnel; 127.0.0.1 for local-only.
    #[arg(long, default_value = "0.0.0.0:8790", env = "ROULETTE_LISTEN")]
    listen: String,
    #[arg(long, value_enum, default_value_t = Mode::Simple)]
    mode: Mode,
    #[arg(long, default_value = "ui")]
    ui_dir: PathBuf,
    /// JSON file for persisted friendships (survives restart).
    #[arg(long, default_value = "data/friends.json", env = "ROULETTE_FRIENDS_FILE")]
    friends_file: PathBuf,
    /// Max concurrent WebSocket clients.
    #[arg(long, default_value_t = 256, env = "ROULETTE_MAX_CLIENTS")]
    max_clients: usize,
    /// Max inbound WS text frame size (bytes).
    #[arg(long, default_value_t = 98304, env = "ROULETTE_MAX_FRAME")]
    max_frame: usize,
    /// Comma-separated STUN URLs for WebRTC ICE.
    #[arg(
        long,
        default_value = "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302",
        env = "ROULETTE_STUN"
    )]
    stun: String,
    /// Comma-separated TURN URLs (e.g. turn:turn.example.com:3478).
    /// Set to `off` to disable TURN. If unset and open-turn is on, uses free Open Relay.
    #[arg(long, env = "ROULETTE_TURN")]
    turn: Option<String>,
    #[arg(long, env = "ROULETTE_TURN_USER")]
    turn_user: Option<String>,
    #[arg(long, env = "ROULETTE_TURN_PASS")]
    turn_pass: Option<String>,
    /// coturn static-auth-secret — issues short-lived TURN credentials in /config.json
    #[arg(long, env = "ROULETTE_TURN_SECRET")]
    turn_secret: Option<String>,
    /// Lifetime of ephemeral TURN credentials (seconds). Default 6 hours.
    #[arg(long, default_value_t = 21600, env = "ROULETTE_TURN_TTL")]
    turn_ttl: u64,
    /// Use free public Open Relay TURN when ROULETTE_TURN is not set (default: true).
    #[arg(long, default_value_t = true, env = "ROULETTE_OPEN_TURN")]
    open_turn: bool,
    /// Stable instance id for federation.
    #[arg(long, env = "ROULETTE_INSTANCE_ID")]
    instance_id: Option<String>,
    /// Shared secret for federation claim/relay (empty = info only).
    #[arg(long, default_value = "", env = "ROULETTE_FEDERATION_TOKEN")]
    federation_token: String,
    /// Comma-separated peer bridge base URLs for outbound claims.
    #[arg(long, default_value = "", env = "ROULETTE_FEDERATION_PEERS")]
    federation_peers: String,
    /// Our public base URL so peers can relay signals back (required for outbound federation).
    #[arg(long, default_value = "", env = "ROULETTE_PUBLIC_BASE")]
    public_base: String,
    /// Comma-separated hub base URLs advertised in GET /v1/directory (client failover hints).
    /// Does not grant federation trust — discovery only.
    /// Merged with data/directory_hubs.json (admin-editable).
    #[arg(long, default_value = "", env = "ROULETTE_DIRECTORY_HUBS")]
    directory_hubs: String,
    /// JSON file for admin-managed public directory hubs (discovery only).
    #[arg(
        long,
        default_value = "data/directory_hubs.json",
        env = "ROULETTE_DIRECTORY_FILE"
    )]
    directory_file: PathBuf,
    /// JSON file for admin-managed federation claim peers (shared stranger pool).
    /// Merged with ROULETTE_FEDERATION_PEERS; live-editable via admin API.
    #[arg(
        long,
        default_value = "data/federation_peers.json",
        env = "ROULETTE_FEDERATION_PEERS_FILE"
    )]
    federation_peers_file: PathBuf,
    /// Yandex Metrica counter id (public). Empty = disabled.
    #[arg(long, default_value = "", env = "ROULETTE_YANDEX_METRICA_ID")]
    yandex_metrica_id: String,
    /// Google Analytics 4 measurement id G-XXXX (public). Empty = disabled.
    #[arg(long, default_value = "", env = "ROULETTE_GA_ID")]
    ga_measurement_id: String,
    /// Admin API + /admin.html token (empty = admin API disabled).
    #[arg(long, default_value = "", env = "ROULETTE_ADMIN_TOKEN")]
    admin_token: String,
    /// Optional HTTPS webhook (Slack/Discord/Telegram) when auto-ban fires.
    #[arg(long, default_value = "", env = "ROULETTE_MOD_WEBHOOK_URL")]
    mod_webhook_url: String,
    /// Freenet WS host (freenet mode only)
    #[arg(long, default_value = "127.0.0.1:7509")]
    freenet: String,
    #[arg(long)]
    lobby_key: Option<String>,
}

#[derive(Clone)]
struct AppState {
    hub: Arc<Mutex<SimpleHub>>,
    /// Static snapshot for health / notes; credentials may be regenerated per request.
    public_config: PublicConfig,
    stun: String,
    turn: TurnAuth,
    fed: FederationConfig,
    /// Extra hubs listed in the public directory (discovery only). Runtime-editable.
    directory_hubs: Arc<Mutex<Vec<String>>>,
    directory_file: PathBuf,
    /// Claim peers for nextface-fed/1 (merged with env). Runtime-editable.
    federation_peers: Arc<Mutex<Vec<String>>>,
    federation_peers_file: PathBuf,
    /// Empty disables /v1/admin/*
    admin_token: String,
    analytics: AnalyticsPublic,
    /// True when ROULETTE_MOD_WEBHOOK_URL is set (never expose the URL).
    mod_webhook_set: bool,
    /// Static UI root (`ui/`). Used for host-aware HTML branding.
    ui_dir: PathBuf,
    /// Coarse global rate limit for POST /v1/funnel: (unix_minute, count).
    funnel_rl: Arc<Mutex<(u64, u32)>>,
}

impl AppState {
    fn ice_config(&self) -> PublicConfig {
        let mut cfg = build_public_config("simple", &self.stun, &self.turn);
        let a = &self.analytics;
        if a.yandex_metrica_id.is_some() || a.ga_measurement_id.is_some() {
            cfg.analytics = Some(a.clone());
        }
        cfg
    }
}

fn load_directory_file(path: &std::path::Path) -> Vec<String> {
    let Ok(text) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else {
        return Vec::new();
    };
    let arr = if let Some(a) = v.as_array() {
        a.clone()
    } else if let Some(a) = v.get("hubs").and_then(|h| h.as_array()) {
        a.clone()
    } else {
        return Vec::new();
    };
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for item in arr {
        let base = item
            .as_str()
            .map(|s| s.to_string())
            .or_else(|| {
                item.get("base")
                    .and_then(|b| b.as_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_default();
        let b = normalize_base(&base);
        if b.starts_with("https://") && seen.insert(b.clone()) {
            out.push(b);
        }
    }
    out
}

fn save_directory_file(path: &std::path::Path, hubs: &[String]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let body = serde_json::json!({
        "protocol": "ruletka-directory/1",
        "updated": chrono_like_now(),
        "hubs": hubs.iter().map(|b| serde_json::json!({"base": b})).collect::<Vec<_>>(),
    });
    std::fs::write(path, serde_json::to_string_pretty(&body).unwrap_or_else(|_| "{}".into()))
        .map_err(|e| e.to_string())
}

/// Load claim-peer bases from JSON (array or `{ "peers": [...] }`). HTTPS only.
fn load_federation_peers_file(path: &std::path::Path) -> Vec<String> {
    let Ok(text) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else {
        return Vec::new();
    };
    let arr = if let Some(a) = v.as_array() {
        a.clone()
    } else if let Some(a) = v.get("peers").and_then(|h| h.as_array()) {
        a.clone()
    } else if let Some(a) = v.get("hubs").and_then(|h| h.as_array()) {
        a.clone()
    } else {
        return Vec::new();
    };
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for item in arr {
        let base = item
            .as_str()
            .map(|s| s.to_string())
            .or_else(|| {
                item.get("base")
                    .and_then(|b| b.as_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_default();
        let b = normalize_base(&base);
        if b.starts_with("https://") && seen.insert(b.clone()) {
            out.push(b);
        }
    }
    out
}

fn save_federation_peers_file(path: &std::path::Path, peers: &[String]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let body = serde_json::json!({
        "protocol": PROTOCOL,
        "updated": chrono_like_now(),
        "peers": peers.iter().map(|b| serde_json::json!({"base": b})).collect::<Vec<_>>(),
    });
    std::fs::write(path, serde_json::to_string_pretty(&body).unwrap_or_else(|_| "{}".into()))
        .map_err(|e| e.to_string())
}

/// Env claim peers + live-editable file peers (deduped, order: env then file).
async fn effective_claim_peers(state: &AppState) -> Vec<String> {
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for b in state.fed.peers.iter() {
        let n = normalize_base(b);
        if !n.is_empty() && seen.insert(n.clone()) {
            out.push(n);
        }
    }
    for b in state.federation_peers.lock().await.iter() {
        let n = normalize_base(b);
        if !n.is_empty() && seen.insert(n.clone()) {
            out.push(n);
        }
    }
    out
}

fn chrono_like_now() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}")
}

fn parse_peer_list(csv: &str) -> Vec<String> {
    csv.split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(normalize_base)
        .collect()
}

async fn flush_fed_outbox(state: &AppState, items: Vec<FedOutbound>) {
    if items.is_empty() {
        return;
    }
    let token = state.fed.token.clone();
    for item in items {
        let token = token.clone();
        tokio::spawn(async move {
            if let Err(e) = post_relay(&item.base_url, &token, &item.request).await {
                tracing::warn!(error = %e, base = %item.base_url, "federation relay failed");
            }
        });
    }
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    {
        let hub = state.hub.lock().await;
        if hub.online() >= hub.max_clients() {
            return (StatusCode::SERVICE_UNAVAILABLE, "server full").into_response();
        }
    }
    ws.on_upgrade(move |socket| client_connection(socket, state))
        .into_response()
}

async fn config_handler(State(state): State<AppState>) -> Json<PublicConfig> {
    // Fresh TURN credentials when ROULETTE_TURN_SECRET is set + optional analytics ids
    Json(state.ice_config())
}

async fn health_handler(State(state): State<AppState>) -> impl IntoResponse {
    let peer_count = effective_claim_peers(&state).await.len();
    let mut hub = state.hub.lock().await;
    let metrics = hub.metrics_snapshot();
    let today = metrics.get("today").cloned().unwrap_or(serde_json::json!({}));
    Json(serde_json::json!({
        "ok": true,
        "service": "roulette-bridge",
        "online": hub.online(),
        "waiting": hub.waiting_count(),
        "waiting_solo": hub.waiting_solo_count(),
        "max_clients": hub.max_clients(),
        "friendships": hub.friendship_count(),
        "blocks": hub.block_edge_count(),
        "has_turn": state.public_config.has_turn,
        "turn_is_open_relay": state.public_config.turn_is_open_relay,
        "mode": state.public_config.mode,
        "mod_webhook": state.mod_webhook_set,
        "metrics_today": today,
        "federation": {
            "protocol": PROTOCOL,
            "instance_id": state.fed.instance_id,
            "accepts_claims": state.fed.accepts_claims(),
            "peers": peer_count,
            "sessions": hub.fed_session_count(),
            "public_base": state.fed.public_base,
        }
    }))
}

/// Public growth funnel beacon (no auth). Rate-limited. Events land in DayMetrics.
#[derive(serde::Deserialize)]
struct FunnelBody {
    #[serde(default)]
    event: String,
}

async fn funnel_handler(
    State(state): State<AppState>,
    Json(body): Json<FunnelBody>,
) -> impl IntoResponse {
    let event = body.event.trim();
    if event.is_empty() || event.len() > 64 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"ok": false, "error": "bad event"})),
        )
            .into_response();
    }
    // ~120 funnel posts per minute globally (small hub; enough for real traffic)
    {
        let minute = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() / 60)
            .unwrap_or(0);
        let mut rl = state.funnel_rl.lock().await;
        if rl.0 != minute {
            *rl = (minute, 0);
        }
        if rl.1 >= 120 {
            return (
                StatusCode::TOO_MANY_REQUESTS,
                Json(serde_json::json!({"ok": false, "error": "rate limit"})),
            )
                .into_response();
        }
        rl.1 = rl.1.saturating_add(1);
    }
    let mut hub = state.hub.lock().await;
    if hub.metrics_inc_funnel(event) {
        (
            StatusCode::OK,
            Json(serde_json::json!({"ok": true})),
        )
            .into_response()
    } else {
        (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"ok": false, "error": "unknown event"})),
        )
            .into_response()
    }
}

async fn admin_metrics_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if !admin_token_ok(&state, &headers) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"ok": false, "error": "unauthorized"})),
        )
            .into_response();
    }
    let mut hub = state.hub.lock().await;
    let snap = hub.metrics_snapshot();
    Json(serde_json::json!({
        "ok": true,
        "online": hub.online(),
        "waiting": hub.waiting_count(),
        "waiting_solo": hub.waiting_solo_count(),
        "friendships": hub.friendship_count(),
        "blocks": hub.block_edge_count(),
        "metrics": snap,
    }))
    .into_response()
}

/// Public multi-hub directory (discovery only — not an auto-trust federation join).
async fn directory_handler(State(state): State<AppState>) -> impl IntoResponse {
    let claim_peers = effective_claim_peers(&state).await;
    let hub = state.hub.lock().await;
    let dir_hubs = state.directory_hubs.lock().await.clone();
    let self_base = if state.fed.public_base.is_empty() {
        String::new()
    } else {
        state.fed.public_base.clone()
    };
    let mut hubs: Vec<serde_json::Value> = Vec::new();
    if !self_base.is_empty() {
        hubs.push(serde_json::json!({
            "base": self_base,
            "name": state.fed.instance_id,
            "instance_id": state.fed.instance_id,
            "online": hub.online(),
            "waiting": hub.waiting_count(),
            "accepts_claims": state.fed.accepts_claims(),
            "self": true,
        }));
    }
    let mut seen = std::collections::HashSet::new();
    if !state.fed.public_base.is_empty() {
        seen.insert(state.fed.public_base.clone());
    }
    for base in dir_hubs.iter().chain(claim_peers.iter()) {
        let b = normalize_base(base);
        if b.is_empty() || !seen.insert(b.clone()) {
            continue;
        }
        hubs.push(serde_json::json!({
            "base": b,
            "name": b,
            "self": false,
        }));
    }
    Json(serde_json::json!({
        "protocol": "ruletka-directory/1",
        "software": "roulette-bridge",
        "instance_id": state.fed.instance_id,
        "public_base": state.fed.public_base,
        "online": hub.online(),
        "waiting": hub.waiting_count(),
        "accepts_claims": state.fed.accepts_claims(),
        "federation_protocol": PROTOCOL,
        "open_source": true,
        "license": "LGPL-2.1-only",
        "repository": "https://github.com/scriptier/ruletka",
        "docs": "https://github.com/scriptier/ruletka/blob/main/docs/DECENTRALIZATION.md",
        "hubs": hubs,
    }))
}

async fn federation_info_handler(State(state): State<AppState>) -> Json<FederationInfo> {
    let hub = state.hub.lock().await;
    Json(hub.federation_info(
        &state.fed.instance_id,
        state.fed.accepts_claims(),
        &state.fed.public_base,
    ))
}

fn bearer<'a>(headers: &'a HeaderMap) -> Option<&'a str> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
}

fn admin_token_ok(state: &AppState, headers: &HeaderMap) -> bool {
    let expected = state.admin_token.trim();
    if expected.is_empty() {
        return false;
    }
    // Authorization: Bearer <token>
    if let Some(auth) = bearer(headers) {
        let t = auth
            .strip_prefix("Bearer ")
            .or_else(|| auth.strip_prefix("bearer "))
            .unwrap_or(auth)
            .trim();
        if t == expected {
            return true;
        }
    }
    // X-Admin-Token: <token>
    if let Some(v) = headers
        .get("x-admin-token")
        .and_then(|h| h.to_str().ok())
        .map(str::trim)
    {
        if v == expected {
            return true;
        }
    }
    false
}

fn read_reports_jsonl(path: &std::path::Path, limit: usize) -> Vec<serde_json::Value> {
    let Ok(text) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let mut lines: Vec<&str> = text.lines().filter(|l| !l.trim().is_empty()).collect();
    if lines.len() > limit {
        lines = lines.split_off(lines.len() - limit);
    }
    lines
        .into_iter()
        .rev() // newest first
        .filter_map(|l| serde_json::from_str(l).ok())
        .collect()
}

fn seeders_path_from_reports(reports_path: &std::path::Path) -> std::path::PathBuf {
    reports_path
        .parent()
        .map(|p| p.join("seeders.jsonl"))
        .unwrap_or_else(|| std::path::PathBuf::from("data/seeders.jsonl"))
}

/// Newest-first unique seeders by public_base (helpers that announced interest).
fn read_seeders_unique(path: &std::path::Path, limit: usize) -> Vec<serde_json::Value> {
    let raw = read_reports_jsonl(path, 500);
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for row in raw {
        let base = row
            .get("public_base")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .trim_end_matches('/')
            .to_string();
        if base.is_empty() || !seen.insert(base.clone()) {
            continue;
        }
        out.push(row);
        if out.len() >= limit {
            break;
        }
    }
    out
}

async fn admin_reports_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if !admin_token_ok(&state, &headers) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"ok": false, "error": "unauthorized"})),
        )
            .into_response();
    }
    let mut hub = state.hub.lock().await;
    let path = hub.reports_file_path();
    let reports = read_reports_jsonl(&path, 200);
    let bans = hub.admin_bans();
    let targets = hub.admin_report_targets();
    let seeders = read_seeders_unique(&seeders_path_from_reports(&path), 40);
    let metrics = hub.metrics_snapshot();
    Json(serde_json::json!({
        "ok": true,
        "reports_path": path.display().to_string(),
        "reports": reports,
        "bans": bans,
        "targets": targets,
        "seeders": seeders,
        "online": hub.online(),
        "waiting": hub.waiting_count(),
        "metrics": metrics,
    }))
    .into_response()
}

/// List helper / seeder announcements; optional live health probe (`?probe=1`).
async fn admin_seeders_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    axum::extract::Query(q): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    if !admin_token_ok(&state, &headers) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"ok": false, "error": "unauthorized"})),
        )
            .into_response();
    }
    let path = {
        let hub = state.hub.lock().await;
        seeders_path_from_reports(&hub.reports_file_path())
    };
    let mut seeders = read_seeders_unique(&path, 40);
    let probe = q
        .get("probe")
        .map(|s| s == "1" || s.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    if probe {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(3))
            .build()
            .ok();
        if let Some(client) = client {
            for row in seeders.iter_mut() {
                let base = row
                    .get("public_base")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .trim()
                    .trim_end_matches('/');
                if base.is_empty() {
                    continue;
                }
                let url = format!("{base}/health");
                match client.get(&url).send().await {
                    Ok(resp) if resp.status().is_success() => {
                        if let Ok(j) = resp.json::<serde_json::Value>().await {
                            row.as_object_mut().map(|o| {
                                o.insert("reachable".into(), serde_json::json!(true));
                                o.insert(
                                    "online".into(),
                                    j.get("online").cloned().unwrap_or(serde_json::json!(0)),
                                );
                                o.insert(
                                    "waiting".into(),
                                    j.get("waiting").cloned().unwrap_or(serde_json::json!(0)),
                                );
                                o.insert(
                                    "instance_live".into(),
                                    j.pointer("/federation/instance_id")
                                        .or_else(|| j.get("service"))
                                        .cloned()
                                        .unwrap_or(serde_json::Value::Null),
                                );
                            });
                        } else {
                            row.as_object_mut()
                                .map(|o| o.insert("reachable".into(), serde_json::json!(true)));
                        }
                    }
                    _ => {
                        row.as_object_mut()
                            .map(|o| o.insert("reachable".into(), serde_json::json!(false)));
                    }
                }
            }
        }
    }
    Json(serde_json::json!({
        "ok": true,
        "seeders_path": path.display().to_string(),
        "seeders": seeders,
        "probed": probe,
        "note": "Seeders are discovery hints only — never auto-trusted for federation",
    }))
    .into_response()
}

#[derive(Debug, serde::Deserialize)]
struct AdminBanBody {
    user_id: String,
    #[serde(default = "default_ban_secs")]
    secs: u64,
}

fn default_ban_secs() -> u64 {
    7 * 24 * 3600
}

#[derive(Debug, serde::Deserialize)]
struct AdminUnbanBody {
    user_id: String,
}

#[derive(Debug, serde::Deserialize)]
struct AdminStarsBody {
    user_id: String,
    amount: u64,
    #[serde(default)]
    reason: String,
}

async fn admin_ban_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<AdminBanBody>,
) -> impl IntoResponse {
    if !admin_token_ok(&state, &headers) {
        return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }
    let mut hub = state.hub.lock().await;
    if hub.admin_ban(&body.user_id, body.secs) {
        (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response()
    } else {
        (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"ok": false, "error": "bad user_id"})),
        )
            .into_response()
    }
}

async fn admin_unban_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<AdminUnbanBody>,
) -> impl IntoResponse {
    if !admin_token_ok(&state, &headers) {
        return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }
    let mut hub = state.hub.lock().await;
    let ok = hub.admin_unban(&body.user_id);
    Json(serde_json::json!({"ok": ok})).into_response()
}

/// Grant stars via append-only ledger (`adjust` / admin:reason). Bypasses daily mint cap.
async fn admin_stars_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<AdminStarsBody>,
) -> impl IntoResponse {
    if !admin_token_ok(&state, &headers) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"ok": false, "error": "unauthorized"})),
        )
            .into_response();
    }
    let mut hub = state.hub.lock().await;
    match hub.admin_grant_stars(&body.user_id, body.amount, &body.reason) {
        Ok(bal) => Json(serde_json::json!({
            "ok": true,
            "user_id": body.user_id.trim(),
            "amount": body.amount,
            "stars": bal,
            "ledger": hub.stars_ledger_snapshot(),
        }))
        .into_response(),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"ok": false, "error": e})),
        )
            .into_response(),
    }
}

/// Federation + public directory status for operators.
async fn admin_mesh_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if !admin_token_ok(&state, &headers) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"ok": false, "error": "unauthorized"})),
        )
            .into_response();
    }
    let claim_peers = effective_claim_peers(&state).await;
    let file_peers = state.federation_peers.lock().await.clone();
    let hub = state.hub.lock().await;
    let dir = state.directory_hubs.lock().await.clone();
    Json(serde_json::json!({
        "ok": true,
        "federation": {
            "protocol": PROTOCOL,
            "instance_id": state.fed.instance_id,
            "public_base": state.fed.public_base,
            "accepts_claims": state.fed.accepts_claims(),
            "token_set": !state.fed.token.is_empty(),
            "peers_env": state.fed.peers,
            "peers_file": file_peers,
            "peers_effective": claim_peers,
            "sessions": hub.fed_session_count(),
            "note": "Claim peers: env peers need restart; file peers (below) are live-editable. Token + public_base still required for outbound claims.",
        },
        "directory_hubs": dir,
        "directory_file": state.directory_file.display().to_string(),
        "federation_peers_file": state.federation_peers_file.display().to_string(),
        "mod_webhook": state.mod_webhook_set,
        "online": hub.online(),
        "waiting": hub.waiting_count(),
    }))
    .into_response()
}

#[derive(Debug, serde::Deserialize)]
struct DirectoryHubBody {
    /// add | remove
    action: String,
    base: String,
}

async fn admin_directory_hubs_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<DirectoryHubBody>,
) -> impl IntoResponse {
    if !admin_token_ok(&state, &headers) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"ok": false, "error": "unauthorized"})),
        )
            .into_response();
    }
    let base = normalize_base(&body.base);
    if !base.starts_with("https://") {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"ok": false, "error": "https base required"})),
        )
            .into_response();
    }
    let mut dir = state.directory_hubs.lock().await;
    let action = body.action.trim().to_lowercase();
    match action.as_str() {
        "add" => {
            if !dir.iter().any(|b| b == &base) {
                dir.push(base.clone());
            }
        }
        "remove" => {
            dir.retain(|b| b != &base);
        }
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"ok": false, "error": "action must be add|remove"})),
            )
                .into_response();
        }
    }
    if let Err(e) = save_directory_file(&state.directory_file, &dir) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"ok": false, "error": e})),
        )
            .into_response();
    }
    Json(serde_json::json!({
        "ok": true,
        "directory_hubs": dir.clone(),
        "action": action,
        "base": base,
    }))
    .into_response()
}

/// Live-edit claim peers for nextface-fed/1 (requires shared token + public_base for claims).
async fn admin_federation_peers_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<DirectoryHubBody>,
) -> impl IntoResponse {
    if !admin_token_ok(&state, &headers) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"ok": false, "error": "unauthorized"})),
        )
            .into_response();
    }
    let base = normalize_base(&body.base);
    if !base.starts_with("https://") {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"ok": false, "error": "https base required"})),
        )
            .into_response();
    }
    // Do not allow listing ourselves as a claim peer
    let self_base = normalize_base(&state.fed.public_base);
    if !self_base.is_empty() && base == self_base {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"ok": false, "error": "cannot add self as claim peer"})),
        )
            .into_response();
    }
    let mut peers = state.federation_peers.lock().await;
    let action = body.action.trim().to_lowercase();
    match action.as_str() {
        "add" => {
            if !peers.iter().any(|b| b == &base) {
                peers.push(base.clone());
            }
        }
        "remove" => {
            peers.retain(|b| b != &base);
        }
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"ok": false, "error": "action must be add|remove"})),
            )
                .into_response();
        }
    }
    if let Err(e) = save_federation_peers_file(&state.federation_peers_file, &peers) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"ok": false, "error": e})),
        )
            .into_response();
    }
    let file_peers = peers.clone();
    drop(peers);
    let effective = effective_claim_peers(&state).await;
    Json(serde_json::json!({
        "ok": true,
        "action": action,
        "base": base,
        "peers_file": file_peers,
        "peers_effective": effective,
        "token_set": !state.fed.token.is_empty(),
        "public_base": state.fed.public_base,
        "outbound_ready": !state.fed.token.is_empty()
            && !state.fed.public_base.is_empty()
            && !effective.is_empty(),
    }))
    .into_response()
}

#[derive(Debug, serde::Deserialize)]
struct SeederRequestBody {
    #[serde(default)]
    public_base: String,
    #[serde(default)]
    instance_id: String,
    #[serde(default)]
    note: String,
}

/// Public (rate-limited lightly): helpers announce interest. Never auto-trusts.
async fn seeder_request_handler(
    State(state): State<AppState>,
    Json(body): Json<SeederRequestBody>,
) -> impl IntoResponse {
    let public_base = body.public_base.trim().chars().take(200).collect::<String>();
    let instance_id = body.instance_id.trim().chars().take(64).collect::<String>();
    let note = body.note.trim().chars().take(64).collect::<String>();
    if public_base.is_empty() || !public_base.starts_with("https://") {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"ok": false, "error": "https public_base required"})),
        )
            .into_response();
    }
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let line = serde_json::json!({
        "t": now_ms,
        "public_base": public_base,
        "instance_id": instance_id,
        "note": note,
    });
    tracing::info!(%line, "seeder request");
    let path = {
        let hub = state.hub.lock().await;
        hub.reports_file_path()
            .parent()
            .map(|p| p.join("seeders.jsonl"))
            .unwrap_or_else(|| std::path::PathBuf::from("data/seeders.jsonl"))
    };
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        use std::io::Write;
        let _ = writeln!(f, "{line}");
    }
    Json(serde_json::json!({
        "ok": true,
        "message": "recorded — operators may contact you; not auto-joined"
    }))
    .into_response()
}

async fn federation_claim_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<ClaimRequest>,
) -> impl IntoResponse {
    if !auth_ok(&state.fed, bearer(&headers)) {
        return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }
    let mut hub = state.hub.lock().await;
    match hub.federation_claim(req) {
        Ok(resp) => {
            let out = hub.drain_fed_outbox();
            drop(hub);
            flush_fed_outbox(&state, out).await;
            (StatusCode::OK, Json(resp)).into_response()
        }
        Err((code, msg)) => (
            StatusCode::from_u16(code).unwrap_or(StatusCode::BAD_REQUEST),
            msg,
        )
            .into_response(),
    }
}

async fn federation_relay_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<RelayRequest>,
) -> impl IntoResponse {
    if !auth_ok(&state.fed, bearer(&headers)) {
        return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }
    let mut hub = state.hub.lock().await;
    match hub.federation_relay_inbound(req) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err((code, msg)) => (
            StatusCode::from_u16(code).unwrap_or(StatusCode::BAD_REQUEST),
            msg,
        )
            .into_response(),
    }
}

async fn client_connection(socket: WebSocket, state: AppState) {
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<ServerMsg>();
    let client_id = Uuid::new_v4();

    let max_frame = {
        let hub = state.hub.lock().await;
        hub.max_frame_bytes()
    };

    let hello = {
        let mut hub = state.hub.lock().await;
        match hub.try_add_client(client_id, tx.clone()) {
            Ok(h) => h,
            Err(msg) => {
                let _ = tx.send(ServerMsg::Error { message: msg });
                if let Some(err) = rx.recv().await {
                    if let Ok(json) = serde_json::to_string(&err) {
                        let _ = sink.send(Message::Text(json)).await;
                    }
                }
                return;
            }
        }
    };
    let _ = tx.send(hello);
    {
        let mut hub = state.hub.lock().await;
        hub.notify_join();
    }
    tracing::info!(%client_id, "browser connected");

    let writer = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let Ok(json) = serde_json::to_string(&msg) else { break };
            if sink.send(Message::Text(json)).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(msg)) = stream.next().await {
        let text = match msg {
            Message::Text(t) => t,
            Message::Close(_) => break,
            Message::Ping(_) | Message::Pong(_) => continue,
            Message::Binary(_) => {
                let _ = tx.send(ServerMsg::Error {
                    message: "binary frames not allowed".into(),
                });
                continue;
            }
        };
        if text.len() > max_frame {
            let _ = tx.send(ServerMsg::Error {
                message: "frame too large".into(),
            });
            continue;
        }
        let parsed: ClientMsg = match serde_json::from_str(&text) {
            Ok(m) => m,
            Err(e) => {
                let _ = tx.send(ServerMsg::Error {
                    message: format!("bad json: {e}"),
                });
                continue;
            }
        };
        let outbox = {
            let mut hub = state.hub.lock().await;
            hub.handle(client_id, parsed);
            hub.drain_fed_outbox()
        };
        flush_fed_outbox(&state, outbox).await;
    }

    {
        let mut hub = state.hub.lock().await;
        hub.remove_client(client_id);
        tracing::info!(%client_id, "browser disconnected");
    }
    writer.abort();
}

/// Periodically claim partners from peer hubs for local solo waiters.
/// Peers are re-read each tick so admin file edits apply without restart.
async fn federation_worker(state: AppState) {
    if state.fed.token.is_empty() || state.fed.public_base.is_empty() {
        tracing::info!(
            "federation outbound disabled (set ROULETTE_FEDERATION_TOKEN + ROULETTE_PUBLIC_BASE; claim peers via env or admin)"
        );
        return;
    }
    tracing::info!(
        env_peers = state.fed.peers.len(),
        instance = %state.fed.instance_id,
        "federation outbound worker started (claim peers live-editable)"
    );
    let mut tick = tokio::time::interval(Duration::from_secs(2));
    loop {
        tick.tick().await;
        let peers = effective_claim_peers(&state).await;
        if peers.is_empty() {
            continue;
        }
        let candidate = {
            let hub = state.hub.lock().await;
            hub.pick_waiting_solo_for_federation()
        };
        let Some((local_id, room, local_peer)) = candidate else {
            continue;
        };

        for peer_base in &peers {
            let req = ClaimRequest {
                room: room.clone(),
                caller_instance_id: state.fed.instance_id.clone(),
                caller_base_url: state.fed.public_base.clone(),
                remote_peer: local_peer.clone(),
            };
            match post_claim(peer_base, &state.fed.token, &req).await {
                Ok(resp) => {
                    let remote_label = resp.claimed_peer.short_id.clone();
                    let mut hub = state.hub.lock().await;
                    match hub.federation_apply_claim(
                        local_id,
                        peer_base,
                        &remote_label,
                        resp,
                    ) {
                        Ok(()) => {
                            tracing::info!(%local_id, peer = %peer_base, "claimed remote peer");
                            let out = hub.drain_fed_outbox();
                            drop(hub);
                            flush_fed_outbox(&state, out).await;
                            break;
                        }
                        Err(e) => {
                            tracing::warn!(error = %e, "apply claim failed");
                        }
                    }
                }
                Err(e) if e == "no_peer" => continue,
                Err(e) => {
                    tracing::debug!(error = %e, peer = %peer_base, "claim attempt failed");
                }
            }
        }
    }
}

fn print_access_hints(addr: SocketAddr, max_clients: usize, fed: &FederationConfig) {
    println!("Bridge listening on http://{addr}/");
    println!("  home:   http://127.0.0.1:{}/  → Start chatting → /live.html", addr.port());
    println!("  live:   http://127.0.0.1:{}/live.html", addr.port());
    if addr.ip().is_unspecified() {
        if let Ok(ifaces) = std::process::Command::new("hostname").arg("-I").output() {
            if ifaces.status.success() {
                let ips = String::from_utf8_lossy(&ifaces.stdout);
                for ip in ips.split_whitespace() {
                    if ip.contains('.') && !ip.starts_with("127.") {
                        println!("  LAN:    http://{ip}:{}/", addr.port());
                    }
                }
            }
        }
        println!("  remote: use ./scripts/run-tunnel.sh (HTTPS tunnel) so friends can join");
        println!("  note:   browsers block cam/mic on plain http://LAN — use localhost or HTTPS");
    }
    println!("  config: http://127.0.0.1:{}/config.json", addr.port());
    println!("  health: http://127.0.0.1:{}/health", addr.port());
    println!(
        "  fed:    http://127.0.0.1:{}/v1/federation/info  ({PROTOCOL})",
        addr.port()
    );
    println!(
        "  fed id: {}  claims={}  peers={}",
        fed.instance_id,
        fed.accepts_claims(),
        fed.peers.len()
    );
    if fed.enabled_outbound() {
        println!("  fed →  outbound claims to {} peer(s)", fed.peers.len());
    }
    println!("  limits: max_clients={max_clients}");
    println!("  Connect → Preview → Next (on each client)");
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let args = Args::parse();

    match args.mode {
        Mode::Simple => {
            println!("Mode: simple (in-memory match + WebSocket signaling)");
            println!("No Freenet node required.");
        }
        #[cfg(feature = "freenet")]
        Mode::Freenet => {
            eprintln!(
                "Freenet mode: use the previous freenet-enabled build or re-enable freenet hub."
            );
            eprintln!("For now, run with --mode simple (default).");
            std::process::exit(2);
        }
    }

    let (turn_urls, turn_user, turn_pass, turn_is_open) = config::resolve_turn(
        args.turn.as_deref(),
        args.turn_user.as_deref(),
        args.turn_pass.as_deref(),
        args.open_turn,
    );
    let turn = TurnAuth {
        urls: turn_urls,
        static_user: turn_user,
        static_pass: turn_pass,
        secret: args
            .turn_secret
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        ttl_secs: args.turn_ttl.max(60),
        is_open_relay: turn_is_open,
    };
    // Open Relay uses fixed public creds — never mix with secret HMAC
    let turn = if turn.is_open_relay {
        TurnAuth {
            secret: None,
            ..turn
        }
    } else {
        turn
    };
    let public_config = build_public_config("simple", &args.stun, &turn);
    println!(
        "ICE: {} server group(s), TURN={}{}",
        public_config.ice_servers.len(),
        public_config.has_turn,
        if public_config.turn_is_open_relay {
            " (open-relay demo)"
        } else if public_config.turn_ephemeral {
            " (ephemeral credentials)"
        } else {
            ""
        }
    );
    for n in &public_config.notes {
        println!("  · {n}");
    }

    let limits = LimitConfig {
        max_clients: args.max_clients.max(2),
        max_frame_bytes: args.max_frame.max(4096),
        ..LimitConfig::default()
    };

    let friends_path = if args.friends_file.is_absolute() {
        args.friends_file.clone()
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(&args.friends_file)
    };
    println!("Friends file: {}", friends_path.display());

    let instance_id = args
        .instance_id
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| format!("hub-{}", &Uuid::new_v4().to_string()[..8]));

    let fed = FederationConfig {
        instance_id,
        token: args.federation_token.trim().to_string(),
        peers: parse_peer_list(&args.federation_peers),
        public_base: normalize_base(&args.public_base),
    };

    let admin_token = args.admin_token.trim().to_string();
    if admin_token.is_empty() {
        tracing::info!("admin API disabled (set ROULETTE_ADMIN_TOKEN to enable /v1/admin/*)");
    } else {
        tracing::info!("admin API enabled at /v1/admin/reports (token required)");
    }

    let dir_file = if args.directory_file.is_absolute() {
        args.directory_file.clone()
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(&args.directory_file)
    };
    let mut directory_hubs = parse_peer_list(&args.directory_hubs);
    for b in load_directory_file(&dir_file) {
        if !directory_hubs.iter().any(|x| x == &b) {
            directory_hubs.push(b);
        }
    }
    if !directory_hubs.is_empty() {
        tracing::info!(
            count = directory_hubs.len(),
            path = %dir_file.display(),
            "public directory lists extra hubs"
        );
    }

    let fed_peers_file = if args.federation_peers_file.is_absolute() {
        args.federation_peers_file.clone()
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(&args.federation_peers_file)
    };
    let federation_peers = load_federation_peers_file(&fed_peers_file);
    if !federation_peers.is_empty() {
        tracing::info!(
            count = federation_peers.len(),
            path = %fed_peers_file.display(),
            "federation claim peers loaded from file"
        );
    }

    let yandex = args.yandex_metrica_id.trim().to_string();
    let ga = args.ga_measurement_id.trim().to_string();
    let analytics = AnalyticsPublic {
        yandex_metrica_id: if yandex.is_empty() {
            None
        } else {
            Some(yandex)
        },
        ga_measurement_id: if ga.is_empty() { None } else { Some(ga) },
    };
    if analytics.yandex_metrica_id.is_some() || analytics.ga_measurement_id.is_some() {
        tracing::info!("analytics ids published via /config.json (no secrets)");
    }

    let mod_hook = args.mod_webhook_url.trim().to_string();
    let mod_webhook_set = !mod_hook.is_empty();
    if mod_webhook_set {
        tracing::info!("mod auto-ban webhook configured (URL not logged)");
    }
    let push_hook = std::env::var("ROULETTE_PUSH_WEBHOOK_URL")
        .unwrap_or_default()
        .trim()
        .to_string();
    if !push_hook.is_empty() {
        tracing::info!("push webhook configured for offline friend rings (URL not logged)");
    }
    let state = AppState {
        hub: Arc::new(Mutex::new(SimpleHub::with_limits_store_webhook(
            limits,
            friends_path,
            if mod_hook.is_empty() {
                None
            } else {
                Some(mod_hook)
            },
            if push_hook.is_empty() {
                None
            } else {
                Some(push_hook)
            },
        ))),
        public_config,
        stun: args.stun.clone(),
        turn,
        fed: fed.clone(),
        directory_hubs: Arc::new(Mutex::new(directory_hubs)),
        directory_file: dir_file,
        federation_peers: Arc::new(Mutex::new(federation_peers)),
        federation_peers_file: fed_peers_file,
        admin_token,
        analytics,
        mod_webhook_set,
        funnel_rl: Arc::new(Mutex::new((0u64, 0u32))),
        ui_dir: {
            if args.ui_dir.is_absolute() {
                args.ui_dir.clone()
            } else {
                std::env::current_dir()
                    .unwrap_or_else(|_| PathBuf::from("."))
                    .join(&args.ui_dir)
            }
        },
    };

    // Background federation claimer
    {
        let st = state.clone();
        tokio::spawn(async move {
            federation_worker(st).await;
        });
    }

    let ui = state.ui_dir.clone();
    tracing::info!(ui = %ui.display(), "serving UI (host-aware HTML branding for .me / .vip)");

    // `/` serves ui/index.html (homepage). Chat lives at /live.html
    // Admin UI: /admin.html  API: /v1/admin/* (ROULETTE_ADMIN_TOKEN)
    // HTML is brand-rewritten from Host so Telegram/Facebook previews match the URL.
    let app = Router::new()
        .route("/ws", get(ws_handler))
        .route("/config.json", get(config_handler))
        .route("/health", get(health_handler))
        .route("/v1/directory", get(directory_handler))
        .route("/v1/federation/info", get(federation_info_handler))
        .route("/v1/federation/claim", post(federation_claim_handler))
        .route("/v1/federation/relay", post(federation_relay_handler))
        .route("/v1/admin/reports", get(admin_reports_handler))
        .route("/v1/admin/metrics", get(admin_metrics_handler))
        .route("/v1/admin/seeders", get(admin_seeders_handler))
        .route("/v1/admin/mesh", get(admin_mesh_handler))
        .route("/v1/admin/directory_hubs", post(admin_directory_hubs_handler))
        .route(
            "/v1/admin/federation_peers",
            post(admin_federation_peers_handler),
        )
        .route("/v1/admin/ban", post(admin_ban_handler))
        .route("/v1/admin/unban", post(admin_unban_handler))
        .route("/v1/admin/stars", post(admin_stars_handler))
        .route("/v1/seeder/request", post(seeder_request_handler))
        .route("/v1/funnel", post(funnel_handler))
        // Mobile Universal Links / App Links (JSON content-type, no HTML branding)
        .route(
            "/.well-known/apple-app-site-association",
            get(apple_app_site_association),
        )
        .route(
            "/apple-app-site-association",
            get(apple_app_site_association),
        )
        .route("/.well-known/assetlinks.json", get(assetlinks_json))
        .fallback(branded_ui)
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr: SocketAddr = args.listen.parse().expect("listen addr");
    print_access_hints(addr, limits.max_clients, &fed);

    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
