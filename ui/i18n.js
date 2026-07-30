/**
 * ruletka.vip i18n — multi-language (EN/RU bundled; others load from /i18n/{code}.json).
 * Usage: t("key"), t("key", { n: 2 }), setLang("es"), applyI18n()
 * Storage key kept as nextface-lang-v1 for continuity.
 */
(function (global) {
  const LANG_KEY = "nextface-lang-v1";

  /** Bundled + dynamically loaded packs. Always fall back to en. */
  const STR = {
    en: {
      // meta / brand
      "meta.title": "ruletka.vip — random video chat",
      "brand.name": "ruletka.vip",
      "brand.badge": "live",
      "brand.badgeTitle": "Matchmaking + P2P video",
      "arch.default": "P2P media · bridge match",
      "arch.p2p": "P2P media live",
      "arch.direct": "Direct P2P",
      "arch.relay": "Relayed (TURN)",
      "arch.freenet": "P2P media · Freenet match",
      "arch.fed": "Mesh match",
      "arch.fedTitle": "Matched via a cooperating hub. Video stays peer-to-peer.",
      "log.fedMatch": "Matched across hubs (federated pool)",
      "sec.pathDirect": "Direct P2P",
      "sec.pathDirectTitle": "Media goes browser-to-browser (encrypted). No TURN relay.",
      "sec.pathRelay": "Relayed",
      "sec.pathRelayTitle": "Media is relayed via TURN (encrypted). Prefer Direct when possible.",
      "sec.pathUnknown": "Connecting…",
      "sec.pathUnknownTitle": "Checking ICE path…",
      "sec.mediaLabel": "Video path",
      "sec.turnLabel": "Relay trust",
      "sec.idLabel": "Device identity",
      "sec.mediaP2p": "WebRTC P2P (when connected)",
      "sec.turnOpen": "Demo public TURN (Open Relay)",
      "sec.turnEphemeral": "Self-hosted TURN · short-lived creds",
      "sec.turnStatic": "Self-hosted TURN",
      "sec.turnNone": "No TURN (STUN only)",
      "sec.turnOn": "TURN available",
      "sec.idCrypto": "Device-bound (crypto key)",
      "sec.idLegacy": "Browser-local id",
      "sec.partnerRecord": "Partner can screenshot — use Block / Report",
      "settings.secSecurity": "Connection",
      "settings.secSafety": "Safety",
      "settings.secAudio": "Partner audio",
      "settings.secLegal": "Legal & help",
      "settings.secHardware": "Devices",
      "settings.secAbout": "About & legal",
      "settings.secMore": "Preferences",
      "settings.heroHint": "Shown to partners in chat",
      "settings.sumBlur": "Blur",
      "settings.sumNsfw": "Auto-skip",
      "settings.sumSound": "Sound",
      "settings.sumOff": "All off",
      "settings.blurFirst": "Blur strangers until I unblur",
      "settings.blurFirstHint": "Partner video starts blurred",
      "settings.nsfwHintShort": "On-device AI · not perfect",
      "log.blurFirst": "partner blurred (safety) — tap Blur to show",
      "log.turnEphemeral": "TURN: short-lived credentials",
      "room.label": "Room",
      "room.placeholder": "public",
      "room.set": "room: {room}",
      "room.public": "public lobby",
      "room.shareTitle": "Share room link",
      "room.copied": "room link copied",
      "room.shared": "room link shared",
      "room.copyFail": "could not copy link",
      "settings.matchSound": "Sound on match",
      "settings.nsfwAuto": "Auto-skip explicit video",
      "settings.nsfwHint": "On-device AI checks stranger video. High-confidence hits are blurred, blocked, and skipped. Not perfect.",
      "settings.roomHint": "Empty = public lobby. Same code = private room.",

      // pool / chrome
      "pool.online": "Online",
      "pool.waiting": "Waiting",
      "pool.searching": "Searching…",
      "pool.youWaiting": "You’re in the queue",
      "pool.othersWaiting": "{n} others waiting",
      "pool.alone": "You’re first in line",
      "phase.idle": "idle",
      "phase.waiting": "waiting",
      "phase.matched": "matched",
      "phase.claiming": "claiming",
      "status.disconnected": "disconnected",
      "status.connecting": "connecting…",
      "status.connected": "connected",
      "status.reconnecting": "reconnecting…",
      "status.socketError": "socket error",
      "status.previewOn": "preview on",
      "status.previewOff": "preview off",
      "status.previewFailed": "preview failed",
      "status.previewStarting": "starting camera…",
      "local.enableCam": "Enable camera",
      "local.enableHint": "Tap to allow camera & mic",
      "local.permDenied": "Camera blocked — allow in browser settings, then tap Enable",
      "local.noDevice": "No camera found on this device",
      "local.camBusy": "Camera is busy — close other apps and try again",
      "local.camConstraints": "Camera settings incompatible — trying defaults…",
      "status.matchedPreviewOff": "matched · preview off",
      "status.needsHttps": "needs HTTPS for cam (see log)",
      "status.searching": "searching…",
      "status.searchingOthers": "searching… {n} other waiting",
      "status.webrtc": "webrtc: {s}",
      "status.previewOkJoin": "preview OK; Join call after match",
      "status.calling": "calling friend…",
      "status.callTimeout": "no answer — try again later",
      "status.rejoinQueue": "back online — rejoining queue…",
      "status.friendCallLost": "connection lost — call friend again",

      // tiles
      "remote.emptyTitle": "Tap Next to start chatting",
      "remote.emptySub": "Partner appears here",
      "remote.connecting": "Connecting…",
      "remote.handshake": "WebRTC handshake",
      "remote.tag": "Partner",
      "local.emptyTitle": "Your camera",
      "local.emptySub": "Allow camera & mic when prompted",
      "local.tag": "You",

      // side rails
      "btn.partner": "Partner",
      "btn.partnerTitle": "Mute partner (P)",
      "btn.blur": "Blur",
      "btn.blurTitle": "Blur partner video (B)",
      "btn.full": "Full",
      "btn.fullTitle": "Fullscreen (F)",
      "nsfw.loading": "loading safety filter…",
      "nsfw.hit": "explicit content detected — skipped",
      "nsfw.blocked": "auto-blocked for explicit video",
      "log.blurOn": "partner video blurred",
      "log.blurOff": "partner video unblurred",
      "btn.cam": "Cam",
      "btn.camTitle": "Camera on/off (V)",
      "btn.mic": "Mic",
      "btn.micTitle": "Mute mic (M)",
      "btn.level": "Level",
      "btn.levelTitle": "Mic level",
      "btn.settingsTitle": "Settings",
      "vol.partner": "Partner volume",
      "vol.partnerAria": "Partner volume",

      // pills
      "mic.mic": "mic",
      "mic.muted": "muted",
      "mic.live": "live",

      // bottom
      "btn.connect": "Connect",
      "btn.next": "Next",
      "btn.spin": "Spin",
      "friends.open": "Friends",
      "friends.title": "Friends",
      "friends.yourCode": "Your code",
      "friends.copyCode": "Copy",
      "friends.yourName": "Display name",
      "friends.nameHint": "This name is what strangers and friends see in chat and when you match. Edit it in the top bar, Friends, or Settings.",
      "name.you": "You",
      "name.saved": "name saved",
      "name.needed": "Pick a display name so others know who you are",
      "friends.addCode": "Add friend by code",
      "friends.add": "Request",
      "friends.mutualHint": "When someone adds your code, you must Accept before you become friends and can Call.",
      "friends.hint": "After both Accept, Call when online. Then Browse together (max 2).",
      "friends.browseTogether": "Browse together",
      "friends.hangup": "Hang up",
      "friends.incoming": "is calling…",
      "friends.accept": "Accept",
      "friends.decline": "Decline",
      "friends.call": "Call",
      "friends.online": "online",
      "friends.offline": "offline",
      "friends.codeCopied": "friend code copied",
      "friends.empty": "No friends yet — share your code",
      "friends.partyTag": "Party of 2",
      "chat.placeholder": "Say something…",
      "chat.send": "Send",
      "chat.title": "Chat",
      "chat.empty": "Say hi — messages appear here",
      "friends.copyInvite": "Invite link",
      "friends.shareInvite": "Share",
      "friends.inviteCopied": "invite link copied",
      "friends.inviteShared": "invite shared",
      "friends.inviteAdded": "friend invite applied",
      "friends.noAnswer": "no answer",
      "friends.block": "Block",
      "friends.blocked": "blocked",
      "friends.unblock": "Unblock",
      "friends.remove": "Remove",
      "friends.blockConfirm": "Block this person? You will not match them again.",
      "friends.blockOk": "user blocked",
      "friends.blockedTitle": "Blocked",
      "friends.incomingTitle": "Friend requests",
      "friends.outgoingTitle": "Pending (sent)",
      "friends.acceptReq": "Accept",
      "friends.declineReq": "Decline",
      "friends.cancelReq": "Cancel",
      "friends.requestSent": "friend request sent",
      "friends.requestAccepted": "friend request accepted",
      "friends.historyTitle": "Recent",
      "friends.historyEmpty": "No recent matches yet",
      "friends.historyClear": "Clear history",
      "friends.redial": "Call",
      "friends.addFromHistory": "Add",
      "friends.kindStranger": "stranger",
      "friends.kindFriend": "friend call",
      "friends.kindMissed": "missed call",
      "friends.reqToast": "wants to be friends",
      "partnerMenu.title": "Partner actions",
      "partnerMenu.addFriend": "Add friend",
      "partnerMenu.alreadyFriend": "Already friends",
      "partnerMenu.pendingFriend": "Request pending",
      "partnerMenu.block": "Block",
      "partnerMenu.report": "Report",
      "partnerMenu.cancel": "Cancel",
      "partnerMenu.back": "Back",
      "partnerMenu.reportHint": "Why are you reporting?",
      "partnerMenu.rExplicit": "Explicit content",
      "partnerMenu.rHarassment": "Harassment",
      "partnerMenu.rUnderage": "Underage concern",
      "partnerMenu.rSpam": "Spam / scam",
      "partnerMenu.rOther": "Other",
      "partnerMenu.reportOk": "report sent — user blocked",
      "partnerMenu.noCode": "can't add friend (no code for this partner)",
      "conn.connecting": "Connecting…",
      "conn.connected": "Connected — ready",
      "conn.searching": "Searching for a partner…",
      "conn.matched": "In a call",
      "conn.friend": "Friend call",
      "conn.party": "Browsing together",
      "conn.disconnected": "Disconnected — retrying…",
      "conn.stunOnly": "STUN only (video may fail on some networks)",
      "conn.turnOn": "TURN relay available",
      "log.summary": "Activity log",

      // settings
      "settings.title": "Settings",
      "settings.camera": "Camera",
      "settings.mic": "Microphone",
      "settings.speaker": "Speaker",
      "settings.partnerVol": "Partner volume",
      "settings.refresh": "Refresh devices",
      "settings.restartCam": "Restart camera",
      "settings.hint":
        "Camera starts automatically. Side buttons control mute & partner volume. Shortcuts: M mic · V cam · P partner · Space next",
      "settings.lang": "Language",
      "settings.secProfile": "Profile",
      "settings.secAppearance": "Appearance",
      "settings.secHardware": "Hardware settings",
      "settings.secHelp": "Help & support",
      "settings.secOther": "Other",
      "settings.theme": "Theme",
      "settings.themeNight": "Night",
      "settings.themeHint": "Night theme is the default. More themes later.",
      "settings.systemDefault": "System default",
      "settings.contact": "Contact us",
      "settings.eula": "EULA",
      "settings.privacy": "Privacy policy",
      "settings.terms": "Terms of service",
      "settings.community": "Community guidelines",
      "settings.clearData": "Clear local data",
      "settings.clearConfirm": "Clear language, devices, history and identity on this browser?",
      "settings.clearDone": "Local data cleared",
      "settings.done": "Done",
      "lang.en": "English",
      "lang.ru": "Русский",

      // device labels
      "device.camera": "camera",
      "device.mic": "mic",
      "device.speaker": "speaker",
      "device.none": "No {kind} found",
      "device.defaultSpeaker": "Default system speaker",
      "device.switchingCam": "switching camera…",
      "device.switchingMic": "switching mic…",
      "device.camFallback": "camera fell back to another device",
      "device.micFallback": "mic fell back to another device",

      // logs / runtime
      "log.id": "id {id}",
      "log.devices": "devices: {c} cam · {m} mic · {s} out",
      "log.devicesFail": "device list failed: {e}",
      "log.previewStart": "preview started",
      "log.previewStop": "preview stopped",
      "log.previewFail": "preview failed: {e}",
      "log.micMuted": "mic muted",
      "log.micUnmuted": "mic unmuted",
      "log.camOff": "camera off",
      "log.camOn": "camera on",
      "log.partnerMuted": "partner muted",
      "log.partnerUnmuted": "partner unmuted",
      "log.speakerFail": "speaker switch failed: {e}",
      "log.spinning": "spinning…",
      "log.next": "next…",
      "log.matched": "matched with {id}",
      "log.matchedStatus": "matched {id} · {role}",
      "log.roleOffer": "you offer",
      "log.roleAnswer": "you answer",
      "log.notMatched": "not matched — preview anytime; call needs a match",
      "log.noMedia": "no local media",
      "log.callOffer": "call: sent offer",
      "log.callWait": "call: waiting for offer",
      "log.callFail": "call failed: {e}",
      "log.webrtcFail": "WebRTC failed — try Next, or check firewall/NAT",
      "coach.title": "Connection problem",
      "coach.lead": "Video couldn’t connect cleanly. Try the tips below — most issues are Wi‑Fi, permissions, or a strict network.",
      "coach.failed": "The peer video link failed. Often the other network or a firewall blocks the call.",
      "coach.timeout": "Still connecting after a while… their network may be blocking video.",
      "coach.stillFail": "Still no video. Try Next, or switch networks.",
      "coach.t1": "Use Wi‑Fi if possible (some mobile networks block video calls)",
      "coach.t2": "Allow camera & mic for this site, then reload",
      "coach.t3": "Tap Next to find someone else (their network may be blocked)",
      "coach.t4": "VPN or corporate networks often break peer video — try without VPN",
      "coach.next": "Next partner",
      "coach.retry": "Retry camera",
      "coach.dismiss": "Dismiss",
      "coach.strip": "Video connection issue",
      "coach.unstable": "Connection unstable…",
      "coach.metaTurnOn": "TURN relay available on this hub",
      "coach.metaTurnOff": "No TURN configured",
      "settings.secHub": "Network hub",
      "settings.secMatch": "Match prefs",
      "prefs.softHint":
        "Soft preferences only — if nobody matches, you’ll still meet others. Optional and private to this device.",
      "prefs.iAm": "I am",
      "prefs.looking": "Looking for",
      "prefs.unset": "Prefer not to say",
      "prefs.man": "Man",
      "prefs.woman": "Woman",
      "prefs.other": "Other",
      "prefs.any": "Anyone",
      "prefs.saved": "Match prefs saved",
      "settings.source": "Source code (GitHub)",
      "settings.decentralDocs": "Multi-hub & decentralization",
      "settings.license": "License · LGPL-2.1",
      "hub.explain":
        "Matchmaking runs on a hub you choose. Video stays peer-to-peer. If one hub is down, the app can try another from the public directory.",
      "hub.current": "Current hub",
      "hub.auto": "Auto-switch if offline",
      "hub.autoHint": "Use the public hub directory to fail over",
      "hub.directory": "Known hubs",
      "hub.refresh": "Refresh list",
      "hub.usePage": "Use this page’s hub",
      "hub.runOwn": "Run your own hub: github.com/scriptier/ruletka",
      "hub.loading": "Loading directory…",
      "hub.empty": "No other hubs listed yet",
      "hub.switched": "Switched hub → {h}",
      "hub.reset": "Using this page’s hub",
      "hub.gaveUp": "Hub unreachable — trying directory / reload",
      "wait.title": "Still looking…",
      "wait.body":
        "Few people online right now. Keep this tab open, share a room with a friend, or try again later.",
      "wait.alone":
        "You’re the only one here. Share ruletka.vip or a room code with a friend.",
      "wait.few":
        "Almost nobody is waiting. Stay open — or invite a friend with a room code.",
      "friends.onlineNow": "is online",
      "keys.title": "Keyboard shortcuts",
      "keys.next": "Next partner",
      "keys.mic": "Mute mic",
      "keys.cam": "Camera on/off",
      "keys.partner": "Mute partner",
      "keys.blur": "Blur partner",
      "keys.full": "Fullscreen partner",
      "keys.this": "This help",
      "keys.esc": "Close menus",
      "keys.hint": "Click partner video for friend / block / report",
      "pool.roomOthers": "{n} others in room “{r}”",
      "pool.roomAlone": "You’re alone in room “{r}” — share the code",
      "room.chipTitle": "Room: {r}",
      "friends.offline": "Offline",
      "friends.incomingNotifTitle": "Incoming call — ruletka.vip",
      "friends.incomingNotifBody": "{n} is calling you",
      "log.signalErr": "signal err: {e}",
      "log.error": "error: {e}",
      "log.secure":
        "⚠ Not a secure context (plain http on non-localhost). Camera/mic may be blocked. Use https:// tunnel, or open via http://127.0.0.1",
      "log.iceDefault": "ICE config: defaults (config.json: {e})",
      "log.iceOk": "ICE: {n} group(s) · {turn}",
      "log.turnOn": "TURN on",
      "log.turnOff": "STUN only",
      "log.meterNoTrack": "mic meter: no audio track on stream",
      "log.meterEnded": "mic meter: audio track ended",
      "log.meterNoAc": "mic meter: AudioContext not supported",
      "log.meterLocked": "mic meter: audio locked — click the page once",
      "log.meterFail": "mic meter failed: {e}",
      "log.reconnectIn": "reconnecting in {s}s…",
      "log.onlineAgain": "network back — reconnecting",
      "log.offline": "network offline",

      "rules.title": "Before you start",
      "rules.age": "You must be 18+ to use ruletka.vip.",
      "rules.respect": "Be respectful. No harassment, hate, or illegal content.",
      "rules.media": "Video is peer-to-peer. Use Block if someone is inappropriate.",
      "rules.privacy": "Do not share secrets; friends are stored on this server instance.",
      "rules.ageConfirm": "I am 18 or older",
      "rules.accept": "Enter ruletka.vip",

      // server detail translations
      "srv.partnerNext": "partner hit Next — searching again",
      "srv.partnerDisc": "partner disconnected — searching again",
      "srv.spun": "spun into lobby",
      "srv.nextSearch": "next — searching again",
      "srv.notMatched": "not matched",
      "srv.chatLong": "chat too long (max 500 chars)",
      "srv.signalLarge": "signal too large",
      "srv.rateLimited": "rate limited — slow down",
      "srv.rateChat": "rate limited — chat too fast",
      "srv.rateMatch": "rate limited — too many spin/next",
      "srv.serverFull": "server full",
      "srv.frameLarge": "frame too large",
    },

    ru: {
      "meta.title": "ruletka.vip — случайный видеочат",
      "brand.name": "ruletka.vip",
      "brand.badge": "онлайн",
      "brand.badgeTitle": "Подбор собеседника + P2P-видео",
      "arch.default": "P2P медиа · матч на мосте",
      "arch.p2p": "P2P медиа активно",
      "arch.direct": "Прямой P2P",
      "arch.relay": "Через TURN",
      "arch.freenet": "P2P медиа · матч Freenet",
      "sec.pathDirect": "Прямой P2P",
      "sec.pathDirectTitle": "Медиа идёт браузер–браузер (шифровано). Без TURN.",
      "sec.pathRelay": "Через TURN",
      "sec.pathRelayTitle": "Медиа через TURN-релей (шифровано). Лучше прямой путь.",
      "sec.pathUnknown": "Соединение…",
      "sec.pathUnknownTitle": "Проверка ICE…",
      "sec.mediaLabel": "Путь видео",
      "sec.turnLabel": "Доверие к релей",
      "sec.idLabel": "Идентичность",
      "sec.mediaP2p": "WebRTC P2P (в звонке)",
      "sec.turnOpen": "Демо TURN (Open Relay)",
      "sec.turnEphemeral": "Свой TURN · краткосрочные ключи",
      "sec.turnStatic": "Свой TURN",
      "sec.turnNone": "Без TURN (только STUN)",
      "sec.turnOn": "TURN доступен",
      "sec.idCrypto": "Привязано к устройству (ключ)",
      "sec.idLegacy": "Локальный id браузера",
      "sec.partnerRecord": "Собеседник может снимать экран — Block / Жалоба",
      "settings.secSecurity": "Соединение",
      "settings.secSafety": "Безопасность",
      "settings.secAudio": "Звук собеседника",
      "settings.secLegal": "Правовое и помощь",
      "settings.secHardware": "Устройства",
      "settings.secAbout": "О сервисе",
      "settings.secMore": "Настройки",
      "settings.heroHint": "Видят собеседники в чате",
      "settings.sumBlur": "Блюр",
      "settings.sumNsfw": "Авто-скип",
      "settings.sumSound": "Звук",
      "settings.sumOff": "Всё выкл.",
      "settings.blurFirst": "Блюр незнакомцев, пока не сниму",
      "settings.blurFirstHint": "Видео собеседника сначала размыто",
      "settings.nsfwHintShort": "ИИ на устройстве · не 100%",
      "log.blurFirst": "собеседник размыт (безопасность) — Blur чтобы показать",
      "log.turnEphemeral": "TURN: краткосрочные ключи",
      "room.label": "Комната",
      "room.placeholder": "общая",
      "room.set": "комната: {room}",
      "room.public": "общий зал",
      "room.shareTitle": "Поделиться комнатой",
      "room.copied": "ссылка скопирована",
      "room.shared": "ссылка отправлена",
      "room.copyFail": "не удалось скопировать",
      "settings.matchSound": "Звук при матче",
      "settings.nsfwAuto": "Авто-пропуск явного видео",
      "settings.nsfwHint": "ИИ на устройстве проверяет видео незнакомцев. При высокой уверенности — блюр, блок и далее. Не 100% точно.",
      "settings.roomHint": "Пусто = общий зал. Один код = приватная комната.",

      "pool.online": "В сети",
      "pool.waiting": "В очереди",
      "pool.searching": "Поиск…",
      "pool.youWaiting": "Вы в очереди",
      "pool.othersWaiting": "ещё {n} ждут",
      "pool.alone": "Вы первые в очереди",
      "phase.idle": "ожидание",
      "phase.waiting": "поиск",
      "phase.matched": "в чате",
      "phase.claiming": "связка",
      "status.disconnected": "нет связи",
      "status.connecting": "подключение…",
      "status.connected": "на связи",
      "status.reconnecting": "переподключение…",
      "status.socketError": "ошибка сокета",
      "status.previewOn": "превью вкл.",
      "status.previewOff": "превью выкл.",
      "status.previewFailed": "превью не удалось",
      "status.previewStarting": "запуск камеры…",
      "local.enableCam": "Включить камеру",
      "local.enableHint": "Нажмите, чтобы разрешить камеру и микрофон",
      "local.permDenied": "Камера запрещена — разрешите в настройках браузера, затем «Включить»",
      "local.noDevice": "Камера не найдена на устройстве",
      "local.camBusy": "Камера занята — закройте другие приложения",
      "local.camConstraints": "Параметры камеры не подходят — пробуем стандартные…",
      "status.matchedPreviewOff": "в чате · превью выкл.",
      "status.needsHttps": "нужен HTTPS для камеры (см. журнал)",
      "status.searching": "поиск…",
      "status.searchingOthers": "поиск… ещё {n} в очереди",
      "status.webrtc": "webrtc: {s}",
      "status.previewOkJoin": "превью ОК; «В звонок» после матча",
      "status.calling": "звоним другу…",
      "status.callTimeout": "нет ответа — попробуйте позже",
      "status.rejoinQueue": "снова в сети — возврат в очередь…",
      "status.friendCallLost": "связь потеряна — позвоните снова",

      "remote.emptyTitle": "Нажмите «Далее», чтобы начать",
      "remote.emptySub": "Собеседник появится здесь",
      "remote.connecting": "Соединение…",
      "remote.handshake": "Установка WebRTC",
      "remote.tag": "Собеседник",
      "local.emptyTitle": "Ваша камера",
      "local.emptySub": "Разрешите камеру и микрофон в браузере",
      "local.tag": "Вы",

      "btn.partner": "Звук",
      "btn.partnerTitle": "Выкл. звук собеседника (P)",
      "btn.blur": "Блюр",
      "btn.blurTitle": "Размыть видео собеседника (B)",
      "btn.full": "Экран",
      "btn.fullTitle": "На весь экран (F)",
      "nsfw.loading": "загрузка фильтра…",
      "nsfw.hit": "явный контент — пропуск",
      "nsfw.blocked": "автоблок за явный контент",
      "log.blurOn": "видео собеседника размыто",
      "log.blurOff": "размытие снято",
      "btn.cam": "Кам",
      "btn.camTitle": "Камера вкл/выкл (V)",
      "btn.mic": "Мик",
      "btn.micTitle": "Микрофон вкл/выкл (M)",
      "btn.level": "Уров.",
      "btn.levelTitle": "Уровень микрофона",
      "btn.settingsTitle": "Настройки",
      "vol.partner": "Громкость собеседника",
      "vol.partnerAria": "Громкость собеседника",

      "mic.mic": "мик",
      "mic.muted": "выкл",
      "mic.live": "эфир",

      "btn.connect": "Связь",
      "btn.next": "Далее",
      "btn.spin": "Спин",
      "friends.open": "Друзья",
      "friends.title": "Друзья",
      "friends.yourCode": "Ваш код",
      "friends.copyCode": "Копир.",
      "friends.yourName": "Имя",
      "friends.nameHint": "Это имя видят собеседники в чате и при матче. Меняйте вверху, в «Друзья» или в настройках.",
      "name.you": "Вы",
      "name.saved": "имя сохранено",
      "name.needed": "Укажите имя, чтобы собеседники видели, кто вы",
      "friends.addCode": "Добавить по коду",
      "friends.add": "Запрос",
      "friends.mutualHint": "Если кто-то добавил ваш код, нажмите «Принять» — только после этого можно звонить.",
      "friends.hint": "После принятия можно звонить. Затем «Смотрим вместе» (макс. 2).",
      "friends.browseTogether": "Вместе",
      "friends.hangup": "Сбросить",
      "friends.incoming": "звонит…",
      "friends.accept": "Принять",
      "friends.decline": "Отклонить",
      "friends.call": "Звонок",
      "friends.online": "в сети",
      "friends.offline": "офлайн",
      "friends.codeCopied": "код скопирован",
      "friends.empty": "Пока нет друзей — поделитесь кодом",
      "friends.partyTag": "Пара (2)",
      "chat.placeholder": "Напишите сообщение…",
      "chat.send": "Отпр.",
      "chat.title": "Чат",
      "chat.empty": "Напишите что-нибудь — сообщения здесь",
      "friends.copyInvite": "Ссылка-приглашение",
      "friends.shareInvite": "Поделиться",
      "friends.inviteCopied": "ссылка скопирована",
      "friends.inviteShared": "приглашение отправлено",
      "friends.inviteAdded": "приглашение применено",
      "friends.noAnswer": "нет ответа",
      "friends.block": "В блок",
      "friends.blocked": "в блоке",
      "friends.unblock": "Разблок.",
      "friends.remove": "Удалить",
      "friends.blockConfirm": "Заблокировать? Вы больше не встретитесь в поиске.",
      "friends.blockOk": "пользователь заблокирован",
      "friends.blockedTitle": "Чёрный список",
      "friends.incomingTitle": "Запросы в друзья",
      "friends.outgoingTitle": "Ожидают ответа",
      "friends.acceptReq": "Принять",
      "friends.declineReq": "Отклонить",
      "friends.cancelReq": "Отмена",
      "friends.requestSent": "запрос отправлен",
      "friends.requestAccepted": "запрос принят",
      "friends.historyTitle": "Недавние",
      "friends.historyEmpty": "Пока нет недавних матчей",
      "friends.historyClear": "Очистить историю",
      "friends.redial": "Звонок",
      "friends.addFromHistory": "В друзья",
      "friends.kindStranger": "незнакомец",
      "friends.kindFriend": "звонок другу",
      "friends.kindMissed": "пропущенный",
      "friends.reqToast": "хочет добавить в друзья",
      "partnerMenu.title": "Действия с собеседником",
      "partnerMenu.addFriend": "В друзья",
      "partnerMenu.alreadyFriend": "Уже в друзьях",
      "partnerMenu.pendingFriend": "Запрос отправлен",
      "partnerMenu.block": "В блок",
      "partnerMenu.report": "Пожаловаться",
      "partnerMenu.cancel": "Отмена",
      "partnerMenu.back": "Назад",
      "partnerMenu.reportHint": "Причина жалобы?",
      "partnerMenu.rExplicit": "Явный контент",
      "partnerMenu.rHarassment": "Оскорбления",
      "partnerMenu.rUnderage": "Подозрение на несовершеннолетнего",
      "partnerMenu.rSpam": "Спам / мошенничество",
      "partnerMenu.rOther": "Другое",
      "partnerMenu.reportOk": "жалоба отправлена — пользователь в блоке",
      "partnerMenu.noCode": "нельзя добавить (нет кода собеседника)",
      "conn.connecting": "Подключение…",
      "conn.connected": "На связи — готово",
      "conn.searching": "Ищем собеседника…",
      "conn.matched": "В звонке",
      "conn.friend": "Звонок с другом",
      "conn.party": "Смотрим вместе",
      "conn.disconnected": "Нет связи — переподключение…",
      "conn.stunOnly": "Только STUN (видео может не пройти NAT)",
      "conn.turnOn": "TURN доступен",
      "log.summary": "Журнал",

      "settings.title": "Настройки",
      "settings.camera": "Камера",
      "settings.mic": "Микрофон",
      "settings.speaker": "Динамик",
      "settings.partnerVol": "Громкость собеседника",
      "settings.refresh": "Обновить устройства",
      "settings.restartCam": "Перезапуск камеры",
      "settings.hint":
        "Камера включается сама. Боковые кнопки — mute и громкость. Клавиши: M мик · V кам · P собеседник · Пробел — далее",
      "settings.lang": "Язык",
      "settings.secProfile": "Профиль",
      "settings.secAppearance": "Оформление",
      "settings.secHardware": "Оборудование",
      "settings.secHelp": "Помощь и поддержка",
      "settings.secOther": "Другое",
      "settings.theme": "Тема",
      "settings.themeNight": "Ночь",
      "settings.themeHint": "Ночная тема по умолчанию. Другие темы позже.",
      "settings.systemDefault": "Системный",
      "settings.contact": "Связаться с нами",
      "settings.eula": "Лицензия (EULA)",
      "settings.privacy": "Политика конфиденциальности",
      "settings.terms": "Условия использования",
      "settings.community": "Правила сообщества",
      "settings.clearData": "Очистить локальные данные",
      "settings.clearConfirm": "Очистить язык, устройства, историю и профиль в этом браузере?",
      "settings.clearDone": "Локальные данные очищены",
      "settings.done": "Готово",
      "lang.en": "English",
      "lang.ru": "Русский",

      "device.camera": "камера",
      "device.mic": "мик",
      "device.speaker": "динамик",
      "device.none": "{kind} не найден(а)",
      "device.defaultSpeaker": "Системный динамик",
      "device.switchingCam": "переключение камеры…",
      "device.switchingMic": "переключение мика…",
      "device.camFallback": "камера переключилась на другое устройство",
      "device.micFallback": "мик переключился на другое устройство",

      "log.id": "id {id}",
      "log.devices": "устройства: {c} кам · {m} мик · {s} вых.",
      "log.devicesFail": "список устройств: {e}",
      "log.previewStart": "превью запущено",
      "log.previewStop": "превью остановлено",
      "log.previewFail": "превью не удалось: {e}",
      "log.micMuted": "микрофон выкл.",
      "log.micUnmuted": "микрофон вкл.",
      "log.camOff": "камера выкл.",
      "log.camOn": "камера вкл.",
      "log.partnerMuted": "собеседник без звука",
      "log.partnerUnmuted": "звук собеседника вкл.",
      "log.speakerFail": "смена динамика: {e}",
      "log.spinning": "в очередь…",
      "log.next": "далее…",
      "log.matched": "пара с {id}",
      "log.matchedStatus": "пара {id} · {role}",
      "log.roleOffer": "вы звоните",
      "log.roleAnswer": "вы отвечаете",
      "log.notMatched": "нет пары — превью можно; звонок после матча",
      "log.noMedia": "нет локального медиа",
      "log.callOffer": "звонок: offer отправлен",
      "log.callWait": "звонок: ждём offer",
      "log.callFail": "звонок не удался: {e}",
      "coach.title": "Проблема со связью",
      "coach.lead": "Видео не подключилось. Чаще всего виноваты сеть, VPN или запрет камеры.",
      "coach.failed": "Видео-связь оборвалась. Часто блокирует сеть собеседника или firewall.",
      "coach.timeout": "Долго нет видео… возможно, у собеседника блокируется WebRTC.",
      "coach.stillFail": "Всё ещё нет видео. Нажмите «Далее» или смените сеть.",
      "coach.t1": "По возможности Wi‑Fi (мобильный интернет иногда режет видео)",
      "coach.t2": "Разрешите камеру и микрофон для сайта, затем обновите страницу",
      "coach.t3": "«Далее» — другой собеседник (у прошлого могла быть закрытая сеть)",
      "coach.t4": "VPN и корпоративные сети часто ломают P2P — попробуйте без VPN",
      "coach.next": "Следующий",
      "coach.retry": "Камера снова",
      "coach.dismiss": "Закрыть",
      "coach.strip": "Проблема с видео-связью",
      "coach.unstable": "Связь нестабильна…",
      "coach.metaTurnOn": "TURN-релей на хабе доступен",
      "coach.metaTurnOff": "TURN не настроен",
      "settings.secHub": "Сетевой хаб",
      "settings.secMatch": "Предпочтения",
      "prefs.softHint":
        "Мягкие предпочтения: если никого нет, всё равно будут другие. Необязательно, хранится на этом устройстве.",
      "prefs.iAm": "Я",
      "prefs.looking": "Ищу",
      "prefs.unset": "Не указывать",
      "prefs.man": "Мужчина",
      "prefs.woman": "Женщина",
      "prefs.other": "Другое",
      "prefs.any": "Кого угодно",
      "prefs.saved": "Предпочтения сохранены",
      "settings.source": "Исходный код (GitHub)",
      "settings.decentralDocs": "Мульти-хаб и децентрализация",
      "settings.license": "Лицензия · LGPL-2.1",
      "hub.explain":
        "Подбор собеседника идёт через выбранный хаб. Видео — peer-to-peer. Если хаб недоступен, клиент может переключиться на другой из каталога.",
      "hub.current": "Текущий хаб",
      "hub.auto": "Авто-переключение при сбое",
      "hub.autoHint": "Брать запасные хабы из публичного каталога",
      "hub.directory": "Известные хабы",
      "hub.refresh": "Обновить список",
      "hub.usePage": "Хаб этой страницы",
      "hub.runOwn": "Свой хаб: github.com/scriptier/ruletka",
      "hub.loading": "Загрузка каталога…",
      "hub.empty": "Других хабов пока нет",
      "hub.switched": "Хаб → {h}",
      "hub.reset": "Используется хаб этой страницы",
      "hub.gaveUp": "Хаб недоступен — пробуем каталог / перезагрузку",
      "wait.title": "Всё ещё ищем…",
      "wait.body":
        "Сейчас мало людей. Оставьте вкладку открытой, позовите друга с кодом комнаты или зайдите позже.",
      "wait.alone":
        "Вы тут один. Поделитесь ruletka.vip или кодом комнаты с другом.",
      "wait.few":
        "Почти никто не ждёт. Подождите — или пригласите друга кодом комнаты.",
      "friends.onlineNow": "сейчас онлайн",
      "keys.title": "Горячие клавиши",
      "keys.next": "Следующий",
      "keys.mic": "Микрофон",
      "keys.cam": "Камера вкл/выкл",
      "keys.partner": "Звук собеседника",
      "keys.blur": "Размыть видео",
      "keys.full": "Полный экран",
      "keys.this": "Эта справка",
      "keys.esc": "Закрыть меню",
      "keys.hint": "Клик по видео собеседника — друг / блок / жалоба",
      "pool.roomOthers": "ещё {n} в комнате «{r}»",
      "pool.roomAlone": "Вы одни в комнате «{r}» — поделитесь кодом",
      "room.chipTitle": "Комната: {r}",
      "friends.offline": "Не в сети",
      "friends.incomingNotifTitle": "Входящий звонок — ruletka.vip",
      "friends.incomingNotifBody": "{n} звонит вам",
      "log.webrtcFail": "WebRTC ошибка — «Далее» или проверьте NAT/файрвол",
      "log.signalErr": "сигнал: {e}",
      "log.error": "ошибка: {e}",
      "log.secure":
        "⚠ Небезопасный контекст (http не на localhost). Камера/мик могут быть заблокированы. Нужен https:// или http://127.0.0.1",
      "log.iceDefault": "ICE: по умолчанию (config.json: {e})",
      "log.iceOk": "ICE: {n} групп(ы) · {turn}",
      "log.turnOn": "TURN вкл.",
      "log.turnOff": "только STUN",
      "log.meterNoTrack": "уровень: нет аудиотрека",
      "log.meterEnded": "уровень: трек завершён",
      "log.meterNoAc": "уровень: AudioContext не поддерживается",
      "log.meterLocked": "уровень: звук заблокирован — кликните «Превью» или страницу",
      "log.meterFail": "уровень: {e}",
      "log.reconnectIn": "переподключение через {s} с…",
      "log.onlineAgain": "сеть снова есть — переподключаемся",
      "log.offline": "нет сети",

      "rules.title": "Перед стартом",
      "rules.age": "Вам должно быть 18+ для ruletka.vip.",
      "rules.respect": "Уважайте других. Без травли, ненависти и незаконного контента.",
      "rules.media": "Видео идёт P2P. Нажмите «В блок», если собеседник неадекватен.",
      "rules.privacy": "Не делитесь секретами; друзья хранятся на этом сервере.",
      "rules.ageConfirm": "Мне есть 18 лет",
      "rules.accept": "Войти в ruletka.vip",

      "srv.partnerNext": "собеседник нажал «Далее» — снова ищем",
      "srv.partnerDisc": "собеседник отключился — снова ищем",
      "srv.spun": "в очереди",
      "srv.nextSearch": "далее — снова поиск",
      "srv.notMatched": "нет пары",
      "srv.chatLong": "сообщение слишком длинное (макс. 500)",
      "srv.signalLarge": "сигнал слишком большой",
      "srv.rateLimited": "лимит — помедленнее",
      "srv.rateChat": "лимит — слишком быстрый чат",
      "srv.rateMatch": "лимит — слишком много «далее»",
      "srv.serverFull": "сервер заполнен",
      "srv.frameLarge": "кадр слишком большой",
    },
  };

  /** English server fragments → i18n keys */
  const SERVER_MAP = [
    [/partner hit Next/i, "srv.partnerNext"],
    [/partner disconnected/i, "srv.partnerDisc"],
    [/spun into lobby/i, "srv.spun"],
    [/next — searching again/i, "srv.nextSearch"],
    [/^not matched$/i, "srv.notMatched"],
    [/chat too long/i, "srv.chatLong"],
    [/signal too large/i, "srv.signalLarge"],
    [/rate limited — chat/i, "srv.rateChat"],
    [/rate limited — too many/i, "srv.rateMatch"],
    [/rate limited/i, "srv.rateLimited"],
    [/server full/i, "srv.serverFull"],
    [/frame too large/i, "srv.frameLarge"],
  ];

  /** Built-in codes; extra packs under /i18n/{code}.json */
  const BUNDLED = new Set(["en", "ru"]);
  let META = {
    languages: [
      { code: "en", native: "English", dir: "ltr" },
      { code: "ru", native: "Русский", dir: "ltr" },
      { code: "uk", native: "Українська", dir: "ltr" },
      { code: "es", native: "Español", dir: "ltr" },
      { code: "de", native: "Deutsch", dir: "ltr" },
      { code: "fr", native: "Français", dir: "ltr" },
      { code: "pt", native: "Português", dir: "ltr" },
      { code: "tr", native: "Türkçe", dir: "ltr" },
      { code: "pl", native: "Polski", dir: "ltr" },
      { code: "zh", native: "中文", dir: "ltr" },
    ],
    default: "ru",
  };
  const SUPPORTED = () => new Set(META.languages.map((l) => l.code));
  const loading = {};

  // Default product language for ruletka.vip is Russian
  let lang = "ru";

  function normalizeLang(code) {
    if (!code) return "";
    const c = String(code).toLowerCase().replace("_", "-");
    const primary = c.split("-")[0];
    // zh-CN / zh-TW → zh pack
    if (primary === "zh") return "zh";
    if (primary === "pt") return "pt";
    return primary;
  }

  function isSupported(code) {
    return SUPPORTED().has(normalizeLang(code));
  }

  function detectLang() {
    const q = new URLSearchParams(location.search).get("lang");
    const nq = normalizeLang(q);
    if (nq && isSupported(nq)) return nq;
    try {
      const saved = localStorage.getItem(LANG_KEY);
      const ns = normalizeLang(saved);
      if (ns && isSupported(ns)) return ns;
    } catch (_) {}
    // Browser preference
    try {
      const nav = navigator.languages || [navigator.language || ""];
      for (const raw of nav) {
        const n = normalizeLang(raw);
        if (n && isSupported(n)) return n;
      }
    } catch (_) {}
    return META.default || "ru";
  }

  function t(key, vars) {
    const table = STR[lang] || {};
    let s = table[key] ?? STR.en?.[key] ?? key;
    if (vars && typeof vars === "object") {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return s;
  }

  function translateServerDetail(detail) {
    if (!detail) return detail;
    for (const [re, key] of SERVER_MAP) {
      if (re.test(detail)) return t(key);
    }
    return detail;
  }

  function phaseLabel(phase) {
    const k = `phase.${phase}`;
    return t(k) !== k ? t(k) : phase;
  }

  function fillLangSelects() {
    const opts = META.languages
      .map(
        (l) =>
          `<option value="${l.code}">${l.native}</option>`
      )
      .join("");
    ["sel-lang", "sel-lang-sheet", "home-lang"].forEach((id) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const cur = sel.value || lang;
      sel.innerHTML = opts;
      if (isSupported(cur)) sel.value = normalizeLang(cur);
      else sel.value = lang;
    });
  }

  function applyI18n(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = t(key);
    });
    scope.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      if (!key) return;
      el.innerHTML = t(key);
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) el.setAttribute("placeholder", t(key));
    });
    scope.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (key) el.setAttribute("title", t(key));
    });
    scope.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (key) el.setAttribute("aria-label", t(key));
    });
    const meta = META.languages.find((l) => l.code === lang);
    document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
    document.documentElement.dir = meta?.dir || "ltr";
    document.title = t("meta.title");
    fillLangSelects();
    const sel = document.getElementById("sel-lang");
    if (sel) sel.value = lang;
    const sel2 = document.getElementById("sel-lang-sheet");
    if (sel2) sel2.value = lang;
  }

  function loadPack(code) {
    const c = normalizeLang(code);
    if (!c || BUNDLED.has(c) || STR[c]) return Promise.resolve(STR[c] || STR.en);
    if (loading[c]) return loading[c];
    loading[c] = fetch(`/i18n/${c}.json?v=1`, { cache: "force-cache" })
      .then((r) => {
        if (!r.ok) throw new Error("lang pack " + c);
        return r.json();
      })
      .then((j) => {
        if (j && typeof j === "object") STR[c] = j;
        return STR[c];
      })
      .catch(() => {
        console.warn("[i18n] failed to load", c);
        return null;
      })
      .finally(() => {
        delete loading[c];
      });
    return loading[c];
  }

  function loadMeta() {
    return fetch("/i18n/meta.json?v=1", { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && Array.isArray(j.languages)) META = j;
        return META;
      })
      .catch(() => META);
  }

  function setLang(next) {
    const n = normalizeLang(next);
    if (!n || !isSupported(n)) return Promise.resolve();
    const apply = () => {
      lang = n;
      try {
        localStorage.setItem(LANG_KEY, lang);
      } catch (_) {}
      applyI18n();
      global.dispatchEvent(new CustomEvent("nextface:lang", { detail: { lang } }));
    };
    if (BUNDLED.has(n) || STR[n]) {
      apply();
      return Promise.resolve();
    }
    return loadPack(n).then(() => apply());
  }

  function getLang() {
    return lang;
  }

  function listLanguages() {
    return META.languages.slice();
  }

  lang = detectLang();

  // Boot: load meta + current pack if external
  const boot = loadMeta()
    .then(() => {
      // re-detect if meta changed supported set
      if (!isSupported(lang)) lang = META.default || "ru";
      if (!BUNDLED.has(lang) && !STR[lang]) return loadPack(lang);
    })
    .then(() => {
      applyI18n();
    })
    .catch(() => {
      applyI18n();
    });

  const api = {
    t,
    setLang,
    getLang,
    applyI18n,
    translateServerDetail,
    phaseLabel,
    listLanguages,
    loadPack,
    ready: boot,
    STR,
  };
  // Brand: ruletka.vip — NextfaceI18n kept as alias for older code
  global.RuletI18n = api;
  global.NextfaceI18n = api;
  global.t = t;
})(typeof window !== "undefined" ? window : globalThis);
