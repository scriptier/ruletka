//! Shared JSON WebSocket protocol (browser ↔ bridge).

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMsg {
    /// Identify with a persistent user_id (localStorage) + display name.
    Hello {
        #[serde(default)]
        user_id: String,
        #[serde(default)]
        name: String,
        /// Soft match: "man" | "woman" | "other" | "" (unset)
        #[serde(default)]
        gender: String,
        /// Soft match: "any" | "man" | "woman" | "" (any)
        #[serde(default)]
        looking: String,
    },
    /// Update soft match preferences without re-hello.
    SetPrefs {
        #[serde(default)]
        gender: String,
        #[serde(default)]
        looking: String,
    },
    Spin {
        #[serde(default)]
        room: String,
    },
    Next {
        #[serde(default)]
        room: String,
    },
    /// Leave queue / end stranger match and return to idle (do not auto-search).
    Stop,
    SetRoom {
        #[serde(default)]
        room: String,
    },
    Chat { body: String },
    /// WebRTC signal. `to` = remote peer_id (required for multi-party).
    Signal {
        kind: String,
        payload: String,
        #[serde(default)]
        to: String,
    },
    Ping,
    /// Request friend by their friend_code (must connect once for lookup). Mutual accept required.
    AddFriend {
        code: String,
    },
    /// Accept an incoming friend request.
    AcceptFriend {
        user_id: String,
    },
    /// Decline / cancel a friend request (incoming or outgoing).
    DeclineFriend {
        user_id: String,
    },
    RemoveFriend {
        user_id: String,
    },
    /// Ring a friend who is online.
    CallFriend {
        user_id: String,
    },
    CallRespond {
        user_id: String,
        accept: bool,
    },
    /// End friend call and/or leave party.
    HangupFriend,
    /// While in a friend call: form a party of 2 and join the stranger queue together.
    BrowseTogether {
        #[serde(default)]
        room: String,
    },
    /// Block a user (stranger or friend). Removes friendship both ways; skips future matches.
    BlockUser {
        user_id: String,
    },
    UnblockUser {
        user_id: String,
    },
    /// Report a user (logged server-side; reporter usually also blocks client-side).
    ReportUser {
        user_id: String,
        #[serde(default)]
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FriendInfo {
    pub user_id: String,
    pub name: String,
    pub friend_code: String,
    pub short_id: String,
    pub online: bool,
}

/// One remote peer you should open WebRTC toward.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchPeer {
    pub peer_id: String,
    pub short_id: String,
    pub user_id: String,
    pub name: String,
    /// Whether *you* create the offer to this peer.
    pub is_offerer: bool,
    /// "friend" | "stranger" | "party"
    pub role: String,
    /// Stable friend code (for history / add-friend from match).
    #[serde(default)]
    pub friend_code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMsg {
    HelloOk {
        client_id: String,
        short_id: String,
        peer_id: String,
        user_id: String,
        friend_code: String,
        name: String,
        media: String,
        signaling: String,
    },
    Status {
        phase: String,
        offers: usize,
        detail: String,
        waiting_peers: usize,
        online: usize,
        #[serde(default)]
        room: String,
    },
    /// 1:1 or multi-peer match. `peers` lists everyone you should connect to.
    Matched {
        partner_short: String,
        session_id: String,
        session_key: String,
        is_offerer: bool,
        #[serde(default)]
        room: String,
        /// "solo" | "friend" | "party_browse"
        #[serde(default = "default_mode")]
        mode: String,
        /// Your role: "solo" | "party" | "friend"
        #[serde(default)]
        your_role: String,
        #[serde(default)]
        peers: Vec<MatchPeer>,
    },
    Chat {
        author: String,
        body: String,
    },
    Signal {
        author: String,
        kind: String,
        payload: String,
        /// Sender's peer_id (for multi-peer demux).
        #[serde(default)]
        from_peer: String,
    },
    Error {
        message: String,
    },
    Pong,
    LobbyInfo {
        waiting_peers: usize,
        online: usize,
        offers: usize,
        #[serde(default)]
        room: String,
        #[serde(default)]
        room_waiting: usize,
    },
    Friends {
        friends: Vec<FriendInfo>,
        friend_code: String,
        /// user_ids this client has blocked
        #[serde(default)]
        blocked: Vec<String>,
        /// Incoming friend requests (others asked you)
        #[serde(default)]
        incoming_requests: Vec<FriendInfo>,
        /// Outgoing friend requests (you asked, waiting)
        #[serde(default)]
        outgoing_requests: Vec<FriendInfo>,
    },
    /// Someone sent you a friend request (toast-friendly).
    FriendRequest {
        from_user_id: String,
        from_name: String,
        from_code: String,
    },
    CallIncoming {
        from_user_id: String,
        from_name: String,
        from_short: String,
        from_peer: String,
        /// Caller friend code (for local history / re-add).
        #[serde(default)]
        from_code: String,
    },
    CallEnded {
        reason: String,
    },
}

fn default_mode() -> String {
    "solo".into()
}
