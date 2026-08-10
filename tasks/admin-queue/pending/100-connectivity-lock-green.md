# Task: Keep connectivity-lock green

## Goal
Prove CONNECTIVITY_LOCK unit suite still passes after 0.1.283 pure-relay/blur land.

## Scope
- Run `./scripts/test-connectivity-lock.sh`
- If FAIL: diagnose only in RESULT — do not "fix" force_relay by reverting pure-relay
- Capture output tail in RESULT

## Done criteria
- [ ] Script exit 0 (or clear failure report if env broken)
- [ ] No code changes unless a trivial test harness bug (not policy)
- [ ] COMPLETE + connect risk none

## Do not
- Change pair_force_relay_decision, hybrid re-intro, answerer promote
