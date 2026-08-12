# 2026-08-10 client-ice hop (0.1.294)

## Scorecard before (21:04Z)
- Hub force_relay=true, signaling+TURN PASS max_rb~1e6
- android frames_in=160 frames_out=0 force_relay=0 policy=all srflx→relay
- web frames_in=0 frames_out=732 force_relay=true policy=relay
- answer relay_candidates=0

## Agents
- diagnose: NEXT_ROLE client-ice (not turn)
- Grok client-ice: hubForceRelaySticky, bindAnswerOutbound m-line, av_path hub_fr/bind_v/app_vc
- Claude: ensureRelayPolicyPc must not rebuild PC mid-negotiation (orphans bound tracks)

## Ship
- APK 0.1.294 / vc302 local artifacts/ruletka-0.1.294-vc302.apk
- Needs human install + smoke; then av-verify expect app_vc=302 force_relay=1 policy=relay frames_out>0
