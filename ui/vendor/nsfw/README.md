# On-device NSFW filter (same-origin copies)

Fetched by `scripts/vendor-nsfw.sh` (pinned URLs + sha256). Do not edit by hand.

| Path | Source | License |
|------|--------|---------|
| `tfjs-4.22.0/` | npm `@tensorflow/tfjs@4.22.0` dist | Apache-2.0 |
| `tfjs-backend-wasm-4.22.0/` | npm `@tensorflow/tfjs-backend-wasm@4.22.0` dist | Apache-2.0 |
| `nsfwjs-2.4.2/` | npm `nsfwjs@2.4.2` dist | MIT |
| `model/quant_nsfw_mobilenet-v2.4.1/` | github infinitered/nsfwjs tag v2.4.1 `example/nsfw_demo/public/quant_nsfw_mobilenet/` | MIT |

The model is the one nsfwjs 2.4.2 loads by default. Its old default host
(`d1zv2aa70wpiur.cloudfront.net`) no longer resolves, so it must be served here.
Folder names carry versions, so Caddy can cache them for a long time.
