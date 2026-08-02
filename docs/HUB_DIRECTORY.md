# Hub directory policy

Clients discover alternate hubs so one operator outage is not fatal.

## Mechanisms

| Source | Path / env | Who edits |
|--------|------------|-----------|
| Seed file shipped with UI | `ui/hubs.json` | Repo maintainers (PR) |
| Live directory | `GET /v1/directory` | Each hub (env + optional admin file) |
| Client failover | `ui/hubs.js` | Tries seed + directory + last-good |

Format hint: `ruletka-directory/1` in `hubs.json`.

## Listing a community hub

We welcome independent operators who:

1. Run a public **HTTPS** hub with working `/live.html` and `/health`
2. Do not impersonate **ruletka.vip** branding without permission
3. Keep basic safety: 18+ gate, Block/Report, no intentional malware in UI
4. Prefer self-hosted TURN for mobile users when possible
5. Accept that **stars and friends are per-hub** (no global account)

### How to request inclusion in the seed `hubs.json`

Open a GitHub issue or PR with:

- Public base URL (e.g. `https://chat.example.com`)
- Operator contact (email or matrix)
- Approximate region / expected capacity (optional)
- Confirm you run open-source **ruletka** / compatible bridge (or document fork)

Maintainers may refuse or remove hubs that are abusive, offline, or phishing.

### Advertise yourself without seed inclusion

On your hub:

```bash
export ROULETTE_PUBLIC_BASE=https://your-hub.example.com
export ROULETTE_DIRECTORY_HUBS=https://ruletka.vip,https://your-hub.example.com
```

Users can also paste your hub URL into client hub settings (if exposed) or open your `/live.html` directly.

## Federation vs directory

- **Directory** = client failover / discovery (no shared queue required)
- **Federation** = optional shared stranger pool between **allowlisted** peers (`docs/INTEROP.md`)

Directory listing does **not** grant federation trust.
