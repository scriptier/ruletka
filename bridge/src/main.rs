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
mod simple;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use clap::{Parser, ValueEnum};
use config::{build_public_config, PublicConfig, TurnAuth};
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
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

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
    #[arg(long, default_value = "", env = "ROULETTE_DIRECTORY_HUBS")]
    directory_hubs: String,
    /// Admin API + /admin.html token (empty = admin API disabled).
    #[arg(long, default_value = "", env = "ROULETTE_ADMIN_TOKEN")]
    admin_token: String,
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
    /// Extra hubs listed in the public directory (discovery only).
    directory_hubs: Vec<String>,
    /// Empty disables /v1/admin/*
    admin_token: String,
}

impl AppState {
    fn ice_config(&self) -> PublicConfig {
        build_public_config("simple", &self.stun, &self.turn)
    }
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
    // Fresh TURN credentials when ROULETTE_TURN_SECRET is set
    Json(state.ice_config())
}

async fn health_handler(State(state): State<AppState>) -> impl IntoResponse {
    let hub = state.hub.lock().await;
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
        "federation": {
            "protocol": PROTOCOL,
            "instance_id": state.fed.instance_id,
            "accepts_claims": state.fed.accepts_claims(),
            "peers": state.fed.peers.len(),
            "sessions": hub.fed_session_count(),
            "public_base": state.fed.public_base,
        }
    }))
}

/// Public multi-hub directory (discovery only — not an auto-trust federation join).
async fn directory_handler(State(state): State<AppState>) -> impl IntoResponse {
    let hub = state.hub.lock().await;
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
    for base in state
        .directory_hubs
        .iter()
        .chain(state.fed.peers.iter())
    {
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
    let hub = state.hub.lock().await;
    let path = hub.reports_file_path();
    let reports = read_reports_jsonl(&path, 200);
    let bans = hub.admin_bans();
    let targets = hub.admin_report_targets();
    Json(serde_json::json!({
        "ok": true,
        "reports_path": path.display().to_string(),
        "reports": reports,
        "bans": bans,
        "targets": targets,
        "online": hub.online(),
        "waiting": hub.waiting_count(),
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
async fn federation_worker(state: AppState) {
    if !state.fed.enabled_outbound() {
        tracing::info!("federation outbound disabled (set token, public_base, and peers)");
        return;
    }
    tracing::info!(
        peers = state.fed.peers.len(),
        instance = %state.fed.instance_id,
        "federation outbound worker started"
    );
    let mut tick = tokio::time::interval(Duration::from_secs(2));
    loop {
        tick.tick().await;
        let candidate = {
            let hub = state.hub.lock().await;
            hub.pick_waiting_solo_for_federation()
        };
        let Some((local_id, room, local_peer)) = candidate else {
            continue;
        };

        for peer_base in &state.fed.peers {
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

    let directory_hubs = parse_peer_list(&args.directory_hubs);
    if !directory_hubs.is_empty() {
        tracing::info!(count = directory_hubs.len(), "public directory lists extra hubs");
    }

    let state = AppState {
        hub: Arc::new(Mutex::new(SimpleHub::with_limits_and_store(
            limits,
            friends_path,
        ))),
        public_config,
        stun: args.stun.clone(),
        turn,
        fed: fed.clone(),
        directory_hubs,
        admin_token,
    };

    // Background federation claimer
    {
        let st = state.clone();
        tokio::spawn(async move {
            federation_worker(st).await;
        });
    }

    let ui = if args.ui_dir.is_absolute() {
        args.ui_dir.clone()
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(&args.ui_dir)
    };

    // `/` serves ui/index.html (homepage). Chat lives at /live.html
    // Admin UI: /admin.html  API: /v1/admin/* (ROULETTE_ADMIN_TOKEN)
    let app = Router::new()
        .route("/ws", get(ws_handler))
        .route("/config.json", get(config_handler))
        .route("/health", get(health_handler))
        .route("/v1/directory", get(directory_handler))
        .route("/v1/federation/info", get(federation_info_handler))
        .route("/v1/federation/claim", post(federation_claim_handler))
        .route("/v1/federation/relay", post(federation_relay_handler))
        .route("/v1/admin/reports", get(admin_reports_handler))
        .route("/v1/admin/ban", post(admin_ban_handler))
        .route("/v1/admin/unban", post(admin_unban_handler))
        .route("/v1/seeder/request", post(seeder_request_handler))
        .fallback_service(ServeDir::new(ui).append_index_html_on_directories(true))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr: SocketAddr = args.listen.parse().expect("listen addr");
    print_access_hints(addr, limits.max_clients, &fed);

    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
