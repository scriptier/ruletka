# Raw: hub_fr wiped mid-match (2026-08-10 ~21:48)

## Evidence (app_vc=303)
- Hub: force_relay=true, offer relay_candidates=1, answer=0
- Android av_path answer_sent: force_relay=0 hub_fr=0 policy=all bind_v=1 frames_out=0
- Android waves: frames_in↑ (sees PC), frames_out=0, bytes_out=0
- Web: frames_in=0, frames_out↑, audio_in↑ (receives phone audio, not video)

## Root cause
MediaSession.closeCall({ keepLocal: true }) always cleared hubForceRelaySticky.
Match path: setForceRelay(true) then closeCall rebuild → sticky gone → answer hybrid/srflx while web pure relay → one-way video.

## Fix
closeCall: clear sticky only when clearForceRelay ?? !keepLocal.
Rewarm preferRelay if sticky remains.
Belt: arm force_relay from pure-relay offer SDP.
