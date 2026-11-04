# improve-system 2026-08-14 — Grok familiarity

Human: turn on experimental memory; see what agentic setups do; proceed with recommended.

### P1: Live session card (SessionStart + PostCompact)
WHY: SessionStart stdout is ignored; hook still cites APK 0.1.295. Cold sessions invent pins.
WHERE: `.grok/hooks/scripts/session-start-agentic.sh` · `never-rules.json`
CHANGE: Write `.grok/session-card.txt` from live files. Same script on PostCompact.
RISK: low
APPROVE?: approved (proceed with recommended)

### P2: NOW.md situation board
WHY: Wiki is a catalog; SMOKE-NEXT is an F17–F69 wall. No 20-line picture.
WHERE: `knowledge/wiki/now.md` + index row
CHANGE: ≤25 lines: open FAIL, disk vs installed, pins, Never.
RISK: low
APPROVE?: approved

### P3: Session-start ritual in AGENTS + CLAUDE
WHY: Law loads; situation does not. ArXiv 2026: do not grow AGENTS.
WHERE: AGENTS.md · CLAUDE.md · agentic-engineering skill
CHANGE: 4-line read order (card → now → matching spec).
RISK: low
APPROVE?: approved

### P4: Seed Grok workspace memory (pointers only)
WHY: `[memory] enabled=true` but only ShopOps MEMORY.md exists.
WHERE: `~/.grok/memory/ruletka-ba28efda/MEMORY.md`
CHANGE: Pointers to card / now / specs / locks. Not a second wiki.
RISK: low
APPROVE?: approved

### P5: two_pass_compaction + memory injection knobs
WHY: Compaction is how this session lost the picture.
WHERE: `~/.grok/config.toml`
CHANGE: `two_pass_compaction=true`; keep memory on; dream defaults.
RISK: low
APPROVE?: approved

### P6: Slim SMOKE-NEXT F-spam
WHY: Cold sessions drown. Separate hop — other agents append lockstep lines.
WHERE: `knowledge/specs/SMOKE-NEXT.md`
CHANGE: deferred
RISK: med
APPROVE?: deferred
