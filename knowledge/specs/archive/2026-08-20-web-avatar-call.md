# Spec: Browser partner photo always + incoming call card

```text
GOAL: PC live always shows conversationalist circle (photo or letter) so tap-★ works. Incoming/outgoing friend call is a big card with photo, not a skinny toast.
DONE WHEN:
  1) #remote-avatar visible mid-match even with no data-URL; #remote-avatar-letter shows first letter
  2) Incoming + outgoing call UI has photo/letter + name + Accept/Decline (or Cancel)
  3) CSS: circle ≥ 4.25rem; call card centered, avatar ~88px
EVAL:
  - gift-kinds / static: remote-avatar-letter in live.html; setTileAvatar letter path; call-toast-av in showIncomingCall
MUST NOT: MediaSession, ICE, pool>0, deploy, APK
```
