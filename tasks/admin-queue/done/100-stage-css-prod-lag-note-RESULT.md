# 100 — prod stage 384 vs disk 385/386 — RESULT

## Status
**COMPLETE** — read-only note, no deploy, no push.

## Goal
Confirm and log: prod `live-stage.css` lags the working tree; human deploy needed to ship dense-chrome + hunt-caption CSS.

## Measured (2026-08-11, this worktree: `freenet-roulette-claude`, branch `claude/p0-connectivity`)

### Prod (live, read-only `curl https://ruletka.vip/live.html`)
```
live-stage.css?v=384
live.js?v=561
webrtc.js?v=315
```

### Disk — working tree (`ui/live.html`, currently dirty/uncommitted)
```
live-stage.css?v=386
live.js?v=561
webrtc.js?v=315
```

### Last commit on this branch touching these files (`6b5d6cf`)
```
live-stage.css?v=359
live.js?v=401
webrtc.js?v=170
```

### CSS body sanity check (disk, uncommitted)
- `max(0.95rem, 15px)` hunt-caption floor: **present** (`#third-empty .empty-title` block at `ui/live-stage.css:20907-20909`)
- Brace balance: **3303 / 3303** (balanced)

## Interpretation
- **Prod is behind disk by two stage-CSS bumps**: prod `384` → working tree `386`. `live.js` (`561`) and `webrtc.js` (`315`) already match between prod and disk, so this is a **CSS-only** lag, not a JS/ICE gap.
- The gap matches the known chain from prior RESULTs (`W3-stage-css-dense-chrome`, `W4-smoke-stamp-disk`, `W7/W8-deploy-readiness`): `384` (prod) → `385` (dense mute/vol floors) → `386` (W5 hunt-caption floor, now confirmed present on disk).
- Disk `ui/live.html`/`ui/live-stage.css`/`ui/live.js`/`ui/webrtc.js` are **uncommitted** in this worktree (`git status --short` shows `M`) and this branch's own last commit is far behind both (`359`/`401`/`170`) — the `386`/`561`/`315` state exists only as local working-tree edits here, separate from whatever Grok's main tree / prod deploy source currently holds.
- No code change needed to close this gap — it is a **deploy-only** step (commit + `push.sh` on the correct tree), which is human/Grok territory per `CLAUDE.md` hard-never #1.

## Files touched
None (read-only verification; no edits made).

## Verify commands run
```bash
git status --short ui/live.html ui/live-stage.css ui/live.js ui/webrtc.js
git log --oneline -5 -- ui/live.html
git log --oneline -5 -- ui/live-stage.css
git show 6b5d6cf:ui/live.html | grep -oE 'live-stage\.css\?v=[0-9]+|live\.js\?v=[0-9]+|webrtc\.js\?v=[0-9]+'
grep -oE 'live-stage\.css\?v=[0-9]+|live\.js\?v=[0-9]+|webrtc\.js\?v=[0-9]+' ui/live.html
curl -s https://ruletka.vip/live.html | grep -oE 'live-stage\.css\?v=[0-9]+|live\.js\?v=[0-9]+|webrtc\.js\?v=[0-9]+'
grep -F 'max(0.95rem, 15px)' ui/live-stage.css
python3 -c "s=open('ui/live-stage.css').read(); print(s.count('{'), s.count('}'))"
```

## Connect risk
**none** — read-only inventory/curl only; no deploy, no push, no ICE/offer/TURN change.

## COMPLETE
