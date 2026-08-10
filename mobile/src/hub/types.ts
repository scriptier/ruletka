/**
 * Subset of bridge wire types for Phase 0–2.
 * Full enum: bridge/src/protocol.rs
 */

export type ClientHello = {
  type: "hello";
  user_id: string;
  name: string;
  gender?: string;
  looking?: string;
  flag?: string;
  avatar?: string;
  tags?: string[];
  /** "android" | "ios" | "web" — hub prefers web as WebRTC offerer */
  platform?: string;
  hide_ip?: boolean;
};

export type ClientSetPrefs = {
  type: "set_prefs";
  gender?: string;
  looking?: string;
  flag?: string;
  avatar?: string;
  tags?: string[];
  hide_ip?: boolean;
};
export type ClientSpin = { type: "spin"; room?: string };
export type ClientNext = { type: "next"; room?: string };
export type ClientStop = { type: "stop" };
export type ClientSignal = {
  type: "signal";
  kind: string;
  payload: string;
  to?: string;
};
export type ClientPing = { type: "ping" };
export type ClientBlock = { type: "block_user"; user_id: string };
export type ClientUnblock = { type: "unblock_user"; user_id: string };
export type ClientReport = {
  type: "report_user";
  user_id: string;
  reason?: string;
  /** Optional JPEG evidence (base64, no data: prefix). Server caps size. */
  screenshot_jpeg_b64?: string;
};
export type ClientChat = { type: "chat"; body: string };
export type ClientAddFriend = { type: "add_friend"; code: string };
export type ClientAcceptFriend = { type: "accept_friend"; user_id: string };
export type ClientDeclineFriend = { type: "decline_friend"; user_id: string };
export type ClientRemoveFriend = { type: "remove_friend"; user_id: string };
export type ClientCallFriend = {
  type: "call_friend";
  user_id: string;
  /** Invite into current 1v1 as a 3rd (mesh). Default false = private replace. */
  join?: boolean;
};
export type ClientBrowseTogether = { type: "browse_together"; room?: string };
export type ClientFindThirdInvite = { type: "find_third_invite" };
export type ClientFindThirdRespond = {
  type: "find_third_respond";
  accept: boolean;
};
export type ClientFindThirdCancel = { type: "find_third_cancel" };
export type ClientFriendChat = {
  type: "friend_chat";
  to_user_id: string;
  body: string;
};
export type ClientFriendChatHistory = {
  type: "friend_chat_history";
  with_user_id: string;
};
export type ClientCallRespond = {
  type: "call_respond";
  user_id: string;
  accept: boolean;
};
export type ClientCallCancel = { type: "call_cancel"; user_id: string };
export type ClientHangupFriend = { type: "hangup_friend" };
export type ClientRatePartner = {
  type: "rate_partner";
  user_id: string;
  star: boolean;
  amount?: number;
  /** When star=false: thanks/vouch (no trust mint) vs bare skip. */
  thanks?: boolean;
};
export type ClientSpendStars = {
  type: "spend_stars";
  to_user_id: string;
  effect: string;
  op_id?: string;
};
export type ClientRegisterPush = {
  type: "register_push";
  token: string;
  platform?: string;
  clear?: boolean;
};

export type ClientMsg =
  | ClientHello
  | ClientSetPrefs
  | ClientSpin
  | ClientNext
  | ClientStop
  | ClientSignal
  | ClientPing
  | ClientBlock
  | ClientUnblock
  | ClientReport
  | ClientChat
  | ClientAddFriend
  | ClientAcceptFriend
  | ClientDeclineFriend
  | ClientRemoveFriend
  | ClientCallFriend
  | ClientBrowseTogether
  | ClientFindThirdInvite
  | ClientFindThirdRespond
  | ClientFindThirdCancel
  | ClientFriendChat
  | ClientFriendChatHistory
  | ClientCallRespond
  | ClientCallCancel
  | ClientHangupFriend
  | ClientRatePartner
  | ClientSpendStars
  | ClientRegisterPush
  | { type: string; [k: string]: unknown };

export type FriendChatLine = {
  id: string;
  from_user_id: string;
  from_name: string;
  body: string;
  ts: number;
};

export type FriendInfo = {
  user_id: string;
  name: string;
  friend_code: string;
  short_id: string;
  online: boolean;
  last_msg?: string;
  last_msg_ts?: number;
  avatar?: string;
  stars?: number;
};

export type ServerHelloOk = {
  type: "hello_ok";
  client_id: string;
  short_id: string;
  peer_id: string;
  user_id: string;
  friend_code: string;
  name: string;
  media?: string;
  signaling?: string;
  stars?: number;
  trust?: number;
  trust_effective?: number;
  trust_gifters?: number;
  rate_min_secs?: number;
  early_rates_left?: number;
  /** Your approximate country (from connect IP) — self UI. */
  country?: string;
  city?: string;
  flag?: string;
  hide_ip?: boolean;
};

/** Hub finished IP→geo for you (self tile). */
export type ServerGeo = {
  type: "geo";
  country?: string;
  city?: string;
  flag?: string;
};

/** Partner geo arrived after match (async lookup race). */
export type ServerPartnerGeo = {
  type: "partner_geo";
  peer_id: string;
  user_id?: string;
  country?: string;
  city?: string;
  flag?: string;
  hide_ip?: boolean;
};

export type ServerStatus = {
  type: "status";
  phase: string;
  offers?: number;
  detail?: string;
  waiting_peers?: number;
  online?: number;
  room?: string;
};

/** Broadcast when anyone joins/leaves the queue — keep Android pool ticker in sync. */
export type ServerLobbyInfo = {
  type: "lobby_info";
  waiting_peers?: number;
  online?: number;
  offers?: number;
  room?: string;
  room_waiting?: number;
};

export type MatchPeer = {
  peer_id: string;
  user_id?: string;
  short_id?: string;
  name?: string;
  is_offerer?: boolean;
  /** Stable friend code — for Add friend during/after match */
  friend_code?: string;
  /** "friend" | "stranger" | "party" | "teammate" | … */
  role?: string;
  flag?: string;
  country?: string;
  city?: string;
  hide_ip?: boolean;
  avatar?: string;
  /** Spendable ★ balance shown on partner badge. */
  stars?: number;
  /** Public reputation trust (peer rate-gifts). */
  trust?: number;
  trust_gifters?: number;
  effect?: string;
  effect_until?: number;
  effect_level?: number;
};

export type ServerMatched = {
  type: "matched";
  partner_short: string;
  session_id: string;
  session_key?: string;
  is_offerer: boolean;
  room?: string;
  mode?: string;
  your_role?: string;
  peers?: MatchPeer[];
  /** Hub: use TURN relay-only (same IP hairpin / cross-country / hide-ip). */
  force_relay?: boolean;
};

export type ServerSignal = {
  type: "signal";
  author?: string;
  kind: string;
  payload: string;
  from_peer?: string;
};

export type ServerFriends = {
  type: "friends";
  friends: FriendInfo[];
  friend_code: string;
  blocked?: string[];
  incoming_requests?: FriendInfo[];
  outgoing_requests?: FriendInfo[];
};

export type ServerFriendRequest = {
  type: "friend_request";
  from_user_id: string;
  from_name: string;
  from_code: string;
};

export type ServerCallIncoming = {
  type: "call_incoming";
  from_user_id: string;
  from_name: string;
  from_short: string;
  from_peer: string;
  from_code?: string;
  /** Invite to join their existing call as a 3rd. */
  join?: boolean;
  with_user_id?: string;
  with_name?: string;
};

export type ServerFindThirdIncoming = {
  type: "find_third_incoming";
  from_user_id: string;
  from_name: string;
};

export type ServerFindThirdResult = {
  type: "find_third_result";
  ok: boolean;
  reason: string;
};

export type ServerCallEnded = {
  type: "call_ended";
  reason: string;
};

export type ServerChat = {
  type: "chat";
  author?: string;
  body?: string;
  from_user_id?: string;
};

export type ServerFriendChat = {
  type: "friend_chat";
  id: string;
  from_user_id: string;
  from_name: string;
  to_user_id: string;
  body: string;
  ts: number;
};

export type ServerFriendChatHistory = {
  type: "friend_chat_history";
  with_user_id: string;
  messages: FriendChatLine[];
};

export type ServerError = { type: "error"; message: string };

export type ServerRatePrompt = {
  type: "rate_prompt";
  user_id: string;
  name: string;
  duration_secs: number;
  max_gift?: number;
  early?: boolean;
  min_secs?: number;
};

export type ServerRateResult = {
  type: "rate_result";
  ok: boolean;
  user_id: string;
  star: boolean;
  amount?: number;
  stars: number;
  trust?: number;
  message?: string;
};

export type ServerStarEffect = {
  type: "star_effect";
  ok: boolean;
  user_id: string;
  effect: string;
  until: number;
  level?: number;
  cost: number;
  spender_stars?: number;
  target_stars?: number;
  message?: string;
  from_user_id?: string;
  from_name?: string;
};

export type ServerMsg =
  | ServerHelloOk
  | ServerStatus
  | ServerLobbyInfo
  | ServerMatched
  | ServerSignal
  | ServerFriends
  | ServerFriendRequest
  | ServerCallIncoming
  | ServerCallEnded
  | ServerFindThirdIncoming
  | ServerFindThirdResult
  | ServerChat
  | ServerFriendChat
  | ServerFriendChatHistory
  | ServerRatePrompt
  | ServerRateResult
  | ServerStarEffect
  | ServerGeo
  | ServerPartnerGeo
  | ServerError
  | { type: string; [k: string]: unknown };

export type IceConfig = {
  ice_servers?: RTCIceServer[];
  has_turn?: boolean;
  notes?: string[];
};

export type RTCIceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};
