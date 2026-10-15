# Herdr + freenet-roulette herd notes

Probe date: **2026-08-13**  
Machine: Linux (`/home/drakosik`)  
Repo root: `/home/drakosik/freenet-roulette`

**Links**

- Site: [https://herdr.dev](https://herdr.dev)
- GitHub: [https://github.com/herdrdev/herdr](https://github.com/herdrdev/herdr)
- Install docs: [https://herdr.dev/docs/install/](https://herdr.dev/docs/install/)
- Quick start: [https://herdr.dev/docs/quick-start/](https://herdr.dev/docs/quick-start/)

---

## 1. Is `herdr` on PATH?

**Yes — installed (re-probe 2026-08-13 evening).**

| Path | Result |
|------|--------|
| `~/.local/bin/herdr` | **present** · `herdr 0.8.0` |
| default session | running (`herdr status` compatible) |

Personal OS now treats herdr as the runtime for **three** surfaces:

| herdr label | cwd |
|-------------|-----|
| `personal-os` | `~/personal-os` |
| `shopops` | `~/ShopOps` |
| `ruletka (grok main)` / `freenet-roulette` | `~/freenet-roulette` |

Map: `~/personal-os/knowledge/wiki/work-surfaces.md` · ensure labels: `~/personal-os/scripts/herdr-link.sh`

After a fresh machine, verify:

```bash
command -v herdr
herdr --version   # or: herdr --help
```

---

## 2. Official install (Linux)

Preferred one-liner (official installer; places binary on PATH, usually `~/.local/bin`):

```bash
curl -fsSL https://herdr.dev/install.sh | sh
```

Then open a new shell (or ensure `~/.local/bin` is on `PATH`) and:

```bash
cd /home/drakosik/freenet-roulette   # start where the work lives
herdr
```

Detach: `ctrl+b q` · Reattach: `herdr`.

### Alternatives (Linux)

| Method | Command |
|--------|---------|
| **Manual binary** | Download `herdr-linux-x86_64` or `herdr-linux-aarch64` from [GitHub releases](https://github.com/herdrdev/herdr/releases), then: `chmod +x herdr-linux-* && mv herdr-linux-* ~/.local/bin/herdr` |
| **mise** | `mise use -g herdr` (fallback: `mise use -g github:herdrdev/herdr`) |
| **Nix** | `nix profile install github:herdrdev/herdr/vX.Y.Z` (pin a release tag) |
| **Homebrew** | `brew install herdr` (if you use Linuxbrew) |
| **From source** | `git clone https://github.com/herdrdev/herdr && cd herdr && cargo build --release` |

Update (installer-managed only):

```bash
herdr update
# optional channel:
# herdr channel set stable   # default on Linux
# herdr channel set preview
```

Package-manager installs update via brew / mise / nix, not `herdr update`.

---

## 3. How herdr complements `scripts/agents/` (runtime vs shepherd)

There is **no** `scripts/herd/` tree today. The repo “herd / shepherd” is:

| Layer | What | Path |
|-------|------|------|
| **Shepherd (ours)** | Queue, OWN, dispatch, continuous overnight Claude, status, harvest | `scripts/agents/` · `scripts/admin-agent/` |
| **Runtime (theirs)** | Persistent multi-pane terminal server; agents keep running after detach/SSH | **herdr** (external binary) |

### herdr = runtime

- Background server; real PTYs live *inside* it.
- Split panes, attach/detach, reattach over SSH.
- Marks panes working / blocked / idle so you don’t hunt stuck Claude/Grok sessions.
- Does **not** replace our queue, worktree isolation, or harvest rules.
- Runs what we already run: `claude`, `grok`, shells, `./scripts/agents/*`.

### Our herd = shepherd / OWN / status

| Concern | Ours |
|---------|------|
| One writer per file set | Task `OWN` + `AGENTS.md` dual-agent rules |
| Enqueue / dispatch Claude | `./scripts/agents/enqueue.sh`, `dispatch.sh`, `loop.sh` |
| Overnight continuous worker | `./scripts/agents/start-sleep-shift.sh` → `continuous.sh` |
| Queue + PID status | `./scripts/agents/status.sh` |
| Worktree → main harvest | `./scripts/agents/harvest.sh` |
| Nightly forensics / briefs | `./scripts/admin-agent/` |

**Complement, don’t merge:** herdr holds the live terminals; our scripts decide *what* Claude may touch and *when* harvest is allowed.

```
┌─────────────────────────────────────────────┐
│  herdr (runtime)                            │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ Claude   │ │ Grok /   │ │ status.sh / │  │
│  │ pane(s)  │ │ director │ │ watch logs  │  │
│  └────┬─────┘ └────┬─────┘ └──────┬──────┘  │
└───────┼────────────┼──────────────┼─────────┘
        │            │              │
        ▼            ▼              ▼
   scripts/agents  AGENTS.md   tasks/admin-queue
   (shepherd OWN)  (policy)    (work tickets)
```

---

## 4. Suggested workflow

**Overnight Claude panes in herdr; OWN/status still ours.**

1. **Install once** (when ready — not done by this probe):
   ```bash
   curl -fsSL https://herdr.dev/install.sh | sh
   command -v herdr && herdr --help | head
   ```

2. **Start herdr in the repo** (or a dedicated “ruletka” session):
   ```bash
   cd /home/drakosik/freenet-roulette
   herdr
   ```

3. **Pane layout (example)**
   - Pane A: continuous Claude shift  
     `./scripts/agents/start-sleep-shift.sh`  
     (or interactive `claude` / `dispatch.sh --wait` for one-shot jobs)
   - Pane B: director / Grok session (specs, av-loop, merge)
   - Pane C: status + logs  
     `watch -n 30 ./scripts/agents/status.sh`  
     and/or `tail -f scripts/claude-logs/continuous-*.log`

4. **Detach** with `ctrl+b q` (or herdr’s detach). Agents keep running. Reattach with `herdr` (or named session attach if you use one).

5. **Morning**
   - Reattach herdr → glance pane states (working / blocked / idle).
   - Still run **our** shepherd:  
     `./scripts/agents/status.sh` · harvest only allowed paths · human smoke before deploy.

6. **Do not**
   - Let herdr “own” queue policy — keep task files + OWN in `tasks/` + `scripts/agents/`.
   - Dual-write the same files from two panes (same hard rule as without herdr).
   - Auto-deploy overnight (`ALLOW_DEPLOY=0`).

---

## 5. License note (AGPL → Apache)

| Fact | Detail |
|------|--------|
| **Current (v0.8.0+)** | **Apache License 2.0** — see [LICENSE](https://github.com/herdrdev/herdr/blob/master/LICENSE) and README badge |
| **Historical** | Herdr was previously **AGPL-3.0-or-later** |
| **Relicense** | Changelog **[0.8.0] (2026-08-03)**: *“Relicensed Herdr from AGPL-3.0-or-later to Apache-2.0.”* |

**Operator takeaway**

- **Today’s upstream binary** is Apache-2.0: permissive use, redistribution with attribution; no AGPL copyleft on current master/stable.
- **Older AGPL builds** (pre-relicense) still carry AGPL obligations if you ship or modify *those* versions — prefer a current install from [herdr.dev](https://herdr.dev) / latest GitHub release.
- freenet-roulette does **not** vendor herdr; it is an optional host tool. Linking notes only; no license change to this repo.

If legal policy ever required “no AGPL tools,” current Herdr no longer triggers that for new installs — confirm against the release you actually install (`herdr --version` + release notes).

---

## 6. Probe commands (copy/paste)

```bash
# Presence
command -v herdr || echo "herdr: not on PATH"
ls -la ~/.local/bin/herdr /usr/local/bin/herdr 2>/dev/null || true

# After install — record for this doc
herdr --version 2>&1 | head -5
herdr --help 2>&1 | head -40
```

**Version/help snippet:** `herdr 0.8.0` (`~/.local/bin/herdr`, 2026-08-13 re-probe).

---

## Related repo docs

- Dual-agent policy: [`AGENTS.md`](../AGENTS.md), [`docs/DUAL_AGENT_WORKFLOW.md`](./DUAL_AGENT_WORKFLOW.md)
- Claude factory: [`docs/AGENT_GROK_CLAUDE.md`](./AGENT_GROK_CLAUDE.md), [`docs/AGENT_FACTORY.md`](./AGENT_FACTORY.md)
- Overnight / continuous: `./scripts/agents/start-sleep-shift.sh`, `./scripts/agents/status.sh`
