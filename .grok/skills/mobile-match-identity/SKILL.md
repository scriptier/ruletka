---
name: mobile-match-identity
description: >
  PC + Android mid-match partner identity (name · ★ · flag · location) for
  freenet-roulette / ruletka. Both clients: one identity surface, poison
  display-name rejection (partner_short / 6–12 hex never as conversationalist),
  hub resolve_match_peer_name empty > hex, PC paintPartnerIdentityChrome /
  re-paint on DC partner_identity, Android snug dock under status bar, no
  CONNECT/Link stopwatch toast mid-match. Lessons from 2026-08-11 thrash. Use
  when partner name is "Partner"/hex/short_id, dual 🇨🇦 flags, dual-id who-sub,
  ★0 looks broken, location stuck "Looking up…", dock missing under
  SurfaceView, rematch wipes geo/stars, PC tile name stale after identity DC,
  or user asks about PartnerIdentityDock / paintPartnerIdentityChrome /
  resolvePartnerPaintName / formatLocLine / partnerFlagChip. Do NOT thrash
  MediaSession or ICE for identity-only bugs. Do NOT toast CONNECT/Link offer
  timing mid-match.
metadata:
  short-description: "PC+Android match identity (no MediaSession thrash)"
  learned: "2026-08-11"
  triggers:
    - partner name Partner / hex / short_id
    - dual flags
    - dual-id who-sub
    - paintPartnerIdentityChrome
    - PartnerIdentityDock
    - resolvePartnerPaintName
    - partner_identity DC
    - CONNECT toast mid-match
    - snug dock under status bar
---

# Match identity (PC + Android)

You fix **cosmetic identity chrome** mid-match on **both clients**: partner name,
stars/trust, flag, location.  
You do **not** open WebRTC/ICE/MediaSession unless frames/audio are the reported FAIL.  
You do **not** ship CONNECT/Link stopwatch toasts mid-match.

Stance: `AGENTS.md` (augmentation). Spec: `knowledge/specs/current-mobile-ux.md`.  
Wiki: `knowledge/wiki/mobile-ux.md`, `knowledge/wiki/gotchas.md`.  
Connect loop (if A/V broken): `av-fix-loop`. Brand watermark (not identity): `brand-stage`.

## When to use

| Symptom | This skill |
|---------|------------|
| Dual flags (emoji in name + loc line + stage chip) | Yes |
| Top says "Partner" while dock has short-id / hex | Yes |
| PC tile paints `partner_short` / 6–12 hex as name | Yes |
| Dual-id who-sub under real name (1v1) | Yes |
| ★0 mid-match (partner) vs gift-bar ★N (self) | Yes |
| Loc blank / "Looking up…" forever when hub has geo | Yes |
| Rematch wipes name/geo/stars for same user | Yes |
| Identity washed out / buried under SurfaceView | Yes |
| Dock too tall / not snug under status bar | Yes |
| CONNECT / Link offer toast mid-match (release) | Yes — **ban toast**; log + Settings only |
| PC identity DC only updates `lastMatchMeta`, chrome stale | Yes — must re-paint |
| Black cams / linking / no audio | **No** → `av-fix-loop` |
| Brand watermark position / flip only | **No** → `brand-stage` |

## DONE WHEN (patterns)

Ship only when **all** hold on a real Pixel↔PC (or emu) match smoke:

1. **One identity surface** — single mid-match belt paints name · ★ · loc.
   - Android: prefer `PartnerIdentityDock` (top absolute strip under status bar, or flex under stage). Do **not** also mount `PartnerChrome` Modal **and** `stagePartnerHud` for the same fields.
   - PC: partner tile name chip via `paintPartnerIdentityChrome` / `setDisplayNameOnTile`; do not dual-stack raw id in who-sub when a real name exists.
2. **One flag** — exactly one 🇨🇦 (or ISO chip) on stage (`partnerFlagChip` on video). Name row and `formatLocLine(..., { omitFlag: true })` must **not** re-prefix the emoji.
3. **Transparent stage overlay** — partner RTCView stays **zOrder 0**; stage/rootMatched parents stay **transparent** so RN elevation can paint chrome above. Opaque header panels over video bury identity (SurfaceView punches through or washout).
4. **Stars display** — `displayPartnerStars = max(stars, trust)` (0 dimmed is valid empty ledger). Never invent stars; never hide the chip.
5. **Cache by `user_id`** — real name / geo / non-zero stars keyed by hub `user_id` survive hangup → rematch. Same-partner re-Matched must not empty-wipe known fields when wire omits them (`starsKnown` / `trustKnown` / non-empty geo merge).
6. **No poison display names** — never paint `partner_short` / bare 6–12 hex as the conversationalist name (see Poison display names).
7. **No CONNECT/Link stopwatch toast** mid-match on release (see Toast ban).

### Layout contract (short)

| Surface | Role |
|---------|------|
| `PartnerIdentityDock` (Android) | **Only** mid-match name · ★ · loc |
| `LiveStageVideo` `partnerFlagChip` | **Only** flag on video (top-left under dock) |
| Gift bar balance pill | **Self** spendable ★ — not partner |
| `PartnerChrome` / `stagePartnerHud` | Off match path for identity; do not dual-mount |
| PC `#remote-name` + `paintPartnerIdentityChrome` | Partner name chip; hide dual-id who-sub on 1v1 when real name |

### Snug dock under status bar (Android — keep)

- Dock strip: `paddingTop = insets.top` (typically `Math.max(insets.top, 4)` from `live.tsx`).
- **Content-sized** strip — not a tall opaque header panel that eats half the partner face.
- Flag chip top tracks the dock (sits **below** the dock strip on partner video), not a fixed mid-torso Y.
- Prefer absolute top strip under status bar **or** flex sibling under stage; do not rely on Modal-over-RTCView alone.

## Poison display names

Never paint these as the conversationalist name:

| Poison | Why |
|--------|-----|
| `partner_short` / short_id | Match routing id, not a human label |
| Bare **6–12 hex** (e.g. `6664acc4`, `DABC741D`) | Looks like a name but is peer/short id |
| Hub placeholder `"Partner"` | Empty until real name arrives |

**Resolver order (both clients):**

1. Real display name from hub / peer meta (non-empty, non-poison)
2. Soft label: `friend_code` (even if hex-looking) when length sane
3. Generic "Partner" / i18n partner string
4. **Never** prefer short_id / partner_short / bare hex over a better label

**Hub:** `resolve_match_peer_name` returning **empty** is better than hex. Empty → client shows Partner / friend_code; do not invent hex into the name slot.

**PC must re-paint** when identity arrives late:

- `paintPartnerIdentityChrome` / `resolvePartnerPaintName` / `setDisplayNameOnTile`
- On DC `partner_identity` (and match paint paths): **must re-paint chrome**, not only update `lastMatchMeta`
- Storing identity in meta without calling paint leaves the tile stuck on poison hex

**Hide dual-id who-sub on 1v1** when a real name exists:

- If painted name is real (not poison, not short hex code-looking only), hide `#remote-who-sub` so you do not stack "Stranger · OTHER_HEX" under a real name
- Screenshot class: name `6664acc4` + who-sub `Незнакомец · DABC741D` = two different ids — both wrong as dual chrome

## No CONNECT / Link stopwatch toast (Android release)

| Allowed | Forbidden mid-match |
|---------|---------------------|
| Logcat / internal log of connect timing | Toast "CONNECT …" / Link offer stopwatch |
| Settings → Last connect (or equivalent history) | Banner/toast that interrupts the match for offer/answer ms |

Agents: if asked to "show connect time", wire **log + Settings Last connect only** — do **not** re-enable mid-match CONNECT toasts on release builds.

## GOTCHAS (2026-08-11 thrash)

| # | Failure | Instead |
|---|---------|---------|
| 1 | **Dual flag** — emoji in name + `formatLocLine` without `omitFlag` + stage chip | One chip on video; `omitFlag: true` on loc line; no flag prefix on name |
| 2 | **Opaque header panel** over partner stage | Transparent stage stack; dock plate may be near-opaque as **flex sibling** or absolute strip that does not bury zOrder-0 RTCView under a solid RN slab |
| 3 | Painting **"Partner"** and/or raw **hex** peer id as name | Treat hub placeholder `"Partner"` as empty; resolve real name → friend_code → soft label; never prefer hex/short_id; cache real names by `user_id` |
| 4 | **Wipe on rematch** — second Matched / empty peer object clears geo or ★ | Merge non-empty fields only; respect `starsKnown`/`trustKnown`; restore geo from `user_id` cache when MatchPeer geo empty |
| 5 | **Gift bar ★ is self, not partner** | Partner ★ lives on identity dock (`max(stars,trust)`). Self balance on home + gift bar is **yours**. ★0 partner + ★42 self is often correct empty ledger |
| 6 | PC: identity DC updates **meta only** | Call `paintPartnerIdentityChrome` so tile name + who-sub hide update |
| 7 | Dual-id who-sub under real name (1v1) | Hide `#remote-who-sub` when `resolvePartnerPaintName` yields a real name |
| 8 | CONNECT/Link offer **toast** mid-match | Log + Settings Last connect only |

### Related (identity-adjacent)

- Infinite **"Looking up location…"** — only show loc when geo known or `hide_ip` → "Location hidden"; flag-only must resolve country via ISO, not hang forever.
- **SurfaceView eats overlays** — absolute chrome over video is flaky; keep partner remote at zOrder 0; identity dock designed so it is not solely dependent on Modal-over-RTCView.
- **Never unmount RTC for blur** — blur is a separate lane; opaque Modal only while veiled. Identity fixes must not re-open blur thrash.
- **Brand watermark** — bottom-middle Android / PC center pill flip; see `brand-stage`. Not identity chrome.

## Verify

### Screenshot checks (human or device-smoke)

Mid-match screenshot must show:

- [ ] **One** partner name (not "Partner" when better label exists; **not** bare short_id/hex when real name or friend_code exists; not dual name rows)
- [ ] PC: no dual-id who-sub under a real name on 1v1
- [ ] **One** flag glyph/chip (not 🇨🇦 · Canada with another 🇨🇦 in the name)
- [ ] Partner ★ chip (0 dimmed OK) on identity dock
- [ ] Loc line: country · city **or** "Location hidden" **or** absent when hub truly has no geo — never permanent "Looking up…"
- [ ] Gift-bar ★N readable as **self** balance (do not fail product for partner ★0 when ledger is empty)
- [ ] Android dock snug under status bar; flag top tracks dock
- [ ] No CONNECT/Link stopwatch toast mid-match

### logcat (tags)

Filter:

```bash
adb logcat -d | rg '\[match\]|\[geo\]'
# or live while matching:
adb logcat | rg '\[match\]|\[geo\]'
```

Useful lines (from `mobile/app/live.tsx`):

| Tag | Meaning |
|-----|---------|
| `[match] name=… stars=… known=… trust=… display★=…` | Wire + display stars at Matched |
| `[match] paint … display★=… hasGeo=…` | What will paint after merge |
| `[match] dock name=… display★=… stars=… trust=…` | Settled dock after setState |
| `[geo] dock flag=… country=… city=… hide=… loc=…` | Settled geo line |
| `[geo] partner_geo apply\|skip …` | Async geo race |
| `[geo] restore-cache uid=…` | Rematch cache hit |

**Diagnose ★0:** `known=1` + stars=0 + trust=0 → empty ledger (not a bug). `known=0` → omitted field; merge/cache should keep prior. Real bug only if hub/log shows stars or trust **>0** but dock paints 0.

**Diagnose dual flag:** screenshot + check dock uses `omitFlag: true` and name row has no `flagEmoji` prefix while `partnerFlagChip` is mounted.

**Diagnose poison name:** screenshot shows 6–12 hex or short_id as title → check resolver + PC re-paint on `partner_identity`; hub empty name > hex.

### Static / unit (pre-APK)

```bash
cd mobile && npm run verify   # L0 match-ux + L1 units + L2 soft
# focused:
node src/identity/formatLocLine.test.mjs
```

L0 should assert single identity surface when matched (see `mobile/scripts/verify-match-ux.mjs`).

## MUST NOT

1. **Thrash `MediaSession.ts` / ICE / force_relay / pool** for identity-only FAILs.  
2. Dual-mount identity: `PartnerIdentityDock` + `PartnerChrome` + `stagePartnerHud` all painting name/★/loc.  
3. Prefix flag emoji in name **and** loc line **and** stage chip.  
4. Empty-wipe partner geo/name/stars on re-Matched when fields are omitted or same `user_id`.  
5. Claim partner ★ broken because gift bar shows self balance.  
6. Ship APK flood without smoke paste (`SMOKE-NEXT`) — at most one verify-gated bump then stop.  
7. Unmount partner RTCView to “fix” chrome z-order.  
8. Paint `partner_short` / bare 6–12 hex as the conversationalist name.  
9. Update PC `lastMatchMeta` on identity DC **without** `paintPartnerIdentityChrome`.  
10. Mid-match CONNECT/Link stopwatch **toast** on Android release (log + Settings only).

## Source of truth

| Path | Use |
|------|-----|
| `mobile/src/live/PartnerIdentityDock.tsx` | Only identity belt (Android) |
| `mobile/src/identity/flagTrust.ts` | `flagEmoji`, `formatLocLine({ omitFlag })` |
| `mobile/src/live/matchPeers.ts` | `displayPartnerStars`, known flags, peer pick |
| `mobile/src/live/LiveStageVideo.tsx` | `partnerFlagChip`, zOrder 0 partner |
| `mobile/app/live.tsx` | Matched merge, `user_id` caches, dock `paddingTop`, `[match]`/`[geo]` logs |
| `ui/live.js` | `setDisplayNameOnTile`, `paintPartnerIdentityChrome`, `resolvePartnerPaintName`, `registerPeerUi`, partner_identity re-paint |
| Hub `resolve_match_peer_name` | Empty > hex poison |
| `knowledge/specs/current-mobile-ux.md` | DONE WHEN |
| `knowledge/wiki/mobile-ux.md` | Compounded UX rules |
| `knowledge/wiki/gotchas.md` | Gotchas 9–19 (incl. dual id / CONNECT toast) |

## Procedure (one hop)

1. **Confirm lane** — identity/chrome only? If black remote / linking → hand off `av-fix-loop`. Brand flip/position only → `brand-stage`.  
2. **Read** wiki + this skill; skim dock + `formatLocLine` + Matched merge; PC paint helpers in `ui/live.js`.  
3. **Reproduce** with screenshot + logcat `[match]`/`[geo]` (Android) or hard-refresh live (PC).  
4. **One change** — e.g. omitFlag, drop dual HUD, fix merge/cache, re-paint on identity DC — not a rewrite of media.  
5. `cd mobile && npm run verify` before any APK.  
6. Human smoke / device-smoke; compound wiki if new gotcha.

## Related skills

- `av-fix-loop` — frames / ICE / one-way (not identity)  
- `brand-stage` — watermark / loading loop (not name · ★ · loc)  
- `spec` — write DONE WHEN before more thrash  
- `knowledge-compound` — write-back after solid hop  
- `improve-system` — process gates (no APK flood)
