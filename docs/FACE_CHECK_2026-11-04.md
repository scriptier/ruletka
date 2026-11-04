# Face check before matching (2026-11-04)

Branch `feature/face-check-2026-11-04`, off `9aa5a7b` (release/2026-10-10). Not deployed.

## What it does
- Web client (`ui/live.js`) runs BlazeFace (tfjs 4.22.0, shared with the NSFW filter) on the
  local camera: ~2 fps while searching (1 fps on lite hardware), 0.5 fps during a call.
  A face must be seen in 2 of the last 4 frames (prob >= 0.8, box >= 8% of short side);
  6 misses in a row flips back to "no face".
- Client sends `{"type":"face_ok","ok":bool,"ready":bool,"fail_open":bool,"model":str}`
  before `hello` and then on change + every 4 s heartbeat.
- Hub (`bridge/src/simple.rs`) won't pair a client whose latest report is `ok=false`, or
  whose report is older than 45 s. Federation solo pick / claim honour the same check.
- Prompt `#face-gate-prompt` — "Покажите лицо в камеру, чтобы начать" (16 languages).

## Safety valves
- Model can't load / 5 detector errors in a row -> client reports `fail_open=true` and is
  matched; hub logs `face gate fail-open — matched without a face check` (WARN, once/episode).
- Stuck in loading (`ready=false`) for 20 s while waiting -> matched anyway.
- Clients that never send `face_ok` (Android app, old cached tabs) are exempt.
- `RULETKA_FACE_GATE=off` on the hub disables the gate; `?facegate=off` disables it per tab.
- Detector order: BlazeFace -> browser `FaceDetector` -> fail open.

## Deploy order
Hub first, then web. An old hub answers "bad json" to the unknown `face_ok` type.

## Assets
`scripts/vendor-face.sh` (sha256-pinned) -> `ui/vendor/face/` (Apache-2.0). No CDN at runtime.

## Android app (mobile/) — not changed
Exempt today. To join: run an on-device face detector (e.g. react-native-fast-tflite +
BlazeFace tflite), send the same `face_ok` message before `hello` and every <=4 s.
Later the hub can enforce for `platform=web`+app once the app ships it.

## Tests
- `cargo test` (bridge): 10 new face-gate tests + protocol parse test.
- `scripts/face-gate-headless.mjs` (Playwright + Chromium fake camera, y4m):
  `CHROME=/usr/bin/chromium FACE_Y4M=face.y4m BASE=http://127.0.0.1:8979 SHOTS=out node scripts/face-gate-headless.mjs`
