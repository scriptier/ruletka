# Network helpers (island hubs)

Lightweight way for a friend to run a **personal mini-hub** on their PC without Docker or a VPS.

## What it does

1. Downloads (or reuses) `roulette-bridge` for their OS  
2. Syncs chat UI from the seed (`RULETKA_BASE`, default `https://ruletka.vip`)  
3. Starts the bridge on `127.0.0.1:8791`  
4. Opens a free **cloudflared** HTTPS tunnel  
5. Opens the browser to local live chat; copies public URL  

Does **not** grant admin access to the seed site. Match pool is independent unless operators federate later.

## User downloads

| Pack | Link on seed |
|------|----------------|
| Windows ZIP | `/download/ruletka-helper-windows.zip` |
| macOS ZIP | `/download/ruletka-helper-macos.zip` |
| Linux ZIP | `/download/ruletka-helper-linux.zip` |

Landing page: `/contribute.html`

## Maintainer build

```bash
./scripts/build-helpers.sh          # checksums + ZIPs from existing artifacts
./scripts/build-helpers.sh --build  # also rebuild Linux bridge
```

`scripts/deploy/push.sh` re-packs ZIPs and refreshes `SHA256SUMS` on each deploy.

## Limits / future

- No Authenticode / Apple notarization yet → first-run OS warnings are normal  
- Signed single-file `RuletkaHelper.exe` / `.app` is optional later (needs certs)  
- See `ui/download/README.md` for verification and env vars (`RULETKA_NO_BROWSER`, etc.)
