---
title: RU check-host DC probes (.me 200 vs .vip no-ALPN broken-pipe)
date: 2026-08-23
slug: ru-reach-checkhost
source_type: note
source_url:
source_path:
captured_by: agent
skill: add-new-resource
binary_inlined: false
---

# Raw: 2026-08-23 RU check-host (DC, not residential)

Director measure dump. Do not treat as GOAL_MET / product.ok. Spec: `knowledge/specs/2026-08-20-ru-reach.md`. Gotcha **76** (SNI `.me` → Caddy) already shipped; this is a re-measure, not a rewrite of 76.

## Source
- Type: note (director MEASURE 2026-08-23)
- Path: herd lane `ru-measure-wiki`
- Captured: 2026-08-23
- Probe class: **check-host DC**, not residential phone ISP (MTS/Beeline/MegaFon)

## Original (untouched)

MEASURE 2026-08-23 check-host (DC, not residential):
- https://ruletka.me/live.html ru2 Moscow 200
- https://ruletka.me/health ru1/ru2/ru3 ALL 200
- https://ruletka.vip/health ru1/ru2/ru3 ALL Broken pipe (no ALPN → coturn mux)
- Droplet has NO public IPv6 (DO metadata no ipv6; only fe80)
- Spec: do not buy second droplet from DC probes. Residential phone ISP still open.

## Split (same probe set)

| URL | ru1 | ru2 Moscow | ru3 | Read |
|-----|-----|------------|-----|------|
| `https://ruletka.me/live.html` | — | **200** | — | page path on `.me` after SNI lock |
| `https://ruletka.me/health` | **200** | **200** | **200** | HTTP ALPN → Caddy; SNI `.me` always Caddy |
| `https://ruletka.vip/health` | Broken pipe | Broken pipe | Broken pipe | no ALPN → coturn mux (TURNS :443). Expected. Not RKN. |

Droplet `209.38.204.153`: DigitalOcean FRA. Public IPv4 only. DO metadata: **no ipv6**. Host: link-local `fe80` only.

## Must not (from this dump)

- Do not buy a second droplet from DC probes alone.
- Do not invent GOAL_MET / product.ok.
- Residential phone ISP (no VPN) is still the product gate: page vs WSS vs ICE/TURN vs faces.

## Related

- Spec: [`../specs/2026-08-20-ru-reach.md`](../specs/2026-08-20-ru-reach.md)
- Gotcha **76** (do not rewrite): `ruletka.me` white screen = no-ALPN → coturn vip cert; SNI `.me` always Caddy
- Gotcha **74**: check-host broken-pipe is often no ALPN, not RKN
- Prior DC measure: spec 2026-08-22 (mixed `/health` before SNI split)
