# 2026-08-16 laptop ↔ Android 1v1 no-media — split public IPs

Score `20260816T060913Z` + rematch `060618Z`. Human: still cannot fully link cameras.

## Evidence

- verdict WARN · product **no-media** · signaling_ok · media_pass (global TURN HOT)
- last match android `e0ca2476` user `52310312-…` ↔ web `c8dcbda9` user `9d083d42-…` (laptop)
- force_relay=**false** · hide_ip=0 both · hub_fr=0
- offerer web · mto 893–1075 recvonly (laptop no cam — expected)
- android answer mta 1833 sendrecv **relay_candidates=0**
- android av_path app_vc=425 bind_v=1 policy=**all** ice checking → **failed** 0/0
- no web av_path

## IPs (hub `browser connected`)

| side | client | public IP | geo |
|------|--------|-----------|-----|
| Pixel | e0ca2476 | **96.1.124.150** | Calgary |
| laptop / PC web | 48b6506a, c8dcbda9, others | **162.157.227.46** | Calgary TELUS fibre |

Same-city ≠ same public IP. `pair_force_relay_decision` string-equal → false. Lock-correct.

Phone was on **162.157.227.46** earlier today (`force_relay=true` matches 03:14–05:03). Flip at **05:28** when android reconnects on 96.1.124.150. Laptop never left fibre.

## Not this

- Chrome version (gotcha 59)
- laptop 3rd PARKED
- first-offer recvonly OPEN (407/413) — recvonly here is no-cam, not the PC-with-preview bug
- always-on force_relay / pool>0 / 480 cut

## Next

Human: Pixel on **same TELUS Wi-Fi** as laptop (not LTE / Smart switch / VPN). Expect next connect `client_ip=162.157.227.46` then `force_relay=true`. Then rematch once ≥20s.

If phone stays on 96.1 after confirmed same SSID → then client-ice hybrid TURN gather (answer relay=0), **not** lock flip.
