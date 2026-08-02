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
};

export type ClientSetPrefs = {
  type: "set_prefs";
  gender?: string;
  looking?: string;
  flag?: string;
  avatar?: string;
  tags?: string[];
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
export type ClientReport = {
  type: "report_user";
  user_id: string;
  reason?: string;
};
export type ClientChat = { type: "chat"; body: string };
export type ClientAddFriend = { type: "add_friend"; code: string };
export type ClientAcceptFriend = { type: "accept_friend"; user_id: string };
export type ClientDeclineFriend = { type: "decline_friend"; user_id: string };
export type ClientRemoveFriend = { type: "remove_friend"; user_id: string };
export type ClientCallFriend = { type: "call_friend"; user_id: string };
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
  | ClientReport
  | ClientChat
  | ClientAddFriend
  | ClientAcceptFriend
  | ClientDeclineFriend
  | ClientRemoveFriend
  | ClientCallFriend
  | ClientCallRespond
  | ClientCallCancel
  | ClientHangupFriend
  | ClientRatePartner
  | ClientSpendStars
  | ClientRegisterPush
  | { type: string; [k: string]: unknown };

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

export type MatchPeer = {
  peer_id: string;
  user_id?: string;
  short_id?: string;
  name?: string;
  is_offerer?: boolean;
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
  | ServerMatched
  | ServerSignal
  | ServerFriends
  | ServerFriendRequest
  | ServerCallIncoming
  | ServerCallEnded
  | ServerChat
  | ServerRatePrompt
  | ServerRateResult
  | ServerStarEffect
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
