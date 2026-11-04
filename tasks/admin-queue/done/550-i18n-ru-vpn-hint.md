# i18n: RU connectivity hint (honest)

## Goal
Settings / coach copy: if you’re in RF and the site or video fails without VPN, that’s network filter not “app requires VPN.” Point to Hide IP only **after** the page loads.

## OWN
- `ui/i18n/en.json` `ui/i18n/ru.json` keys only:
  - `settings.vpnOk` (tweak, don’t delete)
  - add `settings.ruReachHint` EN+RU
- Copy EN into other `ui/i18n/{ar,bg,cs,de,es,fr,pl,pt,sr,tr,uk,zh}.json` if missing
- **Do not** edit `meta.json` or `home-en.json`
- Wire the new key in `ui/live.html` settings connectivity paragraph **only if** a settings.connHint / vpnOk node already exists nearby — one `<p data-i18n="settings.ruReachHint">`. If no settings connectivity block, skip HTML.

## Copy EN
`settings.ruReachHint`: "In some countries the site or video is filtered. If the page won’t open, try another network. If the page opens but cameras never link, enable Hide my IP (TURN relay). We never require a VPN."

RU: honest translation. No “use VPN”. No “fixed in Russia”.

## Must not
- webrtc.js ICE order, coturn, deploy, APK
- Claim TURNS:443 exists if it doesn’t

## Done
keys in en+ru. RESULT + COMPLETE
