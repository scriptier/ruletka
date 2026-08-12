---
name: spec
description: >
  Write or refine a Layer-1 Spec (DONE WHEN + EVAL + CHECKPOINTS) before coding.
  Karpathy/Marchese method: interview for real goal, agile small specs, human
  verifies key decisions. Use when user says write a spec, /spec, clarify goal,
  DONE WHEN, interview me, or starts work without a measurable outcome.
metadata:
  short-description: "Spec with EVAL + interview (not vibe)"
---

# /spec — measurable Spec (Marchese / Karpathy Layer 1)

Turn a vague request into a **Spec** the agent can execute without guessing.

## Step 0 — Interview (when goal is fuzzy)

Do **not** invent the real goal. Ask **1–3** questions (or say you’ll use this prompt):

> Interview me to identify the goal of this work — what decision or outcome matters, what failure looks like, and what is out of scope.

Prefer outcome over task (“both faces on PC+phone” not “touch MediaSession”).

## Step 1 — Draft (required fields)

```text
GOAL: <real outcome>
DONE WHEN: <measurable>
EVAL: <precise quality criteria — what you will score>
CHECKPOINTS: <key decisions human must confirm>
OUT OF SCOPE: …
VERIFY: baseline + after (+ optional second critic)
LANE: …
OWN FILES: …
MUST NOT: …
MAX HOPS: 2
```

**EVAL examples (good):**  
- `product.status=ok` and `app_vc>=303`  
- `./scripts/av-verify.sh` exit 0 and PRODUCT PASS gate  
- unit test X green  

**EVAL examples (bad):** “looks good”, “should work”, “fixed”.

## Step 2 — Write file

- A/V product: `knowledge/specs/current-av.md`  
- New goal: `knowledge/specs/YYYY-MM-DD-slug.md` from `_TEMPLATE.md`  
- Update `knowledge/wiki/index.md` only if a new durable concept page is needed later  

## Step 3 — Human checkpoints

List CHECKPOINTS and **stop** for high-risk items (deploy, ICE policy, lock edits) unless already authorized.

## Step 4 — Stop

**Do not implement** unless user also said implement / fix / proceed with code.

## Rules (video)

1. **Real goal** > task list.  
2. **Small** compartmentalized specs (agile, not waterfall megaprompts).  
3. **Human brain** on key decisions — model drafts, human verifies.  
4. VERIFY points at tools (`av-verify`, tests), not vibes.

## After

```bash
./scripts/agentic-check.sh
# then baseline measure / av-loop
```

Related: `docs/AGENTIC_ENGINEERING.md` · wiki `marchese-karpathy-method.md`.
