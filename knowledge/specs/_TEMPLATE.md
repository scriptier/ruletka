# Spec: <short title>

> Karpathy / Marchese Layer 1. Copy to `YYYY-MM-DD-slug.md` or update `current-*.md`.  
> Prefer **small** specs (one hop). Interview the human if the goal is fuzzy.

```text
GOAL: <outcome the human cares about — not a task list>
DONE WHEN:
  - <measurable gate — command exit, product field, or human observable>
EVAL: <how we know quality — precise criteria, not "looks good">
CHECKPOINTS: <decisions human must confirm before agent continues>
OUT OF SCOPE:
  - <explicit non-goals>
VERIFY:
  - Baseline: <command>
  - After: <same or stronger>
  - Second critic: none | check-work | verify-only | Claude
LANE: <director | client-ice | turn-media | general | …>
OWN FILES: <paths if implementer>
MUST NOT: <pool>0, thrash, push.sh, …>
MAX HOPS: 2 without new human smoke / new evidence
```

### Interview notes (optional)

- What decision does this enable?
- What would make this a failure even if “code compiles”?

### Status

- **Draft** | Active | Done | Abandoned  
- Last measure:  
- Notes:
