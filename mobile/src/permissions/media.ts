/**
 * Camera / mic runtime permissions (Android).
 * Once granted, subsequent calls are silent — no system dialogs.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PermissionsAndroid, Platform } from "react-native";

export type MediaPermissionResult = {
  camera: boolean;
  mic: boolean;
  bluetooth: boolean;
  allGranted: boolean;
};

const BT_ASKED_KEY = "ruletka.bt_connect_asked.v1";

/** In-memory cache for this process — avoid check/request storms on focus. */
let cached: MediaPermissionResult | null = null;

async function checkOne(
  perm: (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS]
): Promise<boolean> {
  try {
    return !!(await PermissionsAndroid.check(perm));
  } catch {
    return false;
  }
}

/**
 * Fast path: true only if OS already granted cam+mic.
 * No system UI. Safe to call from UI warm paths.
 */
export async function hasMediaPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  if (cached?.allGranted) return true;
  const cam = PermissionsAndroid.PERMISSIONS.CAMERA;
  const mic = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
  const camera = await checkOne(cam);
  const micOk = await checkOne(mic);
  if (camera && micOk) {
    cached = {
      camera: true,
      mic: true,
      bluetooth: true,
      allGranted: true,
    };
    return true;
  }
  return false;
}

/**
 * Request camera + microphone if not already granted.
 * Safe to call multiple times; **no-ops when already allowed** (no dialogs).
 * Bluetooth is optional and asked at most once (never on every app open).
 */
export async function ensureMediaPermissions(opts?: {
  rationaleTitle?: string;
  rationaleMessage?: string;
  /** When true, may request BLUETOOTH_CONNECT once (API 31+). Default false. */
  requestBluetooth?: boolean;
}): Promise<MediaPermissionResult> {
  if (Platform.OS !== "android") {
    const ok = {
      camera: true,
      mic: true,
      bluetooth: true,
      allGranted: true,
    };
    cached = ok;
    return ok;
  }

  // Silent if already granted this session or by OS
  if (cached?.allGranted || (await hasMediaPermissions())) {
    return (
      cached || {
        camera: true,
        mic: true,
        bluetooth: true,
        allGranted: true,
      }
    );
  }

  const title = opts?.rationaleTitle || "Camera & microphone";
  const message =
    opts?.rationaleMessage ||
    "ruletka needs your camera and mic for peer-to-peer video chat.";

  const cam = PermissionsAndroid.PERMISSIONS.CAMERA;
  const mic = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
  const bt =
    Platform.Version >= 31
      ? PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
      : null;

  const need: string[] = [];
  if (!(await checkOne(cam))) need.push(cam);
  if (!(await checkOne(mic))) need.push(mic);

  // BT: only if caller asks AND we have never asked before (don't spam every Start)
  if (opts?.requestBluetooth && bt) {
    let asked = false;
    try {
      asked = (await AsyncStorage.getItem(BT_ASKED_KEY)) === "1";
    } catch {
      asked = false;
    }
    if (!asked && !(await checkOne(bt))) {
      need.push(bt);
      try {
        await AsyncStorage.setItem(BT_ASKED_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  }

  if (need.length) {
    try {
      await PermissionsAndroid.requestMultiple(
        need as (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS][]
      );
    } catch {
      /* user dismissed */
    }
  }

  let camera = await checkOne(cam);
  let micOk = await checkOne(mic);

  // Only re-prompt individually if still missing (never loop on NEVER_ASK_AGAIN)
  if (!camera || !micOk) {
    try {
      if (!camera) {
        const r = await PermissionsAndroid.request(cam, {
          title,
          message,
          buttonPositive: "Allow",
          buttonNegative: "Not now",
        });
        camera =
          r === PermissionsAndroid.RESULTS.GRANTED ||
          r === "granted";
        // If permanently denied, stop — Settings is the only path
        if (
          r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
          r === "never_ask_again"
        ) {
          /* leave camera false */
        }
      }
      if (!micOk) {
        const r = await PermissionsAndroid.request(mic, {
          title,
          message,
          buttonPositive: "Allow",
          buttonNegative: "Not now",
        });
        micOk =
          r === PermissionsAndroid.RESULTS.GRANTED || r === "granted";
      }
    } catch {
      /* ignore */
    }
  }

  const bluetooth = bt ? await checkOne(bt) : true;
  const result: MediaPermissionResult = {
    camera,
    mic: micOk,
    bluetooth,
    allGranted: camera && micOk,
  };
  if (result.allGranted) cached = result;
  else cached = null;
  return result;
}

/** Drop in-memory cache (e.g. after returning from Settings). */
export function clearMediaPermissionCache(): void {
  cached = null;
}
