// node ui/genital-guard.test.mjs — pure logic of the genital guard, stubbed model output.
// No real imagery: detector outputs are synthetic tensors.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const G = require("./genital-guard.js");

const N = 2100;
const C = G.LABELS.length;
function tensor(anchors) {
  const data = new Float32Array((4 + C) * N);
  anchors.forEach((a, i) => {
    data[i] = a.cx;
    data[N + i] = a.cy;
    data[2 * N + i] = a.w;
    data[3 * N + i] = a.h;
    for (const [c, s] of Object.entries(a.scores)) data[(4 + Number(c)) * N + i] = s;
  });
  return { data, dims: [1, 4 + C, N] };
}

// labels / classes
assert.equal(C, 18);
assert.equal(G.LABELS[4], "FEMALE_GENITALIA_EXPOSED");
assert.equal(G.LABELS[14], "MALE_GENITALIA_EXPOSED");
assert.deepEqual(G.GENITAL_CLASSES, [4, 14]);

// letterbox 640x480 → scale 0.5, 320x240
const lb = G.letterbox(640, 480);
assert.equal(lb.scale, 0.5);
assert.equal(lb.w, 320);
assert.equal(lb.h, 240);

// rgba → NCHW
const rgba = new Uint8ClampedArray(2 * 2 * 4);
rgba.set([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 51, 102, 153, 255]);
const t = G.rgbaToTensorData(rgba, 2);
assert.equal(t[0], 1);
assert.equal(t[4 + 1], 1);
assert.equal(t[8 + 2], 1);
assert.ok(Math.abs(t[3] - 0.2) < 1e-6 && Math.abs(t[8 + 3] - 0.6) < 1e-6);

// empty output → score 0
let d = G.decodeGenitals(tensor([]).data, [1, 22, N], 640, 480);
assert.equal(d.score, 0);
assert.equal(d.box, null);

// strong male genital box, letterbox coords (320 space) → source fractions
let o = tensor([{ cx: 160, cy: 120, w: 40, h: 40, scores: { 14: 0.81 } }]);
d = G.decodeGenitals(o.data, o.dims, 640, 480);
assert.equal(d.cls, "MALE_GENITALIA_EXPOSED");
assert.ok(Math.abs(d.score - 0.81) < 1e-6);
assert.ok(Math.abs(d.box[0] - 280 / 640) < 1e-6 && Math.abs(d.box[2] - 80 / 640) < 1e-6);
assert.equal(d.boxes.length, 1);

// genital not the anchor's top class (covered wins) → ignored
o = tensor([{ cx: 160, cy: 120, w: 40, h: 40, scores: { 14: 0.5, 13: 0.7 } }]);
assert.equal(G.decodeGenitals(o.data, o.dims, 640, 480).score, 0);

// tiny box below MIN_BOX_FRAC → ignored
o = tensor([{ cx: 160, cy: 120, w: 4, h: 4, scores: { 4: 0.9 } }]);
assert.equal(G.decodeGenitals(o.data, o.dims, 640, 480).score, 0);

// face / breast only → no genital score
o = tensor([
  { cx: 100, cy: 80, w: 60, h: 60, scores: { 1: 0.9 } },
  { cx: 160, cy: 160, w: 80, h: 60, scores: { 3: 0.8 } },
]);
assert.equal(G.decodeGenitals(o.data, o.dims, 640, 480).score, 0);

// best of several, boxes sorted
o = tensor([
  { cx: 100, cy: 100, w: 40, h: 40, scores: { 4: 0.45 } },
  { cx: 200, cy: 150, w: 40, h: 40, scores: { 14: 0.7 } },
]);
d = G.decodeGenitals(o.data, o.dims, 640, 480);
assert.ok(Math.abs(d.score - 0.7) < 1e-6);
assert.ok(d.boxes[0].score >= d.boxes[1].score);

// verdicts
const v = G.frameVerdict;
assert.equal(v({ score: 0.65 }, {}).hit, true);
assert.equal(v({ score: 0.65 }, {}).kind, "detector");
assert.equal(v({ score: 0.45 }, { porn: 0.3 }).hit, false);
assert.equal(v({ score: 0.45 }, { porn: 0.4, hentai: 0.2 }).hit, true);
assert.equal(v({ score: 0.1 }, { porn: 0.99 }).hit, false, "detector running: nsfwjs alone never counts as genitals");
assert.equal(v(null, { porn: 0.91 }).hit, false);
assert.equal(v(null, { porn: 0.95 }).hit, true);
assert.equal(v(null, { porn: 0.95 }).kind, "porn_only");

// 2 of 3
const cf = G.makeConfirm();
assert.equal(cf.push(true).confirmed, false);
assert.equal(cf.push(false).confirmed, false);
assert.equal(cf.push(true).confirmed, true);
cf.reset();
assert.equal(cf.push(true).confirmed, false);
assert.equal(cf.push(false).confirmed, false);
assert.equal(cf.push(false).confirmed, false);
assert.equal(cf.push(true).confirmed, false, "true,false,false,true: window of 3 holds only one");
assert.equal(cf.push(true).confirmed, true);

// detect() with a fake session (no DOM canvas in node → stub document)
globalThis.document = {
  createElement() {
    return {
      width: 0,
      height: 0,
      getContext() {
        return {
          fillRect() {},
          drawImage() {},
          getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        };
      },
    };
  },
};
globalThis.ort = { Tensor: class { constructor(type, data, dims) { Object.assign(this, { type, data, dims }); } } };
const fake = tensor([{ cx: 160, cy: 120, w: 40, h: 40, scores: { 4: 0.77 } }]);
let fed = null;
G._setSession({
  inputNames: ["images"],
  outputNames: ["output0"],
  async run(feeds) {
    fed = feeds.images;
    return { output0: fake };
  },
});
assert.equal(G.ready, true);
const r = await G.detect({ videoWidth: 640, videoHeight: 480 });
assert.deepEqual(fed.dims, [1, 3, 320, 320]);
assert.equal(r.cls, "FEMALE_GENITALIA_EXPOSED");
assert.ok(r.ms >= 0);
assert.equal(await G.detect({ videoWidth: 0, videoHeight: 0 }), null);
G._setSession(null);
assert.equal(await G.detect({ videoWidth: 640, videoHeight: 480 }), null);

console.log("genital-guard.test.mjs OK");
