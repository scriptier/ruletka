/**
 * Outbound quality ladder + codec prefs for phone↔browser.
 * Mirrors ui/webrtc.js QUALITY_TIERS / applySenderEncoding / preferCodecs.
 */

export type QualityTierName = "high" | "mid" | "low" | "min";

export type QualityTier = {
  maxBitrate: number;
  maxFramerate: number;
  scaleResolutionDownBy: number;
  label: QualityTierName;
};

export const QUALITY_TIERS: Record<QualityTierName, QualityTier> = {
  high: {
    maxBitrate: 1_200_000, // slightly under web high — phone encoders run hotter
    maxFramerate: 28,
    scaleResolutionDownBy: 1,
    label: "high",
  },
  mid: {
    maxBitrate: 700_000,
    maxFramerate: 24,
    scaleResolutionDownBy: 1,
    label: "mid",
  },
  low: {
    maxBitrate: 350_000,
    maxFramerate: 18,
    scaleResolutionDownBy: 1.5,
    label: "low",
  },
  min: {
    maxBitrate: 180_000,
    maxFramerate: 12,
    scaleResolutionDownBy: 2,
    label: "min",
  },
};

const TIER_RANK: Record<QualityTierName, number> = {
  high: 3,
  mid: 2,
  low: 1,
  min: 0,
};

export function clampQualityTier(
  tier: string,
  ceiling: string
): QualityTierName {
  const t = (QUALITY_TIERS[tier as QualityTierName] ? tier : "mid") as QualityTierName;
  const c = (QUALITY_TIERS[ceiling as QualityTierName]
    ? ceiling
    : "high") as QualityTierName;
  return (TIER_RANK[t] ?? 2) <= (TIER_RANK[c] ?? 3) ? t : c;
}

export type SenderLike = {
  track?: { kind?: string } | null;
  getParameters?: () => {
    encodings?: Array<Record<string, unknown>>;
    degradationPreference?: string;
  };
  setParameters?: (p: object) => Promise<void>;
};

export async function applySenderEncoding(
  sender: SenderLike,
  opts: {
    maxBitrate?: number;
    maxFramerate?: number;
    scaleResolutionDownBy?: number;
    degradationPreference?: string;
    /** Default true — inactive encodings → framesEncoded=0 forever (RN). */
    active?: boolean;
  }
): Promise<void> {
  if (!sender || typeof sender.getParameters !== "function") return;
  try {
    const params = sender.getParameters() || { encodings: [{}] };
    if (!params.encodings || !params.encodings.length) {
      params.encodings = [{}];
    }
    // Ensure every encoding is active (simulcast rows can default inactive)
    for (const row of params.encodings) {
      const enc = row as Record<string, unknown>;
      if (opts.active !== false) enc.active = true;
    }
    const enc = params.encodings[0] as Record<string, unknown>;
    if (opts.active !== false) enc.active = true;
    if (opts.maxBitrate != null) enc.maxBitrate = opts.maxBitrate;
    if (opts.maxFramerate != null) enc.maxFramerate = opts.maxFramerate;
    if (opts.scaleResolutionDownBy != null) {
      enc.scaleResolutionDownBy = Math.max(
        1,
        Number(opts.scaleResolutionDownBy) || 1
      );
    }
    if (opts.degradationPreference) {
      if ("degradationPreference" in params) {
        params.degradationPreference = opts.degradationPreference;
      } else {
        enc.degradationPreference = opts.degradationPreference;
      }
    }
    if (typeof sender.setParameters === "function") {
      await sender.setParameters(params);
    }
  } catch {
    /* RN may reject mid-renego */
  }
}

type CodecCap = {
  mimeType?: string;
  sdpFmtpLine?: string;
  clockRate?: number;
  channels?: number;
};

function preferOrder(codecs: CodecCap[], mimeOrder: string[]): CodecCap[] {
  const scored = codecs.map((c, i) => {
    const mime = String(c.mimeType || "").toUpperCase();
    let rank = 100 + i;
    mimeOrder.forEach((want, wi) => {
      if (mime === want.toUpperCase()) rank = wi;
    });
    // Android HW H264 often more stable phone↔browser than AV1/VP9
    if (
      mime === "VIDEO/H264" &&
      /packetization-mode=1/i.test(c.sdpFmtpLine || "")
    ) {
      rank -= 0.1;
    }
    return { c, rank };
  });
  scored.sort((a, b) => a.rank - b.rank);
  return scored.map((s) => s.c);
}

export type TransceiverLike = {
  setCodecPreferences?: (c: object[]) => void;
  receiver?: { track?: { kind?: string } | null };
  sender?: { track?: { kind?: string } | null };
};

/**
 * Prefer H264/VP8 + Opus when RN-WebRTC exposes capabilities.
 * Order differs slightly from web: H264 first for Android HW encoders.
 */
export function preferCodecs(
  pc: {
    getTransceivers?: () => TransceiverLike[];
  },
  getCapabilities?: (kind: string) => { codecs?: CodecCap[] } | null
): void {
  if (!pc || typeof pc.getTransceivers !== "function") return;
  if (typeof getCapabilities !== "function") return;
  try {
    const videoCaps = getCapabilities("video");
    const audioCaps = getCapabilities("audio");
    const transceivers = pc.getTransceivers() || [];
    for (const t of transceivers) {
      if (!t?.setCodecPreferences) continue;
      const kind =
        t.receiver?.track?.kind || t.sender?.track?.kind || "";
      if (kind === "video" && videoCaps?.codecs?.length) {
        const pref = preferOrder(videoCaps.codecs, [
          "video/H264",
          "video/VP8",
          "video/VP9",
          "video/AV1",
        ]);
        if (pref.length) t.setCodecPreferences(pref as object[]);
      } else if (kind === "audio" && audioCaps?.codecs?.length) {
        const pref = preferOrder(audioCaps.codecs, [
          "audio/opus",
          "audio/red",
          "audio/PCMU",
        ]);
        if (pref.length) t.setCodecPreferences(pref as object[]);
      }
    }
  } catch {
    /* ignore */
  }
}

/** Tag tracks for better encoder choice (motion talking-head / speech). */
export function tagLocalTracks(stream: {
  getVideoTracks?: () => Array<{ contentHint?: string }>;
  getAudioTracks?: () => Array<{ contentHint?: string }>;
} | null): void {
  if (!stream) return;
  try {
    for (const t of stream.getVideoTracks?.() || []) {
      try {
        if ("contentHint" in t) t.contentHint = "motion";
      } catch {
        /* ignore */
      }
    }
    for (const t of stream.getAudioTracks?.() || []) {
      try {
        if ("contentHint" in t) t.contentHint = "speech";
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Pick next quality tier from RTT / loss EMA.
 * Relay paths step down earlier (TURN freerzes hurt lipsync).
 */
export function pickAdaptiveTier(opts: {
  current: QualityTierName;
  rttMs: number;
  lossP: number;
  relay: boolean;
  ceiling: QualityTierName;
}): QualityTierName {
  let next: QualityTierName = opts.current || "mid";
  const { rttMs, lossP, relay } = opts;
  if (relay) {
    if (lossP > 0.1 || rttMs > 380) next = "min";
    else if (lossP > 0.05 || rttMs > 240) next = "low";
    else if (lossP > 0.025 || rttMs > 160) next = "mid";
    else if (lossP < 0.012 && rttMs < 110) next = "high";
  } else {
    if (lossP > 0.12 || rttMs > 450) next = "min";
    else if (lossP > 0.06 || rttMs > 280) next = "low";
    else if (lossP > 0.03 || rttMs > 180) next = "mid";
    else if (lossP < 0.015 && rttMs < 120) next = "high";
  }
  return clampQualityTier(next, opts.ceiling);
}

/** Cellular / data-saver default ceiling. */
export function networkQualityCeiling(opts: {
  cellular: boolean;
  dataSaver: boolean;
  hideIp: boolean;
}): QualityTierName {
  if (opts.dataSaver) return "low";
  if (opts.cellular) return "mid";
  if (opts.hideIp) return "mid";
  return "high";
}
