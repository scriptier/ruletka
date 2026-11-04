#!/usr/bin/env python3
"""Ruletka Herdr tabs (ruletka-main space): connect, mobile, ios, site, store.

Mirrors ~/ShopOps/herdr-plugin/spec-panes. Live knowledge/specs/current-*.md
map into those groups. Grok starts in the wait-slot tabs if the pane is an
idle shell. Never steals focus. Never closes a tab. connect is the live
implementer pane and is never touched.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

HOME = Path.home()
ROOT = (HOME / "freenet-roulette").resolve()
SPECS = ROOT / "knowledge" / "specs"
SPACE_LABELS = {"ruletka-main"}
PRODUCT = "connect"
GROUPS: dict[str, tuple[str, ...]] = {
    "connect": ("av", "linking-feel", "linking-speed", "no-cam", "multi-party"),
    "mobile": ("mobile-ux",),
    "ios": ("ios-app-store", "ios-parity", "ios-safari-audio"),
    "site": ("site", "seo"),
    "store": ("rustore", "play-store", "store-listing"),
}
TAB_ORDER = ("connect", "mobile", "ios", "site", "store")
TAB_PACKS: dict[str, tuple[str, ...]] = {
    "mobile": ("knowledge/specs/current-mobile-ux.md", "mobile/README.md"),
    "ios": ("knowledge/specs/current-ios-app-store.md", "knowledge/specs/current-ios-parity.md", "mobile/assets/store/ios/LISTING.md"),
    "site": ("ui/home.html", "ui/live.html", "ui/sitemap.xml", "ui/robots.txt"),
    "store": ("mobile/assets/store/rustore/README.md", "mobile/assets/store/LISTING.md", "mobile/assets/store/LISTING-I18N.md"),
}
TAB_EXTRAS: dict[str, str] = {
    "mobile": " This tab is the Expo/React Native Android app UX (mobile/app, mobile/src). Do not build or upload an APK/AAB until asked.",
    "ios": " This tab is iOS parity and App Store prep. Submit for Review needs Anton's explicit yes in chat.",
    "site": " This tab is the ruletka.me / ruletka.vip web UI, Russian copy, and SEO pages (ui/). Do not deploy until Anton says go.",
    "store": " This tab is RuStore and Google Play listings, screenshots, and copy (mobile/assets/store). Russian RuStore shots live in ~/rustore-ru-work/rustore. Store submit needs Anton's go.",
}
HERDR = os.environ.get("HERDR_BIN_PATH") or "herdr"
STATE_DIR = Path(
    os.environ.get("HERDR_PLUGIN_STATE_DIR")
    or (HOME / ".config/herdr/plugin-state/ruletka.spec-panes")
)
LOG = STATE_DIR / "spec-panes.log"


def log(msg: str) -> None:
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as f:
            f.write(msg.rstrip() + "\n")
    except OSError:
        pass


def herdr(*args: str) -> dict:
    proc = subprocess.run([HERDR, *args], check=False, capture_output=True, text=True)
    raw = (proc.stdout or "").strip()
    if not raw:
        err = (proc.stderr or "").strip()
        raise RuntimeError(f"herdr {' '.join(args)} failed: {err or proc.returncode}")
    data = json.loads(raw)
    if "error" in data:
        raise RuntimeError(data["error"].get("message") or raw[:200])
    return data


def unwrap(data: dict, *keys):
    cur = data.get("result", data)
    for k in keys:
        if isinstance(cur, dict) and k in cur:
            cur = cur[k]
        else:
            return None
    return cur


def spec_slug(path: Path) -> str:
    stem = path.name
    if stem.startswith("current-") and stem.endswith(".md"):
        stem = stem[len("current-") : -3]
    lab = re.sub(r"[^a-z0-9_-]+", "-", stem.lower()).strip("-")
    return lab[:32]


def live_slugs() -> set[str]:
    return {spec_slug(p) for p in SPECS.glob("current-*.md")}


def group_for_slug(slug: str) -> str:
    for tab, slugs in GROUPS.items():
        if slug in slugs:
            return tab
    return "product"


def live_spec_labels() -> list[str]:
    """Tab labels to keep: the grouped tabs (always) plus nothing else."""
    return list(TAB_ORDER)


def specs_for_tab(tab: str) -> list[Path]:
    live = live_slugs()
    out = []
    for slug in GROUPS.get(tab) or ():
        if slug in live:
            p = SPECS / f"current-{slug}.md"
            if p.is_file():
                out.append(p)
    # Unmapped live specs sit on product.
    if tab == PRODUCT:
        mapped = {s for slugs in GROUPS.values() for s in slugs}
        for slug in sorted(live - mapped):
            p = SPECS / f"current-{slug}.md"
            if p.is_file():
                out.append(p)
    return out


def space_workspace() -> dict | None:
    for ws in unwrap(herdr("workspace", "list"), "workspaces") or []:
        lab = str(ws.get("label") or "").strip().lower()
        if lab in SPACE_LABELS:
            return ws
    return None


def event_workspace_id() -> str:
    raw = os.environ.get("HERDR_PLUGIN_EVENT_JSON") or ""
    if raw.strip():
        try:
            ev = json.loads(raw)
            wid = str(
                ev.get("workspace_id")
                or (ev.get("workspace") or {}).get("workspace_id")
                or ""
            )
            if wid:
                return wid
        except json.JSONDecodeError:
            pass
    return os.environ.get("HERDR_WORKSPACE_ID") or ""


def pane_has_grok(pane: dict) -> bool:
    sess = pane.get("agent_session") or {}
    if str(sess.get("agent") or "").lower() == "grok":
        return True
    if str(pane.get("agent") or "").lower() == "grok":
        return True
    return False


def pane_has_other_agent(pane: dict) -> bool:
    sess = pane.get("agent_session") or {}
    agent = str(sess.get("agent") or pane.get("agent") or "").lower()
    return bool(agent) and agent != "grok"


def start_grok(pane_id: str, name: str) -> None:
    herdr(
        "agent",
        "start",
        name,
        "--kind",
        "grok",
        "--pane",
        pane_id,
        "--timeout",
        "60000",
        "--",
        "--cwd",
        str(ROOT),
    )


def wait_prompt(tab: str) -> None:
    files = specs_for_tab(tab)
    names = ", ".join(p.name for p in files) or "(none live)"
    pack = TAB_PACKS.get(tab) or ()
    pack_line = ""
    if pack:
        listed = " ".join(pack)
        pack_line = (
            f" Read these first (this tab's pack): {listed}. "
            "Do not open the rest of the wiki unless the hop needs it."
        )
    extra = TAB_EXTRAS.get(tab) or ""
    prompt = (
        f"This Herdr tab is **{tab}**. Live specs here: {names}."
        f"{pack_line}{extra} "
        f"Follow AGENTS.md (Spec → Verifier → Environment). "
        f"Wait for the human. Do not implement until asked. "
        f"One writer — do not thrash the same module as the connect pane. Talk to the cloud bot Ruletka Developer only via AGENT-INBOX.md and [RuletkaDev↔GrokBuild] self-mail (see knowledge/wiki/ruletka-dev-channel.md). No deploy, store submit, or push to main without Anton's go."
    )
    herdr("agent", "prompt", tab, prompt)


def named_agents() -> dict[str, dict]:
    out = {}
    for a in unwrap(herdr("agent", "list"), "agents") or []:
        pid = str(a.get("pane_id") or "")
        if pid:
            out[pid] = a
    return out


def ensure_grok(wid: str, wanted: list[str]) -> int:
    tabs = unwrap(herdr("tab", "list", "--workspace", wid), "tabs") or []
    tab_label = {str(t.get("tab_id")): str(t.get("label") or "") for t in tabs}
    panes = unwrap(herdr("pane", "list", "--workspace", wid), "panes") or []
    started = 0
    for pane in panes:
        lab = tab_label.get(str(pane.get("tab_id")) or "")
        if lab not in wanted or lab == PRODUCT:
            continue
        pid = str(pane.get("pane_id") or "")
        if not pid:
            continue
        live = named_agents()
        agent = live.get(pid) or {}
        if pane_has_grok(pane) or pane_has_grok(agent):
            if str(agent.get("name") or "") != lab:
                try:
                    herdr("agent", "rename", pid, lab)
                    log(f"ren grok {pid} → {lab}")
                except RuntimeError as e:
                    log(f"rename {lab}: {e}")
            continue
        if pane_has_other_agent(pane):
            log(f"skip {lab}: other agent")
            continue
        taken = {str(a.get("name") or "") for a in live.values()}
        name = lab if lab not in taken else f"{lab}-b"[:32]
        try:
            start_grok(pid, name)
        except RuntimeError as e:
            log(f"start {lab}: {e}")
            continue
        started += 1
        log(f"start grok {name} pane={pid}")
        try:
            wait_prompt(name)
        except RuntimeError as e:
            log(f"prompt {name}: {e}")
    return started


def close_extra_tabs(wid: str, wanted: set[str]) -> int:
    """Ruletka: never close tabs (connect and now stay)."""
    return 0


def ensure(only_if_space_event: bool = False) -> str:
    if not SPECS.is_dir():
        return "skip: no specs dir"
    ws = space_workspace()
    if not ws:
        return "skip: no ruletka-main workspace"
    wid = str(ws.get("workspace_id") or "")
    if only_if_space_event:
        ev = event_workspace_id()
        if ev and ev != wid:
            return f"skip: event workspace {ev} is not ruletka-main {wid}"
    wanted = list(TAB_ORDER)
    tabs = unwrap(herdr("tab", "list", "--workspace", wid), "tabs") or []
    have = {str(t.get("label") or ""): t for t in tabs}
    created = 0
    for lab in wanted:
        if lab in have:
            continue
        herdr(
            "tab",
            "create",
            "--workspace",
            wid,
            "--cwd",
            str(ROOT),
            "--label",
            lab,
            "--no-focus",
        )
        created += 1
        log(f"make tab {lab} in {wid}")
    started = ensure_grok(wid, wanted)
    closed = close_extra_tabs(wid, set(wanted))
    return (
        f"ok ruletka-main tabs: {', '.join(wanted)}; "
        f"{created} created, {started} grok started, {closed} extras closed"
    )


def main() -> int:
    mode = (sys.argv[1] if len(sys.argv) > 1 else "ensure").strip().lower()
    try:
        if mode == "focused":
            msg = ensure(only_if_space_event=True)
        elif mode in ("ensure", "startup", "created"):
            msg = ensure(only_if_space_event=False)
        elif mode == "list":
            print("\n".join(TAB_ORDER))
            return 0
        else:
            print(f"unknown mode: {mode}", file=sys.stderr)
            return 2
        print(msg)
        log(msg)
        return 0
    except RuntimeError as e:
        print(str(e), file=sys.stderr)
        log(f"fail {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
