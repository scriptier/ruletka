# 2026-08-16 laptop Chrome: answer apply failed Incompatible send direction

Source: human paste laptop console 2026-08-16 ~00:32 MDT. Full nsfwjs kernel spam omitted; signal lines kept.

## Pins

- live.js?v=677
- webrtc.js?v=334
- 0 cam · 2 mic · audio-only preview (expected)

## Sequence

- warmIcePool policy=all then policy=relay prime=allocate
- Force Relay · warm TURN pure in-flight — kick now
- matched with Courtier · solo
- [webrtc] first ice out +867ms
- [webrtc] offer first-relay count=1 warm=0 multi=0 budget=480
- kickSolo connect +872ms offerer=1 peer=d2925f96 emit=1

## Fatal

```
[webrtc] answer apply failed InvalidAccessError: Failed to execute
'setRemoteDescription' on 'RTCPeerConnection': Failed to set remote
answer sdp: Incompatible send direction state= have-local-offer
```

Then: watch soft no frames ice=new cs=new — push tracks only  
watch hard: pure-relay still dark — keyframe only (no rebuild)

## Noise (not this FAIL)

- navigator.vibrate blocked
- wss://ruletka.me/ws closed before established (me vs vip)
- /v1/funnel 400
- nsfwjs cloudfront ERR_NAME_NOT_RESOLVED
- rate limited — chat too fast
- identity→ name=Laptop (self paint; separate)

## Read

Laptop no-cam offer is **recvonly** (`_ensureNoCamVideoRecvonly`). Android `forceVideoSendrecvSdp` answers **sendrecv**. Chrome rejects. ICE never leaves `new`. 334 UDP relay gathered (count=1) — not the TCP hop.
