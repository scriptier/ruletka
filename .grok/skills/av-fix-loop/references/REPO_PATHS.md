# Repo paths (single home — do not copy lock text here)

| Path | Role |
|------|------|
| `scripts/av-verify.sh` | Scorecard CLI |
| `artifacts/av-verify/latest.{json,md}` | Agent input after every run |
| `scripts/test-coturn-relay.sh` | Coturn dual-relay lock |
| `scripts/test-connectivity-lock.sh` | Hub force_relay unit lock |
| `docs/AV_FIX_SUBAGENT_PLAN.md` | Full decision tree + daily loop |
| `docs/CONNECTIVITY_LOCK.md` | Client/hub ICE locks |
| `docs/VIDEO_PATH_LOCK.md` | Coturn / thrash list |
| `.grok/skills/av-fix-loop/references/GOTCHAS.md` | Thrash anti-patterns |
| `.grok/skills/av-fix-loop/references/ONE_WAY.md` | PC black / frames_out=0 checklist |
| `knowledge/specs/current-av.md` | Active product DONE WHEN |
| `knowledge/wiki/` | Compounded symptoms (read before re-theorizing) |
| `scripts/av-loop.sh` | Measure + NEXT_ROLE + job cards |
| `ui/webrtc.js` · `ui/live.js` | Web media path + av_path |
| `mobile/src/media/MediaSession.ts` | Android media path + av_path |
| `bridge/src/simple.rs` | Match, signal, force_relay, av_path log |
