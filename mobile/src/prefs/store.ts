import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ruletka.media-prefs.v1";

export type SoftGender = "" | "man" | "woman" | "other";
export type LookingFor = "any" | "man" | "woman";

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
   * Cover stranger video until the user taps Show video (safety default ON).
   * Friend calls never start blurred.
   */
  blurStrangers: boolean;
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
  historySnaps: true,
};

export async function loadMatchPrefs(): Promise<MatchPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const j = JSON.parse(raw) as Partial<MatchPrefs>;
    return {
      gender: (j.gender as SoftGender) || "",
      looking: (j.looking as LookingFor) || "any",
      hideIp: !!j.hideIp,
      notifyFriendCalls:
        j.notifyFriendCalls === undefined ? true : !!j.notifyFriendCalls,
      dataSaver: !!j.dataSaver,
      // Default ON when key missing (safer for store builds)
      blurStrangers:
        j.blurStrangers === undefined ? true : !!j.blurStrangers,
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
