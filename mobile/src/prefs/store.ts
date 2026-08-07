import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ruletka.media-prefs.v1";

export type SoftGender = "" | "man" | "woman" | "other";
export type LookingFor = "any" | "man" | "woman";

/**
 * Stranger privacy veil on match (friends never start blurred).
 * - off: show partner cam immediately
 * - intro: frosted veil ~2.5s after video ready, then auto-reveal (default)
 * - hold: stay covered until user taps Show video
 */
export type BlurStrangersMode = "off" | "intro" | "hold";

export type MatchPrefs = {
  gender: SoftGender;
  looking: LookingFor;
  hideIp: boolean;
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
};

const DEFAULTS: MatchPrefs = {
  gender: "",
  looking: "any",
  hideIp: false,
  notifyFriendCalls: true,
  dataSaver: false,
  blurStrangers: true,
  blurStrangersMode: "intro",
  historySnaps: true,
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
    const blurStrangersMode = normalizeBlurMode(j);
    return {
      gender: (j.gender as SoftGender) || "",
      looking: (j.looking as LookingFor) || "any",
      hideIp: !!j.hideIp,
      notifyFriendCalls:
        j.notifyFriendCalls === undefined ? true : !!j.notifyFriendCalls,
      dataSaver: !!j.dataSaver,
      blurStrangersMode,
      blurStrangers: blurStrangersMode !== "off",
      historySnaps:
        j.historySnaps === undefined ? true : !!j.historySnaps,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveMatchPrefs(p: MatchPrefs): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}
