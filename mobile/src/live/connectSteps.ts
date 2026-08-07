/**
 * Pure helper: which connect step is active / done for Live chrome chips.
 * Steps: queue → media → video
 */

export type ConnectStepId = "queue" | "media" | "video";

export type ConnectStepState = "todo" | "active" | "done";

export type ConnectStepsSnapshot = {
  queue: ConnectStepState;
  media: ConnectStepState;
  video: ConnectStepState;
  /** Short stage key for status flash / analytics */
  stage: "idle" | "joining" | "looking" | "connecting" | "wait_video" | "live";
};

export function computeConnectSteps(opts: {
  phase: string;
  queueAcked: boolean;
  connectedHub: boolean;
  conn: string;
  hasRemoteVideo: boolean;
  awaitingRemoteVideo: boolean;
}): ConnectStepsSnapshot {
  const {
    phase,
    queueAcked,
    connectedHub,
    conn,
    hasRemoteVideo,
    awaitingRemoteVideo,
  } = opts;

  if (phase === "idle" || phase === "error") {
    return {
      queue: "todo",
      media: "todo",
      video: "todo",
      stage: "idle",
    };
  }

  if (phase === "search") {
    if (!connectedHub || !queueAcked) {
      return {
        queue: "active",
        media: "todo",
        video: "todo",
        stage: connectedHub ? "joining" : "joining",
      };
    }
    return {
      queue: "active",
      media: "todo",
      video: "todo",
      stage: "looking",
    };
  }

  // matched
  if (hasRemoteVideo && !awaitingRemoteVideo) {
    return {
      queue: "done",
      media: "done",
      video: "done",
      stage: "live",
    };
  }

  const mediaUp =
    conn === "connected" ||
    conn === "completed" ||
    hasRemoteVideo;

  if (mediaUp && (awaitingRemoteVideo || !hasRemoteVideo)) {
    return {
      queue: "done",
      media: "done",
      video: "active",
      stage: "wait_video",
    };
  }

  // connecting / checking / failed still recovering
  return {
    queue: "done",
    media: "active",
    video: "todo",
    stage: "connecting",
  };
}
