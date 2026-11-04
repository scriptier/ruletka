# Safety filter pass (2026-11-03, branch `safety/2026-11-03`)

Not deployed. Pins: live.js **989**, i18n **275**.

## Web NSFW filter (`ui/live.js`)

- Runs on lite devices too (no `isFxLite` gate). Scan every **2.2s**, or **6s**
  on lite hardware (`_fxLiteHw`: weak chip, Safari, or no WebGL).
- Backend: WebGL when it is a real GPU, else **wasm**, else **cpu**.
- Files are same-origin under `ui/vendor/nsfw/` (tfjs 4.22.0, wasm backend,
  nsfwjs 2.4.2, `quant_nsfw_mobilenet` v2.4.1 weights). jsDelivr is only the
  fallback. Refresh with `scripts/vendor-nsfw.sh` (sha256-pinned).
  The old nsfwjs default model host (`d1zv2aa70wpiur.cloudfront.net`) no
  longer resolves, so the live filter could not load before this change.
- While the model loads, and after it fails, stranger video stays blurred
  (the user can tap Unblur). Chip shows loading / on / "Safety filter off".
  A failed load retries after 60s. Reduced motion does not affect the filter.
- 2-of-3: block + report + skip only on 2 hits in the last 3 checked frames.
  One hit = blur only (no report), logged as `nsfw.suspect`.
- Caddy: `/vendor/*` gets `Cache-Control: public, max-age=2592000`.
  `push.sh` already rsyncs all of `ui/`.

## Stranger text chat (`bridge/src/chat_filter.rs`, `handle_chat`)

- Stranger matches only (local + federated). Friend calls are not checked.
- `contact_swap` (t.me/wa.me/vk.com… links, @handles, e-mails, 10+ digit
  phones, "го в тг" / "whatsapp?"), `explicit` (clear sexual words and
  "покажи …" body demands, not everyday mat), `grooming` (age question or
  minor marker + sexual words, or sexual words within 10 min of an age
  question from the same sender).
- Blocked lines are not delivered. Sender gets "message not sent — …".
  One `kind: chat_filter` line in `data/safety-logs.jsonl` (category, rule,
  sender, targets, 160-char excerpt). Grooming also adds to the in-memory
  7-day `chat_grooming_flags` count.

## Underage reports (`handle_report_user`)

- One report → **24h match hold** (`match_bans`), webhook `underage_hold`,
  `reports.jsonl` `underage_hold: true`, no star clawback.
- **30 days** when within 7 days the reports reach **4 points from 2+
  clusters** (same LAN /24 = one; established reporter 2 points, low-star 1),
  or when there is an underage report **and** an `explicit_ai` report on the
  target (either order).
- The 7-day underage / explicit_ai lists are memory only. A restart forgets
  the counts (holds and bans persist in `match_bans`).
