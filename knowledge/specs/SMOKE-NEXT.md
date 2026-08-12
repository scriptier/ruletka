# Human smoke checklist — next product hop

> UX ship **latest APK** (≥0.1.333) + web hop11 (`live.js?v=544`) + chrome autohide (`live-stage.css?v=374`).  
> Nightly loop active — agents smoke Pixel via adb; human paste optional when awake.

## A. Install

- [ ] APK: `mobile/artifacts/ruletka-latest.apk` (target **≥ 0.1.340-vc348**; newer after nightly hop)
- [ ] If phone on adb: `build-apk-local.sh` may auto-push to Download/
- [ ] Web PC: hard-refresh → **`live.js?v=544`** + **`live-stage.css?v=374`**
- [ ] Same-WiFi force_relay pure path as usual

## B. Mobile UX (`current-ship-ux` / `current-mobile-ux`)

- [ ] **1. Name:** Partner name (or short-id fallback) visible mid-match — dock under stage and/or top chrome
- [ ] **2. Stars:** ★ readable (real number or 0 dimmed; trust chip if trust>0)
- [ ] **3. Location:** flag/country/city after match when browser shows loc — not stuck “Looking up…”; hide_ip → Location hidden
- [ ] **4. Local blur:** mid-tone mosaic (not pure black); Show video / unblur works; app does not crash on match
- [ ] **5. Partner Hide (browser):** Android “Partner hidden” mosaic not pure black
- [ ] **6. Mute:** at most one they-muted surface (prefer bottom banners)
- [ ] **7. Bottom chrome:** Stop · Report · Next usable; swipe-to-next if wired

## C. Linking speed (`current-linking-speed`) — stretch after UX green

- [ ] **1.** Linking ends without multi-second freeze feel after match
- [ ] **2.** Optional: `./scripts/hub-match-speed.sh` — note mto/mta vs residual ~1749 / ~4097
- [ ] **3.** `./scripts/av-verify.sh` — **product.status=ok** required for any speed GOAL_MET
- [ ] **4.** No GOAL_MET without product.ok

## D. Report back (paste to agents)

```text
SMOKE APK≥0.1.331 / live.js?v=542: yes|no
UX:
  name: pass|fail
  stars: pass|fail
  loc: pass|fail
  local_blur: pass|fail
  partner_hide: pass|fail
  mute_banner: pass|fail
  bottom_chrome: pass|fail
  gift_fx: pass|fail|n/a
  crash_on_match: no|yes
PC:
  chrome_autohide_3s: pass|fail
Speed:
  feel_faster: yes|no|n/a
  hub-match-speed: mto=… mta=…  (optional)
av-verify: product.status=ok|…  (required for speed GOAL_MET)
GOAL_MET: yes|no
Notes / FAIL lines only: …
```

**Agent rules after this paste**

| Report | Action |
|--------|--------|
| All pass + product.ok if claimed | Compound wiki; stop thrash |
| FAIL lines listed | One hop per line (MAX HOPS 2); re-verify; at most one APK |
| No paste | Idle — no more APK flood |

**Hard:** No GOAL_MET without product.ok for connect/speed. Do not thrash ICE / pool. UX-only fails → mobile UX only.
