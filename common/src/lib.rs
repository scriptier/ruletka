//! Shared types and pure matchmaking logic for Freenet Chat Roulette.
//!
//! Offline unit tests cover monoid laws and the partner-selection algorithm.
//! Wire a Freenet WASM contract with the same `LobbyState` (see `contracts/lobby`).

pub mod agent;
pub mod identity;
pub mod lobby;
pub mod match_algo;
pub mod session;
pub mod types;

pub use agent::{Agent, Phase, TickResult};
pub use identity::{verify_offer, Identity, SignatureBytes};
pub use lobby::{
    Claim, LeaveMark, LobbyConfig, LobbyDelta, LobbyState, LobbySummary, WaitingOffer,
};
pub use match_algo::{
    select_partner, session_for_pair, would_select_each_other, MatchEpoch,
};
pub use session::{
    ChatMessage, SessionId, SessionMeta, SessionParams, SessionState, SignalKind, SignalMessage,
};
pub use types::{PeerId, Preferences};
