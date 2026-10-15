# W7 deploy readiness — live.js?v=561 / stage?v=386 — RESULT

## Status
**COMPLETE** (docs / inventory only — **no deploy run**)

## Goal
List what needs deploy for ship tip **`live.js?v=561`** + **`live-stage.css?v=386`**. RESULT only; no `push.sh` / no APK / no invent PASS.

## Measured (2026-08-12 ~02:07 UTC)

### Disk (`ui/live.html` + bodies)

| Asset | Disk stamp in `live.html` | Body notes |
|-------|---------------------------|------------|
| `live.js` | **`?v=561`** (preload + script) | Dirty vs git HEAD; multi markers on disk (clones, cap-3, Courtier latch, softKeep) |
| `webrtc.js` | **`?v=315`** | Dirty vs HEAD; `iceCandidatePoolSize` → 0 |
| `live-stage.css` | **`?v=385`** (not 386) | Dirty vs HEAD; dense mute/vol floors present (`max(0.72rem, 11px)`); **W5 hunt caption floor CSS not on disk** (`max(0.95rem, 15px)` / `#third-empty .empty-title` rule **absent**) |
| `live-brand.css` | `?v=10` | Unchanged tip |
| `ui/deploy.json` (local) | `20260811T192743Z-538cfa1-chrome-autohide` | Stale vs prod; **rewritten by `push.sh`** |

### Production (`https://ruletka.vip` + `https://ruletka.me`)

| Asset | Prod Network stamp | Body notes |
|-------|-------------------|------------|
| `live.js` | **`?v=561`** | Already linked; minified body has multi strings (`max 3 opponents`, `mesh cost`, `outboundVideoTrackForPc`, `lastGoodPartnerName`, `.clone(`) |
| `webrtc.js` | **`?v=315`** | Already linked; pool=0 / hop budgets present |
| `live-stage.css` | **`?v=384`** | **Behind disk.** No dense `0.72rem` floors; smaller than local (~387KB min vs ~539KB local) |
| `deploy.json` | `20260812T014300Z-a0d195d` | Live on both vip + me |

**Honest gap for tip 561/386:**  
- **561 JS stamp:** already on prod HTML.  
- **386 stage:** **not on prod** (prod=**384**); disk HTML currently **385**, and **true 386 CSS body (W5 caption) missing on disk**.

## Deploy needs (human proceed only)

### 0. Pre-deploy disk gate (before claiming stage 386)

Do **not** ship a “386” tip until disk matches:

1. Re-apply W5 hunt caption floors to `ui/live-stage.css` (see `tasks/grok-loop/done/W5-stage-css-hunt-caption-RESULT.md`) if still absent.  
2. Bump **`ui/live.html`**: `live-stage.css?v=385` → **`?v=386`**.  
3. Confirm:  
   `grep -E 'live\.js\?v=|live-stage\.css\?v=|webrtc\.js\?v=' ui/live.html`  
   → **561 / 386 / 315** only.

### 1. Operator command (when human says proceed)

```bash
# From repo root — agent MUST NOT run without human proceed
./scripts/deploy/push.sh
# optional: HOST=root@… SSH_KEY=…
```

`push.sh` will:

1. `cargo build -p freenet-roulette-bridge --release`  
2. Stage **entire** `ui/` (rsync)  
3. Write fresh `ui/deploy.json` stamp  
4. Minify heavy JS/CSS (`optimize-ui.sh` / terser)  
5. rsync `bin/` + `ui/` + `deploy/` to server (never wipes `data/` / `backups/`)

### 2. Files that must land for 561/386 (web)

| Path | Why |
|------|-----|
| **`ui/live.html`** | Cache-bust links: `live.js?v=561`, **`live-stage.css?v=386`**, `webrtc.js?v=315` |
| **`ui/live.js`** | Body for 561 (multi clones, softKeep, Courtier latch, joinPeers cap) |
| **`ui/live-stage.css`** | **Primary prod gap:** dense chrome (disk 385) + hunt caption floors (target 386) |
| **`ui/webrtc.js`** | Keep **315** body (pool=0, hop9); already on prod but re-push if local dirty is intentional |
| **`ui/deploy.json`** | Auto from push (clients soft-reload on idle via deploy stamp) |

Also shipped as side-effect of full `ui/` rsync (linked from live.html; not 561/386-specific but go with push):

- `i18n.js` (html `?v=248`), `identity.js`, `hubs.js`, `style.css`, `live-brand.css?v=10`, `brand/*`, `sw.js`, legal, etc.  
- Bridge binary `bin/roulette-bridge` (push always rebuilds)

### 3. Not required for web 561/386 tip

| Item | Notes |
|------|--------|
| Android APK / AAB | Separate sideload / Play path (`0.1.366-vc374`); not part of site CSS/JS deploy |
| ICE / hub force_relay policy flip | Out of scope; do not thrash |
| Git force-push | Not the prod path; `push.sh` rsyncs working tree |
| Docs-only wiki/SMOKE restamp | Optional after human confirms Network stamps |

### 4. Post-deploy human verify (not agent PASS)

1. Hard-refresh `https://ruletka.vip/live.html` (and `.me` if same origin tree).  
2. DevTools Network: **`live.js?v=561`**, **`live-stage.css?v=386`**, **`webrtc.js?v=315`**.  
3. Confirm `/deploy.json` `at` is newer than `20260812T014300Z`.  
4. Paste multi / hunt checks into `knowledge/specs/SMOKE-NEXT.md` — leave boxes open until human.

## Residual honesty

1. **Prod already serves `live.js?v=561` + `webrtc.js?v=315`.** Remaining web tip work is **stage 384 → 386** (+ ensure html points at 386).  
2. **Disk is not fully 386 yet** — html=`385`, W5 caption floors missing; fix before a 386 claim.  
3. **No deploy executed this task.** No product GOAL_MET / smoke PASS invented.  
4. **Agent wall:** do not run `scripts/deploy/push.sh` without human proceed (AGENTS Ask-first + hooks).

## Connect risk
**None this hop** — inventory only.

## COMPLETE
RESULT written. Deploy needs listed. **Did not deploy.**
