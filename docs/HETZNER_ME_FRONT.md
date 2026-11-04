# ruletka.me Hetzner front — decommissioned

**2026-10-02:** DNS A `ruletka.me` → DigitalOcean `209.38.204.153` (same as `.vip`). FRA Caddy no longer trusts `78.47.217.35`. Human: delete Hetzner CX23 `ubuntu-4gb-fsn1-1` to stop the extra bill. Hub + coturn stay on FRA. **pool=0.**

~~**Goal:** RU users without VPN can **open the site** on a non-DigitalOcean IP, like camble.online (Hetzner DE, clean 443). Hub + coturn stay on FRA `209.38.204.153`. **pool=0. No TURNS on this hostname.**~~

## Live box (2026-08-28)

| | |
|--|--|
| Host | `ubuntu-4gb-fsn1-1` CX23 Falkenstein (`fsn1-dc8`) |
| IPv4 | **`78.47.217.35`** |
| DNS | A `ruletka.me` → this IP; `www` CNAME; vip stays `209.38.204.153` |
| Caddy | active; public HTTPS **200** (via 2.0 Caddy + origin) |
| Cert | Let’s Encrypt `CN=ruletka.me` until **2026-10-29** (copied from FRA) |
| Firewall | inbound TCP **22, 80, 443** (human opened 2026-08-28) |

## Verifier (2026-08-28) — public path

Human: **firewall open**. Calgary + FRA: TCP 80/443 succeed; `https://ruletka.me` **HTTP/1.1 200** (via 2.0 Caddy + 1.1 Caddy); `:80` **308** → HTTPS; `www` **301** → `https://ruletka.me/`; title `ruletka.me — live chat roulette`. `ruletka.vip` still **209.38.204.153**. **No GOAL_MET** until RU no-VPN smoke.

Was blocked by Cloud Firewall (SSH 22 + ICMP only). Guest iptables was already ACCEPT. Do **not** open UDP 5349.

## Already done

Server, DNS (`@` → `78.47.217.35`), Caddy, copied LE certs. Origin SNI stays `ruletka.me` so FRA HAProxy hits Caddy, not coturn. `www` CNAME → `ruletka.me`.

## Must not

- Point `.vip` at Hetzner  
- Run coturn on the front  
- Always-on `force_relay`  
- `iceCandidatePoolSize` > 0  

## RU probes (2026-08-29)

check-host DC (not a phone). After **h3 off** (h1/h2 only, no Alt-Svc) + `tcp_mtu_probing=1` + TCPMSS 1360:

| | ru1 Moscow AS14576 | ru2 Moscow | ru3 SPb |
|--|--|--|--|
| TCP 443 | OK | OK | OK |
| `GET /health` | **200** ~130ms | **200** | **200** |
| `GET /` (~223k HTML) | **timeout 25s** | **200** ~270ms | **200** |

Not an RKN IP ban. Same node serves `/health`. camble also **200**; their ru1 DNS can land on Yandex Cloud Moscow — we do not. **No GOAL_MET.**

## Client IP / geo (2026-08-29)

Hetzner Caddy sets `X-Forwarded-For` / `X-Real-IP` to the visitor. FRA Caddy `trusted_proxies` **only** `78.47.217.35/32` (plus localhost) so the hub geo is Calgary/RU, not Falkenstein. Direct `.vip` still uses HAProxy PROXY v2. **No TURNS on this hostname.**

## Smoke

RU phone, **no VPN**: `https://ruletka.me` 200 + Start vs Calgary. Same-LAN FRA Play↔PC still on `.vip`.
 Hard reload `https://ruletka.me` — loc chip should be real city, not Falkenstein/AQ.
