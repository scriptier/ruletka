# Remote access (friends join from elsewhere)

The simple bridge is a small **match + signaling** server. Video/audio is still **peer-to-peer** WebRTC (STUN + optional TURN).

## Quick local (this machine)

```bash
./scripts/run-bridge.sh
# http://127.0.0.1:8790/live.html  (two tabs)
```

## Same Wi‑Fi (LAN)

Bridge defaults to `0.0.0.0:8790`:

```bash
./scripts/run-bridge.sh
# printed: LAN http://192.168.x.x:8790/live.html
```

**Caveat:** Many routers isolate Wi‑Fi from wired devices, and browsers treat `http://192.168…` as **not** a secure context (camera/mic may be blocked). Prefer the HTTPS tunnel for phone + real media.

## Friends anywhere (HTTPS tunnel)

1. Start the bridge:

```bash
./scripts/run-bridge.sh
```

2. In another terminal:

```bash
./scripts/run-tunnel.sh
# needs cloudflared or ngrok
```

3. Share the printed URL, or open **`phone-qr.png`** / **`phone-url.txt`** in the repo root (written by the tunnel script).

Example: `https://random.trycloudflare.com/live.html`

WebSocket becomes `wss://` automatically when the page is HTTPS.

### Stable hostname (optional)

Quick tunnels change URL every restart. For a fixed host, configure a **named** Cloudflare tunnel and:

```bash
export TUNNEL_NAME=my-nextface
./scripts/run-tunnel.sh
```

## STUN / TURN (video reliability)

| Setting | Env / flag | Purpose |
|---------|------------|---------|
| STUN | `ROULETTE_STUN` / `--stun` | Discover public addresses (default: Google STUN) |
| TURN | `ROULETTE_TURN` / `--turn` | Relay media when P2P fails |
| TURN auth | `ROULETTE_TURN_USER`, `ROULETTE_TURN_PASS` | Credentials for TURN |
| Open Relay | `ROULETTE_OPEN_TURN` (default **true**) | Free demo TURN when `ROULETTE_TURN` unset |
| Disable TURN | `ROULETTE_TURN=off` | STUN only |

**Default:** free [Open Relay](https://www.metered.ca/tools/openrelay/) TURN so phone ↔ home often works without running coturn. Fine for demos; use your own TURN in production.

Own server:

```bash
export ROULETTE_TURN=turn:turn.example.com:3478
export ROULETTE_TURN_USER=roulette
export ROULETTE_TURN_PASS=secret
./scripts/run-bridge.sh
```

Browsers load ICE from **`GET /config.json`**.

## Friends, blocks, persistence

- Friendships and **block list** are stored in `data/friends.json` and **survive bridge restarts**.
- **Block** in a call (or from Friends) removes friendship and skips that pair in stranger match.
- Friend codes are stable per browser `user_id` (localStorage).

## Health & config

- `GET /health` — online, waiting, friendships, blocks, `has_turn`
- `GET /config.json` — `ice_servers`, `has_turn`, `turn_is_open_relay`, notes

## Client UX (recent)

- **18+ rules gate** on first visit (localStorage)  
- **Reconnect** re-joins the queue after WebSocket blips; online/visibility triggers reconnect  
- **Share** uses the native share sheet when available (invite + room)  
- **PWA**: `manifest.webmanifest` + light `sw.js` for add-to-home-screen  
- Pool bar shows whether you’re alone in queue or how many others wait  

## Security notes

Demo-grade open lobby:

- Anyone with the tunnel URL can join the public pool  
- Use **Room** codes for private lobbies  
- Block list is per-user, not a global ban  
- Do not leave a public tunnel open unattended on untrusted networks  

## Bind local-only again

```bash
LISTEN=127.0.0.1:8790 ./scripts/run-bridge.sh
```
