# Spec: Android match UX — location, stars, blur

> Do **not** thrash WebRTC/ICE/force_relay (product.ok 0.1.297+).

```text
GOAL: On Android live match, partner location and stars are visible/useful; privacy blur works as mosaic (not black hole).
DONE WHEN:
  1) LOCATION: After match (or partner_geo), PartnerChrome shows flag/country/city OR clear "Location hidden" if hide_ip — not stuck forever on "Looking up location…" when hub sent geo
  2) STARS: Partner ★ always visible mid-match (0 dimmed OK); self stars on home/settings still work; gift bar can spend when balance>0
  3) BLUR: With blur mode intro/hold, partner stage shows PartnerBlurVeil mosaic + Show video; Unblur reveals video (zOrder correct); friends never veiled
EVAL:
  - Code: partner_geo updates state; stars from peers[].stars + hello_ok; blur zOrder 0 under veil
  - Human smoke: match PC↔phone — eye/blur works; location line not empty when web shows location; ★ chip visible
  - Mute UX: at most one "they muted you" surface mid-match (LiveStatusBanners only — not stage + banner + bottom stack)
CHECKPOINTS:
  - No ICE/force_relay/pool changes
  - APK only after all three lanes or user asks
OUT OF SCOPE: SFU, redesign gifts economy, web blur rewrite
LANE: three implementers with non-overlapping OWN when possible
VERIFY: log lines blur/geo; optional unit tests for formatLocLine / normalizePeer
```

### Status: Active — hop2 2026-08-10 (SurfaceView chrome + geo buffer + mosaic)

| Lane | Fix |
|------|-----|
| **CHROME** | Partner RTCView **zOrder 0** always — PartnerChrome/location/★ no longer under SurfaceView |
| BLUR | Pixel mosaic + force `#45536c` base (caller transparent no longer wins); partner self-hide mosaic |
| STARS | ★ contrast; trust chip gold when ★0+trust>0; no fake spendable |
| LOCATION | 1v1 partner_geo buffer always flush; flag-only never stuck “Looking up…” |

### Status update 2026-08-11 (verify-gated thrash)

| Piece | Value |
|-------|--------|
| Smoke APK | **0.1.329-vc337** (`ruletka-latest.apk`) — pre-APK L0–L2 gated |
| Identity | `PartnerIdentityDock` under stage when **native** layout; top chrome always when matched |
| Blur | Keep RTC mounted; Modal only while `showPrivacyBlur` (Android) |
| Stars | `displayPartnerStars` = max(stars, trust) |
| Brand | Watermark **ruletka.me** |
| Web | hop10 `live.js?v=541` for stuck-offer / linking |

No GOAL_MET without human PC↔phone smoke (`SMOKE-NEXT.md`) + **product.ok** for connect claims.

**Open gap (post-smoke if FAIL):** dock currently gated `!isBrowserLayout` — browser layout may lack under-stage identity strip (top chrome only).
