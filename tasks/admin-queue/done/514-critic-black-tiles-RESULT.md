# 514 — critic: 3-col black Laptop + Partner (read-only)

Scope: read-only review of `ui/live.js`, `ui/live-stage.css`, `ui/live.html`,
`mobile/src/live/stageStreams.ts`, `mobile/src/live/LiveStageVideo.tsx`
(current disk state). No product files touched.

## Findings — 5 PASS, 1 FAIL

1. **PASS (with a caveat) — hookNoCam does not treat an empty transceiver as painted cam**
   `streamHasLiveVideoTrack` (`ui/live.js:1901-1910`) → `videoTrackLooksLiveCamera`
   (`ui/live.js:1893-1899`) only checks `readyState`/label, **not** `t.muted` or
   painted pixel width — a deliberate choice per the comment at
   `ui/live.js:1895-1897` ("Inbound RTC tracks start muted... treating it as
   audio-only covers #remote while frames_in is already growing (214314Z
   Courtier black)"). In isolation this function *could* misclassify a
   `sendrecv` transceiver with no attached track as a live cam. In practice
   this scenario is prevented upstream: `_ensureNoCamVideoRecvonly`
   (`ui/webrtc.js:1670-1690`, called from `1643`, `1818`, `1882`, `2706`,
   `3690`) forces any no-local-video video transceiver to `recvonly` so a
   no-cam peer never advertises a `sendrecv` slot with no track — the
   offerer path does the same at `ui/webrtc.js:2693-2699`
   ("True no-cam: recvonly (sendrecv empty → Android dummy / Linking)").
   Net: no empty/never-flowing video transceiver reaches a peer's
   `hookNoCamPortraitFromStream`, so this check holds for the shipped
   sender+receiver pair, but the receiver function alone has no direct
   guard — worth tightening if the sender-side invariant is ever relaxed.

2. **FAIL — setNoCamPortrait does not work for remote-third / #third-no-cam**
   `setNoCamPortrait(which, on, avatarUrl)` (`ui/live.js:9579-9598`) only
   branches on `which !== "local"` and always targets `#remote-no-cam` /
   `#remote-no-cam-img` / `#tile-remote` (`ui/live.js:9580-9583`). It is
   **never called** with `"remote-third"` anywhere in the file (grepped all
   call sites: `ui/live.js:1955, 1997, 1999, 9609, 9643, 16410, 37172,
   37262` — none pass `"remote-third"`). For the third slot,
   `hookNoCamPortraitFromStream` (`ui/live.js:2004-2012`) instead just
   toggles a CSS class: `tile.classList.toggle("has-no-cam-portrait",
   streamLooksAudioOnly(stream))` on `#tile-third` — it never clears
   `#third-no-cam`'s `hidden` attribute. `#third-no-cam` (`ui/live.html:1037`)
   is therefore dead: nothing in `ui/live.js` references the string
   `"third-no-cam"` at all (zero hits). The CSS explicitly expects the JS
   side to unhide it — `ui/live-stage.css:22300-22302`: *"Extra-tile no-cam
   (211817Z / 223218Z **Laptop+Partner black**). #third-no-cam paints only
   when unhidden (n-web setNoCamPortrait)"* and `ui/live-stage.css:22378`:
   *"Hidden third portrait stays gone — n-web unhide is the paint latch."*
   Since the `hidden` attribute is never removed, the `#third-no-cam[hidden]`
   rule (`ui/live-stage.css:22379-22384`, `display:none !important`) always
   wins over the `.has-no-cam-portrait` class rule
   (`ui/live-stage.css:22304-22320`), while the video element underneath is
   simultaneously de-prioritized (`ui/live-stage.css:22333-22338`, z-index
   only, no visibility change) with no live frames. Net: third tile shows
   neither video nor portrait — a black tile. This is the incident the CSS
   comment itself names ("Laptop+Partner black") and matches task 514's
   title exactly.

3. **PASS — #remote-no-cam[hidden] is still display:none**
   `ui/live-stage.css:22405-22409`: `#tile-remote.has-no-cam-portrait
   #remote-no-cam[hidden], #tile-remote #remote-no-cam[hidden] { display:
   none !important; visibility: hidden !important; opacity: 0 !important;
   ... }`. Only the `:not([hidden])` rule at `ui/live-stage.css:22393-22404`
   paints it, gated on JS clearing `hidden` via `setNoCamPortrait`
   (`ui/live.js:9590-9591`).

4. **PASS — extraPeerCount>=1 splits Android stage**
   `shouldShowExtraRemoteTile` (`mobile/src/live/stageStreams.ts:288-294`)
   returns true once `extraPeerCount >= 1` even with `remoteStream2` still
   null. `LiveStageVideo.tsx:609`: `extraJoining = extraPeerCount >= 1 &&
   !remoteStream2`, and `LiveStageVideo.tsx:620`: `multiRemote =
   !!(remoteStream2 || remoteStream3 || extraJoining)` — `extraPeerCount>=1`
   alone flips `multiRemote` to `true`, which mounts the split/multi-tile
   tree. `pickStageChromeLayout` mirrors this: `wrapFirstPartner =
   !!opts.huntingThird || has2 || has3 || extra >= 1`
   (`mobile/src/live/stageStreams.ts:369-370`).

5. **PASS — no pool>0 gate, no force_relay flip originating from no-cam/trio logic**
   Grepped `ui/live.js` for `pool *> *0` — zero hits anywhere in the file.
   `force_relay` near the no-cam/trio code only echoes the hub's message,
   e.g. `ui/live.js:28136` (`!!msg.force_relay !== !!alreadyRelay` — compares,
   does not invent), `ui/live.js:28191` (`if (msg.force_relay &&
   typeof setSessionForceRelay === "function")`), `ui/live.js:29881`
   (same pattern, "Re-arm force_relay when hub said so"). No trio/no-cam
   code path sets `force_relay` itself.

6. No fabricated pass/fail token used for this report; every finding above
   is cited to file:line evidence only.

## OWN
RESULT only. No product files edited.
