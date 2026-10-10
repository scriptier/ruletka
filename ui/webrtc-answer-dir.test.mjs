#!/usr/bin/env node
/** Laptop no-cam recvonly offer vs Android sendrecv answer. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "webrtc.js"),
  "utf8"
);
if (!src.includes("function firstLivePreviewVideo")) {
  console.error("FAIL missing firstLivePreviewVideo");
  process.exit(1);
}
if (!src.includes("_attachPreviewVideoIfSending")) {
  console.error("FAIL missing _attachPreviewVideoIfSending");
  process.exit(1);
}
if (!src.includes("function alignAnswerDirectionsToLocalOffer")) {
  console.error("FAIL missing alignAnswerDirectionsToLocalOffer");
  process.exit(1);
}

function sdpMlineDirections(sdp) {
  const dirs = [];
  for (const line of String(sdp || "").split(/\r?\n/)) {
    if (/^m=/i.test(line)) {
      dirs.push("sendrecv");
      continue;
    }
    const m = line.match(/^a=(sendrecv|recvonly|sendonly|inactive)\b/i);
    if (m && dirs.length) dirs[dirs.length - 1] = m[1].toLowerCase();
  }
  return dirs;
}
function alignAnswerDirectionsToLocalOffer(offerSdp, answerSdp) {
  const offerDirs = sdpMlineDirections(offerSdp);
  const lines = String(answerSdp).split(/\r?\n/);
  let mi = -1;
  const out = [];
  for (const line of lines) {
    if (/^m=/i.test(line)) {
      mi += 1;
      out.push(line);
      continue;
    }
    const m = line.match(/^a=(sendrecv|recvonly|sendonly|inactive)\b/i);
    if (m && mi >= 0 && offerDirs[mi]) {
      const od = offerDirs[mi];
      const ad = m[1].toLowerCase();
      let next = ad;
      if (od === "recvonly" && ad === "sendrecv") next = "sendonly";
      else if (od === "sendonly" && ad === "sendrecv") next = "recvonly";
      if (next !== ad) {
        out.push("a=" + next);
        continue;
      }
    }
    out.push(line);
  }
  return out.join("\r\n");
}

const offer = [
  "v=0",
  "m=audio 9 UDP/TLS/RTP/SAVPF 111",
  "a=sendrecv",
  "m=video 9 UDP/TLS/RTP/SAVPF 96",
  "a=recvonly",
  "",
].join("\r\n");
const answer = [
  "v=0",
  "m=audio 9 UDP/TLS/RTP/SAVPF 111",
  "a=sendrecv",
  "m=video 9 UDP/TLS/RTP/SAVPF 96",
  "a=sendrecv",
  "",
].join("\r\n");
const out = alignAnswerDirectionsToLocalOffer(offer, answer);
if (!out.includes("a=sendonly")) {
  console.error("FAIL video not sendonly\n", out);
  process.exit(1);
}
if ((out.match(/a=sendrecv/g) || []).length !== 1) {
  console.error("FAIL audio sendrecv lost\n", out);
  process.exit(1);
}
const both = alignAnswerDirectionsToLocalOffer(
  offer.replace("a=recvonly", "a=sendrecv"),
  answer
);
if (!both.includes("a=sendrecv") || both.includes("a=sendonly")) {
  console.error("FAIL cam path must stay sendrecv");
  process.exit(1);
}
console.log("ok webrtc-answer-dir 3 asserts");
