import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ruletka.media-prefs.v1";
/** One-shot: undo forced hold migration from 0.1.214 that slowed linking. */
const BLUR_CONNECT_FIX_KEY = "ruletka.blur-connect-fix-v222";
/**
 * One-shot: restore product privacy default (intro) after connect-fix left
 * many installs on `off`. Users can still choose Off in Settings afterward.
 * v2: re-run for installs that got v1 stamped while still stuck on off.
 */
const BLUR_UX_INTRO_KEY = "ruletka.blur-ux-intro-v2";

export type SoftGender = "" | "man" | "woman" | "other";
export type LookingFor = "any" | "man" | "woman";

/**
 * Stranger privacy veil on match (friends never start blurred).
 * - off: show partner cam immediately
 * - intro: frosted veil ~2.5s after video ready, then auto-reveal (DEFAULT)
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
   * Default: intro (brief privacy veil). Opt-in off/hold in Settings.
   */
  blurStrangersMode: BlurStrangersMode;
  /**
   * Save tiny partner snapshots for History / Blocked (on this device only).
   * Default ON.
   */
  historySnaps: boolean;
  /** Live UI layout: native call chrome vs mobile-browser dock. */
  liveLayout: LiveLayoutMode;
  /**
   * Swipe left/right on partner main video → Next (skip). Default ON.
   * Matches web prefs.swipeSkip.
   */
  swipeSkip: boolean;
};

const DEFAULTS: MatchPrefs = {
  gender: "",
  looking: "any",
  hideIp: false,
  flag: "",
  notifyFriendCalls: true,
  dataSaver: false,
  blurStrangers: true,
  /**
   * Product default: brief privacy veil on strangers (intro ~2.8s), then
   * auto-reveal. Friends never auto-veil. Eye toggles anytime mid-call.
   * Settings: off | intro | hold (until Show video).
   */
  blurStrangersMode: "intro",
  historySnaps: true,
  liveLayout: "native",
  swipeSkip: true,
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

function prefsFromPartial(
  j: Partial<MatchPrefs>,
  blurStrangersMode: BlurStrangersMode
): MatchPrefs {
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
    historySnaps: j.historySnaps === undefined ? true : !!j.historySnaps,
    liveLayout: j.liveLayout === "browser" ? "browser" : "native",
    swipeSkip: j.swipeSkip === undefined ? true : !!j.swipeSkip,
  };
}

export async function loadMatchPrefs(): Promise<MatchPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      // Fresh install already defaults to intro — mark one-shot so a later
      // user Off choice is never re-migrated back to intro.
      try {
        const introFixed = await AsyncStorage.getItem(BLUR_UX_INTRO_KEY);
        if (!introFixed) await AsyncStorage.setItem(BLUR_UX_INTRO_KEY, "1");
      } catch {
        /* ignore */
      }
      return { ...DEFAULTS };
    }
    const j = JSON.parse(raw) as Partial<MatchPrefs>;
    let blurStrangersMode = normalizeBlurMode(j);

    // One-shot: 0.1.214 forced hold on everyone → veil during linking + black thrash.
    // Reset hold (only if never user-touched after fix) back to off for connect health.
    try {
      const fixed = await AsyncStorage.getItem(BLUR_CONNECT_FIX_KEY);
      if (!fixed && blurStrangersMode === "hold") {
        blurStrangersMode = "off";
        await AsyncStorage.setItem(BLUR_CONNECT_FIX_KEY, "1");
      } else if (!fixed) {
        await AsyncStorage.setItem(BLUR_CONNECT_FIX_KEY, "1");
      }
    } catch {
      /* keep normalized mode */
    }

    // One-shot: connect-fix left installs on off — restore product intro veil.
    // After this key is set, Settings → Off sticks permanently.
    try {
      const introFixed = await AsyncStorage.getItem(BLUR_UX_INTRO_KEY);
      if (!introFixed && blurStrangersMode === "off") {
        blurStrangersMode = "intro";
        await AsyncStorage.setItem(BLUR_UX_INTRO_KEY, "1");
        const next = prefsFromPartial(j, "intro");
        await AsyncStorage.setItem(KEY, JSON.stringify(next));
        return next;
      }
      if (!introFixed) await AsyncStorage.setItem(BLUR_UX_INTRO_KEY, "1");
    } catch {
      /* keep mode */
    }

    // Persist connect-fix hold→off if that was the only change this load.
    if (blurStrangersMode === "off" && normalizeBlurMode(j) === "hold") {
      const next = prefsFromPartial(j, "off");
      try {
        await AsyncStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    }

    return prefsFromPartial(j, blurStrangersMode);
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveMatchPrefs(p: MatchPrefs): Promise<void> {
  // Explicit Settings save: do not re-migrate Off → intro later.
  try {
    await AsyncStorage.setItem(BLUR_UX_INTRO_KEY, "1");
  } catch {
    /* ignore */
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}
