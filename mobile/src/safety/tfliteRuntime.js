/**
 * Optional TFLite runtime. This file is safe to load in Node: the native
 * package is not installed, so createTfliteBackedDetector stays on the stub.
 *
 * A device build still needs, before it can run a model:
 * - npm install of react-native-fast-tflite (not done here)
 * - expo prebuild and patch-android-native.sh (not run here)
 * - Metro assetExts includes tflite (set in metro.config.js on this branch)
 *
 * NSFW weights are not in the repo. classify reports nsfw "unknown" until
 * mobile/assets/models/nsfw_mobilenet_v2.tflite exists and is loaded below.
 */

import {
  faceFromOutputs,
  inputEdge,
  nsfwFromFive,
  rgbToSquareFloat,
} from "./tfliteDecode.js";

function loadOptional(name) {
  try {
    if (typeof require !== "function") return null;
    return require(name);
  } catch {
    return null;
  }
}

function stubDetector() {
  return {
    id: "stub",
    requested: "tflite",
    ready: false,
    classify() {
      return Promise.resolve({
        face: "unknown",
        nsfw: "unknown",
        model: "stub",
      });
    },
  };
}

function decodeRgbBase64(b64) {
  if (!b64 || typeof b64 !== "string") return null;
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  if (typeof atob !== "function") return null;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 255;
  return out;
}

async function runModel(model, input) {
  const raw = await model.run([input]);
  const list = Array.isArray(raw) ? raw : [raw];
  const specs = model.outputs || [];
  return list.map((buf, i) => ({
    name: specs[i]?.name || "",
    shape: specs[i]?.shape || [],
    data: buf instanceof Float32Array ? buf : new Float32Array(buf),
  }));
}

function createLiveDetector(loadTensorflowModel) {
  let faceModel = null;
  let ready = false;
  const boot = (async () => {
    try {
      const asset = require("../../assets/models/blaze_face_short_range.tflite");
      const loaded = await loadTensorflowModel(asset);
      if (!inputEdge(loaded)) return;
      faceModel = loaded;
      ready = true;
    } catch {
      faceModel = null;
      ready = false;
    }
  })();

  return {
    id: "tflite",
    requested: "tflite",
    get ready() {
      return ready;
    },
    async classify(frame) {
      await boot;
      if (!ready || !faceModel || !frame || !frame.rgbBase64) {
        return {
          face: "unknown",
          nsfw: "unknown",
          model: ready ? "tflite" : "stub",
        };
      }
      try {
        const rgb = decodeRgbBase64(frame.rgbBase64);
        const edge = inputEdge(faceModel);
        const input = rgbToSquareFloat(rgb, frame.width, frame.height, edge);
        if (!input) {
          return { face: "unknown", nsfw: "unknown", model: "tflite" };
        }
        const outputs = await runModel(faceModel, input);
        const face = faceFromOutputs(outputs);
        // No NSFW weights in the repo. Passing null keeps nsfw unknown.
        const nsfw = nsfwFromFive(null).nsfw;
        return { face, nsfw, model: "tflite" };
      } catch {
        return { face: "unknown", nsfw: "unknown", model: "tflite" };
      }
    },
  };
}

export function createTfliteBackedDetector() {
  const native = loadOptional("react-native-fast-tflite");
  const load = native && native.loadTensorflowModel;
  if (typeof load !== "function") return stubDetector();
  return createLiveDetector(load);
}

function loadTap() {
  const rn = loadOptional("react-native");
  const tap = rn && rn.NativeModules && rn.NativeModules.RuletkaFrameTap;
  if (!tap || typeof tap.attach !== "function") return null;
  return { rn, tap };
}

function trackPcId(track) {
  if (!track) return -1;
  if (track.remote) {
    const n = Number(track._peerConnectionId);
    return Number.isFinite(n) ? n : -1;
  }
  return -1;
}

/**
 * Copy 224 px RGB frames from a WebRTC video track.
 * No-op when the Kotlin module is absent (no timer).
 * latest() is null until a frame arrives — callers must treat that as unknown.
 */
export function watchVideoFrames(getStream) {
  const loaded = loadTap();
  if (!loaded) return { stop() {}, latest() { return null; } };
  const { rn, tap } = loaded;
  let currentId = "";
  let last = null;
  let sub = null;
  const detach = () => {
    if (sub) {
      sub.remove();
      sub = null;
    }
    if (currentId) {
      try {
        tap.detach(currentId);
      } catch {
        /* module gone */
      }
    }
    currentId = "";
  };
  const timer = setInterval(() => {
    let track = null;
    try {
      const stream = typeof getStream === "function" ? getStream() : null;
      const tracks = stream && stream.getVideoTracks ? stream.getVideoTracks() : [];
      track = tracks && tracks[0] ? tracks[0] : null;
    } catch {
      track = null;
    }
    const id = track && track.id ? String(track.id) : "";
    if (id === currentId) return;
    detach();
    last = null;
    if (!id) return;
    currentId = id;
    const Emitter = rn.NativeEventEmitter;
    if (typeof Emitter === "function") {
      sub = new Emitter(tap).addListener("RuletkaFrameTap", (ev) => {
        if (!ev || ev.trackId !== id || !ev.rgbBase64) return;
        last = {
          rgbBase64: String(ev.rgbBase64),
          width: Number(ev.width) || 0,
          height: Number(ev.height) || 0,
        };
      });
    }
    try {
      tap.attach(trackPcId(track), id, 224, 2000);
    } catch {
      detach();
    }
  }, 500);
  return {
    stop() {
      clearInterval(timer);
      detach();
    },
    latest() {
      return last;
    },
  };
}
