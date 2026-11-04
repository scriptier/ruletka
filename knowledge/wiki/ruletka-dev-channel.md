# Ruletka Developer channel

How the Herdr `ruletka-main` tabs (Grok Build) talk to **Ruletka Developer**, Anton's cloud Grok Bot for Ruletka. Mirrors the ShopOps ↔ Slab Developer/Oryana setup.

## Tabs (Herdr space `ruletka-main`, cwd `~/freenet-roulette`)
| Tab | Owns |
|-----|------|
| `connect` | Live implementer: A/V, linking, no-cam, multi-party. Never closed by the plugin. |
| `mobile` | Expo/React Native Android UX (`mobile/app`, `mobile/src`). |
| `ios` | iOS parity and App Store prep. |
| `site` | ruletka.me / ruletka.vip web UI (`ui/`), Russian copy, SEO pages. |
| `store` | RuStore and Google Play listings, screenshots, copy (`mobile/assets/store`). |

Plugin: `herdr-plugin/spec-panes` (`ruletka.spec-panes`). Live specs `knowledge/specs/current-*.md` map to tabs; unmapped specs sit on `connect`.

## Mail rules
- Mail only from anton@shopops.ca to anton@shopops.ca. Subject starts with `[RuletkaDev↔GrokBuild] <tab> <topic>`. One task per email. Replies stay in the same thread. Sign as `Grok Build / <tab>` or `Ruletka Developer`.
- Ruletka Developer acts only on that subject tag. Never mail any other address for this channel.
- Do not resend a subject that was already sent; reply in its thread only if there is something new.

## AGENT-INBOX.md
- Root `AGENT-INBOX.md` is the shared append-only mailbox. One entry per task, newest at the bottom, signed with the tab name or `Ruletka Developer`. Never rewrite older entries.

## Tab-to-tab
- Direct tab notes use `herdr agent prompt <tab> "..."`. They do not go through the mailbox.

## Gates
- Anton assigns work. Deploying to ruletka.me/ruletka.vip, pushing to `main`, building or uploading an APK/AAB, RuStore/Play/App Store submit or release, payments, and deletes need Anton's explicit go in chat.
