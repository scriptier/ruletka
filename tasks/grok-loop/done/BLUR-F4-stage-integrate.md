# BLUR-F4 LiveStageVideo soft blur integrate

## Goal
When privacyBlur + remote stream: show SoftBlurRemote over partner RTCView; PartnerBlurVeil only as fallback (no stream / soft blur inactive).

## OWN
mobile/src/live/LiveStageVideo.tsx + liveStyles if needed
Depends on SoftBlurRemote existing — stub gracefully if native missing.

## RESULT
tasks/grok-loop/done/BLUR-F4-stage-integrate-RESULT.md
