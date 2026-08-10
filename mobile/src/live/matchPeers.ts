/**
 * Normalize hub matched payload → primary / extra peer picks for Live UI.
 */
import type { MatchPeer, ServerMatched } from "../hub/types";

export type PeerPick = {
  peerId: string;
  userId: string;
  isOfferer: boolean;
  name: string;
  mode: string;
  friendCode: string;
  stars: number;
  trust: number;
  role: string;
  flag: string;
  country: string;
  city: string;
  /** Partner chose hide-IP privacy (partners only see cosmetic flag). */
  hideIp: boolean;
};

export function normalizePeer(p: MatchPeer, msg: ServerMatched): PeerPick {
  return {
    peerId: String(p.peer_id || "legacy"),
    userId: String(p.user_id || ""),
    // Top-level Matched.is_offerer = "I am offerer" (authoritative).
    // peers[].is_offerer currently mirrors the same flag from hub match_peer.
    isOfferer: !!msg.is_offerer,
    name: String(p.name || p.short_id || msg.partner_short || "?"),
    mode: String(msg.mode || "solo"),
    friendCode: String(p.friend_code || "").trim().toUpperCase(),
    stars: Math.max(0, Math.floor(Number(p.stars) || 0)),
    trust: Math.max(0, Math.floor(Number(p.trust) || 0)),
    role: String(p.role || "stranger"),
    flag: String(p.flag || "").toUpperCase(),
    country: String(p.country || ""),
    city: String(p.city || ""),
    hideIp: !!(p as { hide_ip?: boolean }).hide_ip || !!p.hide_ip,
  };
}

export function pickPeer(msg: ServerMatched): PeerPick {
  const peers = (msg.peers || []) as MatchPeer[];
  if (peers.length) {
    return normalizePeer(peers[0], msg);
  }
  return {
    peerId: "legacy",
    userId: "",
    isOfferer: !!msg.is_offerer,
    name: String(msg.partner_short || "?"),
    mode: String(msg.mode || "solo"),
    friendCode: "",
    stars: 0,
    trust: 0,
    role: "stranger",
    flag: "",
    country: "",
    city: "",
    hideIp: false,
  };
}

/** Extra peers after the primary (multi / party). */
export function extraPeersFromMatch(
  msg: ServerMatched,
  primaryPeerId: string
): PeerPick[] {
  const peers = (msg.peers || []) as MatchPeer[];
  if (peers.length <= 1) return [];
  return peers
    .map((p) => normalizePeer(p, msg))
    .filter((p) => p.peerId !== primaryPeerId && p.peerId !== "legacy");
}
