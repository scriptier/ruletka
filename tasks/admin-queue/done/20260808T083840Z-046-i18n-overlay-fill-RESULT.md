# RESULT: 046-i18n-overlay-fill

## Status
DONE

## Completion promise
COMPLETE

## What changed
Filled English-fallback gaps in the mobile i18n *overlay* (thin layer on top of `packs/`, which does not contain any `mobile.*` keys) for the target categories: notify hints, friends Online/Chat/Call, and live `partnerNotReady` / `needStars`.

- Audited all 14 overlay files against a 41-key target list covering `mobile.notif.*`, `mobile.settings.notify*`/`push*`/`battery*`, `mobile.friends.chat*`/`onlineCount`/`callFailed`/`inviteNeedOnline`, `mobile.home.friendsOnline`, `mobile.toast.friend*`, `friends.call*`, and `mobile.live.needStars(Title)`/`partnerNotReady`.
- Translated/added the missing or English-fallback keys natively for **de, es, fr, pl, pt, ar, zh, cs, bg, sr, tr** (9 newly-added keys + up to ~30 previously-English keys per language, depending on how complete that language already was).
- **uk** only needed 5 missing keys (`inviteNeedOnline`, `home.friendsOnline`, `pushBatteryTip`, `toast.friendOnline`, `toast.friendsOnline`) — it was already largely translated.
- **ru** and **en** only needed the `notifyHint` wording fix (see bug below) — otherwise already complete for this key set.
- **Bug fix (in scope, same key set):** `mobile.settings.notifyHint` leaked the internal env var name `ROULETTE_PUSH_WEBHOOK_URL` into user-facing copy in **13 of 14** overlay files (every language except `uk`, which already phrased it generically). Reworded in every language (including `en`/`ru`) to a plain "push notifications enabled on the hub" phrasing — no more raw env var name anywhere in the overlay tree.
- **Bug fix (mojibake, same key `mobile.live.needStars`):** `ar.json`, `cs.json`, `bg.json`, `sr.json` had the ★ star glyph corrupted to `â` in this key (encoding mismatch), e.g. `"...{cost}â (you have {stars})."`. Fixed for `needStars` since it's one of our target keys. **Note:** the same `â` corruption also exists in 5 *other*, out-of-scope keys in those same 4 files (`mobile.live.friendsOnlyHint`, `mobile.live.rateBody`, `mobile.live.starReady`, `mobile.settings.backupHint`, `mobile.settings.saved`) — left untouched per task scope; flagging for a follow-up i18n task.

## Intentional EN-identical values (documented, not bugs)
A handful of target keys are **present** with a value identical to English because that's the correct native-language rendering (common loanwords in tech UI), not a fallback:
- `mobile.friends.chat` = `"Chat"` in de/es/fr/pt/cs (loanword, matches rest of file's style)
- `mobile.common.online`/`mobile.common.offline` in de/es/fr/pt/pl (loanwords already used elsewhere in those same files, e.g. `mobile.friends.offline`)
- `mobile.toast.friendChat` = `"{name}: {body}"` everywhere — pure template, nothing to translate.

## Files
- `mobile/src/i18n/overlay/ar.json`
- `mobile/src/i18n/overlay/bg.json`
- `mobile/src/i18n/overlay/cs.json`
- `mobile/src/i18n/overlay/de.json`
- `mobile/src/i18n/overlay/en.json`
- `mobile/src/i18n/overlay/es.json`
- `mobile/src/i18n/overlay/fr.json`
- `mobile/src/i18n/overlay/pl.json`
- `mobile/src/i18n/overlay/pt.json`
- `mobile/src/i18n/overlay/ru.json`
- `mobile/src/i18n/overlay/sr.json`
- `mobile/src/i18n/overlay/tr.json`
- `mobile/src/i18n/overlay/uk.json`
- `mobile/src/i18n/overlay/zh.json`

(`packs/*.json` untouched — out of scope per task, confirmed they hold no `mobile.*` keys at all.)

## Verify ran
- `python3 -c "import json; json.load(open(f))"` on all 14 overlay files — all valid JSON.
- `grep -rl ROULETTE_PUSH_WEBHOOK_URL mobile/src/i18n/overlay/` — no matches (was in 13 files before).
- Scripted gap check of all 41 target keys × 13 non-English languages — all present, non-English-fallback (except the documented intentional loanword cases above).
- `git diff --stat` — only `mobile/src/i18n/overlay/*.json` touched, no unrelated files.

## Connect risk
safe to merge after smoke — this is a pure JSON string change in the mobile i18n overlay layer; does not touch `mobile/src/media/*`, `mobile/app/live.tsx`, or any connect path code.

## Handoff for morning
- merge branch: `admin/20260808T083840Z-046-i18n-overlay-fill`
- smoke: switch the Play app's language to a few of the touched locales (e.g. de, ar, zh, sr) and check Settings → notification opt-in dialog, Friends tab (online count/chat placeholder), and the "not enough stars" gift toast render correctly with no raw English leaking through and no mojibake `â` characters.
- follow-up idea (not done here, out of scope): fix the remaining 5 mojibake `â` keys in ar/cs/bg/sr (`friendsOnlyHint`, `rateBody`, `starReady`, `backupHint`, `settings.saved`) and consider a broader i18n completeness pass — `sr`/`cs`/`bg`/`ar` overlays are still only ~20% translated overall (most non-`mobile.*` UI keys fall back to English pack instead), `tr`/`zh` ~50%, well beyond what this task's scope covered.
- do not: deploy without Play↔PC connect check (this change shouldn't affect it, but per standing policy)
