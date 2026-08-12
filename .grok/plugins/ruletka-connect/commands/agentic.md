# /agentic — enter agentic engineering mode

Not vibe coding. Load skill **agentic-engineering**.

## Do now

1. Read `docs/AGENTIC_ENGINEERING.md` (skim control surfaces).  
2. Run:

```bash
./scripts/agentic-check.sh
# if A/V / connect:
./scripts/agentic-check.sh --connect
```

3. Ensure a **Spec** exists (`knowledge/specs/` or draft via `/spec`).  
4. For connect: `./scripts/av-loop.sh` → follow `artifacts/av-loop/director.md` (one writer → verify-after).  
5. Report to human:

```text
MODE: agentic
SPEC: <path or DONE WHEN>
BASELINE: <verdict/product or n/a>
NEXT: <measure | implement lane | smoke | compound>
```

Do not thrash code until Spec + baseline path are clear (unless trivial one-liner).
