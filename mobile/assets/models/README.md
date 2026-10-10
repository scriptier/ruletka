# On-device models (polish/ml-native)

Code and files only. Nothing on this branch was prebuilt, installed, or run on a phone.

## What is in this folder

| File | Status |
|---|---|
| `blaze_face_short_range.tflite` | Present. 229746 bytes. Flatbuffer id `TFL3`. Downloaded 2026-10-10 from `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`. MediaPipe short-range face detector. |
| `LICENSE-blazeface-apache-2.0.txt` | Apache-2.0 text from `google-ai-edge/mediapipe` `LICENSE`. |
| `LICENSE-nsfw-model.md` | MIT text from `GantMan/nsfw_model` `LICENSE.md` (fetched 2026-10-10). That file says some third-party material is under other licenses. |
| `nsfw_mobilenet_v2.tflite` | **Absent.** No official TFLite file was published at a URL this pass could verify. Do not drop in a random conversion. Expected input 224×224 RGB, output length 5 in nsfwjs order: drawing, hentai, neutral, porn, sexy. |

NudeNet is AGPL. It is not in this folder and must not be shipped inside the app.

## How the app is supposed to use them

- `react-native-fast-tflite` is **not** in `package.json` and was not installed. `createSafetyDetector("tflite")` stays the stub (`id: "stub"`, `ready: false`) until that package is present and the face model loads. Node tests cover that fallback.
- Metro on this branch accepts `.tflite` assets (`mobile/metro.config.js`).
- Frames: `mobile/android-patches/RuletkaFrameTapModule.kt` attaches an `org.webrtc.VideoSink` to a `VideoTrack` from `WebRTCModule.getTrack`. It emits a 224 px RGB JPEG-less base64 frame at most every 2 s on `RuletkaFrameTap`. `mobile/scripts/patch-android-native.sh` copies it next to the shortcuts module after prebuild and registers `RuletkaFrameTapPackage`. The script was not run. There is no `mobile/android/` tree.
- `mobile/app/live.tsx` asks the tap for the local preview before a match and for the remote track during a match. No frame means `classify` sees null and returns `unknown`. Unknown does not show the missing-face hint and does not blur.
- Face decision: only a tensor named like `scores`, or a tensor whose last dimension is 1. Max score ≥ 0.5 (probability, or sigmoid if the value is outside 0..1) means a face is present. A box tensor is ignored. The model card strings say outputs are `scores` and undecoded boxes. The numeric layout was **not** read with a TFLite interpreter (none is installed).
- NSFW path returns `unknown` until the missing file is added and wired. The 5-class gates are in `tfliteDecode.js` and match `classifyScores`.

## Untested (do not treat as working)

- No `expo prebuild`, no Gradle, no APK, no `npm install`.
- Kotlin has not been compiled. `VideoSink` has not been attached to a real track.
- I420 → RGB, stride, and the 0/90/180/270 rotation map have not been compared to a camera frame. A bad conversion feeds the model garbage.
- `react-native-fast-tflite` `loadTensorflowModel` / `run([input])` / `inputs[].shape` / `outputs[].name` was not called. If the installed version uses a different shape, the loader refuses (`inputEdge` returns null) and the detector stays not ready.
- The face score threshold was not checked against this file's real outputs. A wrong scale would mark every preview "no face" or never mark it.
- Base64 of a 224×224 RGB frame is about 200 KB every 2 seconds. That cost was not measured on a phone.
- NSFW weights, class order on a real TFLite file, and shirtless-vs-explicit were not run. Shirtless is not its own class.
- Hub `safety_log` is still not sent. `HUB_ACCEPTS_SAFETY_LOG` is false on this branch.

Anton decides when to install the native package, prebuild, and build an APK.
