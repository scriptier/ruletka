# Lane job card — {{LANE_ID}}

| Field | Value |
|-------|--------|
| **LANE** | `{{LANE_ID}}` |
| **RUN** | `{{RUN_ID}}` |
| **AGENT** | {{AGENT}} |
| **STATUS** | claimed |

## GOAL

{{GOAL}}

## OWN (write only these)

{{OWN}}

## READ (context only — do not edit)

{{READ}}

## DONE WHEN

{{DONE_WHEN}}

## EVAL

{{EVAL}}

## DO NOT

{{DO_NOT}}

---

## Instructions for the worker

1. Stay inside **OWN**. Never edit paths listed under DO NOT.
2. Prefer READ files for context; do not thrash them.
3. Implement the smallest change that meets DONE WHEN.
4. When finished, leave the **REPORT** block filled exactly (parent may also call `finish.sh`).
5. Do not invent product.ok / human PASS. Use EVAL as written.

---

## REPORT

```
GOAL_MET=yes|no|blocked
FILES_CHANGED:
NOTES:
```
