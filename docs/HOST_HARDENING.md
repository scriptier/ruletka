# Host hardening (ruletka.vip droplet)

Production hardening as of 2026-08-05. On-server note: `/opt/ruletka/deploy/HARDENING.md`.

## Applied

| Control | Setting |
|--------|---------|
| UFW | Default deny inbound; allow **22, 80, 443, TURN 3478 + 49160–49300** |
| SSH IP allowlist | **Not used** — SSH stays open on 22 (keys only); no VPN/IP restriction |
| SSH auth | Keys only · `PasswordAuthentication no` · root `prohibit-password` · `MaxAuthTries 3` |
| Deploy user | `deploy` · sudo NOPASSWD · same key as root · password locked |
| fail2ban | `sshd` jail (4 tries / 10m → 1h ban) |
| Data perms | Secrets `640 root:ruletka` · JSON/jsonl `640 ruletka` · dirs `750` |
| App bind | Bridge `127.0.0.1:8790` · Caddy TLS edge only |
| Auto updates | unattended-upgrades + **reboot 04:17 UTC** when needed |
| Backups | Daily 03:15 UTC on-disk · `latest.tgz` · operator **pull** off-box |

**OpenSSH note:** first match wins. Keep `00-ruletka-hardening.conf` and ensure cloud-init does not set `PasswordAuthentication yes`.

## SSH

```bash
# Preferred
ssh -i ~/.ssh/ruletka_ed25519 deploy@209.38.204.153

# Emergency
ssh -i ~/.ssh/ruletka_ed25519 root@209.38.204.153
```

## Off-box backups

On-disk (droplet): `/opt/ruletka/backups/ruletka-data-*.tgz`  
Pull to this machine:

```bash
./scripts/deploy/pull-backups.sh
# → ~/ruletka-backups/
```

Optional push from droplet — create `/opt/ruletka/data/backup.env`:

```bash
ROULETKA_BACKUP_RSYNC_TARGET=user@other-host:/backups/ruletka/
ROULETKA_BACKUP_RSYNC_SSH=ssh -i /path/to/key
```

Also enable **DigitalOcean weekly Droplet Snapshots** in the DO UI (full disk off-box).

## DigitalOcean Cloud Firewall (manual)

Same ports as UFW. Do **not** require a fixed VPN IP for SSH unless you choose that later.

## Verify

```bash
sshd -T | grep -E 'passwordauthentication|permitrootlogin'
# passwordauthentication no · permitrootlogin without-password
systemctl is-active fail2ban
fail2ban-client status sshd
ufw status verbose
ss -tlnp | grep 8790   # 127.0.0.1 only
id deploy
ls /opt/ruletka/backups/latest.tgz
```
