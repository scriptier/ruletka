# Security policy

## What this software does (and does not)

- **Video/audio** travel **peer-to-peer** (WebRTC SRTP) between browsers when possible.
- **Matchmaking, chat text, and WebRTC signaling** go through a **bridge** you choose (or a federation of bridges).
- A partner can always **screenshot or record** their screen. Block / Report are social controls, not cryptography against the other person.
- **TURN** (if configured) can relay encrypted media when direct P2P fails; operate your own TURN when possible.

## Reporting vulnerabilities

Please report security issues privately:

- Email: **support@ruletka.me** (or open a private advisory if this repo is on GitHub)

Include: affected component (`bridge`, `ui`, federation), version/commit, and a minimal reproduction.

We aim to acknowledge within a few days. Please do not open public issues for exploitable flaws until a fix is available.

## Operator checklist

- Use **HTTPS** (required for camera/mic in browsers).
- Prefer **self-hosted TURN** with short-lived credentials (`ROULETTE_TURN_SECRET`), not long-lived open relays.
- Keep `ROULETTE_ADMIN_TOKEN` and `ROULETTE_FEDERATION_TOKEN` secret.
- Federation peers are an **allowlist** — never auto-trust random seeders into claim/relay.
- Rate-limit and monitor public hubs; enable bans via admin tools.
