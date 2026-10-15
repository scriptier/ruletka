# Spec: Android self avatar + partner dock photo

```text
GOAL: Phone users can set a photo (like web). Conversationalist photo shows on the live dock. Same hub data URL as web (jpeg/png/webp, ≤48k chars, ~192px).
DONE WHEN:
  1) Settings: pick / change / clear photo; persisted in match prefs; hello + set_prefs send avatar (not "")
  2) Live dock: partner data-URL or https/file photo as circle next to name; letter fallback if none
  3) Call cards still use CallPeerAvatar (already)
EVAL:
  - L0: hello/setPrefs include prefs.avatar; dock has partnerAvatar / live-partner-identity-avatar
  - Unit: isValidAvatarDataUrl size + mime
  - Human: Settings photo → rematch → PC sees Android avatar; Android dock shows PC photo
MUST NOT: MediaSession, ICE, pool>0, deploy, unmount RTCView
```
