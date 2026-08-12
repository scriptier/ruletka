# Spec: Ship Android match UX (primary)

> From human interview 2026-08-11. Updated 2026-08-11 for verify-gated ship **0.1.329-vc337** + hop10 web.

```text
GOAL: On real Pixel smoke, partner name, location, stars, and privacy blur work over live video — not only in code review.
DONE WHEN:
  1) NAME: Partner name or short-id fallback visible mid-match (PartnerIdentityDock under stage and/or top chrome)
  2) LOCATION: Flag/country/city (or Location hidden if hide_ip) — not stuck on Looking up… when web shows loc
  3) STARS: ★ chip readable (0 dimmed OK); trust chip if trust>0; display uses max(stars, trust)
  4) BLUR: Local privacy = mid-tone mosaic not black; Show video works; keep RTC mounted (no nuclear unmount crash)
  5) AUTOSTART: Home Start chatting → Live already searching (no second Start) when in scope
  6) Mute: at most one they-muted surface
EVAL:
  - Install APK ≥ 0.1.329-vc337 (ruletka-latest.apk)
  - PC hard-refresh: live.js?v=541 (hop10)
  - Human PC↔phone same-WiFi smoke; checklist knowledge/specs/SMOKE-NEXT.md section B
  - No GOAL_MET from agents without human pass lines
CHECKPOINTS:
  - Agents idle until human pastes smoke report (or FAIL lines only)
  - Before any new APK: mobile/ npm run verify (L0–L2); fail closed
  - UI deploy only with human authorize
  - One FAIL line → one hop → re-verify → at most one APK
OUT OF SCOPE:
  - More pure relay-wait cuts until product.ok reconfirmed after UX smoke
  - SFU, gift redesign, Hostinger
LANE: human-smoke → agents fix only reported fails
VERIFY: human paste-back from SMOKE-NEXT; optional av-verify product.ok
MUST NOT: pool>0; sticky wipe; overnight ICE thrash without smoke; APK flood without smoke
MAX HOPS: 2 per failed smoke item
```

### Weekly win (interview)

Human also wants **all of the above** plus linking **under ~2–3s** feel — treat as **stretch** after UX ship, still gated by product.ok (`current-linking-speed.md`).

### Agent stance

**Idle until smoke report** (or explicit FAIL lines). No walk-loop multi-APK thrash.

### Install target

| Piece | Value |
|-------|--------|
| APK | `mobile/artifacts/ruletka-0.1.329-vc337.apk` / `ruletka-latest.apk` |
| Web | `live.js?v=541`, `webrtc.js?v=311` (hop10 stuck-offer on disk) |

### Code lessons already on disk (do not re-discover)

| Area | Rule |
|------|------|
| Identity | `PartnerIdentityDock` **below** stage (not over SurfaceView) |
| Blur | Keep RTC mounted; Android opaque Modal **only while** `showPrivacyBlur` |
| Stars | `displayPartnerStars` = max(stars, trust) |
| Connect lag | If max_mto ≥ 20s: web cache/hop first — not another HUD APK |
