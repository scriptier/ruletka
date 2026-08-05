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
        /// Cosmetic country/region flag (ISO 3166-1 alpha-2). Not geolocation.
        #[serde(default)]
        flag: String,
        /// Small self-chosen avatar as data URL (jpeg/png/webp). Empty = none.
        #[serde(default)]
        avatar: String,
        /// Soft interest tags (max 3). Prefer shared tags; never hard-filter.
        #[serde(default)]
        tags: Vec<String>,
    },
    /// Update soft match preferences without re-hello.
    SetPrefs {
        #[serde(default)]
        gender: String,
        #[serde(default)]
        looking: String,
        /// Cosmetic flag (ISO 3166-1 alpha-2) or "" to clear. Not geolocation.
        #[serde(default)]
        flag: String,
        /// Small self-chosen avatar data URL, or "" to clear.
        #[serde(default)]
        avatar: String,
        /// Soft interest tags (max 3). Prefer shared tags; never hard-filter.
        #[serde(default)]
        tags: Vec<String>,
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
    /// `join: true` = invite them into your current 1v1 (do not hang up the other person).
    /// `join: false` / omitted = classic private call (ends any current match first).
    CallFriend {
        user_id: String,
        /// Invite into current live 1v1 as a 3rd (mesh). Default false = replace call.
        #[serde(default)]
        join: bool,
    },
    CallRespond {
        user_id: String,
        accept: bool,
    },
    /// Caller cancels while still ringing (before answer).
    CallCancel {
        user_id: String,
    },
    /// End friend call and/or leave party.
    HangupFriend,
    /// While in a friend call: form a party of 2 and join the stranger queue together.
    BrowseTogether {
        #[serde(default)]
        room: String,
    },
    /// While in a stranger 1v1: invite partner to search for a 3rd together (needs accept).
    FindThirdInvite,
    /// Respond to a find-third invite.
    FindThirdRespond {
        accept: bool,
    },
    /// Inviter cancels a pending find-third invite.
    FindThirdCancel,
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
    /// Direct message a mutual friend (works online or offline — stored until they open chat).
    FriendChat {
        to_user_id: String,
        body: String,
    },
    /// Request stored DM history with a friend (last N messages).
    FriendChatHistory {
        with_user_id: String,
    },
    /// After a long enough chat (15 min normal; first 3 unique partners 5 min),
    /// rate partner: gift stars, thanks/vouch, or skip. Same pair can only rate once.
    /// amount: 1–3 when star=true (capped by giver tier: normal 1, 100+ →2, 250+ →3).
    RatePartner {
        user_id: String,
        /// true = give star(s), false = no star (still consumes the one-time review)
        star: bool,
        /// How many stars to gift (1–3). 0 or missing → 1 when star=true.
        #[serde(default)]
        amount: u64,
        /// When star=false: record a thanks/vouch (no trust mint) instead of bare skip.
        #[serde(default)]
        thanks: bool,
    },
    /// Spend reputation stars on a live effect for another user (no money).
    /// effect: "heart"(1★) | "bars"|"flowers"|"balloons"|"confetti"(5★)
    /// | "fireworks"(15★) | "please_stay"(30★, 15s no-Next, once/month per pair).
    /// op_id: optional client idempotency key — same op_id is applied at most once (anti double-spend on retry).
    SpendStars {
        to_user_id: String,
        #[serde(default)]
        effect: String,
        /// Client-generated unique id for this spend attempt (uuid recommended).
        #[serde(default)]
        op_id: String,
    },
    /// Register device push token for offline friend-call rings (FCM/APNs/Expo).
    RegisterPush {
        #[serde(default)]
        token: String,
        /// "ios" | "android" | "expo" | …
        #[serde(default)]
        platform: String,
        /// true = clear stored token for this user
        #[serde(default)]
        clear: bool,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FriendInfo {
    pub user_id: String,
    pub name: String,
    pub friend_code: String,
    pub short_id: String,
    pub online: bool,
    /// Preview of last DM body (empty if none).
    #[serde(default)]
    pub last_msg: String,
    /// Unix seconds of last DM (0 if none).
    #[serde(default)]
    pub last_msg_ts: u64,
    /// Small self-chosen avatar data URL (when known). Empty = none.
    #[serde(default)]
    pub avatar: String,
    /// Public reputation trust (peer rate-gifts only; not spendable balance).
    #[serde(default)]
    pub stars: u64,
    /// Both of you gifted each other post-chat ★ (trust edges both ways).
    #[serde(default)]
    pub mutual_star: bool,
    /// Both of you thanked each other (vouch edges both ways).
    #[serde(default)]
    pub mutual_thanks: bool,
}

/// Privacy-light chip for someone who gifted you post-chat ★ (initial + optional flag).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TrustGiverChip {
    /// 1–2 letter initial (never full user id).
    #[serde(default)]
    pub initial: String,
    /// Cosmetic flag ISO code if known.
    #[serde(default)]
    pub flag: String,
}

/// One line in a friend DM thread (history or live).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FriendChatLine {
    pub id: String,
    pub from_user_id: String,
    pub from_name: String,
    pub body: String,
    pub ts: u64,
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
    /// Self-chosen cosmetic flag (ISO 3166-1 alpha-2). Empty = none. Not real location.
    #[serde(default)]
    pub flag: String,
    /// Small self-chosen avatar data URL. Empty = none.
    #[serde(default)]
    pub avatar: String,
    /// Spendable ★ balance (what the badge number shows).
    #[serde(default)]
    pub stars: u64,
    /// Public reputation trust (peer rate-gifts) — used for tier chrome, not the number.
    #[serde(default)]
    pub trust: u64,
    /// Distinct peers who gifted this user post-chat ★ (public social proof).
    #[serde(default)]
    pub trust_gifters: u32,
    /// Active star-bought effect on this peer ("bars", …). Empty = none.
    #[serde(default)]
    pub effect: String,
    /// Unix seconds when that effect ends (0 = none).
    #[serde(default)]
    pub effect_until: u64,
    /// Intensity of active effect (1–3).
    #[serde(default = "default_effect_level_u32")]
    pub effect_level: u32,
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
        /// Your spendable star balance (gifts / cosmetics).
        #[serde(default)]
        stars: u64,
        /// Your raw trust (peer rate-gifts) — progress toward 100/250.
        #[serde(default)]
        trust: u64,
        /// Effective trust after soft decay + gifter floors (report tier / public badge).
        #[serde(default)]
        trust_effective: u64,
        /// Distinct peers who gifted you post-chat stars.
        #[serde(default)]
        trust_gifters: u32,
        /// Up to 8 privacy-light gifter chips (initials) for social proof strip.
        #[serde(default)]
        trust_givers: Vec<TrustGiverChip>,
        /// Unix seconds of last trust activity (for soft-decay countdown UI). 0 = unknown.
        #[serde(default)]
        trust_last_ts: u64,
        /// Effect currently on *you* ("bars", …). Empty = none.
        #[serde(default)]
        effect: String,
        /// Unix seconds when your effect ends.
        #[serde(default)]
        effect_until: u64,
        /// Intensity of your active effect (1–3).
        #[serde(default = "default_effect_level_u32")]
        effect_level: u32,
        /// Seconds of live chat required before RatePrompt (5m early ramp or 15m).
        #[serde(default = "default_rate_min_secs")]
        rate_min_secs: u64,
        /// How many more unique partners still unlock the shorter first-chat rate window.
        #[serde(default)]
        early_rates_left: u32,
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
        /// Persistent user_id of author when known (helps client thread history).
        #[serde(default)]
        from_user_id: String,
    },
    /// Live friend direct message (also used as echo to sender).
    FriendChat {
        id: String,
        from_user_id: String,
        from_name: String,
        to_user_id: String,
        body: String,
        ts: u64,
    },
    /// Stored friend DM history for one conversation.
    FriendChatHistory {
        with_user_id: String,
        messages: Vec<FriendChatLine>,
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
    /// Ack for register_push
    PushRegistered {
        ok: bool,
        #[serde(default)]
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
        /// True = join their existing call as a 3rd (they will not hang up the other person).
        #[serde(default)]
        join: bool,
        /// The other person already in the call (when join=true).
        #[serde(default)]
        with_user_id: String,
        #[serde(default)]
        with_name: String,
    },
    CallEnded {
        reason: String,
    },
    /// Partner invited you to search for a third person together.
    FindThirdIncoming {
        from_user_id: String,
        from_name: String,
    },
    /// Outcome of a find-third invite (accepted → both enter party browse).
    FindThirdResult {
        ok: bool,
        /// accepted | declined | expired | cancelled | busy | left | error
        reason: String,
    },
    /// Offer a one-time star review after a long enough chat ended.
    RatePrompt {
        user_id: String,
        name: String,
        duration_secs: u64,
        /// Max stars this user may gift (1 normal · 2 if 100+ · 3 if 250+).
        #[serde(default = "default_rate_max_gift")]
        max_gift: u64,
        /// True when this review used the shorter first-chat ramp (not full 15 min).
        #[serde(default)]
        early: bool,
        /// Threshold that was required for this prompt (seconds).
        #[serde(default = "default_rate_min_secs")]
        min_secs: u64,
    },
    /// Result of RatePartner.
    RateResult {
        ok: bool,
        user_id: String,
        /// Whether star(s) were awarded (false if skipped or rejected).
        star: bool,
        /// How many stars were awarded this action (0 if skip).
        #[serde(default)]
        amount: u64,
        /// Target's new spendable balance (or unchanged).
        stars: u64,
        /// Target's new trust score after peer gift (0 if skip / not gift).
        #[serde(default)]
        trust: u64,
        #[serde(default)]
        message: String,
        /// Who initiated the gift/thanks (for reciprocity UI). Empty on errors.
        #[serde(default)]
        from_user_id: String,
        #[serde(default)]
        from_name: String,
    },
    /// Result of SpendStars + broadcast when an effect is applied/extended.
    StarEffect {
        ok: bool,
        /// Who has the visual effect
        user_id: String,
        /// "bars" | "flowers" | …
        effect: String,
        /// Unix seconds when it ends
        until: u64,
        /// Intensity stack 1–3 (respend same kind raises level).
        #[serde(default = "default_effect_level_u32")]
        level: u32,
        /// Stars charged this action (0 if failed)
        cost: u64,
        /// Spender's remaining stars (when they spent); 0 if N/A
        #[serde(default)]
        spender_stars: u64,
        /// Target's public star badge (unchanged by spend; for UI convenience)
        #[serde(default)]
        target_stars: u64,
        #[serde(default)]
        message: String,
        /// Who paid (empty if system clear)
        #[serde(default)]
        from_user_id: String,
        #[serde(default)]
        from_name: String,
    },
    /// Feedback after report_user (weight / progress toward auto-ban).
    ReportResult {
        ok: bool,
        #[serde(default)]
        auto_banned: bool,
        /// Reporter's tier weight (1 / 2 / 3)
        #[serde(default)]
        reporter_weight: u32,
        /// Weight applied after peer dampening (0 if seniors block each other)
        #[serde(default)]
        applied_weight: u32,
        /// Total weighted score on target after this report
        #[serde(default)]
        report_score: u32,
        /// Score needed for auto match-ban
        #[serde(default)]
        threshold: u32,
        #[serde(default)]
        message: String,
    },
}

fn default_mode() -> String {
    "solo".into()
}

fn default_rate_max_gift() -> u64 {
    1
}

/// Default post-chat rate threshold (15 minutes) for older clients / missing fields.
fn default_rate_min_secs() -> u64 {
    15 * 60
}

fn default_effect_level_u32() -> u32 {
    1
}
