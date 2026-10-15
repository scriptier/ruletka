# BM1-pc-blur-canvas-audit — RESULT

**Status:** COMPLETE  
**OWN:** `ui/live.js` blur canvas + `setPartnerBlur` + remote2/third per-tile blur (read-only)  
**Date:** 2026-08-12T02:49:02Z  
**Syntax:** `node --check ui/live.js` → **PASS** (exit 0)  
**Code change:** none (verify-only)

## Goal

Document partner vs remote2/third blur canvas IDs and draw path when `peer-slot-blurred`. Answer: does multi tile get a canvas?

## Verdict (short)

| Question | Answer |
|----------|--------|
| Does **main partner** get blur canvas? | **Yes** — id `partner-blur-canvas`, only when `needsCanvasVideoBlur()` |
| Does **remote2** get blur canvas? | **Yes** — id `remote2-blur-canvas` on parent `#remote2-wrap` |
| Does **remote-third** get blur canvas? | **Yes** — id `third-blur-canvas` on parent `#tile-third` |
| Is `setPartnerBlur` multi-aware? | **No by design** — aliases `setPeerElBlur("remote", on)` only; comment says 3rd/4th use per-tile buttons |
| Shared draw path? | **Yes** — all slots use `startPeerBlurCanvas` → `drawSoftBlurredVideo` |

**Multi tiles do get canvas** (dynamic create + RAF draw) on canvas-needed clients. Desktop skips canvas and relies on CSS `.peer-slot-blurred` filter.

---

## 1. Slot maps (IDs)

```11916:11927:ui/live.js
const PEER_SLOT_TILE = {
  remote: "tile-remote",
  remote2: "remote2-wrap",
  "remote-third": "tile-third",
};
const PEER_SLOT_CANVAS = {
  remote: "partner-blur-canvas",
  remote2: "remote2-blur-canvas",
  "remote-third": "third-blur-canvas",
};
/** @type {Record<string, number>} */
const peerBlurRafByEl = {};
```

| Slot | Video el | Tile / canvas parent | Canvas id | State key |
|------|----------|----------------------|-----------|-----------|
| `remote` | `#remote` | `#tile-remote` | `partner-blur-canvas` | `peerBlurredByEl.remote` (+ legacy `partnerBlurred`) |
| `remote2` | `#remote2` | `#remote2-wrap` | `remote2-blur-canvas` | `peerBlurredByEl.remote2` |
| `remote-third` | `#remote-third` | `#tile-third` | `third-blur-canvas` | `peerBlurredByEl["remote-third"]` |

Canvases are **not** in static HTML; created at runtime by `ensureVideoBlurCanvas(tileId, canvasId)` (appends `<canvas class="video-blur-canvas">` to parent).

HTML hooks present:
- `#remote2-wrap` + `#btn-blur-remote2` — `live.html` ~651–660  
- `#tile-third` + `#btn-blur-remote-third` — `live.html` ~1007–1040  
- `#btn-blur-remote-main` (per-tile) + `#btn-blur-remote` (side-rail) for main partner  

---

## 2. `setPartnerBlur` vs per-tile blur

### Side-rail / intro / global partner API

```18397:18400:ui/live.js
function setPartnerBlur(on) {
  // Side-rail blur = main remote only (3rd/4th use per-tile blur buttons)
  setPeerElBlur("remote", on);
}
```

```18402:18415:ui/live.js
function togglePartnerBlur() {
  // User took control — cancel pending auto-unblur
  clearIntroBlurTimer();
  introBlurGen++;
  togglePeerElBlur("remote");
  ...
}
```

Callers of `setPartnerBlur` (main only):
- `applyStrangerIntroBlur` (~946) — intro / always-blur / low-rep  
- intro auto-unblur timer (~1004)  
- unblur coach OK (~913)  
- hangup / match cleanup paths (~18575, ~25696, ~33095, ~33663, etc.)

**Does not** blur `#remote2` or `#remote-third`.

### Per-tile API (all three slots)

```12216:12236:ui/live.js
function togglePeerElBlur(slot) {
  if (!peerBlurredByEl.hasOwnProperty(slot)) return;
  if (slot === "remote") {
    clearIntroBlurTimer();
    introBlurGen++;
  }
  setPeerElBlur(slot, !peerBlurredByEl[slot]);
  ...
}

function setPeerElBlur(slot, on) {
  if (!peerBlurredByEl.hasOwnProperty(slot)) return;
  peerBlurredByEl[slot] = !!on;
  setPeerBlurUi(slot, peerBlurredByEl[slot]);
  if (peerBlurredByEl[slot]) startPeerBlurCanvas(slot);
  else stopPeerBlurCanvas(slot);
  ...
}
```

Click wiring (~32364–32375):
- `btn-blur-remote-main` → `togglePeerElBlur("remote")`
- `btn-blur-remote2` → `togglePeerElBlur("remote2")`
- `btn-blur-remote-third` → `togglePeerElBlur("remote-third")`
- `btn-blur-remote` (side rail) → `togglePartnerBlur()` → remote only

### UI class toggles (`setPeerBlurUi` ~12129–12158)

| Class / flag | Where |
|--------------|--------|
| `peer-slot-blurred` | on tile parent for **every** slot |
| `partner-blurred` | **only** `slot === "remote"` on `#tile-remote` |
| `partnerBlurred` global | synced from remote slot only |
| `is-active` on blur btn | all three `btn-blur-*` |

---

## 3. Canvas draw path (when `peer-slot-blurred`)

### Gate: canvas vs CSS

```18239:18256:ui/live.js
function needsCanvasVideoBlur() {
  // mobile UA / hover:none / pointer:coarse / touch+Chrome → true
  // else false → desktop CSS filter path
}
```

```12275:12322:ui/live.js
function startPeerBlurCanvas(slot) {
  if (!needsCanvasVideoBlur()) {
    // Desktop: CSS filter on .peer-slot-blurred is enough
    stopPeerBlurCanvas(slot);
    return;
  }
  const tileId = PEER_SLOT_TILE[slot];
  const canvasId = PEER_SLOT_CANVAS[slot];
  const video = $(slot);  // video element id == slot name
  ...
  const canvas = ensureVideoBlurCanvas(tileId, canvasId);
  canvas.hidden = false;
  canvas.classList.add("is-active");
  // boot slate + loadeddata/playing kick + rAF tick
  drawSoftBlurredVideo(ctx, video, canvas, { mirror: false });
  peerBlurRafByEl[slot] = requestAnimationFrame(tick);
}
```

| Step | remote | remote2 | remote-third |
|------|--------|---------|--------------|
| State on | `peerBlurredByEl.remote` | `.remote2` | `["remote-third"]` |
| Parent for canvas | `tile-remote` | `remote2-wrap` | `tile-third` |
| Sample video | `#remote` | `#remote2` | `#remote-third` |
| RAF map key | `peerBlurRafByEl.remote` | `.remote2` | `["remote-third"]` |
| Stop | cancel rAF, remove `is-active`, `hidden=true` | same | same |

Legacy wrappers:
- `startPartnerBlurCanvas` / `stopPartnerBlurCanvas` → slot `"remote"` only (~18349–18356)

### Draw implementation (`drawSoftBlurredVideo` ~18285–18347)

1. If video not ready (`readyState < 2` / no dims) → soft slate gradient (not pure black)  
2. Downscale to 48px-wide tiny canvas → upscale to 360-wide output  
3. Optional `ctx.filter = "blur(6px) saturate(0.9)"`  
4. Dim overlay `rgba(10,12,18,0.18)`  
5. Shared offscreen: `drawSoftBlurredVideo._tiny` (one buffer for all slots; OK single-threaded)

Partner remote blur is **not** mirrored; self blur is (separate `startSelfBlurCanvas`).

### Resync / clear

| Path | Behavior |
|------|----------|
| `syncAllPeerMediaChrome` (~12325) | all 3 slots: UI + start/stop canvas from `peerBlurredByEl` |
| `clearMultiPartyChrome` (~12546) | all slots blur=false, `stopPeerBlurCanvas`, then sync |
| `registerPeerUi` (~12411–12417) | extras: `shouldDefaultBlurExtraPeer` → `setPeerElBlur(elId, true)` only for remote2/third when always-blur / low-rep (never friends/teammates); else preserve UI state |

---

## 4. CSS pairing (context; not OWN edit)

**Desktop CSS blur (always, not media-gated)** — `live-stage.css` ~18133–18138:

```css
.tile-remote.peer-slot-blurred .vid#remote,
.remote-b-wrap.peer-slot-blurred .vid,
.tile-third.peer-slot-blurred .vid#remote-third {
  filter: blur(18px) saturate(0.85);
  transform: scale(1.06);
}
```

**Show canvas when active** — ~18140–18145:

```css
.tile-remote.peer-slot-blurred .video-blur-canvas.is-active,
.remote-b-wrap.peer-slot-blurred .video-blur-canvas.is-active,
.tile-third.peer-slot-blurred .video-blur-canvas.is-active {
  display: block;
}
```

**Legacy main-partner path** still uses `.partner-blurred` + touch media-query that forces video `opacity: 0.001` and `filter: none` (~3209–3235), and shows canvas via `.tile-remote.partner-blurred .video-blur-canvas.is-active` (~3260).

### Implication for multi (remote2 / third) on canvas devices

- JS correctly starts per-slot canvas when blur is on.  
- Multi CSS applies `filter: blur(18px)` on the **video** without a touch-only “hide raw video” counterpart like main `.partner-blurred`.  
- Canvas sits above video (`z-index: 2` on remote2/third canvas rules; base `.video-blur-canvas` is `z-index: 4`), so opaque canvas should cover a black-filtered video **if** rAF draw is healthy.  
- Residual risk: if canvas fails / not yet `is-active`, multi tile can hit the known black `filter:blur` on `<video>` path more easily than main partner.

---

## 5. Policy asymmetry (intro vs multi)

| Behavior | Main `#remote` | `#remote2` / `#remote-third` |
|----------|----------------|------------------------------|
| 3s intro blur then auto-unblur (high rep) | Yes — `applyStrangerIntroBlur` | **No** |
| Stay blurred (always-blur / starter / low rep) | Yes — intro path | Yes — `shouldDefaultBlurExtraPeer` on `registerPeerUi` |
| Manual toggle | side-rail + tile btn | tile btn only |
| Friends / teammates auto-blur | N/A (intro stranger path) | Forced **off** (`isTeammateRole`) |

---

## 6. Checklist

| Check | Verdict |
|-------|---------|
| PEER_SLOT_CANVAS has remote2 + third ids | **PASS** |
| PEER_SLOT_TILE parents match HTML | **PASS** (`remote2-wrap`, `tile-third`) |
| `setPeerElBlur` starts/stops canvas per slot | **PASS** |
| `setPartnerBlur` → remote only | **PASS** (documented) |
| Buttons wire remote2 / third | **PASS** |
| Multi tile canvas on mobile UA | **PASS** (same `needsCanvasVideoBlur` gate) |
| Multi tile canvas on desktop | **N/A by design** — CSS filter only |
| Static canvas nodes in HTML | **absent** — dynamic create OK |
| Intro blur applies to multi extras | **No** (policy gap / intentional?) |
| Touch CSS hides multi video under canvas | **Partial** — main has opacity hide; multi relies on canvas cover |

---

## 7. Answer to OWN question

> Document setPartnerBlur vs per-tile blur; does multi tile get canvas?

1. **`setPartnerBlur(on)`** = thin wrapper around **`setPeerElBlur("remote", on)`**. Side-rail, intro blur, auto-unblur, and hangup cleanup for the **primary** partner only.  
2. **Per-tile blur** = `peerBlurredByEl` + `setPeerElBlur` / `togglePeerElBlur` for `"remote" | "remote2" | "remote-third"`, with distinct canvas ids and parents.  
3. **Yes — multi tiles get canvas** when `needsCanvasVideoBlur()` is true: `remote2-blur-canvas` and `third-blur-canvas`, drawn by the same `drawSoftBlurredVideo` rAF loop as the main partner canvas.

No code changes in this task.
