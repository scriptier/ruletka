# Host hardening (ruletka.vip droplet)

Applied on production 2026-08-05. See also `/opt/ruletka/deploy/HARDENING.md` on the server.

## Applied

| Control | Setting |
|--------|---------|
| UFW | Default deny inbound; allow 22, 80, 443, TURN 3478 + 49160–49300 |
| SSH | Keys only · `PasswordAuthentication no` · root `prohibit-password` · `MaxAuthTries 3` |
| fail2ban | `sshd` jail · 4 tries / 10m → 1h ban |
| Data perms | Secrets `640 root:ruletka` · JSON/jsonl `640 ruletka:ruletka` · dirs `750` |
| App bind | Bridge `127.0.0.1:8790` · Caddy TLS edge only |

**Note:** OpenSSH uses **first match wins**. Cloud-init may write `50-cloud-init.conf` with `PasswordAuthentication yes` — keep `00-ruletka-hardening.conf` first and set cloud-init to `no` after droplet rebuilds.

## Manual: DigitalOcean Cloud Firewall

In DO Control Panel → Networking → Firewalls → create rules matching UFW, attach to the droplet:

**Inbound**
- TCP 22 (optionally source = your admin IPs only)
- TCP 80, TCP 443, UDP 443
- TCP+UDP 3478
- TCP+UDP 49160–49300

**Outbound:** Allow all (or DNS + HTTPS as preferred).

## After rebuild / new droplet

1. Re-apply UFW rules from `scripts/deploy/setup-turn.sh` / install docs  
2. Copy SSH drop-ins (`00-ruletka-hardening.conf`)  
3. `apt install fail2ban` + `jail.local`  
4. Fix data `chmod`/`chown`  
5. Attach Cloud Firewall  

## Verify

```bash
sshd -T | grep -E 'passwordauthentication|permitrootlogin'
# expect: passwordauthentication no · permitrootlogin without-password
systemctl is-active fail2ban
fail2ban-client status sshd
ufw status verbose
ss -tlnp | grep 8790   # expect 127.0.0.1 only
```
