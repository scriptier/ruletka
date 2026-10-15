# Spec: connect without a camera

**Status:** active · 2026-08-14  
**Why:** Laptop webcam broken. Product currently stays on “Linking cameras…” if the peer has audio but no video.

```text
GOAL: A conversationalist with mic but no camera can still match and talk.
DONE WHEN:
  1) No-cam client still sends SDP (audio-only GUM; offer/answer not aborted).
  2) Partner with a camera still sees/hears the no-cam person (audio +
     cylinder / avatar picture, not infinite Linking / black void).
  3) No-cam person still sees/hears the partner who has a camera.
  4) Cam-present 1v1 is unchanged (do not regress product.ok path).
EVAL:
  - startPreview / openLocalStream: video NotFound → audio-only, not hard fail
  - hasLiveRemoteMedia / awaitingRemoteVideo: live audio counts as connected
  - self_hide / partnerCamHidden when we know they have no video
  - node --check ui/live.js · mediasessionMultiSafety
MUST NOT: pool>0; invent product.ok; require deploy/APK claims without smoke
```

Laptop uses **prod** `ruletka.vip`. Phone **0.1.384 / vc392**. `webrtc.js?v=322` (no 3-relay spread). Human 2026-08-14: **laptop Chrome linked**. av-verify `20260814T062553Z` product **ok** app_vc **392** web fin/fout **358/0** android **0/292** (no laptop cam) ice connected relay→relay. Offer/answer **1543 / 3390** ms; ICE up ~7s after match. Chrome 321 3-relay = no answer; Firefox 1-relay worked first. **Linking-speed GOAL_MET not claimed** (slow for taste). PC↔Android must stay green.

**Human 2026-08-14:** laptop browser ↔ desk PC browser **works**. Residual **Pixel ↔ laptop** is ICE, not “slow SDP”: av-verify `051134Z` product.**no-media** mto/mta **1567/2826** · answer **relay_candidates=0** · android ICE **failed** · frames 0/0. Answer wait was capped **480** (fail-open host SDP vs laptop `policy=relay`). Disk: full **1200** wait, early-exit on first relay. **Needs APK.** Phone 0.1.378/vc386 still 480. No product.ok invent.

**Portrait must be laptop-only:** do **not** treat “audio live, no frames yet” as no-cam — that painted the cylinder on a **PC camera**. `noLocalCamera` = **zero video tracks**. Advertise `no_cam` at **match + DC**. Laptop no-cam video m-line is **recvonly** (`webrtc.js?v=323`) so Android 384 never gets a dummy sendrecv track (that sat on Linking). PC with a cam still sendrecv. Disk Android also paints cylinder immediately on audio-only (no 2.2s wait). **Needs rsync webrtc 323 + live 592.** Phone portrait-without-2.2s needs APK; 384 can still fire 2.2s hide once recvonly lands. **No product.ok invent.**

**Audio:** snow / pouring-rain hiss when linked to the laptop — 125% mic-boost Web Audio + compressor lifts old-mic noise and kills AEC. Disk `live.js?v=582` skips boost on audio-only. Laptop is prod until deploy. Workaround: Settings → Mic **100%**.

**Android / phone NS (2026-08-14, herd `20260814T042437Z`):** `prefs.noiseReduction` is **default ON** — same as browser GUM (`ui/webrtc.js`): `echoCancellation` + `noiseSuppression` + `autoGainControl`. **No RNNoise.** Settings toggle; `live.tsx` calls `setNoiseReduction` on load + focus; `applyFullAudioProcessing` re-applies on existing tracks. **Contract:** Settings Off → next GUM EC/NS/AGC **false**. **ns-gum landed** (herd `20260814T042437Z`): `audioConstraints()` reads `this.noiseReduction`. Off sticks on the next getUserMedia. Hiss was mic-boost Web Audio **125%** (lifts old-mic noise / kills AEC), not missing NS. Installed APK is **0.1.378 / vc386** — NS hops are **disk only** until human says build apk. Phone smoke still requires a new APK. **No product.ok invent.**
