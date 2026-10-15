# 549 — Wiki: RU without VPN

## Status
COMPLETE

## What changed
- New page `knowledge/wiki/ru-reach.md`: why RF users need a VPN today (single DigitalOcean FRA IP `209.38.204.153` AS14061 hosts HTML+WSS+coturn — RKN/DPI filters at the AS/IP layer, not per-domain), split diagnostic table (site HTTPS/WSS filtered vs TURN UDP filtered), the "not the cause" section (`pair_force_relay` is hide_ip/untrusted-IP/same-public-IP driven, never "looks like Russia"; Yandex verify file is SEO not a bypass), and a "must not" section citing the CONNECTIVITY_LOCK (no force_relay=false for RU, no pool>0, 480 stays).
- `knowledge/wiki/index.md`: added one row linking `ru-reach.md`.
- `knowledge/wiki/log.md`: added one `## [2026-08-20] wiki | ru-reach page filed` entry.
- Cited (did not edit `DONE WHEN` of) `knowledge/specs/2026-08-20-ru-reach.md`.

## Context note (read this before reusing this worktree)
This worktree's branch (`claude/p0-connectivity`) is behind main and had **no** `knowledge/wiki/index.md`, `log.md`, or `knowledge/specs/` at all — those exist only on the main tree (`/home/drakosik/freenet-roulette`), which has diverged far ahead (many Aug 13–20 wiki/spec commits never reached this branch). To avoid producing a diff that would blow away all of main's existing index/log entries, I copied the **current main-tree versions** of `index.md`, `log.md`, and the `2026-08-20-ru-reach.md` spec into this worktree unmodified as a baseline, then made the scoped one-row / one-line / new-page additions on top. Grok should diff against the real main-tree files (not this branch's stale prior state) when harvesting.
Also note: `knowledge/` is untracked by git on this branch (no `.gitignore` entry, but `git ls-files knowledge/` returns nothing) — this appears to be the existing setup for this branch, not something I changed.

## Files touched
- `knowledge/wiki/ru-reach.md` (new)
- `knowledge/wiki/index.md` (baseline copied from main + 1 row)
- `knowledge/wiki/log.md` (baseline copied from main + 1 entry)
- `knowledge/specs/2026-08-20-ru-reach.md` (baseline copied from main, unmodified — DONE WHEN untouched)

## Verify commands run
None required/listed for this task (docs-only, no code). No `live.js`/`webrtc.js`/`MediaSession`/`coturn.conf` touched.

## Connect risk
none — no code changed, no CONNECTIVITY_LOCK / ICE / offer / TURN files touched, no deploy, no git push, no APK.

COMPLETE
