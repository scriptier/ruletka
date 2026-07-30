//! Post-match session: chat + WebRTC signaling over Freenet.

use crate::net::{
    drain_session_updates, get_or_put_session, put_session, resolve_session_wasm, update_session,
};
// re-export for bridge convenience
use freenet_roulette_common::{
    Agent, SessionMeta, SessionParams, SessionState, SignalKind,
};
use freenet_stdlib::client_api::WebApi;
use freenet_stdlib::prelude::ContractKey;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

type BoxError = Box<dyn std::error::Error + Send + Sync + 'static>;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn kind_label(k: &SignalKind) -> &'static str {
    match k {
        SignalKind::Offer => "offer",
        SignalKind::Answer => "answer",
        SignalKind::Ice => "ice",
        SignalKind::Bye => "bye",
    }
}

/// Open session, exchange chat, then mock WebRTC SDP/ICE over Freenet.
pub async fn freenet_session_chat_and_signals(
    client: &mut WebApi,
    a: &mut Agent,
    b: &mut Agent,
    session_id: freenet_roulette_common::SessionId,
    session_wasm: PathBuf,
) -> Result<ContractKey, BoxError> {
    let params = SessionParams::new(session_id, a.peer_id(), b.peer_id());
    let meta = SessionMeta {
        session_id,
        peer_a: params.peer_a,
        peer_b: params.peer_b,
        created_ms: now_ms(),
    };
    let mut state = SessionState {
        meta: Some(meta),
        max_messages: 100,
        max_signals: 64,
        messages: vec![],
        signals: vec![],
    };

    println!("\n→ Opening session contract on Freenet…");
    let session_key = put_session(client, &session_wasm, &params, &state).await?;
    println!(
        "  session contract {}",
        session_key.encoded_contract_id()
    );

    a.session = state.clone();
    b.session = state.clone();

    // --- text ---
    let lines_a = ["hello over freenet session 🎲", "signaling next"];
    let lines_b = ["mutual claim → session PUT", "ready for WebRTC control plane"];

    for (i, line) in lines_a.iter().enumerate() {
        a.now_ms = now_ms();
        if let Some(m) = a.send_chat(*line) {
            println!("  A chat → {}", m.body);
            state.push_message(m);
            update_session(client, session_key, &state).await?;
            let _ = drain_session_updates(
                client,
                &session_key,
                &mut state,
                Duration::from_millis(350),
            )
            .await?;
        }
        if let Some(line_b) = lines_b.get(i) {
            b.now_ms = now_ms();
            if let Some(m) = b.send_chat(*line_b) {
                println!("  B chat → {}", m.body);
                state.push_message(m);
                update_session(client, session_key, &state).await?;
                let _ = drain_session_updates(
                    client,
                    &session_key,
                    &mut state,
                    Duration::from_millis(350),
                )
                .await?;
            }
        }
    }

    // --- WebRTC signaling (mock SDP/ICE; real browsers would plug in here) ---
    println!("\n→ WebRTC signaling over Freenet session…");
    let offerer_is_a = a.is_webrtc_offerer();
    let (offerer_name, answerer_name) = if offerer_is_a {
        ("A", "B")
    } else {
        ("B", "A")
    };
    println!(
        "  offerer={} ({})  answerer={}",
        offerer_name,
        if offerer_is_a {
            a.peer_id().short_hex()
        } else {
            b.peer_id().short_hex()
        },
        answerer_name
    );

    // Offer (lex-smaller peer)
    {
        let offerer = if offerer_is_a { &mut *a } else { &mut *b };
        offerer.now_ms = now_ms();
        let offer_payload = format!(
            r#"{{"type":"offer","sdp":"v=0\r\no=- {} 2 IN IP4 127.0.0.1\r\ns=FreenetRoulette\r\n"}}"#,
            now_ms()
        );
        if let Some(sig) = offerer.send_signal(SignalKind::Offer, offer_payload) {
            println!(
                "  {} signal → {} ({} bytes)",
                offerer_name,
                kind_label(&sig.kind),
                sig.payload.len()
            );
            state.push_signal(sig);
            update_session(client, session_key, &state).await?;
            let _ = drain_session_updates(
                client,
                &session_key,
                &mut state,
                Duration::from_millis(400),
            )
            .await?;
        }
    }

    // Answer
    {
        let answerer = if offerer_is_a { &mut *b } else { &mut *a };
        answerer.now_ms = now_ms();
        let answer_payload = format!(
            r#"{{"type":"answer","sdp":"v=0\r\no=- {} 2 IN IP4 127.0.0.1\r\ns=FreenetRoulette\r\n"}}"#,
            now_ms()
        );
        if let Some(sig) = answerer.send_signal(SignalKind::Answer, answer_payload) {
            println!(
                "  {} signal → {} ({} bytes)",
                answerer_name,
                kind_label(&sig.kind),
                sig.payload.len()
            );
            state.push_signal(sig);
            update_session(client, session_key, &state).await?;
            let _ = drain_session_updates(
                client,
                &session_key,
                &mut state,
                Duration::from_millis(400),
            )
            .await?;
        }
    }

    // ICE from both sides
    for (is_a, name, host_octet) in [(true, "A", 1u8), (false, "B", 2u8)] {
        let peer = if is_a { &mut *a } else { &mut *b };
        peer.now_ms = now_ms();
        let ice = format!(
            r#"{{"candidate":"candidate:1 1 UDP 2122252543 10.0.0.{host_octet} 54321 typ host","sdpMid":"0"}}"#
        );
        if let Some(sig) = peer.send_signal(SignalKind::Ice, ice) {
            println!("  {name} signal → ice");
            state.push_signal(sig);
            update_session(client, session_key, &state).await?;
            let _ = drain_session_updates(
                client,
                &session_key,
                &mut state,
                Duration::from_millis(300),
            )
            .await?;
        }
    }

    // Bye from offerer
    {
        let offerer = if offerer_is_a { &mut *a } else { &mut *b };
        offerer.now_ms = now_ms();
        if let Some(sig) = offerer.send_signal(SignalKind::Bye, "{}") {
            println!("  {offerer_name} signal → bye");
            state.push_signal(sig);
            update_session(client, session_key, &state).await?;
        }
    }

    let _ = drain_session_updates(client, &session_key, &mut state, Duration::from_secs(1)).await?;
    a.ingest_session(&state);
    b.ingest_session(&state);

    println!("\n  ── session transcript (Freenet) ──");
    for m in &state.messages {
        println!("  [chat {}] {}", m.author.short_hex(), m.body);
    }
    println!("  ── signals ({}) ──", state.signals.len());
    for s in &state.signals {
        println!(
            "  [sig  {}] {} seq={}",
            s.author.short_hex(),
            kind_label(&s.kind),
            s.seq
        );
    }
    println!(
        "  session {} · {} msgs · {} signals",
        session_key.encoded_contract_id(),
        state.messages.len(),
        state.signals.len()
    );

    Ok(session_key)
}

/// Single peer opens/joins session after match (get-or-put).
pub async fn peer_open_session(
    client: &mut WebApi,
    agent: &mut Agent,
    partner: freenet_roulette_common::PeerId,
    session_id: freenet_roulette_common::SessionId,
    session_wasm: Option<PathBuf>,
) -> Result<ContractKey, BoxError> {
    let wasm = resolve_session_wasm(session_wasm)?;
    let params = SessionParams::new(session_id, agent.peer_id(), partner);
    let meta = SessionMeta {
        session_id,
        peer_a: params.peer_a,
        peer_b: params.peer_b,
        created_ms: now_ms(),
    };
    let initial = SessionState {
        meta: Some(meta),
        max_messages: 100,
        max_signals: 64,
        ..Default::default()
    };
    let (key, mut state) = get_or_put_session(client, &wasm, &params, &initial).await?;
    agent.session = state.clone();
    agent.now_ms = now_ms();
    if let Some(m) = agent.send_chat(format!("peer {} joined session", agent.short_id())) {
        state.push_message(m.clone());
        update_session(client, key, &state).await?;
        println!("  sent: {}", m.body);
    }
    let _ = drain_session_updates(client, &key, &mut state, Duration::from_secs(2)).await?;
    println!(
        "  session {} has {} msg(s)",
        key.encoded_contract_id(),
        state.messages.len()
    );
    Ok(key)
}
