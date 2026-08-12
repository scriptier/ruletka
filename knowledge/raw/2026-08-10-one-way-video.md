# Raw: one-way video smoke 2026-08-10

## Human
- Android: sees conversationalist A/V  
- PC browser: black (no partner video)  

## av_path (hub)
- web: force_relay=true policy=relay ice=connected relay→relay frames_in=0 frames_out=high audio_in=high  
- android: force_relay=0 policy=all frames_in=high frames_out=0  

## Scorecard
- av-verify PASS signaling + TURN HOT max_rb high  
- Product still FAIL one-way  

## Compound target
→ wiki/one-way-video.md
