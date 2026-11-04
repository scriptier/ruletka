/**
 * Genital detector for the stranger video (auto-ban signal), 2026-11-04.
 *
 * Runs on the VIEWER's device on the partner's incoming video. Lazy-loaded by
 * live.js only for stranger matches (never for friend calls). Nothing here
 * talks to the hub: live.js sends `genital_hit` after a 2-of-3 confirmation.
 *
 * Model: NudeNet 3.4 "320n" (YOLOv8n, 320x320, AGPL-3.0), run with
 * onnxruntime-web 1.22.0 (wasm, MIT). Files: ui/vendor/genital/
 * (scripts/vendor-genital.sh, sha256-pinned). Output [1, 22, 2100]:
 * cx, cy, w, h + 18 class scores per anchor.
 *
 * Thresholds (see docs/GENITAL_BAN_2026-11-04.md):
 *   frame hit (detector)  = genital class is the anchor's top class AND
 *                           box >= 0.4% of the frame AND
 *                           (score >= 0.60, or score >= 0.40 with nsfwjs Porn+Hentai >= 0.55)
 *   frame hit (porn_only) = no detector on this device: nsfwjs Porn >= 0.92
 *   confirmed             = 2 hits in the last 3 checked frames
 * Pure helpers are exported for ui/genital-guard.test.mjs.
 */
(function (root) {
  "use strict";

  const LABELS = [
    "FEMALE_GENITALIA_COVERED",
    "FACE_FEMALE",
    "BUTTOCKS_EXPOSED",
    "FEMALE_BREAST_EXPOSED",
    "FEMALE_GENITALIA_EXPOSED",
    "MALE_BREAST_EXPOSED",
    "ANUS_EXPOSED",
    "FEET_EXPOSED",
    "BELLY_COVERED",
    "FEET_COVERED",
    "ARMPITS_COVERED",
    "ARMPITS_EXPOSED",
    "FACE_MALE",
    "BELLY_EXPOSED",
    "MALE_GENITALIA_EXPOSED",
    "ANUS_COVERED",
    "FEMALE_BREAST_COVERED",
    "BUTTOCKS_COVERED",
  ];
  /** Only these two classes can ban. Breasts / buttocks / anus never do. */
  const GENITAL_CLASSES = [4, 14];
  const INPUT = 320;
  const MODEL_ID = "nudenet-320n-3.4.2";

  const THRESHOLDS = Object.freeze({
    /** Detector alone. */
    DET_STRONG: 0.6,
    /** Detector + nsfwjs agreement. */
    DET_WEAK: 0.4,
    PORN_WITH_WEAK: 0.55,
    /** Lite fallback (no detector): nsfwjs Porn only, much stricter than the 0.72 blur gate. */
    PORN_ONLY: 0.92,
    /** Ignore tiny boxes (noise, far background): share of frame area. */
    MIN_BOX_FRAC: 0.004,
    CONFIRM_HITS: 2,
    CONFIRM_WINDOW: 3,
  });

  const SOURCES = {
    ort: "/vendor/genital/ort-1.22.0/ort.wasm.min.js",
    wasmDir: "/vendor/genital/ort-1.22.0/",
    model: "/vendor/genital/model/nudenet-320n-3.4.2/320n.onnx",
  };

  /** Letterbox geometry: source scaled into INPUT x INPUT at (0,0), black pad right/bottom. */
  function letterbox(srcW, srcH, size = INPUT) {
    const scale = size / Math.max(1, srcW, srcH);
    return {
      scale,
      w: Math.max(1, Math.round(srcW * scale)),
      h: Math.max(1, Math.round(srcH * scale)),
    };
  }

  /** RGBA bytes (size x size) → Float32 NCHW RGB in [0,1]. */
  function rgbaToTensorData(rgba, size = INPUT) {
    const n = size * size;
    const out = new Float32Array(3 * n);
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      out[i] = rgba[p] / 255;
      out[n + i] = rgba[p + 1] / 255;
      out[2 * n + i] = rgba[p + 2] / 255;
    }
    return out;
  }

  /**
   * Best genital box from raw output [1, 4 + C, N]. A box counts only when a
   * genital class is that anchor's top class (an anchor that is mostly
   * "covered" or "belly" is not a genital hit). Box is returned as fractions
   * of the source frame. Returns { score:0 } when nothing qualifies.
   */
  function decodeGenitals(data, dims, srcW, srcH, minBoxFrac = THRESHOLDS.MIN_BOX_FRAC) {
    const ch = dims[1];
    const n = dims[2];
    const classes = ch - 4;
    const lb = letterbox(srcW, srcH);
    let best = { score: 0, cls: "", box: null, boxFrac: 0 };
    const boxes = [];
    // Diagnostics only: strongest anchor of any class (e.g. FACE_MALE on a face).
    let topAny = { score: 0, cls: "" };
    for (let a = 0; a < n; a++) {
      let top = -1;
      let topScore = 0;
      for (let c = 0; c < classes; c++) {
        const s = data[(4 + c) * n + a];
        if (s > topScore) {
          topScore = s;
          top = c;
        }
      }
      if (top >= 0 && topScore > topAny.score) topAny = { score: topScore, cls: LABELS[top] };
      if (top < 0 || GENITAL_CLASSES.indexOf(top) < 0 || topScore < 0.2) continue;
      const cx = data[a] / lb.scale;
      const cy = data[n + a] / lb.scale;
      const w = data[2 * n + a] / lb.scale;
      const h = data[3 * n + a] / lb.scale;
      const x0 = Math.max(0, cx - w / 2);
      const y0 = Math.max(0, cy - h / 2);
      const x1 = Math.min(srcW, cx + w / 2);
      const y1 = Math.min(srcH, cy + h / 2);
      const bw = Math.max(0, x1 - x0);
      const bh = Math.max(0, y1 - y0);
      const frac = (bw * bh) / Math.max(1, srcW * srcH);
      if (frac < minBoxFrac) continue;
      const box = [x0 / srcW, y0 / srcH, bw / srcW, bh / srcH];
      boxes.push({ score: topScore, cls: LABELS[top], box });
      if (topScore > best.score) {
        best = { score: topScore, cls: LABELS[top], box, boxFrac: frac };
      }
    }
    boxes.sort((p, q) => q.score - p.score);
    best.boxes = boxes.slice(0, 4);
    best.topAny = topAny;
    return best;
  }

  /**
   * One checked frame → hit or not. `det` is null when the detector is not
   * running on this device (lite fallback = nsfwjs Porn only, strict).
   */
  function frameVerdict(det, nsfw) {
    const porn = Number(nsfw?.porn) || 0;
    const hentai = Number(nsfw?.hentai) || 0;
    if (!det) {
      return porn >= THRESHOLDS.PORN_ONLY
        ? { hit: true, kind: "porn_only", why: "porn" }
        : { hit: false, kind: "porn_only", why: "" };
    }
    const s = Number(det.score) || 0;
    if (s >= THRESHOLDS.DET_STRONG) return { hit: true, kind: "detector", why: "det" };
    if (s >= THRESHOLDS.DET_WEAK && porn + hentai >= THRESHOLDS.PORN_WITH_WEAK) {
      return { hit: true, kind: "detector", why: "det+nsfw" };
    }
    return { hit: false, kind: "detector", why: "" };
  }

  /** 2-of-3 confirmation over checked frames. reset() after each confirmed hit. */
  function makeConfirm(hits = THRESHOLDS.CONFIRM_HITS, windowN = THRESHOLDS.CONFIRM_WINDOW) {
    let recent = [];
    return {
      push(hit) {
        recent = [...recent, !!hit].slice(-windowN);
        const n = recent.filter(Boolean).length;
        return { confirmed: n >= hits, hits: n, window: recent.length };
      },
      reset() {
        recent = [];
      },
      get recent() {
        return recent.slice();
      },
    };
  }

  // ───────────── runtime (browser only) ─────────────
  let session = null;
  let loading = null;
  let failedAt = 0;
  const stats = { loadMs: 0, fetchMs: 0, createMs: 0, bytes: 0, runs: 0, lastMs: 0, avgMs: 0, threads: 1 };

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        s.remove();
        reject(new Error("load failed: " + src));
      };
      document.head.appendChild(s);
    });
  }

  /** WebAssembly SIMD (ORT 1.22 ships only the SIMD build). */
  function simdSupported() {
    try {
      return WebAssembly.validate(
        new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])
      );
    } catch (_) {
      return false;
    }
  }

  /**
   * Load ORT + model once. opts.lite → 1 thread. Resolves to the session or
   * null (failure: caller falls back to nsfwjs porn_only; retry after 120s).
   */
  function load(opts = {}) {
    if (session) return Promise.resolve(session);
    if (loading) return loading;
    if (failedAt && Date.now() - failedAt < 120_000) return Promise.resolve(null);
    const src = Object.assign({}, SOURCES, opts.sources || {});
    loading = (async () => {
      const t0 = performance.now();
      try {
        if (typeof WebAssembly !== "object" || !simdSupported()) throw new Error("no wasm simd");
        if (!root.ort) await loadScript(src.ort);
        const ort = root.ort;
        if (!ort?.InferenceSession) throw new Error("ort unavailable");
        ort.env.wasm.wasmPaths = new URL(src.wasmDir, location.href).href;
        const hw = Number(navigator.hardwareConcurrency) || 2;
        const threads = root.crossOriginIsolated && !opts.lite ? Math.max(1, Math.min(4, Math.floor(hw / 2))) : 1;
        ort.env.wasm.numThreads = threads;
        stats.threads = threads;
        const tf = performance.now();
        const res = await fetch(src.model, { cache: "force-cache" });
        if (!res.ok) throw new Error("model http " + res.status);
        const buf = new Uint8Array(await res.arrayBuffer());
        stats.bytes = buf.byteLength;
        stats.fetchMs = Math.round(performance.now() - tf);
        const tc = performance.now();
        session = await ort.InferenceSession.create(buf, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        });
        stats.createMs = Math.round(performance.now() - tc);
        stats.loadMs = Math.round(performance.now() - t0);
        failedAt = 0;
        return session;
      } catch (e) {
        console.warn("[genital] load", e);
        failedAt = Date.now();
        session = null;
        return null;
      } finally {
        loading = null;
      }
    })();
    return loading;
  }

  let canvas = null;
  /**
   * Detect on a <video>/<canvas>/<img>. Returns { score, cls, box, boxes, ms } or null.
   */
  async function detect(source) {
    if (!session) return null;
    const ort = root.ort;
    const srcW = source.videoWidth || source.naturalWidth || source.width;
    const srcH = source.videoHeight || source.naturalHeight || source.height;
    if (!srcW || !srcH) return null;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = INPUT;
      canvas.height = INPUT;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const lb = letterbox(srcW, srcH);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, INPUT, INPUT);
    ctx.drawImage(source, 0, 0, lb.w, lb.h);
    const rgba = ctx.getImageData(0, 0, INPUT, INPUT).data;
    const t0 = performance.now();
    const input = new ort.Tensor("float32", rgbaToTensorData(rgba), [1, 3, INPUT, INPUT]);
    const feeds = {};
    feeds[session.inputNames[0]] = input;
    const out = await session.run(feeds);
    const o = out[session.outputNames[0]];
    const ms = performance.now() - t0;
    stats.runs++;
    stats.lastMs = Math.round(ms);
    stats.avgMs = Math.round(stats.avgMs + (ms - stats.avgMs) / stats.runs);
    const best = decodeGenitals(o.data, o.dims, srcW, srcH);
    best.ms = Math.round(ms);
    return best;
  }

  /**
   * Proof still for the hub: 64 px wide, detected boxes painted black (with
   * margin), then blurred. Shows that a real camera frame was there (person,
   * room, light) but carries no explicit detail. JPEG base64 (no data: prefix).
   */
  function proofThumb(source, boxes) {
    try {
      const srcW = source.videoWidth || source.width;
      const srcH = source.videoHeight || source.height;
      if (!srcW || !srcH) return "";
      const W = 64;
      const H = Math.max(1, Math.round((W * srcH) / srcW));
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d");
      try {
        ctx.filter = "blur(3px)";
      } catch (_) {}
      ctx.drawImage(source, 0, 0, W, H);
      ctx.filter = "none";
      ctx.fillStyle = "#000";
      for (const b of boxes || []) {
        const [x, y, w, h] = b.box || b;
        const mx = w * 0.35;
        const my = h * 0.35;
        ctx.fillRect((x - mx) * W, (y - my) * H, (w + 2 * mx) * W, (h + 2 * my) * H);
      }
      const url = c.toDataURL("image/jpeg", 0.5);
      return url.split(",")[1] || "";
    } catch (_) {
      return "";
    }
  }

  const api = {
    LABELS,
    GENITAL_CLASSES,
    INPUT,
    MODEL_ID,
    THRESHOLDS,
    SOURCES,
    letterbox,
    rgbaToTensorData,
    decodeGenitals,
    frameVerdict,
    makeConfirm,
    load,
    detect,
    proofThumb,
    simdSupported,
    stats,
    get ready() {
      return !!session;
    },
    get failed() {
      return !!failedAt;
    },
    /** Tests only: inject a fake session. */
    _setSession(s) {
      session = s;
    },
  };
  root.RuletkaGenitalGuard = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
