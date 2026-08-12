# /karpathy — Spec + Verifier + Environment (+ LLM Wiki)

Load skill **karpathy-method**. Read `knowledge/wiki/karpathy-method.md` + `knowledge/SCHEMA.md`.

## Both patterns

1. **3 layers** — Spec → Verifier → Environment  
2. **LLM Wiki** — raw → wiki → query → lint (`/knowledge-*`)

## Do now

1. Spec: use `knowledge/specs/current-av.md` if A/V, else write:

```text
GOAL: …
DONE WHEN: …
OUT OF SCOPE: …
LANE: …
```

2. Verifier: criteria in DONE WHEN; for connect run `/av-verify` or `/av-loop`. Optional second critic.  
3. Environment: wiki first; after evidence `/knowledge-compound`.  
4. Query/lint anytime: `/knowledge-query`, `/knowledge-health`.

Always / Ask / Never: root `AGENTS.md`. Do not implement until Spec is clear (unless user only wanted the playbook).
