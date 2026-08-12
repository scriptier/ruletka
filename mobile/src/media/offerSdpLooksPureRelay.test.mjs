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

console.log("offerSdpLooksPureRelay.test.mjs OK");
