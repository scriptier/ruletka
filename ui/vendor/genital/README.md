# Genital detector assets (self-hosted)

Fetched and sha256-checked by `scripts/vendor-genital.sh` (idempotent; re-run
verifies). Loaded lazily by `ui/genital-guard.js` only on capable devices,
after the first match starts.

| Path | What | Source | License | Size |
|---|---|---|---|---|
| `ort-1.22.0/ort.wasm.min.js` | ONNX Runtime Web, wasm-only bundle | npm `onnxruntime-web@1.22.0` | MIT (`ort-1.22.0/LICENSE`) | see script |
| `ort-1.22.0/ort-wasm-simd-threaded.{mjs,wasm}` | ORT wasm SIMD backend | same | MIT | ~11 MB raw, ~1.8 MB brotli |
| `model/nudenet-320n-3.4.2/320n.onnx` | NudeNet v3.4 320n detector (YOLOv8n, 18 classes, input 320x320) | PyPI wheel `nudenet==3.4.2` | **AGPL-3.0** (`model/.../LICENSE`) | 12.15 MB |

## License note (decision needed)

The NudeNet weights ship under AGPL-3.0. Serving them to browsers is
distribution of the model file, unmodified, with its license next to it.
Ruletka's own code stays LGPL-2.1-only; the model is a separate file loaded
at runtime, not linked into our code. Whether that is acceptable is a
decision for the owner (alternatives: a permissively licensed detector, or
the nsfwjs-only `porn_only` fallback everywhere).

## Prod serving

nginx must serve `.mjs` as `text/javascript` and `.wasm` as
`application/wasm` (the Rust hub's ServeDir already does). Long cache headers
are fine: every path carries a version.
