//! Dev helpers for publishing Freenet Roulette contracts.

use clap::{Parser, Subcommand};
use freenet_roulette_common::{LobbyState, SessionState};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "roulette-tools", about = "Freenet Chat Roulette helpers")]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Write empty lobby state as CBOR (for fdev publish --state)
    EmptyLobby {
        #[arg(short, long, default_value = "lobby-state.cbor")]
        out: PathBuf,
    },
    /// Write empty session state as CBOR
    EmptySession {
        #[arg(short, long, default_value = "session-state.cbor")]
        out: PathBuf,
    },
    /// Print lobby state hex (debug)
    DumpLobbyHex {
        #[arg(short, long)]
        file: PathBuf,
    },
}

fn write_cbor<T: serde::Serialize>(path: &PathBuf, value: &T) -> Result<(), String> {
    let mut buf = Vec::new();
    ciborium::ser::into_writer(value, &mut buf).map_err(|e| e.to_string())?;
    std::fs::write(path, &buf).map_err(|e| e.to_string())?;
    println!("wrote {} ({} bytes)", path.display(), buf.len());
    println!("hex: {}", hex::encode(&buf));
    Ok(())
}

fn main() {
    let cli = Cli::parse();
    let result = match cli.cmd {
        Cmd::EmptyLobby { out } => write_cbor(&out, &LobbyState::default()),
        Cmd::EmptySession { out } => {
            let mut s = SessionState::default();
            s.max_messages = 100;
            s.max_signals = 64;
            write_cbor(&out, &s)
        }
        Cmd::DumpLobbyHex { file } => {
            let bytes = std::fs::read(&file).expect("read");
            println!("{}", hex::encode(bytes));
            Ok(())
        }
    };
    if let Err(e) = result {
        eprintln!("error: {e}");
        std::process::exit(1);
    }
}
