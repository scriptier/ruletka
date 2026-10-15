# CLAUDE.md

Grok and Claude both load this file. Follow `AGENTS.md`. The long rules are in `docs/agent-rules.md` (open only when the task needs them).

Hard rules, same as `AGENTS.md`: review gate before merge or ship; no deploy unless the human says **Reviewed OK go live**; never touch prices, Stripe, or stores; no force-push; no push or merge to `main`.
