# Task: Settings Hotkeys sheet — taller + scroll (user screenshot)

**Priority:** P2 polish · **Safe** (CSS / settings UI only)  
**Screenshot:** `/home/drakosik/Pictures/2026-08-07_15-00.png`  
User: *“taller hotkeys window and scrolling if needed”*

## Goal
Settings → Hotkeys (`#settings-view-hotkeys`) shows **all** shortcuts without looking cut off. Window may be **taller**; body **scrolls** if content exceeds viewport.

## Context
- Sheet `#settings-sheet` is a side panel; `.settings-body` / hotkeys lists can clip (e.g. swipe row empty, GENERAL cut off).
- Overlay `?` dialog is `#keys-help` / `.keys-help-card` — improve that too if short, same idea.
- Work in **Claude worktree** (`~/freenet-roulette-claude` or `$CLAUDE_WORKTREE`).

## Files (prefer only these)
- `ui/live-stage.css` — heights, `overflow-y: auto`, flex layout for sheet body
- `ui/live.html` — only if structure needed (e.g. wrap list in scroll region); keep minimal
- Optional: tiny comment in RESULT only (no new docs file required)

## Done criteria
- [ ] Hotkeys view uses most of available sheet height (taller than today’s cramped layout)
- [ ] Body scrolls when content > viewport (mouse + touch); header stays visible if reasonable
- [ ] Swipe / all MEDIA / GENERAL / footer hint fully reachable by scroll
- [ ] No change to WebRTC, match, offer, deploy, git push
- [ ] RESULT markdown with **`COMPLETE`**, files touched, CSS approach, risk = **safe**

## Do not
- Redesign whole Settings app
- Touch `mobile/`, `bridge/`, `ui/webrtc.js`, connect path
- Deploy / push / merge main
- Undo CONNECTIVITY_LOCK

## Already shipped (do not undo)
- Connect speed / veil / partner_mute P2P / live chrome polish elsewhere

## RESULT path
Write to: `tasks/admin-queue/done/037-hotkeys-taller-scroll-RESULT.md`  
(or `pending/` if incomplete — still write RESULT with status)
