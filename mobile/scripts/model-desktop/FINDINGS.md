# Desktop model check — 2026-10-10

Re-run:

```bash
~/rustore-ru-work/venv-ml/bin/python3 mobile/scripts/model-desktop/verify_models.py
```

Python 3.12. PyPI has no `tflite-runtime` build for it. The venv has `ai-edge-litert` 2.3.0 (TensorFlow Lite interpreter), Pillow, and NumPy. System Python was not changed. The script exited 0.

Fixtures, both not explicit:

- `fixtures/face-neutral.jpg` — generated clothed adult portrait. Not a real person.
- `fixtures/blank.png` — 64×64 RGB black.
- A flat gray frame is built in the script (128,128,128). It is not a file.

## Files

- Face: `blaze_face_short_range.tflite`, 229746 bytes, sha256 `b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f`.
- NSFW: `nsfw_mobilenet_v2.tflite`, 17355548 bytes, sha256 `380f98f7685f9d8a386f8cc595b6dfcb972989aae3d1b8b270d3a4a5b96fab40`.
- NSFW zip: `https://github.com/GantMan/nsfw_model/releases/download/1.2.0/mobilenet_v2_140_224.1.zip`, sha256 `22c0892695929639c16ea302996b8f64df9c52e7a6c1d874c1de1047bfe109f7`, member `mobilenet_v2_140_224/saved_model.tflite`.
- Label order in the release: drawings, hentai, neutral, porn, sexy.

## Shapes (float32, no quantization)

- Face input `input` `[1,128,128,3]`. Outputs `classificators` `[1,896,1]` and `regressors` `[1,896,16]`.
- NSFW input `input` `[1,224,224,3]`. Output `Identity` `[1,5]`. The five values sum to 1. They are already probabilities.

## Face

Scores are logits. Sigmoid, then 0.5.

| Norm | Portrait sigmoid max | Blank | Gray |
|---|---|---|---|
| `/255` | 0.880 (present) | 0.054 (absent) | 0.032 (absent) |
| `(x/127.5)-1` | 0.939 (present) | 0.008 (absent) | 0.044 (absent) |
| raw 0..255 | 0.000 (absent) | 0.054 | 0.000 |

`/255` is what `rgbToSquareFloat` writes. `[-1, 1]` is the usual MediaPipe input and also separates these images. Raw bytes do not detect the portrait. The score tensor name is `classificators`, not `scores`.

## NSFW (`/255`, the official loader)

Portrait: neutral 0.9995, porn 0.0005, hentai 0, sexy 0.

Blank: neutral 0.490, drawings 0.288, hentai 0.201, porn 0.015, sexy 0.006. Under the explicit gate (porn 0.72, hentai 0.78). Not a face.

Gray: drawings 0.552, neutral 0.303, hentai 0.135, porn 0.0045, sexy 0.006.

`[-1, 1]` on the portrait is also neutral 0.9983 with porn 0. Do not run softmax a second time.

## I420 helper

`mobile/android-patches/I420RgbTest.kt` compiled with kotlinc-jvm 2.3.10 and `java -jar` printed `0 failed` (rotation 0/90/180/270, stride padding, BT.601, clamp). No prebuild and no APK. The WebRTC buffer copy is still unchecked on a device.
