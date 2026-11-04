# Genital detector + auto-ban (2026-11-04)

Branch `feature/genital-ban-2026-11-04` (on top of `feature/face-check-2026-11-04`). Local only, not deployed.

## What it does
1. On a stranger match, the viewer's browser lazy-loads `ui/genital-guard.js` (~12 KB). Capable devices
   also load ONNX Runtime Web 1.22.0 (wasm SIMD) and NudeNet 320n (12.15 MB, browser-cached).
2. Every nsfwjs scan of the partner's video (2.2 s, or 6 s on lite hardware) also runs the detector on the
   same frame. Only classes `FEMALE_GENITALIA_EXPOSED` (4) and `MALE_GENITALIA_EXPOSED` (14) can ban.
3. Frame verdict (`frameVerdict`):
   - detector score >= **0.60** → hit;
   - detector >= **0.40** and nsfwjs Porn+Hentai >= **0.55** → hit;
   - no detector on this device (save-data, 2g/3g, deviceMemory <= 1, no wasm) → nsfwjs Porn >= **0.92** → hit (`porn_only`);
   - box must cover >= 0.4 % of the frame and genital must be the anchor's top class.
4. **2 of the last 3** checked frames → confirmed hit: video blur locked, `genital_hit` sent to the hub,
   scanning speeds up (1.2 s / 2.5 s lite) for a second confirmation.
5. Hub (`bridge/src/genital_ban.rs`, `simple.rs::handle_genital_hit`):
   - reporter must be the matched viewer of that target in the same session, match >= 2 s old, not friends,
     not a friend call; scores re-checked (det >= 0.5, porn_only >= 0.9); window 2..5 frames;
   - **session path**: same viewer, 2 detector hits >= 2 s apart → ban. Off when the target is a senior
     (>= 250 stars), when the two are feuding (target reported the viewer), when the viewer had a ban overturned,
     or when the viewer already caused 3 bans in 24 h (cluster cap 6) → then a second independent viewer is needed;
   - **cross path**: >= 2 distinct reporter networks (/24 or uid) and >= 1 detector hit → ban;
   - `porn_only` hits never ban alone; they count only on the cross path;
   - per-reporter rate limit 10 hits/h.
6. Ladder: **24 h → 7 days → permanent**, offenses kept 180 days in `genital-offenses.json`
   (beside friends.json). Level = min(offense count, distinct reporter networks), so one viewer can't jump
   someone to permanent. Admin unban marks the latest offense overturned (and flags its reporters).
7. On ban: existing `match_bans` (+ permanent), clawback, `reports.jsonl` reason `genitals_ai`, webhook
   `genital_auto_ban`, safety log. The viewer gets `partner_banned` → notice
   «Собеседник заблокирован за нарушение правил», a local block, and is requeued. The offender gets `banned` →
   a Russian ban screen with the duration and the end time; it is shown again on every reconnect while the ban lasts.
8. If no ban arrives (e.g. a senior target), the viewer falls back to the old nsfwjs path after 25 s (or 3 s
   after the second hit): report + block + next, with the masked proof only.

## Proof: masked, blurred 64 px thumbnail
The detector path sends a 64 px wide JPEG (q 0.5, ~1 KB). Detected boxes are painted black with a 35 % margin and the whole image is blurred.
- It shows a real camera frame was there (room, light, a person) for admin review.
- It carries no explicit detail and is not usable as sexual imagery.
- Storing full explicit frames of possibly unwilling or underage people is a legal risk. Metadata alone gives a moderator nothing to check.
- The hub stores it in `report-evidence/`; set `RULETKA_GENITAL_PROOF=off` to store metadata only.
- Note: the older nsfwjs skip path still uploads a full report screenshot (unchanged).

## Measured (omarchy, headless Chromium, wasm SIMD, 1 thread, no cross-origin isolation)
- Load after download: 0.55–0.7 s cold, about 0.1 s warm (session create about 0.4–0.55 s).
- Download: about 12.2 MB model plus about 11 MB wasm (about 1.8 MB brotli).
- Inference per frame: **110–160 ms**. With 4x CPU throttle: 480–710 ms. With 6x throttle: 770–1050 ms. Throttling only roughly stands in for mid- and low-end phones; it is not a phone measurement.
- At the 6 s lite interval, even about 1 s per frame is acceptable on phones. The cost is the 14 MB first download, which is why save-data/2g/3g fall back to `porn_only`.
- Safe images: black, dark room, noise, skin fill, 4 face portraits, 3 public-domain US Navy swim-call photos (shirtless). **Genital score 0.00 on all.** The faces show up as FACE_* 0.78–0.86, so the pipeline does work.

## Tests
- `cargo test` (bridge): 93 passed, 26 of them genital (protocol 2, ledger 17, hub 7).
- `node ui/genital-guard.test.mjs`: decode, verdict, 2-of-3, letterbox, and detect with a fake session.
- `scripts/genital-ban-headless.mjs`:
  - PART=1 runs the real model on safe images and records the timings above;
  - PART=2 uses a stubbed detector (synthetic tensor) with 2 peers through a local bridge: blur, 2 hits, ban, viewer notice, ban screen, ban screen after reload. 9/9 passed.
  - It needs distinct `x-forwarded-for` test IPs, otherwise the hub forces TURN relay.
- No explicit imagery was downloaded or used.

## Deploy order (when approved)
1. `scripts/vendor-genital.sh` on the build/deploy host. The wasm and onnx files are gitignored, so they must be fetched and sha-checked there. If they are missing, the guard fails and the device falls back to `porn_only`.
2. Hub first. An old hub answers `genital_hit` with "bad json", which is harmless; the client falls back after 25 s.
3. Web (`live.js?v=991`, `i18n.js?v=277`, `live-brand.css?v=26`, packs `v=154`).
4. nginx: `.mjs` → `text/javascript`, `.wasm` → `application/wasm`.
5. Android: next APK needs `genital_hit` (or at least handling of `banned` / `partner_banned`). Until then, Android users can still be banned by web viewers and see the generic restriction.

## Open decisions
- **License**: NudeNet weights are AGPL-3.0. Ruletka is LGPL-2.1-only. Shipping the unmodified model file is probably fine, but this needs a decision.
- Ban durations (24 h / 7 d / permanent, 180-day memory).
- Keeping the masked proof thumbnails (and for how long).
- Whether save-data/cellular users should get the 14 MB detector.
- Whether `porn_only` should count at all on the cross path.
