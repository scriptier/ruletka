# Task: Headless prod pair media budget (web↔web)

## Goal
Run headless Chromium pair against prod if Chrome available; report frames / fail soft.

## Scope
- scripts/prod-pair-media.mjs or pair-smoke.mjs / pair-test-headless.mjs
- BUDGET_MS reasonable (45–60s)
- Write RESULT with pass/fail + console highlights
- Do not "fix" ICE on fail — forensics only

## Done criteria
- [ ] Script ran or blocked (no Chrome) documented
- [ ] No deploy / no force_relay code changes
- [ ] COMPLETE

## Do not
- Change CONNECTIVITY_LOCK client policy to chase headless flake
