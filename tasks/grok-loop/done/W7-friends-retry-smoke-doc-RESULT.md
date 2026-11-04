# W7 Friends Retry smoke-doc clarity — RESULT

## Status
**COMPLETE**

## OWN
- `knowledge/specs/SMOKE-NEXT.md` only (Friends section checkboxes + paste keys)

## Goal
Friends section human boxes call out **Retry** recovery clearly. No invent PASS / GOAL_MET.

## Why edit was required (disk truth)

Code + prior ship already expose labeled **Retry** on Friends; smoke checklist did not name it.

| Path | Evidence |
|------|----------|
| `mobile/app/friends.tsx` | Hero offline strip + empty-offline **Retry** → `retryConnection()` (`reconnectHub` + refresh); history `histStatus === "error"` banner **Retry** → reload (+ reconnect if offline). Label key `mobile.live.retryPath` |
| `tasks/grok-loop/done/W4b-friends-error-copy-RESULT.md` | Shipped offline/error recovery CTAs labeled **Retry** |
| `tasks/grok-loop/done/P1-friends-play-RESULT.md` | Error banner + Retry on history failure |
| `knowledge/specs/FINISH-PLAY-MULTI.md` §B4 | “hist loading strip + **Retry**” · human-smoke-open |
| SMOKE-NEXT E1 **before** | **9** offline warn only (no Retry); **11** “unrecoverable spinner” only (no Retry recovery CTA) |

## What changed

### E1 Friends (still all `- [ ]` — no invent PASS)

- **9.** Offline: header warn **+ labeled Retry tappable** (reconnect path, no crash); Add still toasts not-connected
- **11.** No blank white / infinite spinner **without recovery** — loading strip ends, **or history/offline Retry visible and tappable** (no dead recovery)

### Paste template keys (Friends only)

- `offline_warn` → `offline_warn_retry: pass|fail|n/a`
- `no_blank_spinner` → `no_blank_spinner_or_retry: pass|fail`

Settings E2 and all other sections **unchanged**. All **52** human boxes remain unchecked; **0** checked.

## Explicit non-claims

- Did **not** mark Friends / Settings / multi / UX GOAL_MET
- Did **not** run device smoke or invent pass lines
- Did **not** edit `friends.tsx`, product code, deploy, APK/AAB, or git push
- Did **not** change Settings checkboxes

## Files
- `/home/drakosik/freenet-roulette/knowledge/specs/SMOKE-NEXT.md`
- `/home/drakosik/freenet-roulette/tasks/grok-loop/done/W7-friends-retry-smoke-doc-RESULT.md`

## Verify
```bash
sed -n '98,155p' knowledge/specs/SMOKE-NEXT.md
grep -nE 'Retry|offline_warn_retry|no_blank_spinner_or_retry' knowledge/specs/SMOKE-NEXT.md
grep -cE '^\s*- \[ \]' knowledge/specs/SMOKE-NEXT.md    # 52
grep -cE '^\s*- \[[xX]\]' knowledge/specs/SMOKE-NEXT.md  # 0
# code still has Retry surfaces
grep -nE 'retryConnection|retryPath|histStatus === "error"' mobile/app/friends.tsx | head
```

## Connect risk
**None** — docs-only Friends smoke wording. No ICE / pool / MediaSession / live.js / webrtc / Android media touch.

## Done criteria
- [x] Friends section needs Retry clarity → OWN edit applied
- [x] Offline + error recovery Retry named for human smoke
- [x] Paste keys aligned
- [x] No invent PASS / GOAL_MET
- [x] RESULT COMPLETE

## COMPLETE or BLOCKED
**COMPLETE**
