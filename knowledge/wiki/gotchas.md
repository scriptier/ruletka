# Gotchas (connect thrash)

Canonical: `.grok/skills/av-fix-loop/references/GOTCHAS.md` (17 items after 2026-08-10).

Highest signal from the PC-black saga:

1. Score first — product field, not theories  
2. Signaling/TURN PASS can still be one-way  
3. Layer A pure / B bind / C encode — fix the failing layer only  
4. closeCall(keepLocal) must not wipe force_relay sticky  
5. bind_v≥1 ≠ frames_out (force encodings.active)  
6. pool=0 forever  
7. One writer agent; rebuild APK if dual-edit  
8. GOAL_MET only with product.ok or human faces  

## Mobile UX thrash (2026-08-11)

9. **SurfaceView eats overlays** — put partner name/★/loc in a flex dock **below** stage, not only absolute chrome over video.  
10. **Never unmount RTC for blur** — keep stream mounted; opaque Modal only while veiled.  
11. **max_mto ≥ 20s is web/cache first** — hard-refresh `live.js?v=` + stuck-offer hop; do **not** ship more HUD APKs.  
12. **APK flood without smoke is vibe coding** — at most one verify-gated APK, then human paste-back (`SMOKE-NEXT`).  
13. **Stars display** = max(stars, trust) or ★0 looks “broken” when only trust is set.  
14. **Spec install lines must match artifacts** — update `SMOKE-NEXT` when version bumps or agents install the wrong APK.
15. **PC chrome-autohide** — do **not** “fix” vanished Settings by forcing `chrome-always` / pin forever. Keep local rail visible only while `.is-chrome-open` or settings/flyout sheet open. See [live-chrome-ux](live-chrome-ux.md).
16. **Partner ★0 mid-match is often correct** — hub `MatchPeer.stars`/`trust` are serde `u64` always present; stranger with no gifts → known 0. Self gift-bar ★N is *your* spendable balance, not partner. Diagnose with logcat `[match]` / `[geo]` (`known=1` + both 0 = empty ledger; `known=0` = omitted field / merge keep). Loc blank only when hub has no geo yet (private IP / lookup pending) or hide_ip — flag/country/city when present must paint under name on top strip.
17. **PC dual id / hex / friend_code as name** — never paint `partner_short` / `short_id` / `friend_code` / bare 6–12 hex as conversationalist name (`resolvePartnerPaintName` → real name or generic "Partner" only). Hub `resolve_match_peer_name` empty > hex. On DC `partner_identity`, **re-paint** via `paintPartnerIdentityChrome` (not only `lastMatchMeta`). Always hide `#remote-who-sub` on 1v1 (CSS + `hideRemoteWhoSub` — no "Незнакомец · CODE" dual-id). Ship stamp **`live.js?v=551`**. Skill: `mobile-match-identity`.
18. **CONNECT / Link offer toast ban on Android release** — no mid-match stopwatch toast for CONNECT/Link offer timing. `MediaSession` still emits `CONNECT offer=…` on first frame for log; `live.tsx` routes that string to **log + `lastConnectStats` → Settings Last connect only** (no `showToast`).
19. **Brand watermark place differs by client** — **PC:** center-seam vertical `.stage-brand-spin` between partner \| you; soft **360° every 15s** (16.2s cycle); tile `.stage-wm` **hidden** on match. **Android:** `BrandWatermark` **bottom-middle** of partner video; same 360°/15s. Full `ruletka.me` never clip. Do **not** park Android mid-torso with fixed TY=160; do **not** put PC mark on partner tile bottom. Skill: `brand-stage`. MUST NOT thrash MediaSession for brand-only.

### Log

- 2026-08-10: expanded after product.ok resolution (layers A/B/C).
- 2026-08-10 walk: do **not** GOAL_MET on linking speed from journal mto/mta alone — need UI deploy + APK hop + `product.ok`. Residual pure max mto~1749 / mta~4097 still pre-hop3c/hop4 ship.
- 2026-08-11: UX thrash gotchas 9–14; smoke APK **0.1.329**; method gap compound.
- 2026-08-11: gotcha **15** PC chrome-autohide restore (`live.js?v=542`); never force always-on forever.
- 2026-08-11: gotcha **16** partner ★0 empty ledger vs bug (0.1.341 screenshot; self gift ★≠partner).
- 2026-08-11: gotchas **17–19** PC dual-id/hex paint + re-paint; CONNECT toast ban; brand bottom-middle / center pill (no fixed TY=160). Skills: mobile-match-identity, brand-stage.
- 2026-08-11 (session): **§17** friend_code also poison; who-sub always off 1v1; **`live.js?v=551`**. **§18** toast ban wired (log + Settings Last connect). **§19 corrected** — PC **center seam** (not tile bottom); Android bottom-middle; `.stage-wm` hidden on PC match.
