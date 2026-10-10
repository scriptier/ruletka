# On-device models (polish/ml-native)

Code and files only. Nothing on this branch was prebuilt, installed as an app, or run on a phone.

## What is in this folder

| File | Status |
|---|---|
| `blaze_face_short_range.tflite` | Present. 229746 bytes. sha256 `b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f`. Flatbuffer id `TFL3`. Downloaded 2026-10-10 from `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`. |
| `LICENSE-blazeface-apache-2.0.txt` | Apache-2.0 text from `google-ai-edge/mediapipe` `LICENSE`. |
| `LICENSE-nsfw-model.md` | MIT text from `GantMan/nsfw_model` `LICENSE.md` (fetched 2026-10-10). That file says some third-party material is under other licenses. |
| `nsfw_mobilenet_v2.tflite` | Present. 17355548 bytes. sha256 `380f98f7685f9d8a386f8cc595b6dfcb972989aae3d1b8b270d3a4a5b96fab40`. Flatbuffer id `TFL3`. |

NudeNet is AGPL. It is not in this folder and must not be shipped inside the app.

## NSFW source

Official release asset, not a third-party conversion:

- Page: `https://github.com/GantMan/nsfw_model/releases/tag/1.2.0`
- File: `https://github.com/GantMan/nsfw_model/releases/download/1.2.0/mobilenet_v2_140_224.1.zip`
- Zip sha256: `22c0892695929639c16ea302996b8f64df9c52e7a6c1d874c1de1047bfe109f7` (100619093 bytes)
- Member: `mobilenet_v2_140_224/saved_model.tflite` (the sha256 above)
- Labels in that zip, in order: `drawings`, `hentai`, `neutral`, `porn`, `sexy`
- License: MIT (`LICENSE-nsfw-model.md`)

The h5, frozen graph, SavedModel variables, and TFJS shards from the zip were not committed.

`nsfw_detector/predict.py` at tag 1.2.0 resizes to 224 and divides by 255. It reads `model.predict` directly as probabilities in the label order above. It does not apply a second softmax.

## Desktop check (2026-10-10)

Interpreter: `ai-edge-litert` 2.3.0 in `~/rustore-ru-work/venv-ml` (Python 3.12). PyPI has no `tflite-runtime` wheel for this interpreter. System Python was not changed. Script: `mobile/scripts/model-desktop/verify_models.py`. Images: `fixtures/face-neutral.jpg` (generated clothed adult portrait, not a real person) and `fixtures/blank.png` (64×64 RGB 0,0,0). No explicit image was downloaded or stored.

Both files are float32 with quantization scale 0.

| Model | Input | Outputs |
|---|---|---|
| BlazeFace | `input` `[1,128,128,3]` | `classificators` `[1,896,1]` logits, `regressors` `[1,896,16]` boxes |
| NSFW MobileNetV2 | `input` `[1,224,224,3]` | `Identity` `[1,5]` probabilities, already summing to 1 |

Face scores are logits. The winning portrait score is about 2.0, so it is not a probability. Apply a sigmoid, then compare with 0.5. The JS helper does that when a value is outside 0..1. The score tensor is named `classificators`. A name match on `scores` alone would miss it. `faceFromOutputs` also accepts `classificat` and a last dimension of 1. `regressors` is ignored.

Normalization tried on the portrait, the blank frame, and a flat gray frame:

| Input | Face sigmoid max, portrait / blank | NSFW portrait (neutral, porn, hentai, sexy) |
|---|---|---|
| divide by 255 | 0.880 / 0.054 | 0.9995, 0.0005, 0.0000, 0.0000 |
| `(pixel / 127.5) - 1` | 0.939 / 0.008 | 0.9983, 0.0000, 0.0001, 0.0005 |
| raw 0..255 | 0.000 / 0.054 | 0.7094, 0.0007, 0.0113, 0.0003 |

Divide-by-255 is what the app helper `rgbToSquareFloat` does, and what the NSFW Python loader does. On these images it marks the portrait present and the blank frame absent, and the portrait is neutral. The MediaPipe `[-1, 1]` norm also separates the face and keeps the portrait neutral. It was not switched in, because one helper feeds both models and divide-by-255 already passes. Raw 0..255 produces no face detection.

Blank frame, divide by 255: drawings 0.288, hentai 0.201, neutral 0.490, porn 0.015, sexy 0.006. Porn and sexy are low. Hentai is 0.20, which is under the explicit gate of 0.78, so the frame stays `clean`. A black frame is not a photo of a person. Gray (128,128,128) tops out as drawings 0.552 with porn 0.0045 and sexy 0.006.

Do not softmax the NSFW vector again. Indexes used by `nsfwFromFive`: hentai 1, neutral 2, porn 3, sexy 4.

## How the app is supposed to use them

- `react-native-fast-tflite` is **not** in `package.json` and was not installed. `createSafetyDetector("tflite")` stays the stub (`id: "stub"`, `ready: false`) until that package is present and the face model loads. Node tests cover that fallback.
- `tfliteRuntime.js` requires both `.tflite` files so Metro can bundle them. Only the face file is passed to `loadTensorflowModel`. `classify` still returns nsfw `"unknown"`.
- Metro on this branch accepts `.tflite` assets (`mobile/metro.config.js`).
- Frames: `mobile/android-patches/RuletkaFrameTapModule.kt` attaches an `org.webrtc.VideoSink` to a `VideoTrack` from `WebRTCModule.getTrack`. It emits a square RGB frame at most every 2 s on `RuletkaFrameTap`. The I420 → RGB and rotation math is `I420Rgb.sampleSquare`. `I420RgbTest.kt` checks that math on a desktop JVM (kotlinc 2.3.10, no Android SDK). The WebRTC plane copy has not been checked on a device. `mobile/scripts/patch-android-native.sh` copies the module, the helper, and the package after prebuild. The script was not run. There is no `mobile/android/` tree.
- `mobile/app/live.tsx` asks the tap for the local preview before a match and for the remote track during a match. No frame means `classify` sees null and returns `unknown`. Unknown does not show the missing-face hint and does not blur.
- The tap emits 224×224. The face model wants 128×128. `rgbToSquareFloat` resizes. NSFW, when it is loaded later, wants 224×224 and divide-by-255.

## Untested (do not treat as working)

- No `expo prebuild`, no Gradle, no APK, no `npm install`.
- The frame-tap module has not been compiled. `VideoSink` has not been attached to a real track. The JVM test does not see a camera buffer.
- `react-native-fast-tflite` `loadTensorflowModel` / `run` was not called. If that package reports a different shape, the loader refuses and the detector stays not ready.
- Base64 of a 224×224 RGB frame is about 200 KB every 2 seconds. That cost was not measured on a phone.
- Shirtless is not its own class. Sexy only blurs. Explicit asks skip or report.
- Hub `safety_log` is still not sent. `HUB_ACCEPTS_SAFETY_LOG` is false on this branch. The other branch already sends it. A merge should keep that flag true.

Anton decides when to install the native package, prebuild, and build an APK.
