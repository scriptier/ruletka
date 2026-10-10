/**
 * Mirrors MediaSession.offerSdpLooksPureRelay (hop4 pure-SDP latch).
 * Pure offer (relay only, no host/srflx) must skip the 800ms force_relay poll.
 * Run: node src/media/offerSdpLooksPureRelay.test.mjs
 */
import assert from "node:assert/strict";

function offerSdpLooksPureRelay(sdp) {
  if (!sdp) return false;
  let relay = 0;
  let hostOrSrflx = 0;
  for (const line of sdp.split(/\r?\n/)) {
    if (!/^a=candidate:/i.test(line)) continue;
    if (/\btyp\s+relay\b/i.test(line)) relay += 1;
    else if (/\btyp\s+(host|srflx)\b/i.test(line)) hostOrSrflx += 1;
  }
  return relay > 0 && hostOrSrflx === 0;
}

const pure = [
  "v=0",
  "a=candidate:1 1 udp 1 1.2.3.4 9 typ relay raddr 0.0.0.0 rport 0",
  "a=candidate:2 1 udp 1 5.6.7.8 9 typ relay raddr 0.0.0.0 rport 0",
].join("\n");
assert.equal(offerSdpLooksPureRelay(pure), true, "relay-only is pure");

const hybridHost = [
  "a=candidate:1 1 udp 1 10.0.0.2 9 typ host",
  "a=candidate:2 1 udp 1 1.2.3.4 9 typ relay raddr 0.0.0.0 rport 0",
].join("\n");
assert.equal(offerSdpLooksPureRelay(hybridHost), false, "host+relay is not pure");

const hybridSrflx = [
  "a=candidate:1 1 udp 1 8.8.8.8 9 typ srflx raddr 10.0.0.2 rport 9",
  "a=candidate:2 1 udp 1 1.2.3.4 9 typ relay raddr 0.0.0.0 rport 0",
].join("\n");
assert.equal(offerSdpLooksPureRelay(hybridSrflx), false, "srflx+relay is not pure");

assert.equal(offerSdpLooksPureRelay(""), false);
assert.equal(offerSdpLooksPureRelay(null), false);
assert.equal(
  offerSdpLooksPureRelay("a=candidate:1 1 udp 1 10.0.0.2 9 typ host\n"),
  false,
  "host-only is not pure"
);

// CRLF SDP (browser often uses \r\n)
const crlf = pure.replace(/\n/g, "\r\n");
assert.equal(offerSdpLooksPureRelay(crlf), true, "CRLF pure still true");

// Non-candidate lines ignored
const noise = "m=video 9 UDP/TLS/RTP/SAVPF 96\na=mid:0\n" + pure;
assert.equal(offerSdpLooksPureRelay(noise), true);

function spreadRelayCandidatesAcrossMlines(sdp) {
  if (!sdp) return sdp;
  const nl = sdp.includes("\r\n") ? "\r\n" : "\n";
  const lines = sdp.split(/\r?\n/);
  const relays = [];
  for (const line of lines) {
    if (/^a=candidate:/i.test(line) && /\btyp\s+relay\b/i.test(line)) {
      relays.push(line);
    }
  }
  if (!relays.length) return sdp;
  const seed = relays[0];
  const session = [];
  const media = [];
  let cur = null;
  for (const line of lines) {
    if (/^m=/i.test(line)) {
      cur = [line];
      media.push(cur);
      continue;
    }
    if (!cur) {
      session.push(line);
      continue;
    }
    cur.push(line);
  }
  let filled = 0;
  for (const sec of media) {
    const mline = sec[0] || "";
    if (/\bm=\S+\s+0\s/i.test(mline)) continue;
    if (sec.some((l) => /^a=candidate:/i.test(l))) continue;
    const endAt = sec.findIndex((l) => /^a=end-of-candidates/i.test(l));
    if (endAt >= 0) sec.splice(endAt, 0, seed);
    else sec.push(seed);
    filled += 1;
  }
  if (!filled) return sdp;
  return session.concat(media.flat()).join(nl);
}

const laptopOffer = [
  "v=0",
  "o=- 1 1 IN IP4 0.0.0.0",
  "s=-",
  "t=0 0",
  "a=group:BUNDLE 0 1 2",
  "m=audio 9 UDP/TLS/RTP/SAVPF 111",
  "a=mid:0",
  "a=sendrecv",
  "m=video 9 UDP/TLS/RTP/SAVPF 96",
  "a=mid:1",
  "a=recvonly",
  "a=candidate:1 1 udp 1 209.38.204.153 49160 typ relay raddr 0.0.0.0 rport 0",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "a=mid:2",
].join("\r\n");
const spread = spreadRelayCandidatesAcrossMlines(laptopOffer);
assert.equal(
  (spread.match(/^m=/gm) || []).length,
  3,
  "keeps three m-lines"
);
assert.equal(
  (spread.match(/\btyp\s+relay\b/gi) || []).length,
  3,
  "relay copied onto audio + application"
);
assert.match(spread, /m=audio[\s\S]*?typ relay/, "audio has relay");
assert.match(spread, /m=application[\s\S]*?typ relay/, "app has relay");

const rejected = [
  "m=audio 9 UDP/TLS/RTP/SAVPF 111",
  "a=candidate:1 1 udp 1 1.2.3.4 9 typ relay raddr 0.0.0.0 rport 0",
  "m=video 0 UDP/TLS/RTP/SAVPF 96",
].join("\n");
assert.equal(
  (spreadRelayCandidatesAcrossMlines(rejected).match(/\btyp\s+relay\b/gi) || [])
    .length,
  1,
  "do not fill rejected port-0 m-line"
);

console.log("offerSdpLooksPureRelay.test.mjs OK");
