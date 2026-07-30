/**
 * Browser port of freenet-roulette common match protocol (demo only).
 * Crypto is simplified: peer ids are random hex; no ed25519 in the UI sim.
 */

function randomId() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSeed() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return a;
}

async function sha256Bytes(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    buf.set(p, o);
    o += p.length;
  }
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return new Uint8Array(digest);
}

function utf8(s) {
  return new TextEncoder().encode(s);
}

function hex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function u64le(n) {
  const b = new Uint8Array(8);
  const v = BigInt(n);
  for (let i = 0; i < 8; i++) b[i] = Number((v >> BigInt(8 * i)) & 0xffn);
  return b;
}

function compareHex(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

class Lobby {
  constructor() {
    this.config = {
      offerTtlMs: 15000,
      claimTtlMs: 20000,
      epochMs: 15000,
      maxOffers: 256,
    };
    this.offers = new Map(); // peerId -> offer
    this.claims = new Map(); // claimKey -> claim
    this.leaves = new Map();
  }

  networkNow() {
    let now = 0;
    for (const o of this.offers.values()) now = Math.max(now, o.heartbeatMs);
    for (const c of this.claims.values()) now = Math.max(now, c.createdMs);
    for (const l of this.leaves.values()) now = Math.max(now, l.leftMs);
    return now;
  }

  isLeft(peerId, version) {
    const l = this.leaves.get(peerId);
    return l && l.version >= version;
  }

  liveOffers(now) {
    const out = [];
    for (const o of this.offers.values()) {
      if (this.isLeft(o.peerId, o.version)) continue;
      if (now - o.heartbeatMs > this.config.offerTtlMs) continue;
      out.push(o);
    }
    return out;
  }

  upsertOffer(o) {
    const cur = this.offers.get(o.peerId);
    if (!cur || o.version > cur.version || (o.version === cur.version && o.heartbeatMs >= cur.heartbeatMs)) {
      this.offers.set(o.peerId, o);
    }
  }

  insertClaim(c) {
    const key = `${c.claimer}|${c.target}|${c.sessionId}|${c.createdMs}`;
    if (!this.claims.has(key)) this.claims.set(key, c);
  }

  upsertLeave(l) {
    const cur = this.leaves.get(l.peerId);
    if (!cur || l.version >= cur.version) this.leaves.set(l.peerId, l);
  }

  mutualMatch(a, b) {
    let ab = null;
    let ba = null;
    for (const c of this.claims.values()) {
      if (c.claimer === a && c.target === b) ab = c;
      if (c.claimer === b && c.target === a) ba = c;
    }
    if (ab && ba && ab.sessionId === ba.sessionId) return ab.sessionId;
    return null;
  }

  matchedPeers() {
    const set = new Set();
    for (const c of this.claims.values()) {
      if (this.mutualMatch(c.claimer, c.target)) {
        set.add(c.claimer);
        set.add(c.target);
      }
    }
    return set;
  }

  cleanup() {
    const now = this.networkNow();
    for (const [id, o] of [...this.offers]) {
      if (this.isLeft(id, o.version) || now - o.heartbeatMs > this.config.offerTtlMs) {
        this.offers.delete(id);
      }
    }
    const live = new Set(this.liveOffers(now).map((o) => o.peerId));
    for (const [k, c] of [...this.claims]) {
      if (now - c.createdMs > this.config.claimTtlMs || !live.has(c.claimer) || !live.has(c.target)) {
        this.claims.delete(k);
      }
    }
  }
}

async function pairScore(p, q, epochBucket) {
  const [a, b] = compareHex(p, q) <= 0 ? [p, q] : [q, p];
  return sha256Bytes([utf8("match/v1"), utf8(a), utf8(b), u64le(epochBucket)]);
}

async function selectPartner(me, myOffer, live, epochBucket, matched) {
  let best = null;
  let bestScore = null;
  for (const other of live) {
    if (other.peerId === me) continue;
    if (matched.has(other.peerId)) continue;
    const score = await pairScore(me, other.peerId, epochBucket);
    const scoreHex = hex(score);
    if (
      best === null ||
      scoreHex < bestScore ||
      (scoreHex === bestScore && other.peerId < best)
    ) {
      best = other.peerId;
      bestScore = scoreHex;
    }
  }
  return best;
}

async function sessionIdFor(a, b, seedA, seedB) {
  const [p1, s1, p2, s2] =
    compareHex(a, b) <= 0 ? [a, seedA, b, seedB] : [b, seedB, a, seedA];
  const digest = await sha256Bytes([
    utf8("session/v1"),
    utf8(p1),
    utf8(p2),
    s1,
    s2,
  ]);
  return hex(digest);
}

class Peer {
  constructor(label) {
    this.label = label;
    this.peerId = randomId();
    this.sessionSeed = randomSeed();
    this.version = 0;
    this.phase = "idle"; // idle | waiting | claiming | matched
    this.target = null;
    this.sessionId = null;
    this.messages = [];
    this.msgSeq = 0;
    this.nowMs = 0;
    this.log = []; // system events for UI
  }

  resetIdentity() {
    this.peerId = randomId();
    this.sessionSeed = randomSeed();
    this.version = 0;
  }

  spin(lobby, nowMs) {
    this.nowMs = nowMs;
    this.sessionSeed = randomSeed();
    this.version += 1;
    this.phase = "waiting";
    this.target = null;
    this.sessionId = null;
    this.messages = [];
    this.msgSeq = 0;
    this.log.push({ sys: true, body: "spun into lobby" });
    lobby.upsertOffer({
      peerId: this.peerId,
      version: this.version,
      heartbeatMs: nowMs,
      sessionSeed: this.sessionSeed,
    });
  }

  next(lobby, nowMs) {
    this.nowMs = nowMs;
    if (this.phase !== "idle") {
      lobby.upsertLeave({ peerId: this.peerId, version: this.version, leftMs: nowMs });
    }
    this.phase = "idle";
    this.target = null;
    this.sessionId = null;
    this.messages = [];
    this.log.push({ sys: true, body: "left (next)" });
    this.resetIdentity();
  }

  async tick(lobby, nowMs) {
    this.nowMs = Math.max(this.nowMs, nowMs);
    if (this.phase !== "waiting" && this.phase !== "claiming") return;

    this.version += 1;
    const offer = {
      peerId: this.peerId,
      version: this.version,
      heartbeatMs: this.nowMs,
      sessionSeed: this.sessionSeed,
    };
    lobby.upsertOffer(offer);

    const now = Math.max(lobby.networkNow(), this.nowMs);
    const epochBucket = Math.floor(now / lobby.config.epochMs);
    let live = lobby.liveOffers(now);
    if (!live.find((o) => o.peerId === this.peerId)) live = [...live, offer];
    else live = live.map((o) => (o.peerId === this.peerId ? offer : o));

    const matched = lobby.matchedPeers();
    // Exclude self from "already matched" for selection of free peers
    const partner = await selectPartner(this.peerId, offer, live, epochBucket, matched);

    if (partner) {
      const their = live.find((o) => o.peerId === partner);
      const theirChoice = await selectPartner(partner, their, live, epochBucket, matched);
      if (theirChoice === this.peerId) {
        const sid = await sessionIdFor(
          this.peerId,
          partner,
          this.sessionSeed,
          their.sessionSeed
        );
        lobby.insertClaim({
          claimer: this.peerId,
          target: partner,
          sessionId: sid,
          createdMs: this.nowMs,
        });
        this.phase = "claiming";
        this.target = partner;
        this.sessionId = sid;
        this.log.push({ sys: true, body: `claiming ${partner.slice(0, 8)}` });
      }
    }

    // Detect mutual match
    for (const o of live) {
      if (o.peerId === this.peerId) continue;
      const sid = lobby.mutualMatch(this.peerId, o.peerId);
      if (sid) {
        this.phase = "matched";
        this.target = o.peerId;
        this.sessionId = sid;
        lobby.upsertLeave({
          peerId: this.peerId,
          version: this.version,
          leftMs: this.nowMs,
        });
        this.log.push({ sys: true, body: `matched ${o.peerId.slice(0, 8)}` });
        break;
      }
    }

    lobby.cleanup();
  }

  send(body, sessions) {
    if (this.phase !== "matched" || !this.sessionId) return;
    this.msgSeq += 1;
    const msg = {
      author: this.peerId,
      seq: this.msgSeq,
      sentMs: this.nowMs,
      body,
    };
    this.messages.push(msg);
    const key = this.sessionId;
    if (!sessions.has(key)) sessions.set(key, []);
    const list = sessions.get(key);
    list.push(msg);
    // sync both
    return msg;
  }
}

window.RouletteProtocol = { Lobby, Peer, randomId };
