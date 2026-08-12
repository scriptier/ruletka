# Android: log offer→answer path for black remote diagnosis

## Goal
Nightly smoke: phone matched but never applied answer (ice=new bind_v=0). Add **temporary high-signal logs** only (no ICE thrash).

## OWN
- mobile/src/media/MediaSession.ts — log on inbound offer, setRemoteDescription, createAnswer, setLocalDescription, failures
- optional mobile/app/live.tsx signal handler: log when signal kind=offer|answer received

## Do
1. Log lines must include prefix `[client-ice]` so adb logcat -s ReactNativeJS is greppable
2. Log peer id short, has_local_desc, ice connection state on answer complete
3. No pool/force_relay changes

## Must not
- Deploy, change ICE budgets aggressively

## Done
RESULT COMPLETE + sample log lines
