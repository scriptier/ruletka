# Deploy ruletka.vip to DigitalOcean

## 1. DNS (GoDaddy) — you already did this

| Type | Name | Data |
|------|------|------|
| A | `@` | droplet IP `209.38.204.153` |
| CNAME | `www` | `ruletka.vip.` |

## 2. Add deploy SSH key to the droplet

Public key (from this machine):

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIC3yZTxLJ31qflb5H4SiCU5oE3+La0Isl5Lps4vcWr4U ruletka-deploy@Drakosik
```

**Easiest:** DigitalOcean → Droplet → **Access** → **Launch Droplet Console**, then paste:

```bash
mkdir -p /root/.ssh && chmod 700 /root/.ssh
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIC3yZTxLJ31qflb5H4SiCU5oE3+La0Isl5Lps4vcWr4U ruletka-deploy@Drakosik' >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
```

Or: DO **Settings → Security → SSH keys** → add key → recreate droplet with that key (if you prefer).

## 3. Deploy from this repo

```bash
./scripts/deploy/push.sh
```

This will:

- build `roulette-bridge` release  
- upload binary + `ui/` to `/opt/ruletka`  
- install **Caddy** (HTTPS for `ruletka.vip`)  
- install **systemd** service (bridge on `127.0.0.1:8790`)  
- open firewall ports 22/80/443  

## 4. Verify

- https://ruletka.vip/  
- https://ruletka.vip/live.html  
- https://ruletka.vip/health  
- https://ruletka.vip/config.json  (ICE / TURN; credentials are short-lived)

### Self-hosted TURN (coturn)

`install-on-server.sh` runs `deploy/setup-turn.sh` when present. Manual re-run:

```bash
ssh root@YOUR_DROPLET 'bash /opt/ruletka/deploy/setup-turn.sh'
```

- Secret: `/opt/ruletka/data/turn.env` (not in git)  
- coturn config: `/etc/turnserver.conf`  
- Ports: `3478` UDP/TCP + relay `49160–49300`  
- Bridge env: `ROULETTE_OPEN_TURN=false`, `ROULETTE_TURN=turn:ruletka.vip:3478?...`, `EnvironmentFile=turn.env` 

## Layout on server

```
/opt/ruletka/bin/roulette-bridge
/opt/ruletka/ui/                 # homepage + live
/opt/ruletka/data/friends.json
/etc/caddy/Caddyfile
/etc/systemd/system/roulette-bridge.service
```

## Updates

After code changes:

```bash
./scripts/deploy/push.sh
```
