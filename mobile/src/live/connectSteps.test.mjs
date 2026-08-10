import assert from "node:assert/strict";

function computeConnectSteps(opts) {
  const {
    phase,
    queueAcked,
    connectedHub,
    conn,
    hasRemoteVideo,
    awaitingRemoteVideo,
  } = opts;
  if (phase === "idle" || phase === "error") {
    return { queue: "todo", media: "todo", video: "todo", stage: "idle" };
  }
  if (phase === "search") {
    if (!connectedHub || !queueAcked) {
      return { queue: "active", media: "todo", video: "todo", stage: "joining" };
    }
    return { queue: "active", media: "todo", video: "todo", stage: "looking" };
  }
  if (hasRemoteVideo && !awaitingRemoteVideo) {
    return { queue: "done", media: "done", video: "done", stage: "live" };
  }
  const mediaUp =
    conn === "connected" || conn === "completed" || hasRemoteVideo;
  if (mediaUp && (awaitingRemoteVideo || !hasRemoteVideo)) {
    return {
      queue: "done",
      media: "done",
      video: "active",
      stage: "wait_video",
    };
  }
  return { queue: "done", media: "active", video: "todo", stage: "connecting" };
}

assert.equal(
  computeConnectSteps({
    phase: "search",
    queueAcked: false,
    connectedHub: true,
    conn: "",
    hasRemoteVideo: false,
    awaitingRemoteVideo: false,
  }).stage,
  "joining"
);
assert.equal(
  computeConnectSteps({
    phase: "search",
    queueAcked: true,
    connectedHub: true,
    conn: "",
    hasRemoteVideo: false,
    awaitingRemoteVideo: false,
  }).stage,
  "looking"
);
assert.equal(
  computeConnectSteps({
    phase: "matched",
    queueAcked: true,
    connectedHub: true,
    conn: "connecting",
    hasRemoteVideo: false,
    awaitingRemoteVideo: true,
  }).stage,
  "connecting"
);
assert.equal(
  computeConnectSteps({
    phase: "matched",
    queueAcked: true,
    connectedHub: true,
    conn: "connected",
    hasRemoteVideo: false,
    awaitingRemoteVideo: true,
  }).stage,
  "wait_video"
);
assert.equal(
  computeConnectSteps({
    phase: "matched",
    queueAcked: true,
    connectedHub: true,
    conn: "connected",
    hasRemoteVideo: true,
    awaitingRemoteVideo: false,
  }).stage,
  "live"
);
assert.equal(
  computeConnectSteps({
    phase: "error",
    queueAcked: false,
    connectedHub: false,
    conn: "failed",
    hasRemoteVideo: false,
    awaitingRemoteVideo: false,
  }).stage,
  "idle"
);
assert.equal(
  computeConnectSteps({
    phase: "matched",
    queueAcked: true,
    connectedHub: true,
    conn: "completed",
    hasRemoteVideo: false,
    awaitingRemoteVideo: true,
  }).stage,
  "wait_video"
);

console.log("connectSteps.test.mjs ok");
