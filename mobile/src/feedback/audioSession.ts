/**
 * Android/iOS audio session modes for ruletka.
 *
 * Modes:
 *  - ui: short chimes (duck others, speaker)
 *  - ring: incoming friend call (interrupt, loud speaker)
 *  - call: WebRTC A/V (allow recording path, don't fight peer audio)
 */
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AudioSessionMode = "ui" | "ring" | "call" | "idle";

const SOUND_PREF_KEY = "ruletka-ui-sounds-v1";

let current: AudioSessionMode = "idle";
let soundsEnabled = true;

export async function loadSoundPref(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(SOUND_PREF_KEY);
    if (v === "0") soundsEnabled = false;
    else if (v === "1") soundsEnabled = true;
  } catch {
    /* keep default */
  }
  return soundsEnabled;
}

export async function setSoundPref(on: boolean): Promise<void> {
  soundsEnabled = !!on;
  try {
    await AsyncStorage.setItem(SOUND_PREF_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function isSoundEnabled(): boolean {
  return soundsEnabled;
}

function loadAudio(): {
  setAudioModeAsync: (m: object) => Promise<void>;
  InterruptionModeAndroid: { DoNotMix: number; DuckOthers: number };
  InterruptionModeIOS: { MixWithOthers: number; DoNotMix: number; DuckOthers: number };
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const av = require("expo-av") as {
      Audio: {
        setAudioModeAsync: (m: object) => Promise<void>;
        InterruptionModeAndroid: { DoNotMix: number; DuckOthers: number };
        InterruptionModeIOS: {
          MixWithOthers: number;
          DoNotMix: number;
          DuckOthers: number;
        };
      };
    };
    return av.Audio as unknown as ReturnType<typeof loadAudio>;
  } catch {
    return null;
  }
}

/**
 * Apply session for the next playback / call.
 * Safe to call often — no-ops when mode unchanged (except call which re-asserts).
 */
export async function setAudioSession(
  mode: AudioSessionMode
): Promise<void> {
  if (Platform.OS === "web") return;
  if (mode === current && mode !== "call") return;
  const Audio = loadAudio();
  if (!Audio) return;

  try {
    if (mode === "ring") {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        interruptionModeAndroid: Audio.InterruptionModeAndroid.DoNotMix,
        interruptionModeIOS: Audio.InterruptionModeIOS.DoNotMix,
      });
    } else if (mode === "call") {
      // WebRTC owns mic; keep speaker for video chat (not earpiece)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeAndroid: Audio.InterruptionModeAndroid.DuckOthers,
        interruptionModeIOS: Audio.InterruptionModeIOS.MixWithOthers,
      });
    } else if (mode === "ui") {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeAndroid: Audio.InterruptionModeAndroid.DuckOthers,
        interruptionModeIOS: Audio.InterruptionModeIOS.DuckOthers,
      });
    } else {
      // idle — release aggressive hold
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeAndroid: Audio.InterruptionModeAndroid.DuckOthers,
        interruptionModeIOS: Audio.InterruptionModeIOS.MixWithOthers,
      });
    }
    current = mode;
  } catch {
    /* ignore */
  }
}

export function getAudioSessionMode(): AudioSessionMode {
  return current;
}
