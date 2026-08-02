/**
 * Subset of bridge wire types for Phase 0–1.
 * Full enum lives in bridge/src/protocol.rs — keep field names in sync.
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

export type ClientMsg =
  | ClientHello
  | ClientSpin
  | ClientNext
  | ClientStop
  | ClientSignal
  | ClientPing
  | { type: string; [k: string]: unknown };

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

export type ServerError = { type: "error"; message: string };

export type ServerMsg =
  | ServerHelloOk
  | ServerStatus
  | ServerMatched
  | ServerSignal
  | ServerError
  | { type: string; [k: string]: unknown };

export type IceConfig = {
  ice_servers?: RTCIceServer[];
  has_turn?: boolean;
  notes?: string[];
};

// Minimal DOM-like type for RN WebRTC config JSON
export type RTCIceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};
