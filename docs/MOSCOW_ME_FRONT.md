# ruletka.me Moscow front (camble’s RU IP)

**Why:** camble.online is not “better WebRTC.” Yandex DNS (`77.88.8.8`) answers **`51.250.97.234` AS200350 Yandex Cloud Moscow**. We only have Hetzner `78.47.217.35`. ISPs that filter Hetzner/DO still open camble.

**Goal:** RU phone, **no VPN**, `https://ruletka.me` 200 + Start. Hub + coturn stay FRA `209.38.204.153`. **pool=0. No TURNS on this box.**

## You create (I cannot)

Pick **one** cheap Moscow VM. **Selectel** is what **ruletta.live** uses (`135.106.164.75` AS50340). Yandex Cloud matches camble if you can pay. Timeweb also fine. **Friend-in-RU VPS = $0 for you.**

Free extra (GoDaddy, no new server): AAAA `ruletka.me` → `2a01:4f8:c010:b2e1::1` (Hetzner IPv6 already serves HTTPS 200). Some RU mobile is IPv6-first. Not a TSPU-allowlist. Keep the A `78.47.217.35`.

### Yandex Cloud (recommended)

1. https://console.yandex.cloud → folder (or new cloud)
2. **Compute Cloud → Create VM**
   - Name: `ruletka-me-ru`
   - Zone: **ru-central1-a** (Moscow)
   - Image: **Ubuntu 24.04**
   - Platform: Intel Ice Lake, **2 GB RAM / 2 vCPU** (or 1 vCPU if that’s the floor)
   - Disk: 20 GB
   - **Public IPv4**: yes (one address)
   - SSH: paste `ruletka_ed25519.pub` (same key as Hetzner)
   - Security group: inbound **TCP 22, 80, 443** and **ICMP** from `0.0.0.0/0`
3. Copy the **public IPv4**
4. Paste it here (or say **moscow ip &lt;addr&gt;**)

Timeweb: Ubuntu 24, Moscow/SPb, public IPv4, same ports. Selectel: same.

**Do not** attach a floating IP on FRA. **Do not** open UDP 5349.

## After IP (director)

```bash
./scripts/deploy/install-me-ru-front.sh <MOSCOW_IPV4>
# then FRA Caddy trusted_proxies += MOSCOW/32
```

Then DNS (GoDaddy has **no geo** like camble’s Route53):

| Step | Record | Value |
|------|--------|--------|
| 1 | keep A `@` | `78.47.217.35` (Hetzner) |
| 2 | **add** A `@` | **Moscow IPv4** |
| 3 | `www` | CNAME `ruletka.me` (unchanged) |
| 4 | `ruletka.vip` | **do not touch** (`209.38.204.153`) |

If dual-A still fails for blocked-Hetzner phones (browsers often don’t fail over), we **flip `@` to Moscow-only**. Calgary still loads `.me` via Moscow → FRA.

Optional later: Route53 geolocation (RU → Moscow, else Hetzner) — NS change at GoDaddy.

## Must not

- Point `.vip` at Moscow or Hetzner
- Coturn / TURNS on the front
- `force_relay` always-on
- `iceCandidatePoolSize` > 0
- Cloudflare in front of `.me` (often filtered in RU)

## Smoke

RU phone that **cannot** open Hetzner `.me` and **cannot** open `.vip`, **no VPN**: `https://ruletka.me` page + Start. **No GOAL_MET** until that.
