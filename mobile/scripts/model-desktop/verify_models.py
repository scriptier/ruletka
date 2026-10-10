#!/usr/bin/env python3
"""Desktop check for the two bundled .tflite files.

Confirms input shape, the normalization each model was given, and the
output layout on images that are not explicit: a clothed portrait and a
black frame. Exits 1 when a check fails.

Python 3.12 has no tflite-runtime wheel. This uses ai-edge-litert, the
TensorFlow Lite interpreter package, from the venv only:

  ~/rustore-ru-work/venv-ml/bin/python3 mobile/scripts/model-desktop/verify_models.py

Do not point this at explicit images. Do not install into system Python.
"""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

import numpy as np
from PIL import Image

try:
    from ai_edge_litert.interpreter import Interpreter
except ImportError:
    sys.exit(
        "ai-edge-litert is missing. Run this with ~/rustore-ru-work/venv-ml."
    )

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / "assets" / "models"
FIXTURES = Path(__file__).resolve().parent / "fixtures"

NSFW_SHA = "380f98f7685f9d8a386f8cc595b6dfcb972989aae3d1b8b270d3a4a5b96fab40"
FACE_SHA = "b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f"
NSFW_LABELS = ("drawings", "hentai", "neutral", "porn", "sexy")

failures = []


def check(name: str, ok: bool, detail: str = "") -> None:
    line = f"{'ok' if ok else 'FAIL'}  {name}"
    if detail:
        line = f"{line}  {detail}"
    print(line)
    if not ok:
        failures.append(line)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def prep(img: Image.Image, edge: int, mode: str) -> np.ndarray:
    arr = np.asarray(img.resize((edge, edge), Image.BILINEAR)).astype(np.float32)
    if mode == "div255":
        arr = arr / 255.0
    elif mode == "minus1_1":
        arr = (arr / 127.5) - 1.0
    elif mode == "raw":
        pass
    else:
        raise ValueError(mode)
    return arr.reshape(1, edge, edge, 3)


def sigmoid(values: np.ndarray) -> np.ndarray:
    clipped = np.clip(values, -50.0, 50.0)
    return 1.0 / (1.0 + np.exp(-clipped))


def load(path: Path) -> Interpreter:
    itp = Interpreter(model_path=str(path))
    itp.allocate_tensors()
    return itp


def run(itp: Interpreter, tensor: np.ndarray) -> dict:
    inp = itp.get_input_details()[0]
    itp.set_tensor(inp["index"], tensor)
    itp.invoke()
    return {
        d["name"]: itp.get_tensor(d["index"]).copy()
        for d in itp.get_output_details()
    }


def main() -> int:
    face_path = MODELS / "blaze_face_short_range.tflite"
    nsfw_path = MODELS / "nsfw_mobilenet_v2.tflite"
    portrait = Image.open(FIXTURES / "face-neutral.jpg").convert("RGB")
    blank = Image.open(FIXTURES / "blank.png").convert("RGB")
    gray = Image.new("RGB", (64, 64), (128, 128, 128))

    check("face sha256", sha256(face_path) == FACE_SHA, FACE_SHA)
    check("nsfw sha256", sha256(nsfw_path) == NSFW_SHA, NSFW_SHA)

    face = load(face_path)
    nsfw = load(nsfw_path)
    face_in = face.get_input_details()[0]
    nsfw_in = nsfw.get_input_details()[0]
    face_outs = {d["name"]: tuple(int(x) for x in d["shape"]) for d in face.get_output_details()}
    nsfw_outs = {d["name"]: tuple(int(x) for x in d["shape"]) for d in nsfw.get_output_details()}

    print("face input", face_in["name"], tuple(int(x) for x in face_in["shape"]), face_in["dtype"])
    print("face outputs", face_outs)
    print("nsfw input", nsfw_in["name"], tuple(int(x) for x in nsfw_in["shape"]), nsfw_in["dtype"])
    print("nsfw outputs", nsfw_outs)

    check(
        "face input 1x128x128x3 float32",
        tuple(int(x) for x in face_in["shape"]) == (1, 128, 128, 3)
        and face_in["dtype"] == np.float32
        and face_in["quantization"] == (0.0, 0),
    )
    check(
        "face tensors classificators 896x1 and regressors 896x16",
        face_outs.get("classificators") == (1, 896, 1)
        and face_outs.get("regressors") == (1, 896, 16),
    )
    check(
        "nsfw input 1x224x224x3 float32",
        tuple(int(x) for x in nsfw_in["shape"]) == (1, 224, 224, 3)
        and nsfw_in["dtype"] == np.float32
        and nsfw_in["quantization"] == (0.0, 0),
    )
    check("nsfw output Identity 1x5", nsfw_outs.get("Identity") == (1, 5))

    def face_max(img: Image.Image, mode: str) -> tuple[float, float]:
        raw = run(face, prep(img, 128, mode))["classificators"].reshape(-1)
        return float(raw.max()), float(sigmoid(raw).max())

    def nsfw_vec(img: Image.Image, mode: str) -> np.ndarray:
        return run(nsfw, prep(img, 224, mode))["Identity"].reshape(-1)

    print("--- face (sigmoid of classificators) ---")
    face_scores = {}
    for label, img in ("portrait", portrait), ("blank", blank), ("gray", gray):
        for mode in ("div255", "minus1_1", "raw"):
            raw_max, sig_max = face_max(img, mode)
            face_scores[(label, mode)] = (raw_max, sig_max)
            print(f"  {label:9} {mode:9} raw_max {raw_max:10.3f}  sigmoid_max {sig_max:.4f}")

    # App helper rgbToSquareFloat divides by 255. MediaPipe's card uses [-1, 1].
    # Both separate this portrait from blank and gray. Raw 0..255 does not.
    check("face portrait /255 present", face_scores[("portrait", "div255")][1] >= 0.75)
    check("face blank /255 absent", face_scores[("blank", "div255")][1] < 0.15)
    check("face gray /255 absent", face_scores[("gray", "div255")][1] < 0.15)
    check("face portrait [-1,1] present", face_scores[("portrait", "minus1_1")][1] >= 0.75)
    check("face blank [-1,1] absent", face_scores[("blank", "minus1_1")][1] < 0.15)
    check(
        "face portrait raw 0..255 is not a detection",
        face_scores[("portrait", "raw")][1] < 0.15,
    )
    check(
        "face portrait score is a logit above 1",
        face_scores[("portrait", "div255")][0] > 1.0,
    )

    print("--- nsfw Identity[1,5] drawings,hentai,neutral,porn,sexy ---")
    vectors = {}
    for label, img in ("portrait", portrait), ("blank", blank), ("gray", gray):
        for mode in ("div255", "minus1_1", "raw"):
            vec = nsfw_vec(img, mode)
            vectors[(label, mode)] = vec
            top = NSFW_LABELS[int(np.argmax(vec))]
            shown = ", ".join(f"{n}={v:.4f}" for n, v in zip(NSFW_LABELS, vec))
            print(f"  {label:9} {mode:9} sum={float(vec.sum()):.4f} top={top}  {shown}")

    def assert_nsfw(label: str, mode: str, porn_max: float, hentai_max: float, sexy_max: float, neutral_min: float | None) -> None:
        vec = vectors[(label, mode)]
        porn, hentai, sexy = float(vec[3]), float(vec[1]), float(vec[4])
        check(
            f"nsfw {label} {mode} is a probability vector",
            abs(float(vec.sum()) - 1.0) < 0.01 and float(vec.min()) >= -1e-4 and float(vec.max()) <= 1.01,
        )
        check(f"nsfw {label} {mode} porn < {porn_max}", porn < porn_max, f"porn={porn:.4f}")
        check(f"nsfw {label} {mode} hentai < {hentai_max}", hentai < hentai_max, f"hentai={hentai:.4f}")
        check(f"nsfw {label} {mode} sexy < {sexy_max}", sexy < sexy_max, f"sexy={sexy:.4f}")
        if neutral_min is not None:
            neutral = float(vec[2])
            check(
                f"nsfw {label} {mode} neutral > {neutral_min}",
                neutral > neutral_min and int(np.argmax(vec)) == 2,
                f"neutral={neutral:.4f}",
            )

    # Official nsfw_detector/predict.py divides by 255 and reads these five
    # classes in this order. The file already applies softmax (the five
    # values sum to 1). Do not softmax again.
    assert_nsfw("portrait", "div255", 0.01, 0.01, 0.01, 0.99)
    assert_nsfw("blank", "div255", 0.05, 0.35, 0.05, None)
    assert_nsfw("gray", "div255", 0.05, 0.35, 0.05, None)
    assert_nsfw("portrait", "minus1_1", 0.05, 0.05, 0.05, 0.95)

    print(f"\n{len(failures)} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
