## [2026-08-20] PROPOSED | 2026-08-20-browser-deploy-fx.md
REVIEWED: LAST_RUN 08-16, gotchas 66–68, this session balloons/avatar-gift/deploy loop
PROPOSALS: P1–P5 pending (chat)
NEXT: human approve/deny each P#

## [2026-08-14] learn | android-partner-paint
REVIEWED: Android first-paint win (SoftBlur then face stays); gotchas 45–47; av-fix-loop ICE vs peel
PROPOSALS: human “learn skill from this” = approved
APPLIED:
  - .grok/skills/android-partner-paint/SKILL.md
  - av-fix-loop decision row → hand off peel to that skill
  - knowledge/wiki/index.md pointer
NEXT: do not ICE-thrash “face then gone ~3s”; Hide/Blur them still need rsync

## [2026-08-14 12:00] improve-system
REVIEWED: LAST_RUN 08-11, SessionStart stale, memory on but no ruletka MEMORY.md, ShopOps card pattern, hooks docs, wiki/now gap, two explore agents (popular setups + cold-start)
PROPOSALS: P1–P5 approved (human proceed recommended) | P6 SMOKE-NEXT slim deferred
APPLIED: session-card hook+PostCompact · wiki/now.md · AGENTS/CLAUDE ritual · ruletka MEMORY.md pointers · two_pass_compaction
NEXT: human /new smoke; confirm /memory lists ruletka; slim SMOKE-NEXT later
PROPOSED: knowledge/logs/improve-system/proposals/2026-08-14-grok-familiarity.md

## [2026-08-11 06:30] improve-apply
REVIEWED: proposals 2026-08-11-0601-ux-thrash-process (human: proceed with improvements → P1 P2 P4 P5 P6; not P3)
PROPOSALS: P1,P2,P4,P5,P6 approved | P3 pending (other agent owns dock)
APPLIED:
  - AGENTS.md (P1 smoke gate Never; P2 SMOKE-NEXT Always + Mobile section; P4 one implementer; P5 thrash compound)
  - .grok/skills/agentic-engineering/SKILL.md (P4 UX default; P5 compound trigger)
  - .grok/skills/knowledge-compound/SKILL.md (P5 thrash trigger)
  - mobile/scripts/build-apk-local.sh (P2 post-bump REMINDER echo)
  - mobile/scripts/verify-before-apk.sh (P6 L2 mto≥20s louder WARN)
  - knowledge/wiki/pre-apk-verify.md (P1 agent contract smoke gate; P6 web-first)
  - .grok/skills/av-fix-loop/references/GOTCHAS.md (P6 item 18)
  - proposals + LAST_RUN + this log
NEXT: human smoke 0.1.329; P3 dock deferred; no APK/deploy/ICE thrash
PROPOSED: knowledge/logs/improve-system/proposals/2026-08-11-0601-ux-thrash-process.md

## [2026-08-11 06:01] improve-system
REVIEWED: LAST_RUN, specs ship/mobile/SMOKE, wiki mobile-ux/gotchas/pre-apk/index, APK 0.1.329 thrash themes, method Q&A
PROPOSALS: P1–P6 pending (2026-08-11-0601-ux-thrash-process.md)
APPLIED (bookkeeping, pre-proposal): SMOKE-NEXT + current-ship-ux + current-mobile-ux retarget 0.1.329/hop10; wiki compound raw+mobile-ux+gotchas+index+log
NEXT: human approve/deny P1–P6; human smoke 0.1.329; no product thrash until paste
PROPOSED: knowledge/logs/improve-system/proposals/2026-08-11-0601-ux-thrash-process.md

## [2026-08-10 23:00] improve-system
REVIEWED: AGENTS, SCHEMA, wiki index/log, current specs, GOTCHAS, new skills, Marchese 10× raw, mobile UX thrash screenshot themes
PROPOSALS: P1–P5 pending | P6 denied-by-design (no auto-fire)
APPLIED: none (awaiting human)
NEXT: human approve/deny P1–P5; smoke UX APK 0.1.302; UI deploy for linking speed
PROPOSED: knowledge/logs/improve-system/proposals/2026-08-10-2300-first-run.md

## [2026-08-10 23:30] improve-apply
REVIEWED: proposals 2026-08-10-2300-first-run (human: proceed + use agents → P1–P5 approved; P6 denied)
PROPOSALS: P1–P5 approved | P6 denied
APPLIED:
  - knowledge/specs/current-mobile-ux.md (P1 mute EVAL)
  - docs/DEVICE_SMOKE.md (P1 smoke 11d)
  - knowledge/specs/current-linking-speed.md (P3 product.ok GOAL_MET gate)
  - AGENTS.md (P2 cadence; P4 screenshot funnel; P5 list current specs)
  - .grok/skills/agentic-engineering/SKILL.md (P5 preflight list specs)
  - proposals + LAST_RUN updated
NEXT: human smoke UX APK; deploy UI + APK for linking speed; av-verify product.ok before speed GOAL_MET

## [2026-08-22 02:05] improve-system
REVIEWED: LAST_RUN 2026-08-16; multi-party-stage SKILL; av-fix GOTCHAS (no TURNS/sslh); party-shapes spec; RU reach spec; OPS TURNS mux
PROPOSALS: pending P1–P5 → knowledge/logs/improve-system/proposals/2026-08-22-2v2-turns-mux.md
APPLIED: none (waiting approve/deny)
NEXT: human P1–P5 approve or deny
