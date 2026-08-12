---
description: Run the av-fix-loop skill (verify-first A/V fix director). Augmentation: measure, propose, one role — no unprompted APK.
---

# /av-fix

Load and follow the **av-fix-loop** skill in this plugin (`skills/av-fix-loop/SKILL.md`).

## Immediate actions

1. If no recent scorecard: run `./scripts/av-verify.sh --min 15` (or `--wait 90` if user is about to smoke).
2. Read `artifacts/av-verify/latest.md` + `latest.json`.
3. Follow the skill’s decision tree: **one** next role only.
4. **Implement only if the user asked to fix** (augmentation). Otherwise propose the step and stop.
5. Never unprompted APK/deploy.

Gotchas and locks in the skill body are mandatory.
