/**
 * Light haptics via React Native Vibration (no extra native module).
 * Patterns are short so they stay polite on long sessions.
 */
import { Platform, Vibration } from "react-native";

function ok(): boolean {
  return Platform.OS === "android" || Platform.OS === "ios";
}

export function hapticLight(): void {
  if (!ok()) return;
  try {
    Vibration.vibrate(Platform.OS === "ios" ? 10 : 18);
  } catch {
    /* ignore */
  }
}

export function hapticMedium(): void {
  if (!ok()) return;
  try {
    Vibration.vibrate(Platform.OS === "ios" ? 20 : 32);
  } catch {
    /* ignore */
  }
}

/** Match found / gift — two short pulses. */
export function hapticMatch(): void {
  if (!ok()) return;
  try {
    Vibration.vibrate([0, 36, 50, 28]);
  } catch {
    /* ignore */
  }
}

/** Debate turn change. */
export function hapticDebateTurn(): void {
  if (!ok()) return;
  try {
    Vibration.vibrate([0, 18, 40, 22]);
  } catch {
    /* ignore */
  }
}

/** Debate last 5s urgency. */
export function hapticDebateUrgent(): void {
  if (!ok()) return;
  try {
    Vibration.vibrate([0, 40, 50, 40, 50, 55]);
  } catch {
    /* ignore */
  }
}

/**
 * Incoming friend ring — vibration + optional ringtone sound.
 * Call stopRing() when answered/declined.
 */
let ringTimer: ReturnType<typeof setInterval> | null = null;

export function startIncomingRing(): void {
  stopRing();
  if (!ok()) return;
  const pulse = () => {
    try {
      Vibration.vibrate([0, 420, 180, 420, 180, 420]);
    } catch {
      /* ignore */
    }
  };
  pulse();
  ringTimer = setInterval(pulse, 2200);
  // Fire-and-forget audio (dedicated ring session)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { startRingtone } = require("./sounds") as {
      startRingtone: () => Promise<void>;
    };
    void startRingtone();
  } catch {
    /* ignore */
  }
}

export function stopRing(): void {
  if (ringTimer) {
    clearInterval(ringTimer);
    ringTimer = null;
  }
  try {
    Vibration.cancel();
  } catch {
    /* ignore */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { stopRingtone } = require("./sounds") as {
      stopRingtone: () => Promise<void>;
    };
    void stopRingtone();
  } catch {
    /* ignore */
  }
}
