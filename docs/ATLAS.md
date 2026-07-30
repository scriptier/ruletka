# Getting Freenet Chat Roulette into Atlas

[Atlas](https://github.com/freenet/atlas) is Freenet’s discovery layer (search /
recommend apps and content). This doc is the **practical checklist** for this repo.

## Reality check

| Item | Status |
|------|--------|
| Atlas live UI | Yes (local Freenet node) |
| Open “submit app” for everyone | Early / still evolving |
| Crawler + LLM descriptors | Primary way listings appear today |
| Self-submit (`atlasctl submit`) | Planned in RFC; curator tooling exists |
| freenet.org Apps page | Separate: open a **PR** when demoable |

Atlas indexes **Freenet-addressable** resources (web containers, contracts).  
The **simple bridge** (`:8790`) is a product demo path — **not** what Atlas crawls.

## Atlas UI (local)

With `freenet` running:

http://127.0.0.1:7509/v1/contract/web/771DvtPMwt2PumPyrFvsz7fpvU1gogcmb5qtS1yYEEH9/

## One-command local publish

```bash
# Terminal A — Freenet node
./scripts/run-local-node.sh

# Terminal B — contracts + website
./scripts/publish-freenet-all.sh
```

This produces:

- Lobby contract key → `target/publish/lobby-key.txt`
- Website (UI) key + URL → `target/publish/website-key.txt`, `website-url.txt`
- Human summary → `target/publish/ATLAS_MANIFEST.md`
- Descriptor at `/freenet-app.json` inside the web container

Open the printed **Website** URL in a browser (through the local node HTTP API).

## Manual steps

### 1. Package UI for Freenet

```bash
./scripts/package-webapp.sh
# → target/webapp/ (index.html = live UI, freenet-app.json, about.html)
```

### 2. Publish website

```bash
# one-time signing key (stable site identity)
fdev website init freenet-roulette

fdev -p 7509 website publish --key freenet-roulette target/webapp
# or:
./scripts/publish-website.sh
```

### 3. Publish lobby contract

```bash
./scripts/publish-local.sh
```

### 4. Run on-network match (agent)

```bash
cargo run -p freenet-roulette-agent -- dual
```

## Becoming discoverable

1. **Publish** lobby + web container (above).  
2. Keep a node **online** so peers (and crawlers) can fetch the content.  
3. **Descriptor**: `webapp/freenet-app.json` ships with the site (title, tags, summary).  
4. **Atlas**: wait for crawler indexing; try search for “roulette”, “webrtc”, “chat”.  
5. When self-submit lands, use `atlasctl submit <freenet-uri>` (see Atlas README/PROPOSAL).  
6. Optional: **PR** [freenet.org/apps](https://freenet.org/apps/) with links to keys + repo.  
7. Announce in Freenet Official River room ([quickstart](https://freenet.org/quickstart/)).

## Network vs local

| Mode | Command | Atlas relevance |
|------|---------|-----------------|
| Local node | `freenet local` | Dev only; crawler may not see you |
| Network node | `freenet network` (default) | Content can propagate; better for discovery |

For real discovery, publish with a **network-mode** node that peers with the public Freenet network, then leave it up.

## Related

- [docs/FREENET_DEPLOY.md](FREENET_DEPLOY.md) — lobby/session/agent  
- [docs/ARCHITECTURE.md](ARCHITECTURE.md) — bridge vs Freenet layers  
- [github.com/freenet/atlas](https://github.com/freenet/atlas) — Atlas README + PROPOSAL  
