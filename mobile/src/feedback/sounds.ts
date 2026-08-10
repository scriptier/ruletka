/**
 * Short UI chimes (dedicated assets) + ringtone.
 * Respects sound pref; switches audio session mode for Android focus.
 */
import { Platform } from "react-native";
import {
  isSoundEnabled,
  setAudioSession,
} from "./audioSession";

type SoundLike = {
  unloadAsync: () => Promise<void>;
  stopAsync?: () => Promise<void>;
  setIsLoopingAsync?: (v: boolean) => Promise<void>;
  setVolumeAsync: (v: number) => Promise<void>;
  playAsync: () => Promise<void>;
  replayAsync: () => Promise<void>;
  getStatusAsync?: () => Promise<{ isLoaded?: boolean }>;
};

type Kind = "match" | "turn" | "urgent" | "gift" | "ring";

const cache: Partial<Record<Kind, SoundLike>> = {};
let preloadDone = false;

function asset(kind: Kind): unknown {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const map: Record<Kind, unknown> = {
    match: require("../../assets/sounds/match.wav"),
    turn: require("../../assets/sounds/turn.wav"),
    urgent: require("../../assets/sounds/urgent.wav"),
    gift: require("../../assets/sounds/gift.wav"),
    ring: require("../../assets/sounds/ring.wav"),
  };
  return map[kind];
}

async function getSound(kind: Kind): Promise<SoundLike | null> {
  if (Platform.OS === "web") return null;
  if (cache[kind]) return cache[kind]!;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Audio } = require("expo-av") as {
      Audio: {
        Sound: {
          createAsync: (
            src: unknown,
            opts?: object
          ) => Promise<{ sound: SoundLike }>;
        };
      };
    };
    const isRing = kind === "ring";
    const { sound } = await Audio.Sound.createAsync(asset(kind), {
      shouldPlay: false,
      isLooping: isRing,
      volume: isRing ? 0.9 : 0.55,
      // Android: play even if slightly delayed load
      progressUpdateIntervalMillis: 500,
    });
    cache[kind] = sound;
    return sound;
  } catch {
    return null;
  }
}

/** Warm cache after first frame — avoids lag on first match chime. */
export async function preloadUiSounds(): Promise<void> {
  if (preloadDone || Platform.OS === "web") return;
  preloadDone = true;
  try {
    await setAudioSession("ui");
    await Promise.all(
      (["match", "turn", "urgent", "gift", "ring"] as Kind[]).map((k) =>
        getSound(k)
      )
    );
  } catch {
    /* ignore */
  }
}

async function playOnce(
  kind: Exclude<Kind, "ring">,
  volume: number
): Promise<void> {
  if (!isSoundEnabled()) return;
  try {
    await setAudioSession("ui");
    const s = await getSound(kind);
    if (!s) return;
    await s.setVolumeAsync(volume);
    try {
      await s.replayAsync();
    } catch {
      await s.playAsync();
    }
  } catch {
    /* ignore */
  }
}

export async function playMatchChime(): Promise<void> {
  await playOnce("match", 0.55);
}

export async function playTurnChime(): Promise<void> {
  await playOnce("turn", 0.5);
}

export async function playUrgentChime(): Promise<void> {
  await playOnce("urgent", 0.48);
}

export async function playGiftChime(): Promise<void> {
  await playOnce("gift", 0.52);
}

/* ── Ringtone (looping) ── */

let ringLooping = false;

export async function startRingtone(): Promise<void> {
  if (Platform.OS === "web" || !isSoundEnabled()) return;
  ringLooping = true;
  try {
    await setAudioSession("ring");
    const s = await getSound("ring");
    if (!s || !ringLooping) return;
    await s.setIsLoopingAsync?.(true);
    await s.setVolumeAsync(0.92);
    try {
      await s.replayAsync();
    } catch {
      await s.playAsync();
    }
  } catch {
    /* vibe still runs */
  }
}

export async function stopRingtone(): Promise<void> {
  ringLooping = false;
  try {
    const s = cache.ring;
    if (s) {
      await s.stopAsync?.();
      await s.setIsLoopingAsync?.(false);
    }
  } catch {
    /* ignore */
  }
  // Hand control back for WebRTC / UI
  try {
    await setAudioSession("call");
  } catch {
    /* ignore */
  }
}

export async function enterCallAudio(): Promise<void> {
  ringLooping = false;
  try {
    const s = cache.ring;
    if (s) await s.stopAsync?.();
  } catch {
    /* ignore */
  }
  await setAudioSession("call");
}

export async function leaveCallAudio(): Promise<void> {
  await setAudioSession("idle");
}
