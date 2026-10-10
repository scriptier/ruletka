/**
 * On-device safety policy (phase 1).
 * Pure JS so node tests and the Expo app share one implementation.
 *
 * Detector runtime is a stub until a native TFLite/ONNX build lands.
 * Set EXPO_PUBLIC_SAFETY_DETECTOR=tflite later; unknown values stay on the stub.
 * The stub never raises a hit, so it cannot false-blur a match.
 *
 * Hub transport: the site tab added a log-only safety_log (commit 77a811c).
 * It appends a line and does not touch bans. Do not send report_user for
 * these hits — that reason counts toward the existing auto-ban.
 */

export const FACE_ABSENT_SUSPICION = 3;

/** Self-preview: show the missing-face hint after this long, never block Start. */
export const FACE_HINT_AFTER_MS = 3000;

/** Web nsfwjs gates (ui/live.js). Explicit = confirmed class. */
export function classifyScores(scores) {
  const porn = Number(scores?.porn) || 0;
  const hentai = Number(scores?.hentai) || 0;
  const sexy = Number(scores?.sexy) || 0;
  if (porn >= 0.72 || hentai >= 0.78 || (porn >= 0.55 && sexy >= 0.5)) {
    return "explicit";
  }
  if (sexy >= 0.62) return "sexy";
  return "clean";
}

export function createSafetySession() {
  return {
    window: [],
    faceAbsent: 0,
    suspicionLatched: false,
    confirmedLatched: false,
  };
}

/**
 * @returns {{ session: object, action: "none"|"suspicion"|"confirmed" }}
 * suspicion → blur the partner.
 * confirmed → 2 of the last 3 frames are explicit: blur, offer skip/report, log.
 */
export function pushVerdict(session, verdict) {
  const nsfw = verdict?.nsfw || "unknown";
  const face = verdict?.face || "unknown";
  const window = [...(session?.window || []), nsfw].slice(-3);
  let faceAbsent = session?.faceAbsent || 0;
  if (face === "absent") faceAbsent += 1;
  else if (face === "present") faceAbsent = 0;

  let suspicionLatched = !!session?.suspicionLatched;
  let confirmedLatched = !!session?.confirmedLatched;
  let action = "none";

  const explicitCount = window.filter((x) => x === "explicit").length;
  if (!confirmedLatched && explicitCount >= 2) {
    action = "confirmed";
    confirmedLatched = true;
    suspicionLatched = true;
  } else if (
    !suspicionLatched &&
    (nsfw === "sexy" ||
      nsfw === "explicit" ||
      faceAbsent >= FACE_ABSENT_SUSPICION)
  ) {
    action = "suspicion";
    suspicionLatched = true;
  }

  return {
    session: { window, faceAbsent, suspicionLatched, confirmedLatched },
    action,
  };
}

/** Missing or any value other than false → filter ON (Play default). */
export function safetyFilterEnabled(stored) {
  return stored !== false;
}

/** First action: ask to turn the filter off. It stays on. */
export function beginDisableFilter() {
  return { enabled: true, confirmPending: true };
}

/** Second action: the confirm control. Only this turns the filter off. */
export function confirmDisableFilter() {
  return { enabled: false, confirmPending: false };
}

export function cancelDisableFilter() {
  return { enabled: true, confirmPending: false };
}

/**
 * True after bridge accepts `{ type: "safety_log", log_only: true }`
 * without counting it as report_user (site commit 77a811c).
 */
export const HUB_ACCEPTS_SAFETY_LOG = true;

export function buildSafetyLog(input) {
  const scores = input?.scores;
  return {
    type: "safety_log",
    log_only: true,
    reason: "explicit_shadow",
    target_user_id: String(input?.targetUserId || ""),
    model: String(input?.model || "stub"),
    model_ready: !!input?.modelReady,
    face: String(input?.face || "unknown"),
    nsfw: String(input?.nsfw || "unknown"),
    window: Array.isArray(input?.window) ? input.window.slice(-3) : [],
    scores:
      scores && typeof scores === "object"
        ? {
            porn: Number(scores.porn) || 0,
            hentai: Number(scores.hentai) || 0,
            sexy: Number(scores.sexy) || 0,
          }
        : undefined,
    ts: Number(input?.ts) || Date.now(),
  };
}

export function createFaceWatch() {
  return { absentSince: null, showHint: false };
}

/**
 * Self-check before queueing.
 * "unknown" (the stub) and "present" clear the hint.
 * "absent" for FACE_HINT_AFTER_MS shows the hint.
 * blocked is always false — a missing face does not stop Start.
 */
export function pushFaceSample(watch, face, nowMs) {
  const now = Number(nowMs) || 0;
  const kind = face === "absent" || face === "present" ? face : "unknown";
  if (kind !== "absent") {
    return {
      watch: { absentSince: null, showHint: false },
      showHint: false,
      blocked: false,
    };
  }
  const since = watch && watch.absentSince != null ? watch.absentSince : now;
  const showHint = now - since >= FACE_HINT_AFTER_MS;
  return {
    watch: { absentSince: since, showHint },
    showHint,
    blocked: false,
  };
}

/** A detector that is not ready cannot prove a face is missing. */
export function faceForSelfCheck(detectorReady, face) {
  if (!detectorReady) return "unknown";
  if (face === "absent" || face === "present") return face;
  return "unknown";
}

/**
 * Send safety_log only when the hub flag is on.
 * Never sends report_user / explicit_ai.
 */
export function deliverSafetyLog(record, opts) {
  const accept =
    opts && Object.prototype.hasOwnProperty.call(opts, "accept")
      ? !!opts.accept
      : HUB_ACCEPTS_SAFETY_LOG;
  if (!accept) return { sent: false, reason: "hub_log_disabled" };
  if (!record || record.type !== "safety_log" || record.log_only !== true) {
    return { sent: false, reason: "bad_record" };
  }
  if (record.reason === "explicit_ai" || record.type === "report_user") {
    return { sent: false, reason: "not_a_report" };
  }
  if (opts && typeof opts.send === "function") opts.send(record);
  return { sent: true, reason: "safety_log" };
}

export function createSafetyDetector(mode) {
  const raw =
    mode != null
      ? mode
      : typeof process !== "undefined"
        ? process.env.EXPO_PUBLIC_SAFETY_DETECTOR
        : "";
  const id = String(raw || "stub").toLowerCase();
  // tflite / onnx are reserved. This binary has no native runtime, so both
  // stay on the stub instead of throwing on a missing module.
  return {
    id: id === "tflite" || id === "onnx" ? "stub" : id === "stub" ? "stub" : "stub",
    requested: id,
    ready: false,
    classify() {
      return Promise.resolve({
        face: "unknown",
        nsfw: "unknown",
        model: "stub",
      });
    },
  };
}
