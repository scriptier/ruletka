//! Freenet Chat Roulette agent — match + session chat + WebRTC signaling.

use clap::{Parser, Subcommand};
use freenet_roulette_agent::{
    connect_to_host, drain_lobby_updates, freenet_session_chat_and_signals, get_lobby,
    parse_instance_id, patch_from_delta, peer_open_session, resolve_session_wasm,
    subscribe_lobby, update_lobby_delta,
};
use freenet_roulette_common::{Agent, Phase, Preferences};
use freenet_stdlib::client_api::WebApi;
use freenet_stdlib::prelude::ContractKey;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tracing_subscriber::EnvFilter;

type BoxError = Box<dyn std::error::Error + Send + Sync + 'static>;

#[derive(Parser)]
#[command(
    name = "roulette-agent",
    about = "Match + chat + WebRTC signals on Freenet Chat Roulette"
)]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Two agents: lobby match → session chat → WebRTC signaling on Freenet.
    Dual {
        #[arg(long)]
        lobby_key: Option<String>,
        #[arg(long, default_value = "127.0.0.1:7509")]
        host: String,
        #[arg(long, default_value = "20")]
        max_ticks: u32,
        #[arg(long, default_value = "true")]
        chat: bool,
        #[arg(long)]
        session_wasm: Option<PathBuf>,
    },
    /// Single peer: match, then get-or-put session and announce.
    Peer {
        #[arg(long)]
        lobby_key: Option<String>,
        #[arg(long, default_value = "127.0.0.1:7509")]
        host: String,
        #[arg(long, default_value = "1")]
        seed: u8,
        #[arg(long, default_value = "40")]
        max_ticks: u32,
        #[arg(long)]
        session_wasm: Option<PathBuf>,
        /// Open session contract after match (default true)
        #[arg(long, default_value = "true")]
        session: bool,
    },
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn resolve_lobby_key(explicit: Option<String>) -> Result<String, BoxError> {
    if let Some(k) = explicit {
        return Ok(k);
    }
    let candidates = [
        PathBuf::from("target/publish/lobby-key.txt"),
        PathBuf::from("/home/drakosik/freenet-roulette/target/publish/lobby-key.txt"),
    ];
    for p in candidates {
        if p.exists() {
            return Ok(std::fs::read_to_string(p)?.trim().to_string());
        }
    }
    Err("pass --lobby-key or run scripts/publish-local.sh first".into())
}

async fn push_delta(
    client: &mut WebApi,
    key: ContractKey,
    delta: &freenet_roulette_common::LobbyDelta,
) -> Result<(), BoxError> {
    if delta.is_empty() {
        return Ok(());
    }
    let patch = patch_from_delta(delta);
    update_lobby_delta(client, key, &patch).await
}

async fn run_dual(
    host: String,
    lobby_key: String,
    max_ticks: u32,
    do_chat: bool,
    session_wasm: Option<PathBuf>,
) -> Result<(), BoxError> {
    let session_wasm = if do_chat {
        Some(resolve_session_wasm(session_wasm)?)
    } else {
        None
    };

    let instance = parse_instance_id(&lobby_key)?;
    let mut client = connect_to_host(&host).await?;
    let (key, mut lobby) = get_lobby(&mut client, instance).await?;
    tracing::info!(
        key = %key.encoded_contract_id(),
        offers = lobby.offers.len(),
        "lobby loaded"
    );
    subscribe_lobby(&mut client, &key).await?;
    tracing::info!("subscribed");

    let mut a = Agent::with_seed(
        {
            let mut s = [0u8; 32];
            s[0] = 1;
            s
        },
        Preferences::text_only(),
    );
    let mut b = Agent::with_seed(
        {
            let mut s = [0u8; 32];
            s[0] = 2;
            s
        },
        Preferences::text_only(),
    );

    let t0 = now_ms().max(1);
    println!("A={}  B={}", a.short_id(), b.short_id());
    println!("Spinning both into Freenet lobby…");

    let d_a = a.spin(t0);
    push_delta(&mut client, key, &d_a).await?;
    let d_b = b.spin(t0 + 50);
    push_delta(&mut client, key, &d_b).await?;
    lobby = lobby.apply_delta(&d_a).apply_delta(&d_b);

    for tick in 0..max_ticks {
        let n =
            drain_lobby_updates(&mut client, &key, &mut lobby, Duration::from_millis(300)).await?;
        let t = now_ms().max(t0 + 100 + tick as u64 * 500);

        let tr_a = a.tick(&lobby, t);
        let tr_b = b.tick(&lobby, t);
        for e in tr_a.events.iter().chain(tr_b.events.iter()) {
            println!("  event: {e}");
        }

        push_delta(&mut client, key, &tr_a.lobby_delta).await?;
        if !tr_a.lobby_delta.is_empty() {
            lobby = lobby.apply_delta(&tr_a.lobby_delta);
        }
        push_delta(&mut client, key, &tr_b.lobby_delta).await?;
        if !tr_b.lobby_delta.is_empty() {
            lobby = lobby.apply_delta(&tr_b.lobby_delta);
        }

        let _ =
            drain_lobby_updates(&mut client, &key, &mut lobby, Duration::from_millis(400)).await?;

        let tr_a2 = a.tick(&lobby, t + 10);
        let tr_b2 = b.tick(&lobby, t + 10);
        push_delta(&mut client, key, &tr_a2.lobby_delta).await?;
        if !tr_a2.lobby_delta.is_empty() {
            lobby = lobby.apply_delta(&tr_a2.lobby_delta);
        }
        push_delta(&mut client, key, &tr_b2.lobby_delta).await?;
        if !tr_b2.lobby_delta.is_empty() {
            lobby = lobby.apply_delta(&tr_b2.lobby_delta);
        }

        if n > 0 {
            tracing::debug!(n, tick, offers = lobby.offers.len(), "drained updates");
        }

        match (&a.phase, &b.phase) {
            (
                Phase::Matched {
                    partner: pa,
                    session_id: sa,
                },
                Phase::Matched {
                    partner: pb,
                    session_id: sb,
                },
            ) => {
                let session_id = *sa;
                println!("\n✓ MATCHED on Freenet");
                println!("  A {} ↔ {}", a.short_id(), pa.short_hex());
                println!("  B {} ↔ {}", b.short_id(), pb.short_hex());
                println!("  session {}", hex::encode(sa.0));
                if sa != sb {
                    println!("  (session ids differ — unexpected)");
                }

                if do_chat {
                    if let Some(wasm) = session_wasm {
                        freenet_session_chat_and_signals(
                            &mut client,
                            &mut a,
                            &mut b,
                            session_id,
                            wasm,
                        )
                        .await?;
                    }
                }

                let la = a.next(now_ms());
                let lb = b.next(now_ms());
                push_delta(&mut client, key, &la).await?;
                push_delta(&mut client, key, &lb).await?;
                println!("\nDone. Agents left the lobby.");
                return Ok(());
            }
            _ => {
                print!(
                    "\r  tick {tick}: A={:?} B={:?} offers={}   ",
                    phase_name(&a.phase),
                    phase_name(&b.phase),
                    lobby.offers.len()
                );
                use std::io::Write;
                let _ = std::io::stdout().flush();
            }
        }
    }

    println!("\nNo match within {max_ticks} ticks.");
    Err("timeout waiting for match".into())
}

fn phase_name(p: &Phase) -> &'static str {
    match p {
        Phase::Idle => "idle",
        Phase::Waiting => "waiting",
        Phase::Claiming { .. } => "claiming",
        Phase::Matched { .. } => "matched",
    }
}

async fn run_peer(
    host: String,
    lobby_key: String,
    seed: u8,
    max_ticks: u32,
    session_wasm: Option<PathBuf>,
    open_session: bool,
) -> Result<(), BoxError> {
    let instance = parse_instance_id(&lobby_key)?;
    let mut client = connect_to_host(&host).await?;
    let (key, mut lobby) = get_lobby(&mut client, instance).await?;
    subscribe_lobby(&mut client, &key).await?;

    let mut seed_bytes = [0u8; 32];
    seed_bytes[0] = seed;
    let mut agent = Agent::with_seed(seed_bytes, Preferences::text_only());
    println!("peer {} spinning…", agent.short_id());

    let t0 = now_ms().max(1);
    let d = agent.spin(t0);
    push_delta(&mut client, key, &d).await?;
    lobby = lobby.apply_delta(&d);

    for tick in 0..max_ticks {
        let _ =
            drain_lobby_updates(&mut client, &key, &mut lobby, Duration::from_millis(400)).await?;
        let t = now_ms().max(t0 + tick as u64 * 500);
        let tr = agent.tick(&lobby, t);
        for e in &tr.events {
            println!("  {e}");
        }
        push_delta(&mut client, key, &tr.lobby_delta).await?;
        if !tr.lobby_delta.is_empty() {
            lobby = lobby.apply_delta(&tr.lobby_delta);
        }

        if let Phase::Matched {
            partner,
            session_id,
        } = agent.phase
        {
            println!(
                "✓ matched with {} session {}",
                partner.short_hex(),
                hex::encode(session_id.0)
            );
            if open_session {
                println!("→ opening session (get-or-put)…");
                peer_open_session(
                    &mut client,
                    &mut agent,
                    partner,
                    session_id,
                    session_wasm,
                )
                .await?;
            }
            let leave = agent.next(now_ms());
            push_delta(&mut client, key, &leave).await?;
            return Ok(());
        }
        println!(
            "  tick {tick}: {:?} offers={}",
            phase_name(&agent.phase),
            lobby.offers.len()
        );
    }
    Err("peer: no match".into())
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let cli = Cli::parse();
    let result = match cli.cmd {
        Cmd::Dual {
            lobby_key,
            host,
            max_ticks,
            chat,
            session_wasm,
        } => {
            let key = resolve_lobby_key(lobby_key).unwrap_or_else(|e| {
                eprintln!("{e}");
                std::process::exit(2);
            });
            run_dual(host, key, max_ticks, chat, session_wasm).await
        }
        Cmd::Peer {
            lobby_key,
            host,
            seed,
            max_ticks,
            session_wasm,
            session,
        } => {
            let key = resolve_lobby_key(lobby_key).unwrap_or_else(|e| {
                eprintln!("{e}");
                std::process::exit(2);
            });
            run_peer(host, key, seed, max_ticks, session_wasm, session).await
        }
    };

    if let Err(e) = result {
        eprintln!("error: {e}");
        std::process::exit(1);
    }
}
