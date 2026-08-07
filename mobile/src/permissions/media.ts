/**
 * First-run camera / mic (and Bluetooth for some WebRTC paths) prompts.
 */
import { PermissionsAndroid, Platform } from "react-native";

export type MediaPermissionResult = {
  camera: boolean;
  mic: boolean;
  bluetooth: boolean;
  allGranted: boolean;
};

async function checkOne(
  perm: (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS]
): Promise<boolean> {
  try {
    const s = await PermissionsAndroid.check(perm);
    return !!s;
  } catch {
    return false;
  }
}

/**
 * Request camera + microphone (and BT connect on API 31+) if not already granted.
 * Safe to call multiple times; no-ops when already allowed.
 */
export async function ensureMediaPermissions(opts?: {
  rationaleTitle?: string;
  rationaleMessage?: string;
}): Promise<MediaPermissionResult> {
  if (Platform.OS !== "android") {
    return { camera: true, mic: true, bluetooth: true, allGranted: true };
  }

  const title =
    opts?.rationaleTitle || "Camera & microphone";
  const message =
    opts?.rationaleMessage ||
    "ruletka needs your camera and mic for peer-to-peer video chat.";

  const need: string[] = [];
  const cam = PermissionsAndroid.PERMISSIONS.CAMERA;
  const mic = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
  const bt =
    Platform.Version >= 31
      ? PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
      : null;

  if (!(await checkOne(cam))) need.push(cam);
  if (!(await checkOne(mic))) need.push(mic);
  if (bt && !(await checkOne(bt))) need.push(bt);

  if (need.length) {
    try {
      await PermissionsAndroid.requestMultiple(
        need as (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS][]
      );
    } catch {
      /* user dismissed */
    }
  }

  // Re-check (and offer rationale once more if still denied)
  let camera = await checkOne(cam);
  let micOk = await checkOne(mic);
  if (!camera || !micOk) {
    try {
      if (!camera) {
        const r = await PermissionsAndroid.request(cam, {
          title,
          message,
          buttonPositive: "Allow",
          buttonNegative: "Not now",
        });
        camera = r === PermissionsAndroid.RESULTS.GRANTED;
      }
      if (!micOk) {
        const r = await PermissionsAndroid.request(mic, {
          title,
          message,
          buttonPositive: "Allow",
          buttonNegative: "Not now",
        });
        micOk = r === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch {
      /* ignore */
    }
  }

  const bluetooth = bt ? await checkOne(bt) : true;
  return {
    camera,
    mic: micOk,
    bluetooth,
    allGranted: camera && micOk,
  };
}
