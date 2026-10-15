# Grok agent loop (max 5 concurrent)

**Director:** Grok (this session + durable scheduler).  
**Workers:** `spawn_subagent` general-purpose, non-overlapping OWN.  
**Claude:** separate continuous factory (`scripts/agents/continuous.sh`).

## Rules

1. At most **5** workers running at once.  
2. **One writer** per file set (never dual-edit `live.js` + same file).  
3. Prefer lanes from `backlog/*.md` → `pending/` → spawn.  
4. On COMPLETE: move to `done/`, harvest if needed, re-queue next.  
5. No deploy/APK unless human said so or job card allows.  
6. No ICE thrash / pool>0.

## Priority backlog (product finish)

| P | Lane | OWN |
|---|------|-----|
| P0 | multi 3/4-way web | `ui/live.js` multi only |
| P0 | multi 3/4-way CSS | `ui/live-stage.css` + live.html v-bump |
| P0 | multi Android 4-way UI | `mobile/app/live.tsx` multi tiles only |
| P1 | Friends Play polish | `mobile/app/friends.tsx` |
| P1 | Settings Play polish | `mobile/app/settings.tsx` |
| P1 | MediaSession multi | `mobile/src/media/MediaSession.ts` |
| P2 | Play checklist / store copy | `docs/PLAY_*` + store assets |
| P2 | Identity PC Courtier | `ui/live.js` identity only (not multi same hop) |

## Commands

```bash
# Claude continuous (1 worker sequential from admin-queue)
./scripts/agents/status.sh
./scripts/agents/start-sleep-shift.sh

# Auto-mint Claude backlog
./scripts/agents/auto-enqueue-backlog.sh

# Grok director tick (manual)
# "run grok-loop tick" in chat — or durable scheduler every 25m
```

## DONE WHEN (product)

- Human smoke 3-way + find-3rd hunt both clients faces live  
- 4-way stretch: all tiles or honest n/a  
- Friends + Settings usable Play-ready (no crash empty states)  
- AAB build path documented + one release APK/AAB candidate  
