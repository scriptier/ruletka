# BLUR-F1 Soft live blur architecture — RESULT

## Status
**COMPLETE** (architecture + plan §F polish only — **no product UI code**, **no invent multi / blur product PASS**)

## OWN
- `knowledge/specs/BLUR-MULTI-FINISH-PLAN.md` section **F** polish
- RESULT: `tasks/grok-loop/done/BLUR-F1-architecture-RESULT.md` (this file)
- Card: `tasks/grok-loop/running/BLUR-F1-architecture.md` → `done/`
- **Did not** edit `live.tsx` / `LiveStageVideo` / `PartnerBlurVeil` / native Java / APK / deploy

## Goal
Document Android **PC-like soft live blur** architecture: why current solid `PartnerBlurVeil` cannot match PC mosaic video blur, and the VideoSink → downscale → blur → ImageView path with veil fallback.

---

## 1. Product problem

| Surface | Today | Desired |
|---------|-------|---------|
| **PC browser** | Soft **live** blur of partner video (mosaic / frosted faces still motion) | Keep |
| **Android app** | Solid mid-tone **PartnerBlurVeil** mosaic (+ fullscreen Modal) over mounted RTCView | **PC-like soft video blur** while `remoteBlurred` |

User signal (plan §F): “Blur still doesn’t work” / veil reads as solid slab, not soft video. Prior waves (BM1–BM5) fixed **mount / z-order / prefs apply** so veil *can* show; they did **not** deliver soft *video sampling* on Android.

---

## 2. PC reference algorithm (`drawSoftBlurredVideo`)

**Source of truth:** `ui/live.js` — `drawSoftBlurredVideo` (~18365–18427) + `startPeerBlurCanvas` / `needsCanvasVideoBlur`.

| Step | PC behavior |
|------|-------------|
| Gate | Mobile UA / coarse pointer → **canvas** path; desktop often CSS `filter:blur` on `.peer-slot-blurred` video |
| Sample | Read `<video>` pixels via `drawImage` |
| Tiny | Intermediate canvas **~48px** wide (aspect-preserved height) |
| Upscale | Output canvas **~360px** wide; `imageSmoothingQuality = "high"` |
| Extra | Optional `ctx.filter = "blur(6px) saturate(0.9)"` |
| Dim | `rgba(10,12,18,0.18)` privacy wash |
| Not ready | Soft slate gradient `#1c2230` → `#12161e` (never pure black) |
| Loop | `requestAnimationFrame` while slot blurred; stop on clear |
| Multi | Per-slot canvas: `partner-blur-canvas` / `remote2-blur-canvas` / `third-blur-canvas` (see BM1-pc-blur-canvas-audit) |

**Why canvas on mobile web:** CSS `filter:blur()` on `<video>` often paints **solid black** on Android/iOS browsers — same class of “cannot trust view-compositor blur on video surfaces.”

---

## 3. Why Android RN cannot copy PC BlurView / CSS

| Constraint | Detail |
|------------|--------|
| **RTCView = SurfaceView** | `react-native-webrtc` `WebRTCView` renders via `SurfaceViewRenderer` (separate window/layer) |
| **zOrder ≥ 1** | Composites **above** entire RN window — chrome/veil lose (BM2 veil z-order: force **0** under privacy) |
| **Cannot sample SurfaceView** | RN `BlurView` / `backdrop-filter` / screenshot-of-view do **not** read SurfaceView video pixels; they sample the RN hierarchy only |
| **Must keep RTCView mounted** | Unmount mid-call crashes WebRTC on some devices (`VideoView` / `LiveStageVideo` / CONNECTIVITY_LOCK) |
| **Current cover** | Opaque `PartnerBlurVeil` (`#45536c` + mosaic cells) + Android `Modal` while `showPrivacyBlur` — intentional **non-sampling** privacy slab |

**Conclusion:** Soft live blur on Android requires a **second consumer of the same `VideoTrack`** (VideoSink), not a post-process of the SurfaceView pixels.

---

## 4. Target architecture (Android soft live blur)

```
Remote MediaStream (streamURL / toURL())
        │
        ▼
  VideoTrack (org.webrtc)
        │
        ├── existing: RTCView / SurfaceViewRenderer  (live decode, zOrder 0 while privacy)
        │
        └── new: SoftBlur VideoSink  (optional second sink)
                    │
                    ▼
              downscale frame  (~48px wide, PC parity)
                    │
                    ▼
              soft blur       (API 31+ RenderEffect optional; else multi-scale Canvas)
                    │
                    ▼
              upscale + dim   (~view size / ~360 logical, dim wash)
                    │
                    ▼
              ImageView / Bitmap display  (RN SoftBlurRemote overlay)
                    │
                    ▼
         visible while remoteBlurred && active && hasFrame
```

### 4.1 Native (`SoftBlurVideoView` — lane F2)

| Item | Spec |
|------|------|
| Package / access | Resolve `streamURL` → `MediaStream` via `WebRTCModule.getStreamForReactTag` (package-private today → **same package** `com.oney.WebRTCModule` under app `java/` **or** controlled reflection). Then first `VideoTrack` |
| Sink | Implement `org.webrtc.VideoSink`; `videoTrack.addSink(this)` when `active=true` + stream set; `removeSink` on inactive / unmount / stream change |
| Frame throttle | **~12–15 fps** (not full 30) — privacy soft look + CPU |
| Tiny buffer | **~48px** wide intermediate (PC `tinyW = 48`) |
| Blur | Prefer scale-down + smooth scale-up; API 31+ may use `RenderEffect.createBlurEffect`; always mid-tone, never pure `#000` |
| Display | `ImageView` (or custom View drawing Bitmap) **inside** the native view hierarchy — RN elevation can cover / sit above zOrder-0 RTCView |
| Props | `streamURL: string`, `active: boolean` (mirror optional later; partner remote = no mirror) |
| Threading | Convert I420/VideoFrame → Bitmap off UI thread if needed; **setImageBitmap** on UI thread; drop frames if previous still processing |
| Lifecycle | On detach / `active=false`: remove sink, recycle bitmaps, clear ImageView |
| Multi | One SoftBlur instance **per remote tile** (same as PC per-slot canvas) |

### 4.2 RN wrapper (`SoftBlurRemote` — lane F3)

| Item | Spec |
|------|------|
| File | `mobile/src/live/SoftBlurRemote.tsx` + export from `index.ts` |
| Bind | `requireNativeComponent('SoftBlurVideoView')` (name matches ViewManager) |
| Props | `streamURL` from `stream.toURL()` (same as `VideoView`); `active={privacyBlur}`; `style` absoluteFill |
| Graceful stub | If native missing (web / failed link): render `null` → stage keeps veil-only path |
| No MediaSession | Do not touch ICE / tracks / remount RTCView |

### 4.3 Stage integrate (`LiveStageVideo` — lane F4)

Stack while `privacyBlur` (partner tile / multi remote tiles):

```
[ bottom ]  VideoView RTCView  zOrder={0}   KEEP MOUNTED always when stream
[ middle ]  SoftBlurRemote     elev shell   active when streamURL + privacy
[ top    ]  PartnerBlurVeil    fallback     until soft blur has painted OR soft inactive
[ chrome ]  existing HUD / eye (unchanged ownership)
```

| Rule | Detail |
|------|--------|
| Soft on | `privacyBlur && stream && streamURL` → SoftBlur `active=true` |
| Veil fallback | Show `PartnerBlurVeil` when soft blur **unavailable**, **inactive**, or **no frame yet** (slate period). Optional: hide veil after first soft frame event if F2 exposes `onFirstFrame` |
| Never unmount RTC | Privacy still uses keepRtc=1 contract |
| Multi | Same stack per `splitTiles` remote (remote2/3) — BM3 already places veil on all idx; F4 adds SoftBlur beside veil |
| partnerHide | Unrelated black/cam-off cover — not SoftBlur |

### 4.4 Modal chrome (`live.tsx` — lane F5)

| Today | Soft-blur era |
|-------|----------------|
| Opaque Android `Modal` while `showPrivacyBlur` blocks SurfaceView punch-through **and** hides soft paint under it | Prefer **transparent Modal** (CTA chrome only: Show video / eye) so SoftBlur under stage remains visible; **or** drop full-screen opaque fill when SoftBlur reports painting |
| Show video / prefs Off/Intro/Hold | **Unchanged** apply paths (`applyMatchBlurVeil`, eye toggle) |

Honesty: F5 is chrome only; does not invent Hold product PASS.

### 4.5 Ship gate (lane F6)

APK rebuild + device smoke Hold/Intro/Off — **human proceed**; agent must not invent PASS. Default-hold backlog (F7) is separate product prefs policy.

---

## 5. Lane map (OWN non-overlap)

| Lane | OWN | Depends on | Deliverable stamp |
|------|-----|------------|-------------------|
| **F1** | Plan §F + this RESULT | — | **architecture COMPLETE** (this hop) |
| **F2** | `mobile/android/app/src/main/java/**` SoftBlur* + package register | F1 | native view + ViewManager |
| **F3** | `mobile/src/live/SoftBlurRemote.tsx` + `index.ts` export | F2 name contract (can stub) | RN wrapper |
| **F4** | `LiveStageVideo.tsx` + `liveStyles` if needed | F3 stub OK | soft + veil fallback on stage |
| **F5** | `mobile/app/live.tsx` Modal privacy block only | F4 preferred | transparent chrome / Show video |
| **F6** | APK + device smoke (human proceed) | F2–F5 | **human-smoke-open** until paste |

**Do not** dual-edit: F4 vs F5 (stage vs Modal); F2 vs F3 (native vs TS); MediaSession / ICE **out of scope**.

---

## 6. Contracts & non-goals

### Contracts (must keep)

1. Partner RTCView **mounted** at **zOrder 0** while privacy.  
2. Mid-tone privacy — **never pure black** OLED “broken cam”.  
3. Friends / prefs Off never auto-veil (existing apply rules).  
4. Soft blur is **viewer-local** privacy (does not change outbound track).  
5. Frame path is **sink clone**, not replace of SurfaceView renderer.  
6. Connect / ICE / pool=0 / MediaSession **untouched** by F lanes.

### Non-goals (this architecture)

- iOS soft blur (later; different sampler).  
- Self/local soft blur parity (PC has self canvas; Android partner-first).  
- RN community BlurView over RTCView (proven non-sampling).  
- Unmount-to-black privacy.  
- Invent multi product PASS / Hold PASS / GOAL_MET.

---

## 7. Failure modes → fallback

| Failure | Behavior |
|---------|----------|
| Native module missing | SoftBlurRemote null → veil-only (today’s path) |
| streamURL empty / no VideoTrack | Soft inactive; veil stays |
| Sink not getting frames (black peer) | Soft slate or hold last good; veil until first frame |
| CPU thermal | Drop to lower fps / skip frames; never block WebRTC decoder |
| Unblur (`remoteBlurred=false`) | `active=false`, remove sink, hide SoftBlur + veil, restore RTC z-order policy as today |

---

## 8. Verify plan (downstream; not this hop)

| Check | Owner |
|-------|--------|
| Static: SoftBlur* registered in MainApplication packages | F2 |
| Static: SoftBlurRemote export + LiveStageVideo privacy stack | F3/F4 `verify-match-ux` extend later |
| Device: logcat soft blur first frame + veil peel | F6 |
| Human: Off / Intro / Hold + eye mid-match **soft** mosaic (motion under frost) | Human |
| Multi tiles soft blur | Human after F4 multi path; no invent PASS |

---

## 9. Evidence sources (read-only this hop)

| Source | Used for |
|--------|----------|
| `ui/live.js` `drawSoftBlurredVideo` / `needsCanvasVideoBlur` | PC algorithm parity numbers |
| BM1-pc-blur-canvas-audit-RESULT | Per-slot canvas IDs / multi |
| `VideoView.tsx` / `LiveStageVideo.tsx` / `PartnerBlurVeil.tsx` | Keep-mounted + z0 + solid veil today |
| `react-native-webrtc` `WebRTCView` / `WebRTCModule.getStreamForReactTag` | streamURL → VideoTrack pattern |
| BM2-veil-zorder / BM3-multi-tile-blur | Elev shell + multi tile veil already code-shipped |
| Plan §F (2026-08-12) | Problem statement + lane table |

---

## 10. Explicit non-claims (no invent PASS)

| Claim | Verdict |
|-------|---------|
| Soft live blur on device | **NOT shipped** — architecture only |
| Blur Off/Intro/Hold product PASS | **NOT claimed** — human-smoke-open |
| Multi soft blur / multi GOAL_MET | **NOT claimed** |
| APK / deploy | **NOT this hop** |
| Product UI code | **None** |

---

## 11. Files this hop

| Path | Change |
|------|--------|
| `knowledge/specs/BLUR-MULTI-FINISH-PLAN.md` | §F polish + F1 COMPLETE stamp |
| `tasks/grok-loop/done/BLUR-F1-architecture-RESULT.md` | this RESULT |
| Card | `running/BLUR-F1-architecture.md` → `done/BLUR-F1-architecture.md` |

## Connect risk
**None** — docs/architecture only.

## COMPLETE
**COMPLETE.** Architecture for Android PC-like soft live blur documented: PC tiny-canvas upscale; Android SurfaceView non-sampleable; VideoSink → downscale → blur → ImageView; PartnerBlurVeil fallback; F2–F6 OWN map. **No product UI code. No invent multi / blur product PASS.**
