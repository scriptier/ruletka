//! Thin WebApi helpers (pattern from freenet-ping).

use freenet_roulette_common::{LobbyState, SessionParams, SessionState};
use freenet_stdlib::client_api::{
    ClientRequest, ContractRequest, ContractResponse, HostResponse, WebApi,
};
use freenet_stdlib::prelude::{
    ContractCode, ContractContainer, ContractInstanceId, ContractKey, ContractWasmAPIVersion,
    Parameters, RelatedContracts, StateDelta, StateSummary, UpdateData, WrappedContract,
    WrappedState,
};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::time::timeout;
use tokio_tungstenite::tungstenite::protocol::WebSocketConfig;

type BoxError = Box<dyn std::error::Error + Send + Sync + 'static>;

fn ws_config() -> WebSocketConfig {
    WebSocketConfig::default()
        .max_message_size(Some(100 * 1024 * 1024))
        .max_frame_size(Some(16 * 1024 * 1024))
}

pub async fn connect_to_host(host: &str) -> Result<WebApi, BoxError> {
    let uri = format!("ws://{host}/v1/contract/command?encodingProtocol=native");
    tracing::info!(%uri, "connecting");
    let (stream, _resp) =
        tokio_tungstenite::connect_async_with_config(uri.as_str(), Some(ws_config()), false)
            .await?;
    Ok(WebApi::start(stream))
}

enum RecvOutcome {
    Message(HostResponse),
    HostError(freenet_stdlib::client_api::ClientError),
    PerRecvTimeout,
    DeadlineElapsed { skipped: u32 },
}

async fn recv_with_deadline(client: &mut WebApi, deadline: Instant, skipped: u32) -> RecvOutcome {
    let remaining = deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
        return RecvOutcome::DeadlineElapsed { skipped };
    }
    let recv_timeout = remaining.min(Duration::from_secs(5));
    match timeout(recv_timeout, client.recv()).await {
        Ok(Ok(msg)) => RecvOutcome::Message(msg),
        Ok(Err(err)) => RecvOutcome::HostError(err),
        Err(_) => RecvOutcome::PerRecvTimeout,
    }
}

pub fn encode_lobby(state: &LobbyState) -> Result<Vec<u8>, BoxError> {
    let mut buf = Vec::new();
    ciborium::ser::into_writer(state, &mut buf)?;
    Ok(buf)
}

pub fn decode_lobby(bytes: &[u8]) -> Result<LobbyState, BoxError> {
    if bytes.is_empty() {
        return Ok(LobbyState::default());
    }
    Ok(ciborium::de::from_reader(bytes)?)
}

pub fn parse_instance_id(s: &str) -> Result<ContractInstanceId, BoxError> {
    Ok(ContractInstanceId::from_base58(s.trim())?)
}

/// Extract CBOR payload from update notification data.
pub fn update_bytes(update: &UpdateData<'_>) -> Option<Vec<u8>> {
    match update {
        UpdateData::State(s) => Some(s.as_ref().to_vec()),
        UpdateData::Delta(d) => Some(d.as_ref().to_vec()),
        UpdateData::StateAndDelta { state, .. } => Some(state.as_ref().to_vec()),
        _ => None,
    }
}

pub async fn get_lobby(
    client: &mut WebApi,
    instance: ContractInstanceId,
) -> Result<(ContractKey, LobbyState), BoxError> {
    client
        .send(ClientRequest::ContractOp(ContractRequest::Get {
            key: instance,
            return_contract_code: true,
            subscribe: false,
            blocking_subscribe: false,
        }))
        .await?;

    let deadline = Instant::now() + Duration::from_secs(20);
    let mut skipped = 0u32;
    loop {
        match recv_with_deadline(client, deadline, skipped).await {
            RecvOutcome::Message(HostResponse::ContractResponse(
                ContractResponse::GetResponse { key, state, .. },
            )) => {
                if key.id() != &instance {
                    return Err(format!(
                        "unexpected key: got {} want {}",
                        key.encoded_contract_id(),
                        instance.encode()
                    )
                    .into());
                }
                let lobby = decode_lobby(state.as_ref())?;
                return Ok((key, lobby));
            }
            RecvOutcome::Message(HostResponse::ContractResponse(
                ContractResponse::NotFound { instance_id },
            )) => {
                return Err(format!("lobby not found: {}", instance_id.encode()).into());
            }
            RecvOutcome::Message(HostResponse::ContractResponse(
                ContractResponse::UpdateNotification { .. },
            )) => {
                skipped += 1;
            }
            RecvOutcome::Message(other) => {
                tracing::debug!("skip while GET: {other}");
                skipped += 1;
            }
            RecvOutcome::HostError(err) => {
                let msg = format!("{err}");
                if msg.to_lowercase().contains("subscription") {
                    skipped += 1;
                    continue;
                }
                return Err(err.into());
            }
            RecvOutcome::PerRecvTimeout => continue,
            RecvOutcome::DeadlineElapsed { skipped } => {
                return Err(format!("timeout GET lobby (skipped {skipped})").into());
            }
        }
    }
}

pub async fn subscribe_lobby(client: &mut WebApi, key: &ContractKey) -> Result<(), BoxError> {
    client
        .send(ClientRequest::ContractOp(ContractRequest::Subscribe {
            key: *key.id(),
            summary: None::<StateSummary>,
        }))
        .await?;

    let deadline = Instant::now() + Duration::from_secs(15);
    let mut skipped = 0u32;
    loop {
        match recv_with_deadline(client, deadline, skipped).await {
            RecvOutcome::Message(HostResponse::ContractResponse(
                ContractResponse::SubscribeResponse {
                    key: k,
                    subscribed,
                    ..
                },
            )) => {
                if k.id() != key.id() {
                    return Err("subscribe: unexpected key".into());
                }
                if !subscribed {
                    return Err("subscribe rejected".into());
                }
                return Ok(());
            }
            RecvOutcome::Message(other) => {
                tracing::debug!("skip while SUB: {other}");
                skipped += 1;
            }
            RecvOutcome::HostError(err) => return Err(err.into()),
            RecvOutcome::PerRecvTimeout => continue,
            RecvOutcome::DeadlineElapsed { skipped } => {
                return Err(format!("timeout SUB (skipped {skipped})").into());
            }
        }
    }
}

pub async fn update_lobby_delta(
    client: &mut WebApi,
    key: ContractKey,
    patch: &LobbyState,
) -> Result<(), BoxError> {
    let bytes = encode_lobby(patch)?;
    client
        .send(ClientRequest::ContractOp(ContractRequest::Update {
            key,
            data: UpdateData::Delta(StateDelta::from(bytes)),
        }))
        .await?;

    // Best-effort: wait briefly for UpdateResponse; notifications may race.
    let deadline = Instant::now() + Duration::from_secs(30);
    let mut skipped = 0u32;
    loop {
        match recv_with_deadline(client, deadline, skipped).await {
            RecvOutcome::Message(HostResponse::ContractResponse(
                ContractResponse::UpdateResponse { key: k, .. },
            )) => {
                if k.id() == key.id() {
                    return Ok(());
                }
                skipped += 1;
            }
            RecvOutcome::Message(HostResponse::ContractResponse(
                ContractResponse::UpdateNotification { key: k, update },
            )) => {
                // Our own update may arrive as notification — accept if key matches.
                if k.id() == key.id() {
                    let _ = update;
                    return Ok(());
                }
                skipped += 1;
            }
            RecvOutcome::Message(_) => skipped += 1,
            RecvOutcome::HostError(err) => {
                tracing::warn!(%err, "update wait error");
                return Err(err.into());
            }
            RecvOutcome::PerRecvTimeout => continue,
            RecvOutcome::DeadlineElapsed { .. } => {
                tracing::warn!("no update ack (continuing)");
                return Ok(());
            }
        }
    }
}

/// Drain pending messages for a short window, merging lobby notifications.
pub async fn drain_lobby_updates(
    client: &mut WebApi,
    key: &ContractKey,
    lobby: &mut LobbyState,
    window: Duration,
) -> Result<u32, BoxError> {
    let deadline = Instant::now() + window;
    let mut n = 0u32;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            break;
        }
        match timeout(remaining.min(Duration::from_millis(200)), client.recv()).await {
            Ok(Ok(HostResponse::ContractResponse(ContractResponse::UpdateNotification {
                key: k,
                update,
            }))) if k.id() == key.id() => {
                if let Some(bytes) = update_bytes(&update) {
                    let incoming = decode_lobby(&bytes)?;
                    *lobby = lobby.merge(&incoming).cleanup();
                    n += 1;
                }
            }
            Ok(Ok(HostResponse::ContractResponse(ContractResponse::GetResponse {
                key: k,
                state,
                ..
            }))) if k.id() == key.id() => {
                let incoming = decode_lobby(state.as_ref())?;
                *lobby = lobby.merge(&incoming).cleanup();
                n += 1;
            }
            Ok(Ok(_)) => {}
            Ok(Err(e)) => return Err(e.into()),
            Err(_) => break, // timeout slice
        }
    }
    Ok(n)
}

pub fn patch_from_delta(delta: &freenet_roulette_common::LobbyDelta) -> LobbyState {
    let mut patch = LobbyState::default();
    for o in &delta.offers {
        patch.upsert_offer(o.clone());
    }
    for c in &delta.claims {
        patch.insert_claim(c.clone());
    }
    for l in &delta.leaves {
        patch.upsert_leave(l.clone());
    }
    patch
}

// --- Session contract ---

pub fn encode_session(state: &SessionState) -> Result<Vec<u8>, BoxError> {
    let mut buf = Vec::new();
    ciborium::ser::into_writer(state, &mut buf)?;
    Ok(buf)
}

pub fn decode_session(bytes: &[u8]) -> Result<SessionState, BoxError> {
    if bytes.is_empty() {
        return Ok(SessionState {
            max_messages: 100,
            max_signals: 64,
            ..Default::default()
        });
    }
    Ok(ciborium::de::from_reader(bytes)?)
}

pub fn default_session_wasm_path() -> PathBuf {
    PathBuf::from("target/wasm32-unknown-unknown/release/freenet_roulette_session.wasm")
}

pub fn resolve_session_wasm(explicit: Option<PathBuf>) -> Result<PathBuf, BoxError> {
    if let Some(p) = explicit {
        if p.exists() {
            return Ok(p);
        }
        return Err(format!("session wasm not found: {}", p.display()).into());
    }
    let candidates = [
        default_session_wasm_path(),
        PathBuf::from("/home/drakosik/freenet-roulette")
            .join(default_session_wasm_path()),
    ];
    for p in candidates {
        if p.exists() {
            return Ok(p);
        }
    }
    Err(
        "session WASM missing — run ./scripts/build-wasm.sh (freenet_roulette_session.wasm)".into(),
    )
}

fn session_container(wasm: &[u8], params: &SessionParams) -> Result<ContractContainer, BoxError> {
    let param_bytes = params.to_cbor().map_err(|e| -> BoxError { e.into() })?;
    let code = Arc::new(ContractCode::from(wasm.to_vec()));
    Ok(ContractContainer::Wasm(ContractWasmAPIVersion::V1(
        WrappedContract::new(code, Parameters::from(param_bytes)),
    )))
}

/// PUT a new session contract instance. Returns its key.
pub async fn put_session(
    client: &mut WebApi,
    wasm_path: &Path,
    params: &SessionParams,
    initial: &SessionState,
) -> Result<ContractKey, BoxError> {
    let wasm = std::fs::read(wasm_path)?;
    let container = session_container(&wasm, params)?;
    let key = container.key();
    let state_bytes = encode_session(initial)?;

    client
        .send(ClientRequest::ContractOp(ContractRequest::Put {
            contract: container,
            state: WrappedState::new(state_bytes),
            related_contracts: RelatedContracts::new(),
            subscribe: true,
            blocking_subscribe: false,
        }))
        .await?;

    wait_session_put_ack(client, &key).await
}

/// GET session by derived key (from wasm+params). Falls back to PUT if missing.
pub async fn get_or_put_session(
    client: &mut WebApi,
    wasm_path: &Path,
    params: &SessionParams,
    initial: &SessionState,
) -> Result<(ContractKey, SessionState), BoxError> {
    let wasm = std::fs::read(wasm_path)?;
    let container = session_container(&wasm, params)?;
    let key = container.key();
    let instance = *key.id();

    client
        .send(ClientRequest::ContractOp(ContractRequest::Get {
            key: instance,
            return_contract_code: false,
            subscribe: true,
            blocking_subscribe: false,
        }))
        .await?;

    let deadline = Instant::now() + Duration::from_secs(30);
    let mut skipped = 0u32;
    loop {
        match recv_with_deadline(client, deadline, skipped).await {
            RecvOutcome::Message(HostResponse::ContractResponse(
                ContractResponse::GetResponse { key: k, state, .. },
            )) if k.id() == &instance => {
                let st = decode_session(state.as_ref())?;
                return Ok((k, st));
            }
            RecvOutcome::Message(HostResponse::ContractResponse(
                ContractResponse::NotFound { .. },
            )) => {
                break; // put below
            }
            RecvOutcome::Message(HostResponse::ContractResponse(
                ContractResponse::SubscribeResponse { key: k, .. },
            )) if k.id() == &instance => {
                skipped += 1;
            }
            RecvOutcome::Message(_) => skipped += 1,
            RecvOutcome::HostError(err) => {
                let msg = format!("{err}");
                if msg.to_lowercase().contains("not found") || msg.contains("NotFound") {
                    break;
                }
                // try put on soft failures
                tracing::warn!(%err, "session GET error — will PUT");
                break;
            }
            RecvOutcome::PerRecvTimeout => continue,
            RecvOutcome::DeadlineElapsed { .. } => break,
        }
    }

    let k = put_session(client, wasm_path, params, initial).await?;
    Ok((k, initial.clone()))
}

async fn wait_session_put_ack(
    client: &mut WebApi,
    key: &ContractKey,
) -> Result<ContractKey, BoxError> {
    let deadline = Instant::now() + Duration::from_secs(120);
    let mut skipped = 0u32;
    loop {
        match recv_with_deadline(client, deadline, skipped).await {
            RecvOutcome::Message(HostResponse::ContractResponse(
                ContractResponse::PutResponse { key: k },
            )) => {
                if k.id() == key.id() {
                    return Ok(k);
                }
                skipped += 1;
            }
            RecvOutcome::Message(HostResponse::ContractResponse(
                ContractResponse::UpdateResponse { key: k, .. },
            )) => {
                if k.id() == key.id() {
                    return Ok(k);
                }
                skipped += 1;
            }
            RecvOutcome::Message(HostResponse::ContractResponse(
                ContractResponse::UpdateNotification { key: k, .. },
            )) => {
                if k.id() == key.id() {
                    return Ok(k);
                }
                skipped += 1;
            }
            RecvOutcome::Message(HostResponse::ContractResponse(
                ContractResponse::SubscribeResponse { .. },
            )) => {
                skipped += 1;
            }
            RecvOutcome::Message(other) => {
                tracing::debug!("skip while session PUT: {other}");
                skipped += 1;
            }
            RecvOutcome::HostError(err) => return Err(err.into()),
            RecvOutcome::PerRecvTimeout => continue,
            RecvOutcome::DeadlineElapsed { skipped } => {
                tracing::warn!(skipped, "session PUT ack timeout — using derived key");
                return Ok(*key);
            }
        }
    }
}

pub async fn update_session(
    client: &mut WebApi,
    key: ContractKey,
    state: &SessionState,
) -> Result<(), BoxError> {
    let bytes = encode_session(state)?;
    client
        .send(ClientRequest::ContractOp(ContractRequest::Update {
            key,
            data: UpdateData::Delta(StateDelta::from(bytes)),
        }))
        .await?;

    let deadline = Instant::now() + Duration::from_secs(30);
    let mut skipped = 0u32;
    loop {
        match recv_with_deadline(client, deadline, skipped).await {
            RecvOutcome::Message(HostResponse::ContractResponse(
                ContractResponse::UpdateResponse { key: k, .. },
            )) if k.id() == key.id() => return Ok(()),
            RecvOutcome::Message(HostResponse::ContractResponse(
                ContractResponse::UpdateNotification { key: k, .. },
            )) if k.id() == key.id() => return Ok(()),
            RecvOutcome::Message(_) => skipped += 1,
            RecvOutcome::HostError(err) => {
                tracing::warn!(%err, "session update wait");
                return Err(err.into());
            }
            RecvOutcome::PerRecvTimeout => continue,
            RecvOutcome::DeadlineElapsed { .. } => {
                tracing::warn!("session update no ack");
                return Ok(());
            }
        }
    }
}

pub async fn drain_session_updates(
    client: &mut WebApi,
    key: &ContractKey,
    session: &mut SessionState,
    window: Duration,
) -> Result<u32, BoxError> {
    let deadline = Instant::now() + window;
    let mut n = 0u32;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            break;
        }
        match timeout(remaining.min(Duration::from_millis(200)), client.recv()).await {
            Ok(Ok(HostResponse::ContractResponse(ContractResponse::UpdateNotification {
                key: k,
                update,
            }))) if k.id() == key.id() => {
                if let Some(bytes) = update_bytes(&update) {
                    let incoming = decode_session(&bytes)?;
                    *session = session.merge(&incoming);
                    n += 1;
                }
            }
            Ok(Ok(HostResponse::ContractResponse(ContractResponse::GetResponse {
                key: k,
                state,
                ..
            }))) if k.id() == key.id() => {
                let incoming = decode_session(state.as_ref())?;
                *session = session.merge(&incoming);
                n += 1;
            }
            Ok(Ok(_)) => {}
            Ok(Err(e)) => return Err(e.into()),
            Err(_) => break,
        }
    }
    Ok(n)
}


