/**
 * Pure tensor helpers for the on-device detector.
 * No native module. Node tests cover these. Device output is untested.
 *
 * Face scores follow the bundled BlazeFace file: the tensor is named
 * "classificators" (shape 1×896×1), not "scores". A tensor whose last
 * dimension is 1 is the same fallback. "regressors" (1×896×16) is boxes.
 * Anything else is unknown, which must not raise the missing-face hint.
 * Values inside 0..1 are treated as probabilities. Values outside that
 * range are logits and pass through a sigmoid. Desktop check: the winning
 * score on a portrait is above 1, so it is a logit.
 *
 * NSFW class order, when a 5-vector exists, matches the bundled file's
 * class_labels.txt and nsfw_detector/predict.py:
 * drawings, hentai, neutral, porn, sexy. The vector is already
 * probabilities (it sums to 1). Do not softmax it again. The numeric
 * gates match classifyScores. Input floats are pixel/255.
 */

export const FACE_SCORE_THRESHOLD = 0.5;

export function inputEdge(model) {
  const shape = model?.inputs?.[0]?.shape;
  if (!Array.isArray(shape) || shape.length < 3) return null;
  const h = Number(shape[shape.length - 3]);
  const w = Number(shape[shape.length - 2]);
  const c = Number(shape[shape.length - 1]);
  if (c !== 3 || h !== w || h < 32 || h > 320) return null;
  return h;
}

/** Nearest-neighbor square resize. RGB bytes in, float 0..1 out. */
export function rgbToSquareFloat(rgb, srcW, srcH, edge) {
  const w = Number(srcW) || 0;
  const h = Number(srcH) || 0;
  const dst = Number(edge) || 0;
  if (!rgb || w < 1 || h < 1 || dst < 1) return null;
  if (rgb.length < w * h * 3) return null;
  const out = new Float32Array(dst * dst * 3);
  for (let y = 0; y < dst; y++) {
    const sy = Math.min(h - 1, Math.floor(((y + 0.5) * h) / dst));
    for (let x = 0; x < dst; x++) {
      const sx = Math.min(w - 1, Math.floor(((x + 0.5) * w) / dst));
      const si = (sy * w + sx) * 3;
      const di = (y * dst + x) * 3;
      out[di] = rgb[si] / 255;
      out[di + 1] = rgb[si + 1] / 255;
      out[di + 2] = rgb[si + 2] / 255;
    }
  }
  return out;
}

function asProbability(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n >= 0 && n <= 1) return n;
  return 1 / (1 + Math.exp(-n));
}

export function faceFromOutputs(outputs) {
  if (!Array.isArray(outputs) || outputs.length === 0) return "unknown";
  const named = outputs.find((o) => /score|classificat/i.test(String(o?.name || "")));
  const last1 = outputs.find((o) => {
    const shape = o?.shape;
    return Array.isArray(shape) && shape[shape.length - 1] === 1;
  });
  const picked = named || last1;
  const data = picked?.data;
  if (!data || typeof data.length !== "number" || data.length < 1) {
    return "unknown";
  }
  let max = -1;
  for (let i = 0; i < data.length; i++) {
    const p = asProbability(data[i]);
    if (p == null) return "unknown";
    if (p > max) max = p;
  }
  if (max < 0) return "unknown";
  return max >= FACE_SCORE_THRESHOLD ? "present" : "absent";
}

/** drawings, hentai, neutral, porn, sexy. Wrong length → unknown. */
export function nsfwFromFive(values) {
  if (!values || values.length !== 5) return { nsfw: "unknown" };
  const porn = Number(values[3]);
  const hentai = Number(values[1]);
  const sexy = Number(values[4]);
  if (![porn, hentai, sexy, Number(values[0]), Number(values[2])].every(Number.isFinite)) {
    return { nsfw: "unknown" };
  }
  let nsfw = "clean";
  if (porn >= 0.72 || hentai >= 0.78 || (porn >= 0.55 && sexy >= 0.5)) {
    nsfw = "explicit";
  } else if (sexy >= 0.62) nsfw = "sexy";
  return { nsfw, scores: { porn, hentai, sexy } };
}
