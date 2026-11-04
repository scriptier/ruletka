# On-device face detector (same-origin copies)

Used by the face check before matching (`ui/live.js`, "face gate"). Fetched by
`scripts/vendor-face.sh` (pinned URLs + sha256). Do not edit by hand.
tfjs is shared with the NSFW filter (`/vendor/nsfw/tfjs-4.22.0/`).

| Path | Source | License |
|------|--------|---------|
| `blazeface-0.1.0/` | npm `@tensorflow-models/blazeface@0.1.0` `dist/blazeface.min.umd.js` | Apache-2.0 |
| `model/blazeface-1/` | TF Hub `tensorflow/tfjs-model/blazeface/1/default/1` (Kaggle Models) | Apache-2.0 |

Folder names carry versions, so Caddy can cache them for a long time
(`/vendor/*` already gets `max-age=2592000`).
