# AGENTS.md — ruletka

Grok loads this file every turn. Do not re-read it. Full rules (Always / Ask / Never, Claude factory, wiki ops, connect gotchas): `docs/agent-rules.md`. Open that file only when the task needs it.

## Stack

Expo Android (Play) ↔ browser WebRTC video chat. Rust hub in `bridge/`. Browser in `ui/`. Phone in `mobile/`.

## Key folders

- `ui/live.js`, `ui/webrtc.js`, `ui/live.html` — browser call
- `mobile/app/live.tsx`, `mobile/src/media/MediaSession.ts` — Android call
- `bridge/src/simple.rs` — match and hub
- `docs/CONNECTIVITY_LOCK.md`, `docs/VIDEO_PATH_LOCK.md` — connect locks
- `knowledge/specs/` — DONE WHEN for the task you were given (one spec)
- `knowledge/wiki/now.md` — situation board, for connect or status work
- `docs/agent-rules.md` — the rest of the agent rules

## Test

- Before hub, ICE, or MediaSession edits: `./scripts/test-connectivity-lock.sh`
- Web: `node --check` on each touched JS file
- Mobile: `cd mobile && SKIP_L2=1 ./scripts/verify-before-apk.sh`
- APK only when asked: `cd mobile && ./scripts/build-apk-local.sh --bump`
- One writer per file set. Verify after edits. Never invent product.ok or GOAL_MET.

## Hard rules

- Review gate: do not merge, and do not call work shipped, without a human review.
- No deploy (rsync, systemctl, coturn, droplet, or the production deploy script) unless the human says **Reviewed OK go live**.
- Never touch prices, Stripe, or store listings or uploads (Play, RuStore, App Store).
- No force-push. No push or merge to `main`.
- No website APK unless the human says **put apk on the site** or **update website apk**.
- Do not undo the connectivity lock: `iceCandidatePoolSize` stays 0, no always-on force_relay, no dual-offer thrash.
- One APK bump per session, then stop for a human smoke note.

Paint-only HUD (one CSS or pin bump) skips specs and the wiki. One topic per session.
