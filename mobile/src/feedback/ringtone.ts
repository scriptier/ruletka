/**
 * Back-compat re-exports — ringtone lives in sounds.ts with proper session modes.
 */
export {
  startRingtone,
  stopRingtone,
  enterCallAudio,
  leaveCallAudio,
} from "./sounds";

export async function unloadRingtone(): Promise<void> {
  const { stopRingtone } = require("./sounds") as {
    stopRingtone: () => Promise<void>;
  };
  await stopRingtone();
}
