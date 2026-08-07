# Claude task: Play ↔ browser parity matrix

## Goal
Audit code and produce `docs/PARITY_MATRIX.md`: feature × web × android with status.

## Scope (read-only preferred; write only the matrix doc + tiny notes)
- Web: `ui/live.js`, `ui/webrtc.js`, protocol usage
- Mobile: `mobile/app/live.tsx`, `mobile/src/media/*`, `mobile/src/hub/*`, friends/settings
- Protocol: `docs/PROTOCOL.md`, `bridge/src/protocol.rs`

## Columns
| Feature | Web | Android | Notes / gap | Priority P0–P3 |

## Must cover
- Stranger match Start/Next/Stop
- WebRTC offerer role / force_relay / TURN
- Cam/mic mute, flip camera
- Geo display (flag/country/city) + i18n
- Friends: add code, call, hangup
- Chat + typing
- Stars: balance, gift, spend effects
- Block/report, 18+ gate
- Hide IP / prefer direct
- Deep links / app links
- Identity export-import
- Find 3rd / party (if present)

## Rules
- Do NOT change WebRTC connect path unless you find a 1-line bug
- Do NOT deploy
- Write `docs/PARITY_MATRIX.md` and `tasks/parity-matrix-RESULT.md`

## Done when
Matrix exists with honest statuses (done / partial / missing) and top 10 gaps ranked.
