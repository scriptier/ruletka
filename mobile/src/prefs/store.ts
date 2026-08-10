import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ruletka.media-prefs.v1";
/** One-shot: undo forced hold migration from 0.1.214 that slowed linking. */
const BLUR_CONNECT_FIX_KEY = "ruletka.blur-connect-fix-v222";

export type SoftGender = "" | "man" | "woman" | "other";
export type LookingFor = "any" | "man" | "woman";

/**
 * Stranger privacy veil on match (friends never start blurred).
 * - off: show partner cam immediately
 * - intro: frosted veil ~2.5s after video ready, then auto-reveal (default)
 * - hold: stay covered until user taps Show video
 */
export type BlurStrangersMode = "off" | "intro" | "hold";

/**
 * Live stage chrome on Play:
 * - native: bottom Start/Next/Stop bar + gifts/chat under the stage (default call UI)
 * - browser: full-bleed video like mobile web — dock/gifts/chat over the stage
 */
export type LiveLayoutMode = "native" | "browser";

export type MatchPrefs = {
  gender: SoftGender;
  looking: LookingFor;
  hideIp: boolean;
  /** Cosmetic flag ISO when hideIp (optional). */
  flag?: string;
  /** Prefer offline friend-call rings when a push token is available. */
  notifyFriendCalls: boolean;
  /**
   * Lower camera resolution / fps to save data, heat, and battery.
   * Applied on next getUserMedia / can re-open stream when toggled on Live.
   */
  dataSaver: boolean;
  /**
   * Legacy boolean (derived from blurStrangersMode). Kept for older readers.
   * true = intro or hold; false = off.
   */
  blurStrangers: boolean;
  /**
   * How to cover stranger video on match. Friend calls never start blurred.
   * Default: intro (frosted brief veil, not a permanent black wall).
   */
  blurStrangersMode: BlurStrangersMode;
  /**
   * Save tiny partner snapshots for History / Blocked (on this device only).
   * Default ON.
   */
  historySnaps: boolean;
  /** Live UI layout: native call chrome vs mobile-browser dock. */
  liveLayout: LiveLayoutMode;
};

const DEFAULTS: MatchPrefs = {
  gender: "",
  looking: "any",
  hideIp: false,
  flag: "",
  notifyFriendCalls: true,
  dataSaver: false,
  blurStrangers: false,
  /**
   * Default off while phone↔browser media is being stabilized (auto-veil
   * looked like "Android broken" / black stage). Eye still toggles anytime.
   * Settings: intro (brief) or hold (until Show video).
   */
  blurStrangersMode: "off",
  historySnaps: true,
  liveLayout: "native",
};

function normalizeBlurMode(
  j: Partial<MatchPrefs>
): BlurStrangersMode {
  const m = j.blurStrangersMode;
  if (m === "off" || m === "intro" || m === "hold") return m;
  // Migrate legacy boolean: true used to mean permanent black cover →
  // prefer brief intro (better UX); false stays off.
  if (j.blurStrangers === false) return "off";
  if (j.blurStrangers === true) return "intro";
  return "intro";
}

export async function loadMatchPrefs(): Promise<MatchPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const j = JSON.parse(raw) as Partial<MatchPrefs>;
    let blurStrangersMode = normalizeBlurMode(j);
    // One-shot: 0.1.214 forced hold on everyone → veil during linking + black thrash.
    // Reset hold (only if never user-touched after fix) back to off for connect health.
    try {
      const fixed = await AsyncStorage.getItem(BLUR_CONNECT_FIX_KEY);
      if (!fixed && blurStrangersMode === "hold") {
        blurStrangersMode = "off";
        await AsyncStorage.setItem(BLUR_CONNECT_FIX_KEY, "1");
        const next: MatchPrefs = {
          gender: (j.gender as SoftGender) || "",
          looking: (j.looking as LookingFor) || "any",
          hideIp: !!j.hideIp,
          flag: String(j.flag || "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z]/g, "")
            .slice(0, 2),
          notifyFriendCalls:
            j.notifyFriendCalls === undefined ? true : !!j.notifyFriendCalls,
          dataSaver: !!j.dataSaver,
          blurStrangersMode: "off",
          blurStrangers: false,
          historySnaps:
            j.historySnaps === undefined ? true : !!j.historySnaps,
          liveLayout: j.liveLayout === "browser" ? "browser" : "native",
        };
        await AsyncStorage.setItem(KEY, JSON.stringify(next));
        return next;
      }
      if (!fixed) await AsyncStorage.setItem(BLUR_CONNECT_FIX_KEY, "1");
    } catch {
      /* keep normalized mode */
    }
    const liveLayout: LiveLayoutMode =
      j.liveLayout === "browser" ? "browser" : "native";
    return {
      gender: (j.gender as SoftGender) || "",
      looking: (j.looking as LookingFor) || "any",
      hideIp: !!j.hideIp,
      flag: String(j.flag || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 2),
      notifyFriendCalls:
        j.notifyFriendCalls === undefined ? true : !!j.notifyFriendCalls,
      dataSaver: !!j.dataSaver,
      blurStrangersMode,
      blurStrangers: blurStrangersMode !== "off",
      historySnaps:
        j.historySnaps === undefined ? true : !!j.historySnaps,
      liveLayout,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveMatchPrefs(p: MatchPrefs): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}
