# Email for ruletka.vip

Public addresses used in legal, Play/App Store, and UI:

| Address | Purpose |
|---------|---------|
| **support@ruletka.me** | Support, Play Console contact, general |
| **privacy@ruletka.me** | Privacy / deletion requests |

**Goal:** forward both to **yanesplu@gmail.com** (read in Gmail; reply as yourself or “Send mail as” if configured).

Public product mail is on **`@ruletka.me`**.  
Both `ruletka.me` and `ruletka.vip` have MX (ImprovMX). Prefer **me** in store listings and in-app contact.

ShopOps/Stoned used **Google Workspace** (full `@domain` mailboxes + SMTP). That works but costs ~$6+/user/mo. For store support mail, **free forwarding** is enough.

---

## Recommended: ImprovMX (free, ~5 minutes)

Works with GoDaddy DNS; no Workspace needed.

### 1. Create account + alias

1. Open https://improvmx.com → sign up with **yanesplu@gmail.com**
2. Add domain **`ruletka.vip`**
3. Create aliases:
   - `support` → `yanesplu@gmail.com`
   - `privacy` → `yanesplu@gmail.com`  
   (or a catch-all `*` → same Gmail)

### 2. DNS in GoDaddy

GoDaddy → **My Products** → **ruletka.vip** → **DNS** → **Add**:

| Type | Name | Value | Priority |
|------|------|--------|----------|
| **MX** | `@` | `mx1.improvmx.com` | **10** |
| **MX** | `@` | `mx2.improvmx.com` | **20** |
| **TXT** | `@` | `v=spf1 include:spf.improvmx.com ~all` | — |

Notes:

- Delete any old MX (secureserver, Google, etc.) if present.
- Only **one** SPF TXT on `@`. If another SPF exists, **merge** into a single record  
  e.g. `v=spf1 include:spf.improvmx.com include:_spf.google.com ~all`
- ImprovMX may show a domain-verification TXT — add that too if asked.

### 3. Verify

```bash
dig +short MX ruletka.vip
# expect mx1/mx2.improvmx.com

# From another account, email support@ruletka.me
# Should land in yanesplu@gmail.com within a few minutes (DNS can take up to 1h)
```

Optional Gmail: **Settings → Accounts → Send mail as** → add `support@ruletka.me`  
(ImprovMX paid or SMTP SMTP for custom From; free tier still **receives** fine.)

---

## Alternative: GoDaddy Email Forwarding

If your GoDaddy plan still includes free email forwarding:

1. GoDaddy → **Email & Office** / domain **Email** → **Forwarding**
2. Create `support@ruletka.me` → `yanesplu@gmail.com`
3. Same for `privacy@`
4. Let GoDaddy set MX to `smtp.secureserver.net` / `mailstore1.secureserver.net` (or confirm they match the product UI)

Availability of free bulk forwarding has varied; if the UI is gone or paid-only, use **ImprovMX** above.

---

## Alternative: Google Workspace (ShopOps style)

Same pattern as `ShopOps/scripts/configure_workspace_mail.sh`:

1. Workspace for `ruletka.vip` + MX → Google  
2. User `support@ruletka.me` (or group that forwards to Gmail)  
3. Heavier / paid — only if you want full mailbox + professional SMTP send.

---

## After mail works

Play Console / App Store can use:

- Support email: **support@ruletka.me**  
- Privacy: **https://ruletka.vip/legal/privacy.html** + privacy@ if asked  

No app code change required — mailto links already point at these addresses.

---

## Operator checklist

- [x] ImprovMX aliases (support + privacy → yanesplu@gmail.com)  
- [x] MX + SPF live (`mx1/mx2.improvmx.com`, SPF include:spf.improvmx.com) — verified 2026-08-04  
- [ ] Optional: send yourself a test to support@ and confirm Gmail  
- [ ] Optional: Gmail filter label “ruletka” for both aliases  
- [ ] Play Console / store listing: support email = support@ruletka.me  
