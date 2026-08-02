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
};

const DEFAULTS: MatchPrefs = {
  gender: "",
  looking: "any",
  hideIp: false,
  notifyFriendCalls: true,
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
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveMatchPrefs(p: MatchPrefs): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}
