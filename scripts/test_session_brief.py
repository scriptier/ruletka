#!/usr/bin/env python3
"""Session card stays tiny: ≤15 lines, at most 5 current- spec names."""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOOK = ROOT / ".grok/hooks/scripts/session-start-agentic.sh"
CARD = ROOT / ".grok/session-card.txt"


def main() -> int:
    failed = 0

    def ok(cond: bool, msg: str) -> None:
        nonlocal failed
        if cond:
            print("ok  ", msg)
        else:
            failed += 1
            print("FAIL", msg)

    sh = HOOK.read_text(encoding="utf-8")
    ok("head -n 5" in sh, "hook takes newest 5 specs")
    ok("do not read all" in sh, "hook tells the agent not to open the full set")

    env = os.environ.copy()
    env["GROK_WORKSPACE_ROOT"] = str(ROOT)
    env["GROK_PROJECT_DIR"] = str(ROOT)
    subprocess.run(["bash", str(HOOK)], check=True, env=env, cwd=str(ROOT))
    text = CARD.read_text(encoding="utf-8")
    lines = [ln for ln in text.splitlines() if ln.strip()]
    ok(len(lines) <= 15, f"card ≤15 lines (got {len(lines)})")
    spec_line = next((ln for ln in lines if ln.startswith("specs:")), "")
    names = re.findall(r"current-[a-z0-9-]+\.md", spec_line)
    ok(len(names) <= 5, f"at most 5 spec filenames on the card (got {len(names)})")
    ok(len(spec_line) < 500, f"specs line stays short (got {len(spec_line)} chars)")
    ok("do not read all" in spec_line or len(names) <= 5, "card does not dump every spec")
    ok("not SMOKE-NEXT" in text, "card points away from SMOKE-NEXT")

    agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    start = agents.split("### Session start", 1)[-1]
    ok("Do **not** open every" in start, "AGENTS session start forbids reading every spec")
    ok("list active `knowledge/specs/current-*.md`" not in agents.split("## Always", 1)[-1][:800], "Always no longer lists every spec")
    ok("Paint-only skip" in agents, "AGENTS paint-only HUD skips spec/wiki")
    ok("One topic per session" in agents, "AGENTS one topic per session")

    plug = (ROOT / ".grok/config.toml").read_text(encoding="utf-8")
    ok("vercel" in plug and "disabled" in plug, "ruletka disables vercel plugin")
    ok("ruletka-connect" not in plug.split("disabled", 1)[-1], "ruletka-connect stays enabled")

    live = list((ROOT / "knowledge/specs").glob("current-*.md"))
    archived = list((ROOT / "knowledge/specs/archive").glob("*.md"))
    ok(len(live) <= 20, f"live current- specs stay a small set (got {len(live)})")
    ok(len(archived) >= 20, f"closed specs live in archive (got {len(archived)})")

    if failed:
        print(failed, "failed")
        return 1
    print("all ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
