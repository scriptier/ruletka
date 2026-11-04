# W8 deploy readiness — live 561 / stage 386 — RESULT

## Status
**COMPLETE** (read-only inventory — **no deploy**)

## Goal
List exact files a human would deploy for **Courtier** (`live.js?v=561`) + **hunt caption** (`live-stage.css?v=386`). RESULT only; no `push.sh`, no APK, no remote touch.

## Measured (2026-08-12 ~02:16 UTC)

### Disk versions (`ui/live.html` cache stamps)

| Asset | Disk `?v=` in `live.html` | Body size | Dirty vs git | Body notes |
|-------|---------------------------|-----------|--------------|------------|
| **`live.js`** | **`561`** (preload L397 + script L3032) | 1 126 138 B | yes | Courtier latch (`lastGoodPartnerName`, “Prefer latched Courtier”), softKeep, `outboundVideoTrackForPc`, cap-3 (`max 3 opponents`), `.clone(` |
| **`webrtc.js`** | **`315`** (L3031) | 137 885 B | yes | `iceCandidatePoolSize: 0` |
| **`live-stage.css`** | **`385`** (L395) — **not 386** | 539 100 B | yes | Dense mute/vol floors present (`max(0.72rem, 11px)`); brace balance **3302 / 3302** |
| **`live.html`** | (shell) | 190 499 B | yes | Links above |

Confirm command:

```text
live-stage.css?v=385
live.js?v=561
webrtc.js?v=315
live.js?v=561
```

### Vs recent RESULT tips (W5 / W7)

| Tip / card | Claimed | Disk now | Gap |
|------------|---------|----------|-----|
| **W5-stage-css-hunt-caption** | CSS `?v=386` + floor `max(0.95rem, 15px)` on `#third-empty .empty-title` | **absent** — no `max(0.95rem, 15px)`; no `#third-empty .empty-title` rule | W5 body not on disk (or was reverted); html still **385** |
| **W7-deploy-readiness** | Ship tip 561 + 386; pre-gate: re-apply W5 then bump html | Same as W7: **561 OK**, stage **385**, caption **missing** | Unchanged since W7 |
| **W7-multi-css-orphan-static** | html `385`; hunt floor absent | Confirmed again | — |
| Courtier / multi in `live.js` | 561 body with latch | **Present** on disk | JS tip ready; stage tip not |

**Honest tip state for “live 561 / stage 386”:**

| Ship tip | Ready on disk? |
|----------|----------------|
| `live.js?v=561` (Courtier + multi) | **Yes** — stamped and markers present |
| `webrtc.js?v=315` | **Yes** |
| `live-stage.css?v=386` (dense 385 + W5 hunt caption) | **No** — html still **385**; W5 caption CSS **not on disk** |

Do **not** claim stage **386** until caption floors land and html is bumped.

## Pre-deploy disk gate (before any 386 claim)

1. Re-apply W5 hunt caption floors to `ui/live-stage.css` (selectors from `tasks/grok-loop/done/W5-stage-css-hunt-caption-RESULT.md`):
   - `.stage.stage-trio.stage-trio-searching #third-empty .empty-title` (+ stack / tile-third variants)
   - `font-size: max(0.95rem, 15px) !important` + weight/color/text-shadow contrast
2. Bump **`ui/live.html`**: `live-stage.css?v=385` → **`?v=386`**
3. Re-check:
   ```bash
   grep -E 'live\.js\?v=|live-stage\.css\?v=|webrtc\.js\?v=' ui/live.html
   # expect: 561 / 386 / 315 only
   grep -F 'max(0.95rem, 15px)' ui/live-stage.css
   ```

## Deploy file list (human must proceed)

**Agent wall:** do **not** run `./scripts/deploy/push.sh` without human proceed. This task did **not** deploy.

### Must land for Courtier + hunt caption (web tip 561 / 386)

| Path | Role |
|------|------|
| **`ui/live.html`** | Cache-bust: `live.js?v=561`, **`live-stage.css?v=386`**, `webrtc.js?v=315` |
| **`ui/live.js`** | Courtier name latch + multi (561 body) |
| **`ui/live-stage.css`** | Dense chrome (current 385 body) **+** W5 hunt caption floors (target 386 body) |
| **`ui/webrtc.js`** | Keep **315** (`poolSize` 0); re-push if dirty tree is intentional |
| **`ui/deploy.json`** | Written by `push.sh` (not hand-edited) |

### Shipped as side-effect of full `ui/` rsync (not 561/386-specific)

- `i18n.js` (`?v=248`), `identity.js`, `hubs.js`, `style.css`, `live-brand.css?v=10`, `brand/*`, `sw.js`, legal, etc.
- Bridge binary `bin/roulette-bridge` (push rebuilds)

### Operator command (human only)

```bash
# From repo root — agent MUST NOT run without human proceed
./scripts/deploy/push.sh
```

### Not required for this web tip

| Item | Notes |
|------|--------|
| Android APK / AAB | Separate path — out of scope |
| Force-push / git ship | Prod is `push.sh` rsync of working tree |
| ICE / force_relay policy | Do not thrash |

## Post-deploy human verify (not agent PASS)

1. Hard-refresh `https://ruletka.vip/live.html` (and `.me` if same tree).
2. Network: **`live.js?v=561`**, **`live-stage.css?v=386`**, **`webrtc.js?v=315`**.
3. PC find-3rd: middle “Looking for a 3rd…” legible over brand loop (hunt caption).
4. Partner tile keeps real name (e.g. Courtier) through find-3rd rebind.

## Residual honesty

1. **Courtier JS (561) is on disk and ready** to ship with current html stamp.
2. **Stage 386 is not on disk** — still **385** + missing W5 caption rule (same gap as W7).
3. **Human must proceed deploy** after the pre-deploy gate (caption + html bump). Agent did not deploy.
4. No product GOAL_MET / smoke PASS invented.

## Connect risk
**None this hop** — inventory / RESULT only.

## COMPLETE
RESULT written. Deploy file list + version table filed. **Did not deploy.**
