/* global RouletteWebRtc, listMediaDevices, loadRtcConfig, getIceConfig, NextfaceI18n, t */

const $ = (id) => document.getElementById(id);
const PREFS_KEY = "freenet-roulette-media-prefs-v1";

/**
 * Private rooms (codes, share room, room QR, ?room= deep-links).
 * Off while the public pool is small — invite-friend path still works.
 * Flip to true when enough concurrent users to support private lobbies.
 */
const ROOMS_ENABLED = false;

/** Stranger 1v1 → invite partner to find a 3rd (party browse). */
const TRIO_FIND_ENABLED = true;

/** Friend / find-third co-search partner roles (keep media on Next). */
function isTeammateRole(role) {
  return role === "friend" || role === "teammate";
}

function applyRoomsFeatureFlag() {
  try {
    document.documentElement.classList.toggle("rooms-disabled", !ROOMS_ENABLED);
  } catch (_) {}
  const roomBtnIds = [
    "btn-empty-share",
    "btn-empty-copy",
    "btn-empty-qr",
    "btn-mobile-share",
    "btn-share-room",
    "btn-share-room-settings",
  ];
  const settingsRoom = document.querySelector(".settings-row-room");
  const roomField = document.querySelector(".room-field");
  if (!ROOMS_ENABLED) {
    // Force public lobby; clear any stale room field so re-enable starts clean
    try {
      if ($("room")) $("room").value = "";
      if ($("room-settings")) $("room-settings").value = "";
    } catch (_) {}
    try {
      const chip = $("room-chip");
      if (chip) chip.hidden = true;
    } catch (_) {}
    roomBtnIds.forEach((id) => {
      const el = $(id);
      if (el) el.hidden = true;
    });
    if (settingsRoom) settingsRoom.hidden = true;
    if (roomField) roomField.hidden = true;
    return;
  }
  // Re-enabled: show room controls again
  roomBtnIds.forEach((id) => {
    const el = $(id);
    if (el) el.hidden = false;
  });
  if (settingsRoom) settingsRoom.hidden = false;
  if (roomField) roomField.hidden = false;
}

// i18n helpers (fallback if i18n.js missing)
const _t =
  typeof t === "function"
    ? t
    : (k) => k;

/** Funnel analytics (no-op until YM/GA ids in /config.json). */
function trackEvent(name, params) {
  try {
    if (typeof RuletTrack === "function") RuletTrack(name, params || {});
  } catch (_) {}
}

/**
 * Week-1 growth funnel: share → land with ?friend= → request → match / friend call.
 * Session-scoped so a single visit can be attributed end-to-end.
 */
const INVITE_FUNNEL_KEY = "ruletka-invite-funnel-v1";

function readInviteFunnel() {
  try {
    const raw = sessionStorage.getItem(INVITE_FUNNEL_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : null;
  } catch {
    return null;
  }
}

function writeInviteFunnel(patch) {
  try {
    const prev = readInviteFunnel() || {};
    const next = { ...prev, ...patch, t: Date.now() };
    sessionStorage.setItem(INVITE_FUNNEL_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

/** Mark that *this* user shared an invite (outbound). */
function markInviteFunnelShare(via) {
  const f = writeInviteFunnel({
    role: "sharer",
    stage: "shared",
    via: via || "share",
  });
  trackEvent("funnel_invite_share", {
    via: via || "share",
    live: inQueue || wantSearch || matched ? 1 : 0,
  });
  return f;
}

/**
 * Capture inbound deep-link / ref on first paint (before URL clean).
 * Call early from boot. Idempotent for the session.
 */
function captureInviteFunnelLanding() {
  try {
    const existing = readInviteFunnel();
    if (existing && (existing.stage === "landed" || existing.stage === "request_sent" || existing.stage === "connected" || existing.role === "sharer")) {
      // Still refresh code from URL if present
      const q0 = new URLSearchParams(location.search);
      const f0 = q0.get("friend");
      if (f0 && !existing.code) {
        writeInviteFunnel({ ...existing, code: String(f0).slice(0, 16) });
      }
      return;
    }
    const q = new URLSearchParams(location.search);
    const friend = q.get("friend");
    const ref = q.get("ref") || "";
    if (friend) {
      writeInviteFunnel({
        role: "invitee",
        stage: "landed",
        ref: ref || "friend_invite",
        code: String(friend).slice(0, 16),
      });
      trackEvent("funnel_invite_land", {
        has_friend: 1,
        ref: ref || "friend_invite",
      });
      return;
    }
    if (ref === "friend_invite" || ref === "invite" || q.get("invite") === "1") {
      writeInviteFunnel({
        role: ref === "friend_invite" ? "invitee" : "opener",
        stage: "landed",
        ref: ref || "invite",
      });
      trackEvent("funnel_invite_land", { has_friend: 0, ref: ref || "invite" });
    }
  } catch (_) {}
}

/** Advance funnel when friend request is sent from deep link. */
function markInviteFunnelRequestSent(code) {
  const prev = readInviteFunnel() || {};
  writeInviteFunnel({
    ...prev,
    role: prev.role || "invitee",
    stage: "request_sent",
    code: code || prev.code || "",
  });
  trackEvent("funnel_invite_request", { code: (code || "").slice(0, 12) });
}

/**
 * Fire once when a real call connects while this session has invite context.
 * @param {"stranger"|"friend"} kind
 */
function markInviteFunnelConnected(kind) {
  try {
    const f = readInviteFunnel();
    if (!f || f.stage === "connected") return;
    writeInviteFunnel({ ...f, stage: "connected", kind: kind || "stranger" });
    trackEvent("funnel_invite_connected", {
      kind: kind || "stranger",
      role: f.role || "",
      via: f.via || f.ref || "",
    });
  } catch (_) {}
}
const _phase =
  NextfaceI18n?.phaseLabel?.bind(NextfaceI18n) || ((p) => p);
const _srv =
  NextfaceI18n?.translateServerDetail?.bind(NextfaceI18n) || ((s) => s);

function hubBase() {
  if (typeof RuletHub !== "undefined" && RuletHub.base) return RuletHub.base();
  return location.origin;
}

function wsUrl() {
  const q = new URLSearchParams(location.search);
  if (q.get("ws")) return q.get("ws");
  // Freenet serves the UI on :7509 — match bridge is always on :8790 by default
  if (
    location.port === "7509" ||
    location.pathname.includes("/v1/contract/web/")
  ) {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//127.0.0.1:8790/ws`;
  }
  if (typeof RuletHub !== "undefined" && RuletHub.wsUrlFor) {
    return RuletHub.wsUrlFor(hubBase());
  }
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
  } catch {
    return {};
  }
}
function savePrefs(partial) {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), ...partial }));
}

/** @typedef {"dark"|"light"|"saloon"|"matrix"|"pink"|"pixel"} UiTheme */
const THEME_IDS = ["dark", "light", "saloon", "matrix", "pink", "pixel"];
const THEME_META = {
  dark: { color: "#0a0b0e", labelKey: "settings.themeDark", fallback: "Dark" },
  light: { color: "#faf7f5", labelKey: "settings.themeLight", fallback: "Light" },
  saloon: { color: "#1a1008", labelKey: "settings.themeSaloon", fallback: "Saloon" },
  matrix: { color: "#020402", labelKey: "settings.themeMatrix", fallback: "Matrix" },
  pink: { color: "#fff0f5", labelKey: "settings.themePink", fallback: "Pink" },
  pixel: { color: "#0f0f1b", labelKey: "settings.themePixel", fallback: "Pixel" },
};
const LIGHT_THEMES = new Set(["light", "pink"]);
/** Default chrome icons → saloon western set */
const THEME_ICON_REMAP = {
  saloon: {
    "#i-skip": "#i-star",
    "#i-settings": "#i-spur",
    "#i-users": "#i-hat",
    "#i-door": "#i-saloon-doors",
    "#i-pointer": "#i-star",
    "#i-globe": "#i-horseshoe",
    "#i-user": "#i-hat",
    "#i-expand": "#i-star",
    "#i-share": "#i-lantern",
    "#i-camera": "#i-lantern",
    "#i-camera-off": "#i-cactus",
  },
};

function normalizeTheme(v) {
  const t = String(v || "").toLowerCase();
  if (t === "night") return "dark";
  return THEME_IDS.includes(t) ? t : "dark";
}

function getTheme() {
  return normalizeTheme(loadPrefs().theme);
}

function themeLabel(theme) {
  const id = normalizeTheme(theme);
  const meta = THEME_META[id];
  return _t(meta.labelKey) || meta.fallback;
}

function applyThemeIcons(theme) {
  const map = THEME_ICON_REMAP[theme] || {};
  document.querySelectorAll("svg use").forEach((use) => {
    if (use.closest(".theme-icon-fixed") || use.closest(".theme-pick")) return;
    const href =
      use.getAttribute("href") ||
      use.getAttributeNS("http://www.w3.org/1999/xlink", "href") ||
      "";
    if (!href || href.charAt(0) !== "#") return;
    if (!use.dataset.iconBase) {
      // Only lock base when current href is a default (non-saloon) icon,
      // or already stored after first visit.
      const id = href.slice(1);
      if (
        id === "i-star" ||
        id === "i-spur" ||
        id === "i-hat" ||
        id === "i-saloon-doors" ||
        id === "i-horseshoe" ||
        id === "i-cactus" ||
        id === "i-lantern" ||
        id === "i-sun"
      ) {
        // Already remapped without a base — skip until we can infer
        if (!use.dataset.iconBase) return;
      } else {
        use.dataset.iconBase = href;
      }
    }
    const base = use.dataset.iconBase;
    if (!base) return;
    const next = map[base] || base;
    use.setAttribute("href", next);
  });
}

/** Theme fonts (not loaded on first paint — Inter/Noto only). */
const THEME_FONT_HREF = {
  saloon:
    "https://fonts.googleapis.com/css2?family=Rye&family=Source+Serif+4:opsz,wght@8..60,400;600;700&display=swap",
  pixel:
    "https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&family=Press+Start+2P&display=swap",
};
const _themeFontsLoaded = Object.create(null);
let _themeCssLoaded = false;

function ensureThemeFonts(theme) {
  const id = normalizeTheme(theme);
  const href = THEME_FONT_HREF[id];
  if (!href || _themeFontsLoaded[id]) return;
  _themeFontsLoaded[id] = true;
  try {
    if (document.querySelector(`link[data-theme-font="${id}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    l.setAttribute("data-theme-font", id);
    l.media = "print";
    l.onload = function () {
      this.media = "all";
    };
    document.head.appendChild(l);
  } catch (_) {}
}

/** light/saloon/pink/pixel rules live in live-themes.css (deferred from first paint). */
function ensureThemeCss(theme) {
  const id = normalizeTheme(theme);
  if (id === "dark" || id === "matrix") return; // base live-stage.css covers these
  if (_themeCssLoaded) return;
  _themeCssLoaded = true;
  try {
    if (document.querySelector('link[data-theme-css="1"]')) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "live-themes.css?v=1";
    l.setAttribute("data-theme-css", "1");
    document.head.appendChild(l);
  } catch (_) {}
}

function applyTheme(theme, { persist = true } = {}) {
  const id = normalizeTheme(theme);
  document.documentElement.setAttribute("data-theme", id);
  document.documentElement.style.colorScheme = LIGHT_THEMES.has(id) ? "light" : "dark";
  const meta = document.getElementById("meta-theme-color");
  if (meta) meta.setAttribute("content", THEME_META[id].color);
  applyThemeIcons(id);
  ensureThemeCss(id);
  ensureThemeFonts(id);
  if (persist) savePrefs({ theme: id });
  syncThemeChoices();
  if ($("settings-theme-value")) {
    $("settings-theme-value").textContent = themeLabel(id);
  }
  // Main theme row icon
  const rowIco = document.querySelector('[data-settings-open="theme"] .row-ico use');
  if (rowIco) {
    const ico =
      id === "light"
        ? "#i-sun"
        : id === "saloon"
          ? "#i-star"
          : id === "matrix"
            ? "#i-matrix"
            : id === "pink"
              ? "#i-heart"
              : id === "pixel"
                ? "#i-star"
                : "#i-moon";
    rowIco.setAttribute("href", ico);
  }
}

function syncThemeChoices() {
  const cur = getTheme();
  document.querySelectorAll("[data-theme-pick]").forEach((btn) => {
    const id = btn.getAttribute("data-theme-pick");
    btn.classList.toggle("is-selected", id === cur);
  });
  document.querySelectorAll("[data-check-theme]").forEach((el) => {
    const id = el.getAttribute("data-check-theme");
    const row = el.closest(".settings-choice");
    if (row) row.classList.toggle("is-selected", id === cur);
  });
}

function wireThemeSettings() {
  document.querySelectorAll("[data-theme-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-theme-pick");
      if (!id) return;
      applyTheme(id, { persist: true });
      log(_t("settings.themeSet", { theme: themeLabel(id) }) || `Theme: ${themeLabel(id)}`);
    });
  });
}

let ws = null;
/** @type {Map<string, InstanceType<typeof RouletteWebRtc>>} peer_id → pc */
const peerPcs = new Map();
/** @deprecated single-pc alias used by mute helpers */
let rtc = null;
let previewStream = null;
let isOfferer = false;
let matched = false;
let matchMode = "solo"; // solo | friend | party_browse
let yourRole = "solo"; // solo | party | friend
/** Find-third invite: null | "out" | "in" */
let findThirdPending = null;
/** Stranger party hunting for a 3rd (trio layout). */
let trioBrowse = false;
let intentionalClose = false;
let reconnectAttempt = 0;
let reconnectTimer = 0;
let pingTimer = 0;
let statsTimer = 0;
let micMuted = false;
let camOff = false;
let partnerMuted = false;
/** Manual blur of partner video (local view only) */
let partnerBlurred = false;
/** Hide your camera from partners until you reveal (disables outbound video track) */
let selfBlurred = false;
/** NSFWJS model + scan timer */
let nsfwModel = null;
let nsfwLoadPromise = null;
let nsfwTimer = 0;
let nsfwHitCooldown = false;
/** Formal debate: alternating speaking turns (P2P-synced). */
const DEBATE_TURN_MS = 30_000;
const DEBATE_TURN_CHOICES_S = [15, 30, 45, 60];
/** @type {AudioContext | null} */
let debateAudioCtx = null;
/** @type {{
 *   active: boolean,
 *   pending: null | "out" | "in",
 *   partnerId: string,
 *   hostId: string,
 *   speakerId: string,
 *   inviteId: string,
 *   turnMs: number,
 *   turnEndsAt: number,
 *   turnIndex: number,
 *   tickIv: number,
 *   inviteTimer: number,
 *   topic: string,
 *   urgentBeeped: boolean,
 *   lastUrgentHapticSec: number,
 *   lastChimeSpeaker: string,
 *   composeTurnSecs: number
 * }} */
let debate = {
  active: false,
  pending: null,
  partnerId: "",
  hostId: "",
  speakerId: "",
  inviteId: "",
  turnMs: DEBATE_TURN_MS,
  turnEndsAt: 0,
  turnIndex: 0,
  tickIv: 0,
  inviteTimer: 0,
  topic: "",
  urgentBeeped: false,
  lastUrgentHapticSec: -1,
  lastChimeSpeaker: "",
  composeTurnSecs: 30,
};

/** Prefer staying in queue across reconnects (Next / Spin / waiting). */
let wantSearch = false;
/** True while phase is waiting (also used across reconnect). */
let inQueue = false;
let myUserId = "";
let myFriendCode = "";
let myPeerId = "";
let inFriendCall = false;
let incomingCallFrom = null;
/** Outbound friend ring until answer/decline/timeout */
let callTimeoutTimer = 0;
/** @type {Array} */
let friendsCache = [];
/** @type {string[]} */
let blockedCache = [];
/** @type {Array} */
let incomingRequests = [];
/** @type {Array} */
let outgoingRequests = [];
/** Primary remote user_id for Block (friend or stranger). */
let primaryPartnerUserId = "";
/** Last matched peer meta for history */
let lastMatchMeta = null;
/** Your spendable star balance (from hub). */
let myStars = 0;
/** Your raw trust score — peer rate-gifts (progress toward 100/250). */
let myTrust = 0;
/** Effective trust after decay + gifter floors (report tier / badge chrome). */
let myTrustEffective = 0;
/** Distinct peers who gifted you post-chat stars. */
let myTrustGifters = 0;
/** Unix seconds of last trust activity (decay countdown). 0 = unknown. */
let myTrustLastTs = 0;
/** Gifter floors (must match bridge). */
const TRUSTED_MIN_GIFTERS = 5;
const SENIOR_MIN_GIFTERS = 12;
/** Soft idle decay (must match bridge TRUST_DECAY_*). */
const TRUST_DECAY_START_DAYS = 45;
const TRUST_DECAY_FULL_DAYS = 180;
/** Milestone localStorage keys */
const STARS_MS_G1_KEY = "rulet_stars_ms_g1";
const STARS_MS_G5_KEY = "rulet_stars_ms_g5";
const STARS_MS_W100_KEY = "rulet_stars_ms_w100";
const STARS_MS_W250_KEY = "rulet_stars_ms_w250";
/** Partner spendable ★ during current match (badge number). */
let partnerStars = 0;
/** Partner public trust + unique gifters (social proof). */
let partnerTrust = 0;
let partnerTrustGifters = 0;
/** Session: people who praised us (uid → { name, kind: star|thanks, ts }). */
let recentPraiseBy = {};
/** Privacy-light gifter chips from hub: [{ initial, flag }]. */
let myTrustGivers = [];
const PEAK_TRUST_KEY = "rulet_peak_trust_v1";
const FLAIR_STAR_BOND_MS = 7 * 24 * 3600 * 1000;
const WELCOME_BACK_KEY = "rulet_welcome_back_v1";
const FRIENDS_BONDED_FILTER_KEY = "rulet_friends_bonded_only";
/** Client: welcome-back pending until first long chat after idle return */
let welcomeBackPending = false;
/** Friends list: show only mutual ★ / thanks bonds */
let friendsBondedOnly = false;
try {
  friendsBondedOnly = localStorage.getItem(FRIENDS_BONDED_FILTER_KEY) === "1";
} catch (_) {}
/** Min chat length for star review (must match bridge STAR_MIN_SECS). */
const STAR_MIN_SECS = 15 * 60;
/** First unique partners use a shorter window (must match bridge STAR_FIRST_RATE_SECS). */
const STAR_FIRST_RATE_SECS = 5 * 60;
/** How many unique partners get the short window (must match STAR_FIRST_RATE_SLOTS). */
const STAR_FIRST_RATE_SLOTS = 3;
/** Current rate threshold from hub (5m early ramp or 15m). Optimistic until hello_ok. */
let starRateMinSecs = STAR_FIRST_RATE_SECS;
/** Remaining short-window slots from hub. Optimistic until hello_ok. */
let earlyRatesLeft = STAR_FIRST_RATE_SLOTS;
/** Per-match mid-chat ★ progress flags (reset on new match). */
let starProgressHalfShown = false;
let starProgressNearShown = false;
let starProgressReadyShown = false;
/** Mid-tier gift cost / duration (must match bridge defaults). */
const STAR_EFFECT_COST = 5;
const STAR_EFFECT_SECS = 15;
/** Per-kind gift pricing (must match bridge effect_cost_duration). */
const STAR_GIFT_COSTS = {
  heart: 1,
  bars: 5,
  flowers: 5,
  balloons: 5,
  confetti: 5,
  fireworks: 15,
  please_stay: 30,
};
const STAR_GIFT_SECS = {
  heart: 8,
  bars: 15,
  flowers: 15,
  balloons: 15,
  confetti: 15,
  fireworks: 20,
  please_stay: 15,
};
/** When > unix now, local user cannot press Next (server also enforces). */
let selfNoSkipUntil = 0;
function giftCost(kind) {
  return STAR_GIFT_COSTS[String(kind || "").toLowerCase()] ?? STAR_EFFECT_COST;
}
function giftSecs(kind) {
  return STAR_GIFT_SECS[String(kind || "").toLowerCase()] ?? STAR_EFFECT_SECS;
}
/** localStorage keys for one-shot “almost tier” nudges */
const STARS_NUDGE_90_KEY = "ruletka-stars-nudge-90-v1";
const STARS_NUDGE_240_KEY = "ruletka-stars-nudge-240-v1";
/** Min ms between gift spends (client anti-spam). */
const GIFT_RATE_LIMIT_MS = 10_000;
/** @type {number} last successful gift send time */
let lastGiftSpendAt = 0;
/** @type {{ kind: string, until: number } | null} effect on partner */
let partnerFx = null;
/** @type {{ kind: string, until: number } | null} effect on self (e.g. bars after logout) */
let selfFx = null;
let fxTickTimer = 0;
/** Long-press timer for partner gift strip */
let giftStripLongPressTimer = 0;
let giftStripSuppressClick = false;
/** Partner swipe-to-skip state */
let partnerSwipe = null;
/** After a committed swipe, ignore the synthetic click */
let swipeSkipSuppressClick = false;
/** Last lobby waiting count for pool hint */
let lastWaitingCount = 0;
const RULES_KEY = "nextface-rules-v1";
const HISTORY_KEY = "nextface-history-v1";
/** Keep many encounter rows so short/bad matches are not dropped. */
const MAX_HISTORY = 80;
/** Local match + friend chat threads (survive hangup / reload). */
const CHAT_THREADS_KEY = "ruletka-chat-threads-v1";
/** last-read timestamps per thread key (for friend unread badges). */
const CHAT_READ_KEY = "ruletka-chat-read-v1";
/** Local mirror of friends from hub — recovery if identity still matches / re-request by code. */
const FRIENDS_BACKUP_KEY = "ruletka-friends-backup-v1";
/** Personal nicknames for friends (local only): { [user_id]: "My name for them" } */
const FRIEND_NICKS_KEY = "ruletka-friend-nicks-v1";
const MAX_THREAD_MSGS = 80;
const MAX_CHAT_THREADS = 40;
/**
 * Active compose/target for the dock chat input.
 * mode: none | match | friend | history
 * live: true while matched with this peer (match chat protocol) or always for friend DMs
 * @type {{ mode: string, peerUserId: string, peerName: string, threadKey: string, live: boolean }}
 */
let activeChat = {
  mode: "none",
  peerUserId: "",
  peerName: "",
  threadKey: "",
  live: false,
};
/** Messages inbox tab: "friends" | "matches" */
let messagesTab = "friends";
/** Whether the Messages sheet is open */
let messagesSheetOpen = false;
/** Whether inbox is showing a thread (vs list) */
let messagesInThread = false;
/** @type {AudioContext | null} */
let meterCtx = null;
/** @type {AudioContext | null} */
let chimeCtx = null;
/** @type {AnalyserNode | null} */
let meterAnalyser = null;
/** @type {MediaStreamAudioSourceNode | null} */
let meterSource = null;
let meterRaf = 0;
/** @type {Array<{from_peer?: string, kind: string, payload: string}>} */
const pendingSignals = [];

const ID_KEY =
  (typeof RuletIdentity !== "undefined" && RuletIdentity.ID_KEY) || "nextface-user-v1";

function loadIdentity() {
  if (typeof RuletIdentity !== "undefined" && RuletIdentity.loadIdentity) {
    return RuletIdentity.loadIdentity();
  }
  try {
    const raw = JSON.parse(localStorage.getItem(ID_KEY) || "{}");
    if (!raw.user_id) {
      raw.user_id =
        crypto.randomUUID?.() ||
        "u-" + Math.random().toString(16).slice(2) + Date.now().toString(16);
      raw.name = raw.name || "";
      localStorage.setItem(ID_KEY, JSON.stringify(raw));
    }
    if (raw.name == null) raw.name = "";
    return raw;
  } catch {
    return { user_id: "u-" + Date.now(), name: "" };
  }
}
function saveIdentity(partial) {
  if (typeof RuletIdentity !== "undefined" && RuletIdentity.saveIdentity) {
    return RuletIdentity.saveIdentity(partial);
  }
  const cur = loadIdentity();
  const next = { ...cur, ...partial };
  if (typeof next.name === "string") {
    next.name = next.name.trim().slice(0, 32);
  }
  localStorage.setItem(ID_KEY, JSON.stringify(next));
  return next;
}

/**
 * Keep strangers blurred until the user taps Blur.
 * Permanent: Settings toggle.
 * Starter (Week B): first N stranger matches for new users (safer cold start).
 */
const BLUR_STARTER_KEY = "ruletka-blur-starter-left-v1";
const BLUR_STARTER_DEFAULT = 5;
const BLUR_STARTER_TIP_KEY = "ruletka-blur-starter-tip-v1";

function blurStarterLeft() {
  try {
    const raw = localStorage.getItem(BLUR_STARTER_KEY);
    // null = never initialized
    if (raw === null || raw === "") {
      // Returning users (already have call history) skip re-onboarding blur
      try {
        const hist = localStorage.getItem(HISTORY_KEY);
        if (hist && hist.length > 8 && hist !== "[]") {
          localStorage.setItem(BLUR_STARTER_KEY, "0");
          return 0;
        }
      } catch (_) {}
      return BLUR_STARTER_DEFAULT;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  } catch {
    return 0;
  }
}

function setBlurStarterLeft(n) {
  try {
    localStorage.setItem(BLUR_STARTER_KEY, String(Math.max(0, Math.floor(n))));
  } catch (_) {}
}

/**
 * Settings “Always blur everyone” — ignores partner reputation.
 * Default OFF so reputation-based auto-blur is the product default.
 * Explicit true still forces permanent blur for every stranger.
 */
function blurFirstPrefEnabled() {
  try {
    return loadPrefs().blurFirst === true;
  } catch {
    return false;
  }
}

/** Partner public score for intro-blur policy (balance or trust). */
function partnerRepScoreForBlur(meta) {
  const m = meta || lastMatchMeta || {};
  const stars = Math.max(
    0,
    Number(m.stars != null ? m.stars : partnerStars) || 0
  );
  const trust = Math.max(
    0,
    Number(m.trust != null ? m.trust : partnerTrust) || 0
  );
  return Math.max(stars, trust);
}

/** Below this score: stranger stays blurred until Unblur. At/above: 3s intro only. */
const BLUR_REP_THRESHOLD = 39;

/** True when this stranger should stay blurred until the user taps Unblur. */
function strangerKeepsBlurUntilUnblur(meta) {
  if (blurFirstPrefEnabled()) return true;
  if (blurStarterLeft() > 0) return true;
  return partnerRepScoreForBlur(meta) < BLUR_REP_THRESHOLD;
}

function blurFirstEnabled() {
  // Back-compat name: any path that keeps blur until Unblur
  return strangerKeepsBlurUntilUnblur();
}

/** Consume one starter match when a stranger session begins under starter mode. */
function consumeBlurStarterIfNeeded() {
  if (blurFirstPrefEnabled()) return;
  const left = blurStarterLeft();
  if (left <= 0) return;
  setBlurStarterLeft(left - 1);
  try {
    trackEvent("blur_starter_consume", { left: left - 1 });
  } catch (_) {}
}

/** One-shot tip: how to unblur (status + short toast). */
function maybeShowBlurStarterTip() {
  try {
    if (localStorage.getItem(BLUR_STARTER_TIP_KEY) === "1") return;
    localStorage.setItem(BLUR_STARTER_TIP_KEY, "1");
  } catch {
    return;
  }
  const body =
    _t("safety.blurStarterTip") ||
    "Strangers start blurred for your first chats. Tap “Unblur” to reveal when ready.";
  setStatus(body);
  try {
    if ($("blur-starter-tip")) return;
    const tip = document.createElement("div");
    tip.id = "blur-starter-tip";
    tip.className = "weak-conn-tip blur-starter-tip";
    tip.setAttribute("role", "status");
    tip.style.pointerEvents = "auto";
    tip.innerHTML = `
      <span>${escapeHtml(body)}</span>
      <button type="button" class="pill tight accent" id="btn-blur-starter-ok">${escapeHtml(
        _t("pwa.iosGotIt") || "Got it"
      )}</button>`;
    document.body.appendChild(tip);
    const dismiss = () => {
      if (tip.parentNode) tip.remove();
    };
    $("btn-blur-starter-ok")?.addEventListener("click", dismiss);
    setTimeout(dismiss, 9000);
    trackEvent("blur_starter_tip_show");
  } catch (_) {}
}

const UNBLUR_COACH_SESSION_KEY = "ruletka-unblur-coach-session-v1";

/**
 * Coach toast when always-blur is on: point at Unblur button + tap-to-reveal.
 * Once per browser tab session so it does not spam every Next.
 */
function maybeShowUnblurCoach() {
  try {
    if (sessionStorage.getItem(UNBLUR_COACH_SESSION_KEY) === "1") return;
    sessionStorage.setItem(UNBLUR_COACH_SESSION_KEY, "1");
  } catch {
    /* still show once if storage blocked */
  }
  const body =
    _t("safety.unblurCoach") ||
    "Partner is blurred for privacy. Tap Unblur (side button) or their video to reveal.";
  setStatus(body);
  try {
    if ($("unblur-coach-tip")) return;
    const tip = document.createElement("div");
    tip.id = "unblur-coach-tip";
    tip.className = "weak-conn-tip unblur-coach-tip";
    tip.setAttribute("role", "status");
    tip.style.pointerEvents = "auto";
    tip.innerHTML = `
      <span>${escapeHtml(body)}</span>
      <button type="button" class="pill tight accent" id="btn-unblur-coach-ok">${escapeHtml(
        _t("btn.unblur") || "Unblur"
      )}</button>
      <button type="button" class="pill tight ghost" id="btn-unblur-coach-dismiss">${escapeHtml(
        _t("pwa.iosGotIt") || "Got it"
      )}</button>`;
    document.body.appendChild(tip);
    const dismiss = () => {
      if (tip.parentNode) tip.remove();
    };
    $("btn-unblur-coach-dismiss")?.addEventListener("click", dismiss);
    $("btn-unblur-coach-ok")?.addEventListener("click", () => {
      dismiss();
      try {
        if (partnerBlurred) {
          clearIntroBlurTimer();
          introBlurGen++;
          setPartnerBlur(false);
          syncPartnerBlurButtonLabels();
          log(_t("log.blurOff") || "partner video unblurred");
          setStatus(
            _t("log.blurOffTap") || "Partner revealed — tap again for more options"
          );
        }
      } catch (_) {}
    });
    setTimeout(dismiss, 10000);
    trackEvent("unblur_coach_show");
  } catch (_) {}
}

/** Timed safety blur on new stranger matches (then auto-clear unless blur-first). */
const INTRO_BLUR_MS = 3000;
let introBlurTimer = 0;
let introBlurGen = 0;

function clearIntroBlurTimer() {
  if (introBlurTimer) {
    clearTimeout(introBlurTimer);
    introBlurTimer = 0;
  }
}

/**
 * Blur a new stranger:
 * - Settings always-blur OR starter budget OR rep &lt; 39 → stay blurred until Unblur
 * - rep ≥ 39 → INTRO_BLUR_MS then auto-unblur
 */
function applyStrangerIntroBlur() {
  clearIntroBlurTimer();
  setPartnerBlur(true);
  const score = partnerRepScoreForBlur();
  const keepBlurred = strangerKeepsBlurUntilUnblur();
  if (keepBlurred) {
    // Starter path: burn one of the first-N matches
    const wasStarter = !blurFirstPrefEnabled() && blurStarterLeft() > 0;
    if (wasStarter) {
      consumeBlurStarterIfNeeded();
      maybeShowBlurStarterTip();
      log(
        _t("log.blurStarter") ||
          "partner blurred until you unblur (starter safety)"
      );
    } else if (blurFirstPrefEnabled()) {
      log(_t("log.blurFirst") || "partner stays blurred until you unblur");
      maybeShowUnblurCoach();
    } else {
      // Low reputation / stars auto-blur
      log(
        _t("log.blurLowRep", { n: score, thr: BLUR_REP_THRESHOLD }) ||
          `partner blurred until Unblur (score ${score} < ${BLUR_REP_THRESHOLD})`
      );
      maybeShowUnblurCoach();
      try {
        trackEvent("blur_low_rep", {
          score,
          thr: BLUR_REP_THRESHOLD,
          stars: partnerStars,
          trust: partnerTrust,
        });
      } catch (_) {}
    }
    try {
      syncBlurFirstUi();
      syncPartnerBlurButtonLabels();
    } catch (_) {}
    return;
  }
  log(
    _t("log.blurIntroRep", { n: score }) ||
      `partner blurred 3s — score ${score} ≥ ${BLUR_REP_THRESHOLD}`
  );
  try {
    trackEvent("blur_intro_rep", {
      score,
      thr: BLUR_REP_THRESHOLD,
      stars: partnerStars,
      trust: partnerTrust,
    });
  } catch (_) {}
  const gen = ++introBlurGen;
  introBlurTimer = setTimeout(() => {
    introBlurTimer = 0;
    if (gen !== introBlurGen) return;
    if (!matched) return;
    if (strangerKeepsBlurUntilUnblur()) return;
    if (!partnerBlurred) return; // user already unblurred
    setPartnerBlur(false);
    log(_t("log.blurIntroDone") || "partner unblurred");
  }, INTRO_BLUR_MS);
}

function syncBlurFirstUi() {
  const chk = $("chk-blur-first");
  if (!chk) return;
  chk.checked = blurFirstPrefEnabled();
  const titleEl = chk
    .closest(".settings-row")
    ?.querySelector?.(".toggle-title");
  if (titleEl) {
    titleEl.textContent =
      _t("settings.blurFirst") ||
      "Always blur everyone";
  }
  const hint = chk
    .closest(".settings-row")
    ?.querySelector?.(".toggle-hint");
  if (!hint) return;
  if (blurFirstPrefEnabled()) {
    hint.textContent =
      _t("settings.blurFirstHintOn") ||
      "On: every stranger stays blurred until you Unblur (ignores their ★).";
    return;
  }
  const left = blurStarterLeft();
  if (left > 0) {
    hint.textContent =
      _t("settings.blurFirstHintStarter", {
        n: left,
        thr: BLUR_REP_THRESHOLD,
      }) ||
      `First ${left} stranger matches stay blurred · then auto: under ${BLUR_REP_THRESHOLD}★ keep blur · ${BLUR_REP_THRESHOLD}+ get 3s only`;
  } else {
    hint.textContent =
      _t("settings.blurFirstHint", { thr: BLUR_REP_THRESHOLD }) ||
      `Auto: under ${BLUR_REP_THRESHOLD}★ stay blurred until Unblur · ${BLUR_REP_THRESHOLD}+ blur 3s then reveal`;
  }
}

/** Update blur button labels for current partner blur state. */
function syncPartnerBlurButtonLabels() {
  const lbl = $("btn-blur-remote")?.querySelector(".lbl");
  if (lbl) {
    lbl.textContent = partnerBlurred
      ? _t("btn.unblur") || "Unblur"
      : _t("btn.blur") || "Blur them";
  }
  const btn = $("btn-blur-remote");
  if (btn) {
    const title = partnerBlurred
      ? _t("btn.unblurTitle") ||
        "Show partner video — you chose to reveal them"
      : blurFirstPrefEnabled()
        ? _t("btn.blurTitleAlways") ||
          "Blur partner video (B) · always blur new matches until you Unblur"
        : _t("btn.blurTitle") ||
          "Blur partner video (B) · auto 3s on new match";
    btn.title = title;
    btn.setAttribute("aria-label", title);
    // Accent "Unblur" state so the reveal action stands out
    btn.classList.toggle("is-unblur", !!partnerBlurred);
    btn.classList.toggle("active", !!partnerBlurred);
  }
}

/** Current display name for UI + server (falls back to short id / anon). */
/** Session short id from bridge (not shown in header). */
let myShortId = "";

function getDisplayName() {
  const fromInput =
    $("display-name-top")?.value?.trim() ||
    $("display-name")?.value?.trim() ||
    $("display-name-settings")?.value?.trim();
  if (fromInput) return fromInput;
  const saved = (loadIdentity().name || "").trim();
  if (saved) return saved;
  if (myShortId) return myShortId;
  return "anon";
}

function syncNameInputs(name) {
  const n = (name ?? getDisplayName()) || "";
  for (const id of ["display-name-top", "display-name", "display-name-settings"]) {
    const el = $(id);
    if (el && el.value !== n) el.value = n;
  }
  refreshLocalNameChip();
}

/** Curated cosmetic flags — user-chosen only, never from IP/GPS. */
const FLAG_OPTIONS = [
  ["", "None"],
  ["AQ", "Antarctica"],
  ["EU", "European Union"],
  ["UN", "United Nations"],
  ["AF", "Afghanistan"],
  ["AX", "Åland Islands"],
  ["AL", "Albania"],
  ["DZ", "Algeria"],
  ["AS", "American Samoa"],
  ["AD", "Andorra"],
  ["AO", "Angola"],
  ["AI", "Anguilla"],
  ["AG", "Antigua and Barbuda"],
  ["AR", "Argentina"],
  ["AM", "Armenia"],
  ["AW", "Aruba"],
  ["AU", "Australia"],
  ["AT", "Austria"],
  ["AZ", "Azerbaijan"],
  ["BS", "Bahamas"],
  ["BH", "Bahrain"],
  ["BD", "Bangladesh"],
  ["BB", "Barbados"],
  ["BY", "Belarus"],
  ["BE", "Belgium"],
  ["BZ", "Belize"],
  ["BJ", "Benin"],
  ["BM", "Bermuda"],
  ["BT", "Bhutan"],
  ["BO", "Bolivia"],
  ["BA", "Bosnia and Herzegovina"],
  ["BW", "Botswana"],
  ["BV", "Bouvet Island"],
  ["BR", "Brazil"],
  ["IO", "British Indian Ocean Territory"],
  ["VG", "British Virgin Islands"],
  ["BN", "Brunei"],
  ["BG", "Bulgaria"],
  ["BF", "Burkina Faso"],
  ["BI", "Burundi"],
  ["CV", "Cabo Verde"],
  ["KH", "Cambodia"],
  ["CM", "Cameroon"],
  ["CA", "Canada"],
  ["BQ", "Caribbean Netherlands"],
  ["KY", "Cayman Islands"],
  ["CF", "Central African Republic"],
  ["TD", "Chad"],
  ["CL", "Chile"],
  ["CN", "China"],
  ["CX", "Christmas Island"],
  ["CC", "Cocos (Keeling) Islands"],
  ["CO", "Colombia"],
  ["KM", "Comoros"],
  ["CG", "Congo"],
  ["CK", "Cook Islands"],
  ["CR", "Costa Rica"],
  ["CI", "Côte d’Ivoire"],
  ["HR", "Croatia"],
  ["CU", "Cuba"],
  ["CW", "Curaçao"],
  ["CY", "Cyprus"],
  ["CZ", "Czechia"],
  ["DK", "Denmark"],
  ["DJ", "Djibouti"],
  ["DM", "Dominica"],
  ["DO", "Dominican Republic"],
  ["CD", "DR Congo"],
  ["EC", "Ecuador"],
  ["EG", "Egypt"],
  ["SV", "El Salvador"],
  ["GQ", "Equatorial Guinea"],
  ["ER", "Eritrea"],
  ["EE", "Estonia"],
  ["SZ", "Eswatini"],
  ["ET", "Ethiopia"],
  ["FK", "Falkland Islands"],
  ["FO", "Faroe Islands"],
  ["FJ", "Fiji"],
  ["FI", "Finland"],
  ["FR", "France"],
  ["GF", "French Guiana"],
  ["PF", "French Polynesia"],
  ["TF", "French Southern Territories"],
  ["GA", "Gabon"],
  ["GM", "Gambia"],
  ["GE", "Georgia"],
  ["DE", "Germany"],
  ["GH", "Ghana"],
  ["GI", "Gibraltar"],
  ["GR", "Greece"],
  ["GL", "Greenland"],
  ["GD", "Grenada"],
  ["GP", "Guadeloupe"],
  ["GU", "Guam"],
  ["GT", "Guatemala"],
  ["GG", "Guernsey"],
  ["GN", "Guinea"],
  ["GW", "Guinea-Bissau"],
  ["GY", "Guyana"],
  ["HT", "Haiti"],
  ["HM", "Heard & McDonald Islands"],
  ["HN", "Honduras"],
  ["HK", "Hong Kong"],
  ["HU", "Hungary"],
  ["IS", "Iceland"],
  ["IN", "India"],
  ["ID", "Indonesia"],
  ["IR", "Iran"],
  ["IQ", "Iraq"],
  ["IE", "Ireland"],
  ["IM", "Isle of Man"],
  ["IL", "Israel"],
  ["IT", "Italy"],
  ["JM", "Jamaica"],
  ["JP", "Japan"],
  ["JE", "Jersey"],
  ["JO", "Jordan"],
  ["KZ", "Kazakhstan"],
  ["KE", "Kenya"],
  ["KI", "Kiribati"],
  ["XK", "Kosovo"],
  ["KW", "Kuwait"],
  ["KG", "Kyrgyzstan"],
  ["LA", "Laos"],
  ["LV", "Latvia"],
  ["LB", "Lebanon"],
  ["LS", "Lesotho"],
  ["LR", "Liberia"],
  ["LY", "Libya"],
  ["LI", "Liechtenstein"],
  ["LT", "Lithuania"],
  ["LU", "Luxembourg"],
  ["MO", "Macao"],
  ["MG", "Madagascar"],
  ["MW", "Malawi"],
  ["MY", "Malaysia"],
  ["MV", "Maldives"],
  ["ML", "Mali"],
  ["MT", "Malta"],
  ["MH", "Marshall Islands"],
  ["MQ", "Martinique"],
  ["MR", "Mauritania"],
  ["MU", "Mauritius"],
  ["YT", "Mayotte"],
  ["MX", "Mexico"],
  ["FM", "Micronesia"],
  ["MD", "Moldova"],
  ["MC", "Monaco"],
  ["MN", "Mongolia"],
  ["ME", "Montenegro"],
  ["MS", "Montserrat"],
  ["MA", "Morocco"],
  ["MZ", "Mozambique"],
  ["MM", "Myanmar"],
  ["NA", "Namibia"],
  ["NR", "Nauru"],
  ["NP", "Nepal"],
  ["NL", "Netherlands"],
  ["NC", "New Caledonia"],
  ["NZ", "New Zealand"],
  ["NI", "Nicaragua"],
  ["NE", "Niger"],
  ["NG", "Nigeria"],
  ["NU", "Niue"],
  ["NF", "Norfolk Island"],
  ["KP", "North Korea"],
  ["MK", "North Macedonia"],
  ["MP", "Northern Mariana Islands"],
  ["NO", "Norway"],
  ["OM", "Oman"],
  ["PK", "Pakistan"],
  ["PW", "Palau"],
  ["PS", "Palestine"],
  ["PA", "Panama"],
  ["PG", "Papua New Guinea"],
  ["PY", "Paraguay"],
  ["PE", "Peru"],
  ["PH", "Philippines"],
  ["PN", "Pitcairn Islands"],
  ["PL", "Poland"],
  ["PT", "Portugal"],
  ["PR", "Puerto Rico"],
  ["QA", "Qatar"],
  ["RE", "Réunion"],
  ["RO", "Romania"],
  ["RU", "Russia"],
  ["RW", "Rwanda"],
  ["BL", "Saint Barthélemy"],
  ["SH", "Saint Helena"],
  ["KN", "Saint Kitts and Nevis"],
  ["LC", "Saint Lucia"],
  ["MF", "Saint Martin"],
  ["PM", "Saint Pierre and Miquelon"],
  ["VC", "Saint Vincent and the Grenadines"],
  ["WS", "Samoa"],
  ["SM", "San Marino"],
  ["ST", "São Tomé and Príncipe"],
  ["SA", "Saudi Arabia"],
  ["SN", "Senegal"],
  ["RS", "Serbia"],
  ["SC", "Seychelles"],
  ["SL", "Sierra Leone"],
  ["SG", "Singapore"],
  ["SX", "Sint Maarten"],
  ["SK", "Slovakia"],
  ["SI", "Slovenia"],
  ["SB", "Solomon Islands"],
  ["SO", "Somalia"],
  ["ZA", "South Africa"],
  ["GS", "South Georgia & South Sandwich"],
  ["KR", "South Korea"],
  ["SS", "South Sudan"],
  ["ES", "Spain"],
  ["LK", "Sri Lanka"],
  ["SD", "Sudan"],
  ["SR", "Suriname"],
  ["SJ", "Svalbard and Jan Mayen"],
  ["SE", "Sweden"],
  ["CH", "Switzerland"],
  ["SY", "Syria"],
  ["TW", "Taiwan"],
  ["TJ", "Tajikistan"],
  ["TZ", "Tanzania"],
  ["TH", "Thailand"],
  ["TL", "Timor-Leste"],
  ["TG", "Togo"],
  ["TK", "Tokelau"],
  ["TO", "Tonga"],
  ["TT", "Trinidad and Tobago"],
  ["TN", "Tunisia"],
  ["TR", "Türkiye"],
  ["TM", "Turkmenistan"],
  ["TC", "Turks and Caicos Islands"],
  ["TV", "Tuvalu"],
  ["UM", "U.S. Outlying Islands"],
  ["VI", "U.S. Virgin Islands"],
  ["UG", "Uganda"],
  ["UA", "Ukraine"],
  ["AE", "United Arab Emirates"],
  ["GB", "United Kingdom"],
  ["US", "United States"],
  ["UY", "Uruguay"],
  ["UZ", "Uzbekistan"],
  ["VU", "Vanuatu"],
  ["VA", "Vatican City"],
  ["VE", "Venezuela"],
  ["VN", "Vietnam"],
  ["WF", "Wallis and Futuna"],
  ["EH", "Western Sahara"],
  ["YE", "Yemen"],
  ["ZM", "Zambia"],
  ["ZW", "Zimbabwe"],
];


function normalizeFlagCode(raw) {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
  if (s.length !== 2) return "";
  // Cosmetic-only codes (not geolocation). UN/EU/AQ use regional-indicator pairs.
  if (s === "EU" || s === "AQ" || s === "UN" || s === "XK") return s;
  return s;
}

function flagEmoji(code) {
  const cc = normalizeFlagCode(code);
  if (!cc || cc.length !== 2) return "";
  try {
    return String.fromCodePoint(
      ...[...cc].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0))
    );
  } catch {
    return "";
  }
}

function getFlag() {
  return normalizeFlagCode(loadPrefs().flag);
}

function flagLabel(code) {
  const cc = normalizeFlagCode(code);
  if (!cc) return _t("flag.none") || "None";
  const hit = FLAG_OPTIONS.find((x) => x[0] === cc);
  const name = hit ? hit[1] : cc;
  const em = flagEmoji(cc);
  return em ? `${em} ${name}` : name;
}

function formatNameWithFlag(name, flag) {
  const n = (name || "anon").trim() || "anon";
  const em = flagEmoji(flag);
  return em ? `${em} ${n}` : n;
}

/** Put name + larger flag emoji into a .name-on-tile (or similar) element. */
function setNameOnTile(el, name, flag) {
  if (!el) return;
  const n = (name || "anon").trim() || "anon";
  const em = flagEmoji(flag);
  if (em) {
    el.innerHTML = `<span class="name-flag" aria-hidden="true">${em}</span><span class="name-text"></span>`;
    const t = el.querySelector(".name-text");
    if (t) t.textContent = n;
  } else {
    el.textContent = n;
  }
}

function refreshLocalNameChip() {
  const tile = $("local-name");
  if (tile) setNameOnTile(tile, getDisplayName(), getFlag());
  syncFlagSettingsSummary();
}

function syncFlagSettingsSummary() {
  const cc = getFlag();
  const em = flagEmoji(cc);
  if ($("settings-flag-value")) {
    $("settings-flag-value").textContent = cc
      ? em || cc
      : _t("flag.none") || "None";
  }
  if ($("settings-flag-emoji")) {
    $("settings-flag-emoji").textContent = em || "🏳️";
  }
  document.querySelectorAll("[data-flag-pick]").forEach((btn) => {
    const v = btn.getAttribute("data-flag-pick") || "";
    btn.classList.toggle("is-selected", normalizeFlagCode(v) === cc || (!cc && v === ""));
  });
}

function setFlag(code, { persist = true, notify = true } = {}) {
  const flag = normalizeFlagCode(code);
  if (persist) savePrefs({ flag });
  refreshLocalNameChip();
  if (notify) {
    // Push to hub so next match sees it; set_prefs updates live client flag
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendMatchPrefs();
    }
  }
  log(
    flag
      ? _t("flag.set", { flag: flagLabel(flag) }) || `Flag: ${flagLabel(flag)}`
      : _t("flag.cleared") || "Flag cleared"
  );
}

/** Max data-URL length for avatar (must match bridge normalize_avatar). */
const MAX_AVATAR_CHARS = 48000;
const AVATAR_PX = 192;

function getAvatar() {
  const a = loadPrefs().avatar;
  return typeof a === "string" && a.startsWith("data:image/") ? a : "";
}

function isValidAvatarDataUrl(s) {
  if (!s || typeof s !== "string") return false;
  if (s.length > MAX_AVATAR_CHARS) return false;
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(s);
}

function setTileAvatar(which, dataUrl) {
  const wrap = $(which === "remote" ? "remote-avatar" : "local-avatar");
  const img = $(which === "remote" ? "remote-avatar-img" : "local-avatar-img");
  if (!wrap || !img) return;
  if (dataUrl && isValidAvatarDataUrl(dataUrl)) {
    img.src = dataUrl;
    wrap.hidden = false;
  } else {
    img.removeAttribute("src");
    wrap.hidden = true;
  }
  if (which === "remote") syncRemoteTileTagVisibility();
}

/** Show partner identity strip when name and/or avatar is present. */
function syncRemoteTileTagVisibility() {
  const wrap = $("remote-tile-tag");
  const tag = $("remote-tag");
  const av = $("remote-avatar");
  if (!wrap) return;
  const hasName = !!(tag && String(tag.textContent || "").trim());
  const hasAv = !!(av && !av.hidden);
  wrap.hidden = !(hasName || hasAv);
  if (hasName || hasAv) wrap.removeAttribute("hidden");
  else wrap.setAttribute("hidden", "");
}

function looksLikeImageFile(file) {
  if (!file) return false;
  const t = String(file.type || "").toLowerCase();
  if (t.startsWith("image/")) return true;
  // Some mobile pickers leave type empty — allow common extensions
  const n = String(file.name || "").toLowerCase();
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(n);
}

function refreshAvatarUi() {
  const url = getAvatar();
  const hero = $("settings-hero-avatar");
  const img = $("settings-hero-img");
  const letterEl = $("settings-hero-letter");
  const clearBtn = $("btn-avatar-clear");
  const valueEl = $("settings-avatar-value");
  const nm = (getDisplayName() || "").trim();
  const letter = nm && nm !== "anon" ? nm.charAt(0).toUpperCase() : "";
  if (letterEl) letterEl.textContent = letter || "?";
  if (img) {
    if (url) {
      img.src = url;
      img.hidden = false;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
    }
  }
  if (hero) {
    hero.classList.toggle("has-photo", !!url);
    hero.classList.toggle("has-letter", !url && !!letter);
  }
  if (clearBtn) clearBtn.hidden = !url;
  if (valueEl) {
    valueEl.textContent = url
      ? _t("avatar.set") || "Set"
      : _t("avatar.none") || "No photo";
  }
  setTileAvatar("local", url);
}

/**
 * Draw a loaded image source into a small square JPEG data URL.
 * @param {CanvasImageSource} source
 * @param {number} w
 * @param {number} h
 */
function avatarDataUrlFromImageSource(source, w, h) {
  if (!w || !h) throw new Error("bad image");
  const side = Math.min(w, h);
  const sx = Math.floor((w - side) / 2);
  const sy = Math.floor((h - side) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_PX;
  canvas.height = AVATAR_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
  for (const q of [0.78, 0.62, 0.48, 0.35]) {
    const data = canvas.toDataURL("image/jpeg", q);
    if (isValidAvatarDataUrl(data) && data.length <= MAX_AVATAR_CHARS) return data;
  }
  throw new Error("too big after compress");
}

/**
 * Resize/crop image file to a small square JPEG data URL.
 * @param {File|Blob} file
 * @returns {Promise<string>}
 */
async function resizeImageToAvatarDataUrl(file) {
  if (!file || !looksLikeImageFile(file)) {
    throw new Error("not an image");
  }
  // Soft client limit before decode (8 MB — phones often send large photos)
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("too large");
  }

  // Prefer createImageBitmap when available (better HEIC/orientation on some browsers)
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      try {
        return avatarDataUrlFromImageSource(
          bmp,
          bmp.width,
          bmp.height
        );
      } finally {
        if (typeof bmp.close === "function") bmp.close();
      }
    } catch (_) {
      /* fall through to Image() path */
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        URL.revokeObjectURL(url);
        resolve(
          avatarDataUrlFromImageSource(
            img,
            img.naturalWidth || img.width,
            img.naturalHeight || img.height
          )
        );
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

async function setAvatarFromFile(file) {
  try {
    const data = await resizeImageToAvatarDataUrl(file);
    savePrefs({ avatar: data });
    refreshAvatarUi();
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Prefer full hello so name+avatar stay in sync
      try {
        sendHelloPayload();
      } catch (_) {
        sendMatchPrefs();
      }
    }
    setStatus(_t("avatar.saved") || "Photo saved");
    log(_t("avatar.saved") || "Photo saved");
  } catch (e) {
    const key =
      e?.message === "too large"
        ? "avatar.tooLarge"
        : e?.message === "not an image"
          ? "avatar.notImage"
          : "avatar.fail";
    const msg =
      _t(key) ||
      (e?.message === "too large"
        ? "Image too large (max 8 MB)"
        : "Could not use that image — try JPG or PNG");
    setStatus(msg);
    log(msg);
  }
}

function clearAvatar() {
  savePrefs({ avatar: "" });
  refreshAvatarUi();
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      sendHelloPayload();
    } catch (_) {
      sendMatchPrefs();
    }
  }
  setStatus(_t("avatar.cleared") || "Photo removed");
  log(_t("avatar.cleared") || "Photo removed");
}

function openAvatarPicker() {
  const file = $("avatar-file");
  if (!file) return;
  try {
    file.value = "";
  } catch (_) {}
  // Defer so the click is treated as a direct user gesture on mobile
  file.click();
}

function wireAvatarSettings() {
  const file = $("avatar-file");
  $("settings-hero-avatar")?.addEventListener("click", (e) => {
    e.preventDefault();
    openAvatarPicker();
  });
  $("btn-avatar-change")?.addEventListener("click", (e) => {
    e.preventDefault();
    openAvatarPicker();
  });
  $("btn-avatar-clear")?.addEventListener("click", (e) => {
    e.preventDefault();
    clearAvatar();
  });
  file?.addEventListener("change", () => {
    const f = file.files?.[0];
    try {
      file.value = "";
    } catch (_) {}
    if (f) setAvatarFromFile(f);
  });

  // Drag & drop your own picture onto the profile hero
  const hero = $("settings-hero");
  if (hero && !hero.dataset.avatarDrop) {
    hero.dataset.avatarDrop = "1";
    const stop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    hero.addEventListener("dragenter", (e) => {
      stop(e);
      hero.classList.add("is-drop-target");
    });
    hero.addEventListener("dragover", (e) => {
      stop(e);
      hero.classList.add("is-drop-target");
    });
    hero.addEventListener("dragleave", () => {
      hero.classList.remove("is-drop-target");
    });
    hero.addEventListener("drop", (e) => {
      stop(e);
      hero.classList.remove("is-drop-target");
      const f = e.dataTransfer?.files?.[0];
      if (f) setAvatarFromFile(f);
    });
  }
  refreshAvatarUi();
}

/** Soft interest tags — must match bridge ALLOWED_TAGS. */
const INTEREST_TAGS = [
  "music",
  "games",
  "movies",
  "tech",
  "travel",
  "sports",
  "art",
  "chat",
  "langs",
  "anime",
];
const MAX_INTEREST_TAGS = 3;

function normalizeInterestTags(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const t of list) {
    const key = String(t || "")
      .trim()
      .toLowerCase();
    if (!INTEREST_TAGS.includes(key)) continue;
    if (out.includes(key)) continue;
    out.push(key);
    if (out.length >= MAX_INTEREST_TAGS) break;
  }
  return out;
}

function matchPrefs() {
  const p = loadPrefs();
  const gender = ["man", "woman", "other"].includes(p.gender) ? p.gender : "";
  const looking = ["man", "woman", "any"].includes(p.looking) ? p.looking : "any";
  const flag = normalizeFlagCode(p.flag);
  const avatar = isValidAvatarDataUrl(p.avatar) ? p.avatar : "";
  const tags = normalizeInterestTags(p.tags);
  return { gender, looking, flag, avatar, tags };
}

function sendHelloPayload(name) {
  const idn = loadIdentity();
  const prefs = matchPrefs();
  send({
    type: "hello",
    user_id: idn.user_id,
    name: name || getDisplayName(),
    gender: prefs.gender,
    looking: prefs.looking,
    flag: prefs.flag || "",
    avatar: prefs.avatar || "",
    tags: prefs.tags || [],
  });
}

function sendMatchPrefs() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const prefs = matchPrefs();
  send({
    type: "set_prefs",
    gender: prefs.gender,
    looking: prefs.looking,
    flag: prefs.flag || "",
    avatar: prefs.avatar || "",
    tags: prefs.tags || [],
  });
}

function renderFlagPickerList(filter = "") {
  const list = $("settings-flag-list");
  if (!list) return;
  const q = String(filter || "").trim().toLowerCase();
  const cur = getFlag();
  const rows = FLAG_OPTIONS.filter(([code, name]) => {
    if (!q) return true;
    if (
      !code &&
      ("none".includes(q) ||
        "no flag".includes(q) ||
        "без".includes(q) ||
        "нет".includes(q))
    )
      return true;
    const nameL = name.toLowerCase();
    return (
      code.toLowerCase().includes(q) ||
      nameL.includes(q) ||
      // match "antarctica" even when user types partial
      nameL.replace(/[’']/g, "'").includes(q) ||
      flagEmoji(code).includes(q)
    );
  });
  const countEl = $("flag-list-count");
  if (countEl) {
    const total = FLAG_OPTIONS.length;
    const n = rows.length;
    countEl.textContent =
      n === total
        ? `${n} flags · Antarctica, EU, UN at top · scroll or search`
        : `${n} of ${total} flags`;
  }
  list.innerHTML = rows
    .map(([code, name]) => {
      const em = code ? flagEmoji(code) : "🏳️";
      const selected = (code || "") === (cur || "");
      return `<button type="button" class="settings-row settings-choice flag-pick${
        selected ? " is-selected" : ""
      }" data-flag-pick="${escapeAttr(code)}">
        <span class="row-left">
          <span class="flag-emoji-lg" aria-hidden="true">${em || "🏳️"}</span>
          <span class="flag-pick-copy">
            <span class="flag-pick-title">${escapeHtml(code ? name : _t("flag.none") || name)}</span>
            <span class="flag-pick-sub">${
              code
                ? escapeHtml(code)
                : escapeHtml(_t("flag.noneHint") || "Hide flag on your name")
            }</span>
          </span>
        </span>
        <span class="choice-check">✓</span>
      </button>`;
    })
    .join("");
  list.querySelectorAll("[data-flag-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setFlag(btn.getAttribute("data-flag-pick") || "");
      showSettingsView("main");
    });
  });
}

function wireFlagSettings() {
  const search = $("flag-search");
  if (search && !search.dataset.wired) {
    search.dataset.wired = "1";
    search.addEventListener("input", () => renderFlagPickerList(search.value));
  }
}

function prefsLabel(key, val) {
  if (key === "gender") {
    if (val === "man") return _t("prefs.man");
    if (val === "woman") return _t("prefs.woman");
    if (val === "other") return _t("prefs.other");
    return _t("prefs.unset");
  }
  if (val === "man") return _t("prefs.man");
  if (val === "woman") return _t("prefs.woman");
  return _t("prefs.any");
}

function syncMatchPrefsUi() {
  const { gender, looking, tags } = matchPrefs();
  document.querySelectorAll("[data-pref-gender]").forEach((btn) => {
    const v = btn.getAttribute("data-pref-gender") || "";
    btn.classList.toggle("is-selected", v === gender);
  });
  document.querySelectorAll("[data-check-gender]").forEach((el) => {
    const v = el.getAttribute("data-check-gender") || "";
    el.style.opacity = v === gender ? "1" : "0";
  });
  document.querySelectorAll("[data-pref-looking]").forEach((btn) => {
    const v = btn.getAttribute("data-pref-looking") || "any";
    btn.classList.toggle("is-selected", v === looking);
  });
  document.querySelectorAll("[data-check-looking]").forEach((el) => {
    const v = el.getAttribute("data-check-looking") || "any";
    el.style.opacity = v === looking ? "1" : "0";
  });
  document.querySelectorAll("[data-pref-tag]").forEach((btn) => {
    const v = btn.getAttribute("data-pref-tag") || "";
    btn.classList.toggle("is-selected", tags.includes(v));
  });
  if ($("settings-match-summary")) {
    const tagBits = tags
      .map((t) => _t(`prefs.tag.${t}`) || t)
      .slice(0, 3)
      .join(", ");
    $("settings-match-summary").textContent =
      prefsLabel("looking", looking) +
      (gender ? " · " + prefsLabel("gender", gender) : "") +
      (tagBits ? " · " + tagBits : "");
  }
}

function wireMatchPrefs() {
  document.querySelectorAll("[data-pref-gender]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const gender = btn.getAttribute("data-pref-gender") || "";
      savePrefs({ gender });
      syncMatchPrefsUi();
      sendMatchPrefs();
      log(_t("prefs.saved"));
    });
  });
  document.querySelectorAll("[data-pref-looking]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const looking = btn.getAttribute("data-pref-looking") || "any";
      savePrefs({ looking });
      syncMatchPrefsUi();
      sendMatchPrefs();
      log(_t("prefs.saved"));
    });
  });
  document.querySelectorAll("[data-pref-tag]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tag = btn.getAttribute("data-pref-tag") || "";
      if (!tag) return;
      let tags = normalizeInterestTags(loadPrefs().tags);
      if (tags.includes(tag)) {
        tags = tags.filter((t) => t !== tag);
      } else if (tags.length >= MAX_INTEREST_TAGS) {
        setStatus(
          _t("prefs.tagsMax") || `Pick up to ${MAX_INTEREST_TAGS} interests`
        );
        return;
      } else {
        tags = normalizeInterestTags([...tags, tag]);
      }
      savePrefs({ tags });
      syncMatchPrefsUi();
      sendMatchPrefs();
      log(_t("prefs.saved"));
    });
  });
  document.querySelectorAll('[data-settings-open="matchprefs"]').forEach((el) => {
    el.addEventListener("click", () => syncMatchPrefsUi());
  });
}

function pushNameToServer(name) {
  const n = (name || getDisplayName() || "anon").trim().slice(0, 32) || "anon";
  saveIdentity({ name: n === "anon" ? "" : n });
  syncNameInputs(n);
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendHelloPayload(n);
  }
}

function wireNameInputs() {
  const handler = (e) => {
    const n = (e.target.value || "").trim().slice(0, 32);
    // Live sync other fields while typing
    for (const id of ["display-name-top", "display-name", "display-name-settings"]) {
      const el = $(id);
      if (el && el !== e.target) el.value = e.target.value;
    }
    refreshLocalNameChip();
    refreshAvatarUi();
  };
  const commit = (e) => {
    const n = (e.target.value || "").trim().slice(0, 32) || "anon";
    pushNameToServer(n);
    setStatus(_t("name.saved") + ": " + n);
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) setStatus(_t("status.connected"));
    }, 1200);
  };
  for (const id of ["display-name-top", "display-name", "display-name-settings"]) {
    const el = $(id);
    if (!el) continue;
    el.addEventListener("input", handler);
    el.addEventListener("change", commit);
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        el.blur();
      }
    });
  }
}

function log(line, cls = "sys") {
  if (cls === "mine" || cls === "theirs") {
    console.log(`[chat:${cls}]`, line);
    // Match chat path still uses log("[author] body", mine|theirs)
    let who = "";
    let body = line;
    const m = /^\[([^\]]+)\]\s*(.*)$/s.exec(line);
    if (m) {
      who = m[1];
      body = m[2];
    }
    recordChatMessage({
      author: who,
      body,
      mine: cls === "mine",
      cls,
    });
  } else {
    console.log(`[ruletka.vip]`, line);
  }
}

/**
 * Large on-tile #chat-panel retired — only the compact Messages sheet remains.
 * showChatPanel() is kept as a no-op hide so call sites stay safe.
 */
let chatPanelHideTimer = 0;
let chatPanelSticky = false;
const CHAT_PANEL_AUTO_HIDE_MS = 5000;

function showChatPanel(show, _opts = {}) {
  const panel = $("chat-panel");
  if (chatPanelHideTimer) {
    clearTimeout(chatPanelHideTimer);
    chatPanelHideTimer = 0;
  }
  chatPanelSticky = false;
  if (panel) {
    panel.classList.remove("is-pinned");
    panel.hidden = true;
    panel.setAttribute("hidden", "");
    panel.setAttribute("aria-hidden", "true");
  }
  // Never open the big panel again. Callers that need UI should use
  // openMessages() / openInboxThread() (compact sheet).
  void show;
}

function loadChatThreads() {
  try {
    const raw = JSON.parse(localStorage.getItem(CHAT_THREADS_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function saveChatThreads(map) {
  try {
    // Cap total threads by updated time
    const entries = Object.entries(map || {});
    entries.sort((a, b) => (b[1]?.updated || 0) - (a[1]?.updated || 0));
    const trimmed = {};
    for (const [k, v] of entries.slice(0, MAX_CHAT_THREADS)) trimmed[k] = v;
    localStorage.setItem(CHAT_THREADS_KEY, JSON.stringify(trimmed));
    maybeShowChatCleanupTip();
  } catch (e) {
    // Quota exceeded — force prune match threads and retry once
    if (e && (e.name === "QuotaExceededError" || e.code === 22)) {
      try {
        pruneOldMatchChats({ aggressive: true });
        localStorage.setItem(
          CHAT_THREADS_KEY,
          JSON.stringify(loadChatThreads())
        );
      } catch (_) {}
    }
  }
}

const CHAT_CLEANUP_TIP_KEY = "ruletka-chat-cleanup-tip-v1";

function chatCleanupTipDone() {
  try {
    return localStorage.getItem(CHAT_CLEANUP_TIP_KEY) === "1";
  } catch {
    return true;
  }
}

function markChatCleanupTipDone() {
  try {
    localStorage.setItem(CHAT_CLEANUP_TIP_KEY, "1");
  } catch (_) {}
}

function chatStorageApproxBytes() {
  try {
    const a = localStorage.getItem(CHAT_THREADS_KEY) || "";
    const b = localStorage.getItem(CHAT_READ_KEY) || "";
    return (a.length + b.length) * 2;
  } catch {
    return 0;
  }
}

function countMatchChatThreads() {
  try {
    return Object.keys(loadChatThreads()).filter((k) =>
      String(k).startsWith("match:")
    ).length;
  } catch {
    return 0;
  }
}

/** Drop oldest match chats; keep all friend: threads. */
function pruneOldMatchChats({ aggressive = false } = {}) {
  const map = loadChatThreads();
  const friends = [];
  const matches = [];
  for (const [k, v] of Object.entries(map)) {
    if (String(k).startsWith("friend:")) friends.push([k, v]);
    else matches.push([k, v]);
  }
  matches.sort((a, b) => (b[1]?.updated || 0) - (a[1]?.updated || 0));
  const keepN = aggressive
    ? Math.min(8, Math.floor(MAX_CHAT_THREADS / 4))
    : Math.min(20, Math.floor(MAX_CHAT_THREADS / 2));
  const kept = matches.slice(0, keepN);
  const next = {};
  for (const [k, v] of friends) next[k] = v;
  for (const [k, v] of kept) next[k] = v;
  // Cap messages inside kept threads
  for (const k of Object.keys(next)) {
    const thr = next[k];
    if (thr && Array.isArray(thr.messages) && thr.messages.length > MAX_THREAD_MSGS) {
      thr.messages = thr.messages.slice(-MAX_THREAD_MSGS);
    }
  }
  try {
    localStorage.setItem(CHAT_THREADS_KEY, JSON.stringify(next));
  } catch (_) {}
  // Prune read map for dropped keys
  try {
    const read = loadChatRead();
    const keepKeys = new Set(Object.keys(next));
    for (const k of Object.keys(read)) {
      if (!keepKeys.has(k)) delete read[k];
    }
    saveChatRead(read);
  } catch (_) {}
  return matches.length - kept.length;
}

/**
 * Soft one-shot when local match chats grow large (not a forced modal).
 */
function maybeShowChatCleanupTip() {
  try {
    if (!SOFT_POPUPS_ENABLED) {
      markChatCleanupTipDone();
      return;
    }
    if (chatCleanupTipDone()) return;
    if ($("chat-cleanup-tip") || $("match-path-summary-toast")) return;
    const bytes = chatStorageApproxBytes();
    const nMatch = countMatchChatThreads();
    // ~180KB chat data or many match threads
    if (bytes < 180_000 && nMatch < 28) return;
    markChatCleanupTipDone();
    const tip = document.createElement("div");
    tip.id = "chat-cleanup-tip";
    tip.className = "weak-conn-tip chat-cleanup-tip";
    tip.setAttribute("role", "status");
    tip.style.pointerEvents = "auto";
    tip.innerHTML = `
      <span>${escapeHtml(
        _t("chat.cleanupTip") ||
          "Match chat history is getting large on this device. Clear old match chats to free space? Friend chats are kept."
      )}</span>
      <button type="button" class="pill tight ghost" id="btn-chat-cleanup-later">${escapeHtml(
        _t("friends.exportNudgeLater") || "Later"
      )}</button>
      <button type="button" class="pill tight accent" id="btn-chat-cleanup-go">${escapeHtml(
        _t("chat.cleanupAction") || "Clear old matches"
      )}</button>`;
    document.body.appendChild(tip);
    const dismiss = () => {
      if (tip.parentNode) tip.remove();
    };
    $("btn-chat-cleanup-later")?.addEventListener("click", () => {
      trackEvent("chat_cleanup_later");
      dismiss();
    });
    $("btn-chat-cleanup-go")?.addEventListener("click", () => {
      const n = pruneOldMatchChats({ aggressive: false });
      trackEvent("chat_cleanup_go", { removed: n });
      setStatus(
        _t("chat.cleanupDone", { n }) ||
          (n > 0
            ? `Cleared ${n} old match chats`
            : "Match chats already trimmed")
      );
      try {
        updateMessagesBadge?.();
        if (messagesSheetOpen) {
          showMsgListView?.();
        }
      } catch (_) {}
      dismiss();
    });
    setTimeout(dismiss, 16000);
    trackEvent("chat_cleanup_tip_show", { bytes, matchThreads: nMatch });
  } catch (_) {}
}

function loadChatRead() {
  try {
    const raw = JSON.parse(localStorage.getItem(CHAT_READ_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function saveChatRead(map) {
  try {
    localStorage.setItem(CHAT_READ_KEY, JSON.stringify(map || {}));
  } catch (_) {}
}

function markThreadRead(threadKey, ts) {
  if (!threadKey) return;
  const map = loadChatRead();
  map[threadKey] = Math.max(map[threadKey] || 0, ts || Date.now());
  saveChatRead(map);
  updateFriendsUnreadBadge();
}

function friendThreadKey(userId) {
  return `friend:${userId || ""}`;
}

function matchThreadKey(userId, friendCode, shortId) {
  const id = userId || friendCode || shortId || "anon";
  return `match:${id}`;
}

function updateChatHeader() {
  const title = $("chat-panel-title");
  const sub = $("chat-panel-sub");
  if (!title) return;
  const name = activeChat.peerName || _t("chat.title") || "Chat";
  if (activeChat.mode === "friend") {
    title.textContent = name;
    if (sub) {
      const fr = friendsCache.find((f) => f.user_id === activeChat.peerUserId);
      const online = fr ? !!fr.online : false;
      sub.hidden = false;
      if ((inFriendCall || matchMode === "friend") && anyChatDcOpen()) {
        sub.textContent = _t("chat.p2pLive") || "P2P · not via hub";
        sub.classList.add("chat-sub-p2p");
      } else {
        sub.classList.remove("chat-sub-p2p");
        sub.textContent = online
          ? _t("friends.online") || "online"
          : _t("chat.friendOffline") ||
            "offline · messages deliver when they open chat";
      }
    }
  } else if (activeChat.mode === "match" || activeChat.mode === "history") {
    title.textContent = name;
    if (sub) {
      if (activeChat.live) {
        if (anyChatDcOpen()) {
          sub.hidden = false;
          sub.textContent = _t("chat.p2pLive") || "P2P · not via hub";
          sub.classList.add("chat-sub-p2p");
        } else {
          sub.hidden = false;
          sub.textContent = _t("chat.hubRelay") || "via hub until P2P ready";
          sub.classList.remove("chat-sub-p2p");
        }
      } else {
        sub.hidden = false;
        sub.textContent = _t("chat.ended") || "Call ended · chat saved";
        sub.classList.remove("chat-sub-p2p");
      }
    }
  } else {
    title.textContent = _t("chat.title") || "Chat";
    if (sub) {
      sub.hidden = true;
      sub.textContent = "";
    }
  }
  updateComposePlaceholder();
}

function updateComposePlaceholder() {
  const input = $("msg");
  if (!input) return;
  if (activeChat.mode === "friend") {
    input.placeholder = _t("chat.placeholderFriend") || "Message friend…";
    input.disabled = false;
  } else if (activeChat.mode === "match" && activeChat.live) {
    input.placeholder = _t("chat.placeholder") || "Say something…";
    input.disabled = false;
  } else if (activeChat.mode === "match" || activeChat.mode === "history") {
    // Stranger history after hangup — keep visible but no send unless they became a friend
    const isFriend =
      activeChat.peerUserId &&
      friendsCache.some((f) => f.user_id === activeChat.peerUserId);
    if (isFriend) {
      // Promote to friend DM target so they can keep chatting
      activeChat.mode = "friend";
      activeChat.live = true;
      activeChat.threadKey = friendThreadKey(activeChat.peerUserId);
      input.placeholder = _t("chat.placeholderFriend") || "Message friend…";
      input.disabled = false;
      updateChatHeader();
    } else {
      input.placeholder = _t("chat.placeholderEnded") || "Chat saved · match ended";
      input.disabled = true;
    }
  } else {
    input.placeholder = _t("chat.placeholder") || "Say something…";
    input.disabled = false;
  }
}

/** Clear only the visible bubbles (does not wipe localStorage). */
function clearChatDom() {
  const box = $("chat-messages");
  if (box) box.innerHTML = "";
}

/** Clear current thread from storage + UI. */
function clearChat() {
  if (activeChat.threadKey) {
    const map = loadChatThreads();
    delete map[activeChat.threadKey];
    saveChatThreads(map);
  }
  clearChatDom();
  showChatPanel(false);
}

/** Keep chat visible after hangup — do not wipe history. */
function endActiveMatchChat() {
  if (activeChat.mode === "match" && activeChat.threadKey) {
    activeChat.live = false;
    activeChat.mode = "history";
    updateChatHeader();
    // Leave panel open if it has messages
    const map = loadChatThreads();
    const thr = map[activeChat.threadKey];
    if (thr && thr.msgs && thr.msgs.length) {
      showChatPanel(true);
    }
  }
}

/**
 * Unsolicited bottom-sheet toasts (invite nags, path tips, onboarding cards, etc.).
 * Off by default — invite lives on the empty card; feedback uses the status line.
 * Keep only action-required dialogs: star review, friend request / call.
 */
const SOFT_POPUPS_ENABLED = false;

/**
 * Post-match “Add friend?” after a real stranger call ends (Next/Stop).
 * Retention-critical (Week-2) — always shown as a real toast, not gated by SOFT_POPUPS.
 * Only if: partner code, not already friends, match ≥8s, once per partner/session.
 */
const friendNudgeShown = new Set();
/** Pending schedule so star-review can trigger the same nudge without double timers. */
let postMatchFriendNudgeTimer = 0;
/** Snapshot for delayed nudge (meta cleared after stop). */
let postMatchFriendSnap = null;
/** Min match seconds before post-match friend CTA (lowered for Week-2 funnel). */
const POST_MATCH_FRIEND_MIN_SEC = 8;

/**
 * After any stranger call: let user Report / Block last partner even if they
 * forgot in-call (and even if Call history is hard to find).
 */
const safetyNudgeShown = new Set();
let postMatchSafetyNudgeTimer = 0;
/** @type {{ uid: string, name: string, short_id: string, friend_code: string, reason: string } | null} */
let postMatchSafetySnap = null;

/** Last call duration in seconds (survives stopMatchTimer zeroing the clock). */
let lastMatchDurationSec = 0;

function matchDurationSec() {
  if (matchTimerStartedAt) {
    return Math.max(0, Math.floor((Date.now() - matchTimerStartedAt) / 1000));
  }
  return lastMatchDurationSec || 0;
}

/**
 * Snapshot path + quality for the call that is about to end (call while still matched).
 * @returns {{ ice: string, grade: string, sec: number, mode: string } | null}
 */
function captureMatchPathSummary() {
  const sec = matchDurationSec();
  if (sec < 3) return null;
  const ice = lastIceKind || "unknown";
  const grade = lastConnGrade || "";
  return {
    ice,
    grade,
    sec,
    mode: matchMode || "solo",
  };
}

/**
 * Soft post-match path summary: Direct/Relay · Good/OK/Weak · time.
 * Status line always; short toast only for meaningful stranger calls (≥8s).
 */
function maybeShowMatchPathSummary(reason) {
  try {
    const s = captureMatchPathSummary();
    if (!s) return;
    if (s.mode === "friend" || inFriendCall) return;
    const path =
      s.ice === "direct"
        ? _t("conn.chipDirect") || "Direct"
        : s.ice === "relay"
          ? _t("conn.chipRelay") || "Relay"
          : _t("conn.chipConnecting") || "Path?";
    const grade =
      s.grade === "good"
        ? _t("conn.chipGood") || "Good"
        : s.grade === "weak"
          ? _t("conn.chipWeak") || "Weak"
          : s.grade === "ok"
            ? _t("conn.chipOk") || "OK"
            : "";
    const t = formatMatchDuration(s.sec * 1000);
    const bits = [path];
    if (grade) bits.push(grade);
    bits.push(t);
    const line =
      _t("conn.matchSummary", {
        path,
        grade: grade || "—",
        t,
      }) || `Last call: ${bits.join(" · ")}`;
    setStatus(line);
    log(line);
    trackEvent("match_summary", {
      ice: s.ice,
      grade: s.grade || "",
      sec: s.sec,
      reason: reason || "",
    });
    // No popup — status line is enough
  } catch (_) {}
}

/**
 * Star earn/give feedback → status line only (no bottom popup).
 * @param {"earned"|"given"|"gift"} kind
 * @param {{ name?: string, n?: number, title?: string, body?: string }} [extra]
 */
function showStarFeedbackToast(kind, extra = {}) {
  try {
    let title = "★";
    let body = "";
    if (kind === "earned") {
      title = _t("stars.earnedTitle") || "You received a star ★";
      body =
        _t("stars.earnedBody", { n: extra.n ?? myStars }) ||
        `Balance: ★ ${extra.n ?? myStars}`;
    } else if (kind === "given") {
      title = _t("stars.givenTitle") || "Star sent ★";
      body =
        _t("stars.givenBody", { name: extra.name || "them" }) ||
        `You gifted a star to ${extra.name || "them"}.`;
    } else if (kind === "gift") {
      title = extra.title || "Gift";
      body = extra.body || "";
    }
    const line = body ? `${title} · ${body}` : title;
    setStatus(line);
    // Corner toast for live gifts (stronger than status line alone)
    if (kind === "gift" && (extra.corner || extra.level >= 2 || extra.received)) {
      showGiftCornerToast(title, body, {
        accent: extra.accent || "",
        level: extra.level || 1,
        ico: extra.ico || "★",
      });
    }
  } catch (_) {}
}

/**
 * Brief corner gift toast (receive / high stack send).
 * @param {string} title
 * @param {string} body
 * @param {{ accent?: string, level?: number, ico?: string }} [opts]
 */
function showGiftCornerToast(title, body, opts = {}) {
  try {
    const id = "gift-corner-toast";
    $(id)?.remove?.();
    const toast = document.createElement("div");
    toast.id = id;
    toast.className = "corner-toast gift-corner-toast";
    const lvl = Math.max(1, Math.min(3, Number(opts.level) || 1));
    if (lvl >= 2) toast.classList.add("is-stack");
    if (lvl >= 3) toast.classList.add("is-mega");
    if (opts.accent) toast.style.setProperty("--gift-accent", opts.accent);
    toast.setAttribute("role", "status");
    toast.innerHTML = `<span class="gift-corner-ico" aria-hidden="true">${escapeHtml(
      opts.ico || "★"
    )}</span><div class="gift-corner-copy"><strong>${escapeHtml(
      title || "Gift"
    )}</strong><span>${escapeHtml(body || "")}</span></div>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, lvl >= 3 ? 4200 : 3200);
  } catch (_) {}
}

function giftKindMeta(kind) {
  const k = String(kind || "").toLowerCase();
  const map = {
    heart: { ico: "💖", name: "Heart", accent: "#ff5a8a" },
    flowers: { ico: "🌸", name: "Flowers", accent: "#ff6bb5" },
    balloons: { ico: "🎈", name: "Balloons", accent: "#5ad4ff" },
    confetti: { ico: "🎊", name: "Confetti", accent: "#ffd14a" },
    fireworks: { ico: "🎆", name: "Fireworks", accent: "#ffb020" },
    bars: { ico: "🔒", name: "Behind bars", accent: "#a0b0c8" },
    please_stay: { ico: "🙏", name: "Please stay", accent: "#ff8fab" },
  };
  return map[k] || { ico: "★", name: "Gift", accent: "#ffd54a" };
}

/** Brief gold pulse on a star badge when count changes. */
function pulseStarsBadge(which) {
  const badge = $(which === "local" ? "local-stars-badge" : "remote-stars-badge");
  if (!badge || badge.hidden) return;
  badge.classList.remove("is-pulse");
  // reflow so animation restarts
  void badge.offsetWidth;
  badge.classList.add("is-pulse");
  setTimeout(() => badge.classList.remove("is-pulse"), 900);
}

const STARS_INTRO_TIP_KEY = "ruletka-stars-intro-tip-v1";
function starsIntroTipDone() {
  try {
    return localStorage.getItem(STARS_INTRO_TIP_KEY) === "1";
  } catch {
    return true;
  }
}
function markStarsIntroTipDone() {
  try {
    localStorage.setItem(STARS_INTRO_TIP_KEY, "1");
  } catch (_) {}
}

/** One-shot: after first match — no popup (stars sheet is always on the ★ badge). */
function maybeShowStarsIntroTip() {
  try {
    if (!SOFT_POPUPS_ENABLED) {
      markStarsIntroTipDone();
      markFirstSessionGuideDone();
      return;
    }
    if (!firstSessionGuideDone()) {
      maybeShowFirstSessionGuide();
      return;
    }
    if (starsIntroTipDone()) return;
    markStarsIntroTipDone();
  } catch (_) {}
}

const FIRST_SESSION_GUIDE_KEY = "ruletka-first-session-guide-v1";
function firstSessionGuideDone() {
  try {
    return localStorage.getItem(FIRST_SESSION_GUIDE_KEY) === "1";
  } catch {
    return true;
  }
}
function markFirstSessionGuideDone() {
  try {
    localStorage.setItem(FIRST_SESSION_GUIDE_KEY, "1");
  } catch (_) {}
}

/**
 * First-session help lives on the empty card (not a popup).
 * Call after rules / when empty UI refreshes.
 */
function maybeShowFirstSessionGuide() {
  try {
    updateFirstRunEmptyHint();
  } catch (_) {}
}

/**
 * Inline first-run steps under empty title (Week-6 cold-start).
 * Hidden after first Start so it never nags return visitors.
 */
function updateFirstRunEmptyHint() {
  const hint = $("empty-first-hint");
  const camWhy = $("empty-cam-why");
  const startBtn = $("btn-start-match");
  const empty = $("remote-empty");
  const emptyOpen =
    !!empty &&
    !empty.classList.contains("hidden") &&
    !matched &&
    !inFriendCall &&
    !trioBrowse;
  const firstRun =
    rulesAccepted() && !firstSessionGuideDone() && emptyOpen && !inQueue && !wantSearch;
  if (hint) {
    hint.hidden = !firstRun;
    if (firstRun) hint.removeAttribute("hidden");
    else hint.setAttribute("hidden", "");
  }
  if (camWhy) {
    camWhy.hidden = !firstRun;
    if (firstRun) camWhy.removeAttribute("hidden");
    else camWhy.setAttribute("hidden", "");
  }
  if (startBtn) {
    startBtn.classList.toggle("is-first-run", !!firstRun);
    if (firstRun) {
      const label =
        _t("btn.startFirst") || _t("btn.start") || "Start chatting";
      // Keep data-i18n span-free button text for first-run emphasis
      if (!startBtn.dataset.firstRunLabel) {
        startBtn.dataset.firstRunLabel = "1";
        startBtn.textContent = label;
      }
    } else if (startBtn.dataset.firstRunLabel) {
      delete startBtn.dataset.firstRunLabel;
      startBtn.textContent = _t("btn.start") || "Start";
    }
  }
}

/**
 * Show/hide gold star badge. Click always opens the Stars sheet (like Settings).
 * @param {"local"|"remote"} which
 * @param {number} count
 */
/** Apply tier rings: avatar (subtle) + full cam tile frame for Trusted/Senior. */
function applyStarsTierFrames(which, n) {
  const w = reportWeightForStars(n);
  const tierClass =
    w >= 3 ? "tier-senior" : w >= 2 ? "tier-trusted" : "tier-normal";
  // Name chips no longer get tier glow — user asked for clean flag+name.
  // Avatars keep a subtle tier ring when photo is set.
  // Full tiles get a gold cam frame only at Trusted / Senior.
  const targets =
    which === "local" ? ["local-avatar"] : ["remote-avatar"];
  // Clear any leftover classes on name chips from older deploys
  const clearIds =
    which === "local"
      ? ["local-name-tag", "local-name", "local-avatar"]
      : ["remote-tile-tag", "remote-tag", "remote-avatar"];
  clearIds.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.classList.remove("tier-normal", "tier-trusted", "tier-senior", "has-star-tier");
  });
  targets.forEach((id) => {
    const el = $(id);
    if (!el) return;
    if (n > 0 || which === "local") {
      el.classList.add("has-star-tier", tierClass);
    }
  });
  // Full-tile cam frame (Trusted / Senior status chrome)
  const tileId = which === "local" ? "tile-local" : "tile-remote";
  const tile = $(tileId);
  if (tile) {
    tile.classList.remove(
      "tier-normal",
      "tier-trusted",
      "tier-senior",
      "has-star-tier",
      "cam-tier-trusted",
      "cam-tier-senior"
    );
    const showCam =
      w >= 2 && (which === "local" || n >= STARS_TRUSTED_GOAL);
    if (showCam) {
      tile.classList.add(
        "has-star-tier",
        tierClass,
        w >= 3 ? "cam-tier-senior" : "cam-tier-trusted"
      );
    }
  }
}

/** One-shot nudge when close to Trusted (90–99) or Senior (240–249). */
function maybeStarsAlmostThereNudge(n) {
  try {
    if (n >= 90 && n < STARS_TRUSTED_GOAL) {
      if (!localStorage.getItem(STARS_NUDGE_90_KEY)) {
        localStorage.setItem(STARS_NUDGE_90_KEY, "1");
        const left = STARS_TRUSTED_GOAL - n;
        showStarFeedbackToast("gift", {
          title: _t("stars.almostTrustedTitle") || "Almost Trusted ★",
          body:
            _t("stars.almostTrustedBody", { n: left }) ||
            `${left} more peer trust to Trusted status. Keep chatting!`,
        });
        trackEvent("stars_almost_there", { tier: "trusted", have: n, left });
      }
    }
    if (n >= 240 && n < STARS_SENIOR_GOAL) {
      if (!localStorage.getItem(STARS_NUDGE_240_KEY)) {
        localStorage.setItem(STARS_NUDGE_240_KEY, "1");
        const left = STARS_SENIOR_GOAL - n;
        showStarFeedbackToast("gift", {
          title: _t("stars.almostSeniorTitle") || "Almost Senior ★",
          body:
            _t("stars.almostSeniorBody", { n: left }) ||
            `${left} more peer trust to Senior status.`,
        });
        trackEvent("stars_almost_there", { tier: "senior", have: n, left });
      }
    }
    // Reset nudges if they somehow drop below (edge case / account switch)
    if (n < 90) localStorage.removeItem(STARS_NUDGE_90_KEY);
    if (n < 240) localStorage.removeItem(STARS_NUDGE_240_KEY);
  } catch (_) {}
}

/** Milestone toasts: first/5th gifter, wealth 100/250. */
function maybeStarsMilestones(opts = {}) {
  try {
    const g = Math.max(
      0,
      Number(opts.gifters != null ? opts.gifters : myTrustGifters) || 0
    );
    const bal = Math.max(
      0,
      Number(opts.balance != null ? opts.balance : myStars) || 0
    );
    if (g >= 1 && !localStorage.getItem(STARS_MS_G1_KEY)) {
      localStorage.setItem(STARS_MS_G1_KEY, "1");
      showStarFeedbackToast("gift", {
        title: _t("stars.msFirstGifterTitle") || "First peer ★",
        body:
          _t("stars.msFirstGifterBody") ||
          "Someone gifted you after a chat — trust grows only this way.",
      });
      trackEvent("stars_milestone", { kind: "gifter_1" });
    }
    if (g >= TRUSTED_MIN_GIFTERS && !localStorage.getItem(STARS_MS_G5_KEY)) {
      localStorage.setItem(STARS_MS_G5_KEY, "1");
      showStarFeedbackToast("gift", {
        title: _t("stars.msFiveGiftersTitle") || "5 unique gifters",
        body:
          _t("stars.msFiveGiftersBody") ||
          "Gifter floor met for Trusted status (still need 100 trust).",
      });
      trackEvent("stars_milestone", { kind: "gifter_5" });
    }
    if (bal >= 100 && !localStorage.getItem(STARS_MS_W100_KEY)) {
      localStorage.setItem(STARS_MS_W100_KEY, "1");
      showStarFeedbackToast("gift", {
        title: _t("stars.msWealth100Title") || "Rich balance ★100",
        body:
          _t("stars.msWealth100Body") ||
          "Big spendable balance — trust still comes only from peer gifts.",
      });
      trackEvent("stars_milestone", { kind: "wealth_100" });
    }
    if (bal >= 250 && !localStorage.getItem(STARS_MS_W250_KEY)) {
      localStorage.setItem(STARS_MS_W250_KEY, "1");
      showStarFeedbackToast("gift", {
        title: _t("stars.msWealth250Title") || "Legendary balance ★250",
        body:
          _t("stars.msWealth250Body") ||
          "Legendary wallet for gifts — separate from Senior trust.",
      });
      trackEvent("stars_milestone", { kind: "wealth_250" });
    }
    if (g < 1) localStorage.removeItem(STARS_MS_G1_KEY);
    if (g < TRUSTED_MIN_GIFTERS) localStorage.removeItem(STARS_MS_G5_KEY);
    if (bal < 100) localStorage.removeItem(STARS_MS_W100_KEY);
    if (bal < 250) localStorage.removeItem(STARS_MS_W250_KEY);
  } catch (_) {}
}

/**
 * @param {"local"|"remote"} which
 * @param {number} count  Local = spendable balance; remote = public trust
 * @param {{ trust?: number }} [opts] optional trust override for local tier chrome
 */
function setStarsBadge(which, count, opts = {}) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const badge = $(which === "local" ? "local-stars-badge" : "remote-stars-badge");
  const el = $(which === "local" ? "local-stars-count" : "remote-stars-count");
  if (el) el.textContent = String(n);
  const prevLocalBal = which === "local" ? myStars : partnerStars;
  const prevLocalTrust = myTrust;
  if (which === "local") myStars = n;
  if (which === "remote") partnerStars = n;
  // Tier chrome: prefer explicit trust (local + remote). Remote number is spendable balance.
  const tierScore = Math.max(
    0,
    Math.floor(
      Number(
        opts.trust != null
          ? opts.trust
          : which === "local"
            ? myTrustEffective || myTrust
            : 0
      ) || 0
    )
  );
  if (badge) {
    const live = !!(matched || inFriendCall);
    // Your ★ always visible (even 0) so you can open the guide anytime.
    // Partner ★ when they have trust, or during live chat (shows 0).
    const show = which === "local" ? true : n > 0 || live;
    badge.hidden = !show;
    if (show) {
      badge.removeAttribute("hidden");
      // Defeat leftover display:none from races / old CSS
      try {
        badge.style.removeProperty("display");
        if (which === "local") {
          badge.style.setProperty("display", "inline-flex", "important");
          badge.style.setProperty("opacity", "1", "important");
          badge.style.setProperty("visibility", "visible", "important");
        }
      } catch (_) {}
    } else badge.setAttribute("hidden", "");
    badge.classList.add("is-clickable");
    badge.classList.toggle("is-live-chat", live);
    // Trust tier from peer gifts; wealth chrome from spendable balance (local only)
    const w = reportWeightForStars(tierScore);
    const wealth = starsWealthLevel(which === "local" ? n : 0);
    badge.classList.remove(
      "tier-normal",
      "tier-trusted",
      "tier-senior",
      "wealth-1",
      "wealth-2",
      "wealth-3",
      "wealth-4"
    );
    badge.classList.add(
      w >= 3 ? "tier-senior" : w >= 2 ? "tier-trusted" : "tier-normal"
    );
    if (wealth >= 1) badge.classList.add(`wealth-${wealth}`);
    badge.dataset.tier = String(w);
    badge.dataset.stars = String(n);
    badge.dataset.trust = String(tierScore);
    badge.dataset.wealth = String(wealth);
    const ico = badge.querySelector(".stars-icon");
    if (ico) {
      // Same glyph; CSS beefs up trusted/senior (glow, size, gold)
      ico.textContent = "★";
      ico.setAttribute(
        "title",
        w >= 3
          ? _t("stars.tierSenior") || "Senior"
          : w >= 2
            ? _t("stars.tierTrusted") || "Trusted"
            : _t("stars.tierNormal") || "Normal"
      );
    }
    const tierBit =
      w >= 3
        ? _t("stars.tierSenior") || "Senior · ×3"
        : w >= 2
          ? _t("stars.tierTrusted") || "Trusted · ×2"
          : "";
    const label =
      which === "local"
        ? (_t("stars.yours") || "Your balance") +
          ` · ★ ${n}` +
          (tierScore
            ? ` · ${_t("stars.trustShort") || "trust"} ${tierScore}`
            : "")
        : (_t("stars.tipTheirsTitle") || "Reputation") + ` · ★ ${n}`;
    badge.setAttribute(
      "aria-label",
      (tierBit ? tierBit + ". " : "") +
        label +
        ". " +
        (_t("stars.badgeClick") || "Click for Stars guide and gifts")
    );
    badge.title =
      (tierBit ? tierBit + " · " : "") +
      (_t("stars.badgeClick") || "Click for Stars guide and gifts");
  }
  applyStarsTierFrames(which, tierScore);
  // Match-time tier chip (New / Known / Trusted / Senior)
  try {
    setTrustTierChip(which, tierScore);
  } catch (_) {}
  if (which === "local" && (n !== prevLocalBal || tierScore !== prevLocalTrust)) {
    maybeStarsAlmostThereNudge(tierScore);
  }
  if (starsSheetIsOpen()) syncStarsSheetUi();
}

function setMyTrust(trust, gifters, effective) {
  myTrust = Math.max(0, Math.floor(Number(trust) || 0));
  if (effective != null) {
    myTrustEffective = Math.max(0, Math.floor(Number(effective) || 0));
  } else {
    // Client-side floor mirror when hub didn't send effective
    myTrustEffective = clientEffectiveTrust(myTrust, myTrustGifters);
  }
  if (gifters != null) {
    myTrustGifters = Math.max(0, Math.floor(Number(gifters) || 0));
    if (effective == null) {
      myTrustEffective = clientEffectiveTrust(myTrust, myTrustGifters);
    }
  }
  // Refresh local badge tier without changing displayed balance
  setStarsBadge("local", myStars, { trust: myTrustEffective });
  maybeStarsMilestones({ gifters: myTrustGifters, balance: myStars });
}

/** Peak trust ever seen on this browser (prestige; not active trust). */
function notePeakTrust(rawTrust) {
  const t = Math.max(0, Math.floor(Number(rawTrust) || 0));
  if (t <= 0) return t;
  let peak = 0;
  try {
    peak = Math.max(0, Math.floor(Number(localStorage.getItem(PEAK_TRUST_KEY)) || 0));
  } catch (_) {}
  if (t > peak) {
    peak = t;
    try {
      localStorage.setItem(PEAK_TRUST_KEY, String(peak));
    } catch (_) {}
  }
  return peak;
}

function getPeakTrust() {
  try {
    return Math.max(0, Math.floor(Number(localStorage.getItem(PEAK_TRUST_KEY)) || 0));
  } catch (_) {
    return 0;
  }
}

/** Privacy-light gifter initials from hub. */
function syncGiverChips(chips) {
  const box = $("stars-giver-chips");
  if (!box) return;
  const list = Array.isArray(chips) ? chips : myTrustGivers || [];
  if (!list.length) {
    box.hidden = true;
    box.setAttribute("hidden", "");
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  box.removeAttribute("hidden");
  const key = list.map((c) => `${c.initial || ""}:${c.flag || ""}`).join("|");
  if (box.dataset.key === key && box.childElementCount) return;
  box.dataset.key = key;
  box.innerHTML = "";
  list.slice(0, 8).forEach((c) => {
    const span = document.createElement("span");
    span.className = "stars-giver-chip";
    const initial = String(c?.initial || "★").slice(0, 2);
    const flag = String(c?.flag || "").trim().toUpperCase();
    span.textContent = initial;
    span.title =
      _t("stars.giverChipTip") || "Someone who gifted you ★ after a chat";
    if (flag && flag.length === 2) {
      span.dataset.flag = flag;
      try {
        // regional indicator symbols for flag emoji when possible
        const A = 0x1f1e6;
        const code = [...flag].map((ch) => A + (ch.charCodeAt(0) - 65));
        if (code.every((n) => n >= A && n <= A + 25)) {
          span.dataset.emoji = String.fromCodePoint(...code);
        }
      } catch (_) {}
    }
    box.appendChild(span);
  });
}

/** Full reputation card + one-line story. */
function syncRepStory(state = {}) {
  const el = $("stars-rep-story");
  const card = $("stars-rep-card");
  const trustN = Math.max(0, Number(state.trustN != null ? state.trustN : myTrust) || 0);
  const balN = Math.max(0, Number(state.balN != null ? state.balN : myStars) || 0);
  const effN = Math.max(
    0,
    Number(state.effN != null ? state.effN : myTrustEffective) ||
      clientEffectiveTrust(trustN, myTrustGifters)
  );
  const g = Math.max(
    0,
    Number(state.gifters != null ? state.gifters : myTrustGifters) || 0
  );
  const peak = Math.max(getPeakTrust(), notePeakTrust(trustN));
  const lastTs = Math.max(0, Number(myTrustLastTs) || 0);
  const isSenior = effN >= STARS_SENIOR_GOAL;
  const isTrusted = effN >= STARS_TRUSTED_GOAL;
  const show = trustN > 0 || g > 0 || peak > 0 || balN > 0;

  if (card) {
    if (!show) {
      card.hidden = true;
      card.setAttribute("hidden", "");
    } else {
      card.hidden = false;
      card.removeAttribute("hidden");
      const tierEl = $("stars-rep-card-tier");
      if (tierEl) {
        tierEl.textContent = isSenior
          ? _t("stars.chipSenior") || "Senior"
          : isTrusted
            ? _t("stars.chipTrusted") || "Trusted"
            : trustN > 0
              ? _t("stars.chipKnown") || "Known"
              : _t("stars.chipNew") || "New";
        tierEl.className =
          "stars-rep-card-tier" +
          (isSenior ? " is-senior" : isTrusted ? " is-trusted" : "");
      }
      const balEl = $("stars-rep-card-bal");
      if (balEl) balEl.textContent = `★${balN}`;
      const trEl = $("stars-rep-card-trust");
      if (trEl) {
        trEl.textContent =
          effN !== trustN && trustN > 0 ? `${effN} (${trustN})` : String(effN || trustN);
      }
      const gEl = $("stars-rep-card-gifters");
      if (gEl) gEl.textContent = String(g);
      const pEl = $("stars-rep-card-peak");
      if (pEl) pEl.textContent = String(peak || trustN || 0);
      const rankEl = $("stars-rep-card-rank");
      if (rankEl) {
        if (isTrusted || isSenior) {
          rankEl.hidden = false;
          rankEl.removeAttribute("hidden");
          rankEl.textContent =
            _t("stars.softRankOn") ||
            "↗ Soft match rank on · better mix when lobby is busy";
        } else {
          rankEl.hidden = true;
          rankEl.setAttribute("hidden", "");
          rankEl.textContent = "";
        }
      }
    }
  }

  if (!el) return;
  if (!show) {
    el.hidden = true;
    el.setAttribute("hidden", "");
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.removeAttribute("hidden");
  const bits = [];
  if (g > 0) {
    bits.push(
      _t("stars.storyGifters", { n: g }) || `${g} unique gifters`
    );
  }
  if (peak > 0) {
    bits.push(
      peak > trustN
        ? _t("stars.storyPeakActive", { peak, n: trustN }) ||
            `peak trust ${peak} · active ${trustN}`
        : _t("stars.storyPeak", { peak }) || `peak trust ${peak}`
    );
  }
  if (lastTs > 0) {
    const days = Math.max(
      0,
      Math.floor((Date.now() / 1000 - lastTs) / 86400)
    );
    bits.push(
      days === 0
        ? _t("stars.storyPraiseToday") || "last praise today"
        : _t("stars.storyPraiseDays", { n: days }) ||
            `last praise ${days}d ago`
    );
  }
  el.textContent = bits.join(" · ");
}

/**
 * Welcome-back after soft-decay idle: toast once per return, spark flair,
 * pending flag until first long chat completes.
 */
function maybeWelcomeBackOnHello() {
  const lastTs = Math.max(0, Number(myTrustLastTs) || 0);
  const trustN = Math.max(0, Number(myTrust) || 0);
  const peak = getPeakTrust();
  if (!lastTs && trustN <= 0 && peak <= 0) return;
  const info = trustDecayInfo(lastTs || 0);
  // Only when idle long enough that decay would start (or is active)
  const idleEnough =
    info.kind === "decaying" ||
    info.kind === "full" ||
    (info.kind === "fresh" &&
      lastTs > 0 &&
      info.idleDays >= Math.max(14, Math.floor(TRUST_DECAY_START_DAYS / 2)));
  // Prefer true decay window
  const inDecayWindow =
    info.kind === "decaying" ||
    info.kind === "full" ||
    (lastTs > 0 &&
      Math.floor((Date.now() / 1000 - lastTs) / 86400) >= TRUST_DECAY_START_DAYS);
  if (!inDecayWindow && !idleEnough) return;
  if (!inDecayWindow) return; // stick to 45d+ for real welcome-back

  let lastShown = 0;
  try {
    lastShown = Math.max(0, Number(localStorage.getItem(WELCOME_BACK_KEY)) || 0);
  } catch (_) {}
  // At most once per 14 days
  if (lastShown && Date.now() - lastShown < 14 * 86400000) return;

  welcomeBackPending = true;
  try {
    localStorage.setItem(WELCOME_BACK_KEY, String(Date.now()));
  } catch (_) {}

  // Soft spark flair for 24h (self) — balance-free cosmetic welcome
  try {
    const st = pruneFlairState(loadFlairState());
    const now = Date.now();
    st.selfUntil = Math.max(st.selfUntil || 0, now + FLAIR_SPARK_MS);
    if (st.selfKind !== "duo" && st.selfKind !== "bond") st.selfKind = "spark";
    saveFlairState(st);
    refreshFlairUi();
  } catch (_) {}

  const days = info.idleDays || TRUST_DECAY_START_DAYS;
  try {
    showStarFeedbackToast("gift", {
      title: _t("stars.welcomeBackTitle") || "Welcome back ★",
      body:
        _t("stars.welcomeBackBody", { n: days }) ||
        `${days}d since last peer praise · trust softens when idle. Chat long and get ★ gifts to refresh.`,
    });
  } catch (_) {
    setStatus(_t("stars.welcomeBackTitle") || "Welcome back ★");
  }
  trackEvent("stars_welcome_back", { idle_days: days, trust: trustN });
}

/** After first long chat while welcome-back pending — close the loop. */
function maybeCompleteWelcomeBack() {
  if (!welcomeBackPending) return;
  welcomeBackPending = false;
  try {
    showStarFeedbackToast("gift", {
      title: _t("stars.welcomeBackDoneTitle") || "You’re active again",
      body:
        _t("stars.welcomeBackDoneBody") ||
        "Long chats refresh your path — peer ★ gifts rebuild trust.",
    });
  } catch (_) {}
  trackEvent("stars_welcome_back_done", {});
}

/** Render gifter floor dots (1…12) with marks at 5 and 12 + initials chips. */
function syncGiftersStrip(gifters) {
  const g = Math.max(0, Math.min(24, Math.floor(Number(gifters) || 0)));
  const strip = $("stars-gifters-strip");
  const countEl = $("stars-gifters-overview-count");
  const note = $("stars-gifters-strip-note");
  const slots = SENIOR_MIN_GIFTERS;
  if (countEl) {
    countEl.textContent = `${g} / ${slots}`;
  }
  try {
    syncGiverChips(myTrustGivers);
  } catch (_) {}
  if (strip) {
    const prev = strip.dataset.g;
    if (prev !== String(g) || !strip.childElementCount) {
      strip.dataset.g = String(g);
      strip.innerHTML = "";
      for (let i = 1; i <= slots; i++) {
        const dot = document.createElement("span");
        dot.className = "stars-gifter-dot";
        if (i <= g) dot.classList.add("is-filled");
        if (i === TRUSTED_MIN_GIFTERS) dot.classList.add("is-mark-trusted");
        if (i === SENIOR_MIN_GIFTERS) dot.classList.add("is-mark-senior");
        dot.title =
          i === TRUSTED_MIN_GIFTERS
            ? _t("stars.gifterMarkTrusted") || "Trusted floor · 5 gifters"
            : i === SENIOR_MIN_GIFTERS
              ? _t("stars.gifterMarkSenior") || "Senior floor · 12 gifters"
              : `Gifter ${i}`;
        strip.appendChild(dot);
      }
    } else {
      strip.querySelectorAll(".stars-gifter-dot").forEach((dot, idx) => {
        dot.classList.toggle("is-filled", idx < g);
      });
    }
    strip.setAttribute(
      "aria-label",
      _t("stars.giftersStripAria", { n: g, s: slots }) ||
        `${g} of ${slots} unique gifters`
    );
  }
  if (note) {
    if (g >= SENIOR_MIN_GIFTERS) {
      note.textContent =
        _t("stars.giftersNoteSenior") ||
        "12+ unique gifters — Senior floor met.";
    } else if (g >= TRUSTED_MIN_GIFTERS) {
      note.textContent =
        _t("stars.giftersNoteTrusted", {
          n: SENIOR_MIN_GIFTERS - g,
        }) ||
        `Trusted floor met · ${SENIOR_MIN_GIFTERS - g} more for Senior.`;
    } else if (g > 0) {
      note.textContent =
        _t("stars.giftersNoteProgress", {
          n: TRUSTED_MIN_GIFTERS - g,
        }) ||
        `${TRUSTED_MIN_GIFTERS - g} more unique gifters for Trusted floor.`;
    } else {
      note.textContent =
        _t("stars.giftersNoteEmpty") ||
        "Each person who gifts you after a chat fills one dot.";
    }
  }
  try {
    syncRepStory({
      trustN: myTrust,
      balN: myStars,
      effN: myTrustEffective,
      gifters: g,
    });
  } catch (_) {}
}

/** Days until soft decay starts / how far into decay. */
function trustDecayInfo(lastTs) {
  const last = Math.max(0, Math.floor(Number(lastTs) || 0));
  if (!last) {
    return { kind: "unknown", daysLeft: TRUST_DECAY_START_DAYS, idleDays: 0 };
  }
  const now = Math.floor(Date.now() / 1000);
  const idleDays = Math.max(0, Math.floor((now - last) / 86400));
  if (idleDays < TRUST_DECAY_START_DAYS) {
    return {
      kind: "fresh",
      daysLeft: TRUST_DECAY_START_DAYS - idleDays,
      idleDays,
    };
  }
  if (idleDays >= TRUST_DECAY_FULL_DAYS) {
    return { kind: "full", daysLeft: 0, idleDays };
  }
  return {
    kind: "decaying",
    daysLeft: TRUST_DECAY_FULL_DAYS - idleDays,
    idleDays,
  };
}

/** Power tab: balance / trust / gifters / decay / soft-rank map. */
function syncStarsPowerMap(state) {
  const balN = state.balN || 0;
  const trustN = state.trustN || 0;
  const effN = state.effN || 0;
  const g = state.gifters || 0;
  const isTrusted = !!state.isTrusted;
  const isSenior = !!state.isSenior;

  const balBody = $("stars-map-balance-body");
  if (balBody) {
    balBody.textContent =
      _t("stars.mapBalanceBody", { n: balN }) ||
      `★${balN} ready to spend on gifts and FX`;
  }
  const trustBody = $("stars-map-trust-body");
  if (trustBody) {
    if (effN !== trustN && trustN > 0) {
      trustBody.textContent =
        _t("stars.mapTrustBodyCapped", { raw: trustN, eff: effN, g }) ||
        `Raw ${trustN} · effective ${effN} (gifter floors) · ${g} gifters`;
    } else {
      trustBody.textContent =
        _t("stars.mapTrustBody", { n: trustN, g }) ||
        `★${trustN} from peer gifts · ${g} unique gifters`;
    }
  }
  const gBody = $("stars-map-gifters-body");
  if (gBody) {
    gBody.textContent =
      _t("stars.mapGiftersBody", {
        n: g,
        t: TRUSTED_MIN_GIFTERS,
        s: SENIOR_MIN_GIFTERS,
      }) ||
      `${g} people · need ${TRUSTED_MIN_GIFTERS} for Trusted · ${SENIOR_MIN_GIFTERS} for Senior`;
  }
  const decayBody = $("stars-map-decay-body");
  if (decayBody) {
    if (trustN <= 0) {
      decayBody.textContent =
        _t("stars.mapDecayNone") ||
        "No trust yet — peer gifts start the clock.";
    } else {
      const info = trustDecayInfo(myTrustLastTs);
      if (info.kind === "unknown") {
        decayBody.textContent =
          _t("stars.mapDecayUnknown") ||
          "Stay active with peer gifts — soft decay after 45 idle days.";
      } else if (info.kind === "fresh") {
        decayBody.textContent =
          _t("stars.mapDecayFresh", { d: info.daysLeft }) ||
          `Soft decay starts in ${info.daysLeft} day(s) without peer gifts.`;
      } else if (info.kind === "decaying") {
        decayBody.textContent =
          _t("stars.mapDecayActive", {
            idle: info.idleDays,
            d: info.daysLeft,
          }) ||
          `Soft decay active (${info.idleDays}d idle) · max at ${TRUST_DECAY_FULL_DAYS}d.`;
      } else {
        decayBody.textContent =
          _t("stars.mapDecayFull") ||
          "Idle decay at max (~50% soft cap). A peer gift refreshes you.";
      }
    }
  }
  const rankRow = $("stars-map-rank-row");
  const rankBody = $("stars-map-rank-body");
  if (rankRow) {
    if (isTrusted || isSenior) {
      rankRow.hidden = false;
      rankRow.removeAttribute("hidden");
      if (rankBody) {
        rankBody.textContent = isSenior
          ? _t("stars.mapRankSenior") ||
            "Senior soft-rank on when 3+ solos wait"
          : _t("stars.mapRankTrusted") ||
            "Trusted soft-rank on when 3+ solos wait";
      }
    } else {
      rankRow.hidden = true;
      rankRow.setAttribute("hidden", "");
    }
  }
}

/**
 * “Why am I stuck?” CTA when wealth high but trust low, or floors block tier.
 */
function syncStarsStuckCta(state) {
  const wrap = $("stars-stuck-cta-wrap");
  const btn = $("stars-stuck-cta");
  if (!wrap || !btn) return;
  const balN = state.balN || 0;
  const trustN = state.trustN || 0;
  const effN = state.effN || 0;
  const g = state.gifters || 0;
  const isTrusted = !!state.isTrusted;
  const isSenior = !!state.isSenior;
  let label = "";
  if (!isSenior && trustN >= STARS_SENIOR_GOAL && g < SENIOR_MIN_GIFTERS) {
    label =
      _t("stars.stuckNeedGiftersSenior", {
        n: SENIOR_MIN_GIFTERS - g,
      }) ||
      `Need ${SENIOR_MIN_GIFTERS - g} more unique gifters for Senior — chat longer so new people can gift you`;
  } else if (
    !isTrusted &&
    trustN >= STARS_TRUSTED_GOAL &&
    g < TRUSTED_MIN_GIFTERS
  ) {
    label =
      _t("stars.stuckNeedGiftersTrusted", {
        n: TRUSTED_MIN_GIFTERS - g,
      }) ||
      `Need ${TRUSTED_MIN_GIFTERS - g} more unique gifters for Trusted — peer ★ after long chats`;
  } else if (!isTrusted && balN >= 50 && trustN < STARS_TRUSTED_GOAL) {
    label =
      _t("stars.stuckWealthPath", { n: balN }) ||
      `★${balN} is for gifts · Trust grows only when others gift you after chats`;
  } else if (!isTrusted && trustN > 0 && trustN < STARS_TRUSTED_GOAL) {
    const left = STARS_TRUSTED_GOAL - trustN;
    label =
      _t("stars.stuckTrustLeft", { n: left, g }) ||
      `${left} more peer trust to Trusted · ${g} gifters so far`;
  } else if (trustN > effN && effN > 0) {
    label =
      _t("stars.stuckCapped", { raw: trustN, eff: effN, g }) ||
      `Raw trust ${trustN} · effective ${effN} (need more unique gifters · have ${g})`;
  }
  if (!label) {
    wrap.hidden = true;
    wrap.setAttribute("hidden", "");
    btn.textContent = "";
    return;
  }
  wrap.hidden = false;
  wrap.removeAttribute("hidden");
  btn.textContent = label;
  if (!btn.dataset.wired) {
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => {
      try {
        setStarsSheetTab("overview");
        const earn = document.querySelector(
          "#stars-panel-overview .stars-earn-group"
        );
        earn?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
        trackEvent("stars_stuck_cta", {});
      } catch (_) {}
    });
  }
}

function wireStarsStuckCtaOnce() {
  // no-op alias — wiring happens in syncStarsStuckCta
}

/** Mirror bridge gifter floors (decay is hub-only). */
function clientEffectiveTrust(raw, gifters) {
  let t = Math.max(0, Math.floor(Number(raw) || 0));
  const g = Math.max(0, Math.floor(Number(gifters) || 0));
  if (g < TRUSTED_MIN_GIFTERS) t = Math.min(t, STARS_TRUSTED_GOAL - 1);
  else if (g < SENIOR_MIN_GIFTERS) t = Math.min(t, STARS_SENIOR_GOAL - 1);
  return t;
}

function starsSheetIsOpen() {
  const sheet = $("stars-sheet");
  return !!(sheet && !sheet.hidden && sheet.classList.contains("is-open"));
}

function closeStarGiftPop() {
  // legacy alias
  closeStarsSheet();
}

/** Stars needed for report weight tiers (must match bridge). */
const STARS_TRUSTED_GOAL = 100; // weight ×2
const STARS_SENIOR_GOAL = 250; // weight ×3 — bans faster

/** Report weight for current stars (mirrors bridge report_weight_for). */
function reportWeightForStars(stars) {
  const n = Math.max(0, Number(stars) || 0);
  if (n >= STARS_SENIOR_GOAL) return 3;
  if (n >= STARS_TRUSTED_GOAL) return 2;
  return 1;
}

/**
 * Human tier key from trust score.
 * @returns {"new"|"known"|"trusted"|"senior"}
 */
function trustTierKey(trust) {
  const n = Math.max(0, Number(trust) || 0);
  if (n >= STARS_SENIOR_GOAL) return "senior";
  if (n >= STARS_TRUSTED_GOAL) return "trusted";
  if (n > 0) return "known";
  return "new";
}

function trustTierLabel(trust) {
  const key = trustTierKey(trust);
  if (key === "senior") return _t("stars.chipSenior") || "Senior";
  if (key === "trusted") return _t("stars.chipTrusted") || "Trusted";
  if (key === "known") return _t("stars.chipKnown") || "Known";
  return _t("stars.chipNew") || "New";
}

/**
 * Compact tier chip on video tiles (match-time reputation signal).
 * @param {"local"|"remote"} which
 * @param {number} trust
 * @param {{ forceShow?: boolean }} [opts]
 */
function setTrustTierChip(which, trust, opts = {}) {
  const id = which === "local" ? "local-trust-chip" : "remote-trust-chip";
  const el = $(id);
  if (!el) return;
  const n = Math.max(0, Math.floor(Number(trust) || 0));
  const key = trustTierKey(n);
  const live = !!(matched || inFriendCall);
  // Local: show during live or when trust > 0. Remote: during live always.
  const show =
    opts.forceShow ||
    (which === "remote" ? live : live || n > 0);
  el.classList.remove(
    "tier-new",
    "tier-known",
    "tier-trusted",
    "tier-senior",
    "is-live"
  );
  el.classList.add(`tier-${key}`);
  if (live) el.classList.add("is-live");
  el.textContent = trustTierLabel(n);
  el.dataset.trust = String(n);
  el.dataset.tier = key;
  const tip =
    key === "senior"
      ? _t("stars.chipSeniorTip") ||
        "Senior · soft match rank · gift up to 3★ · harder to auto-ban"
      : key === "trusted"
        ? _t("stars.chipTrustedTip") ||
          "Trusted · soft match rank · gift up to 2★"
        : key === "known"
          ? _t("stars.chipKnownTip", { n }) || `Known · trust ${n}`
          : _t("stars.chipNewTip") || "New · no peer gifts yet";
  el.title = tip;
  el.setAttribute("aria-label", tip);
  el.hidden = !show;
  if (show) el.removeAttribute("hidden");
  else el.setAttribute("hidden", "");
  if (which === "local") syncLocalSoftRankChip(n);
  if (which === "remote") syncRemoteMutualChip();
}

/** Local cam: show soft-rank when Trusted/Senior (matchmaking boost). */
function syncLocalSoftRankChip(trust) {
  const el = $("local-soft-rank-chip");
  if (!el) return;
  const n = Math.max(0, Math.floor(Number(trust != null ? trust : myTrustEffective || myTrust) || 0));
  const on = n >= STARS_TRUSTED_GOAL;
  const live = !!(matched || inFriendCall);
  const show = on && (live || n > 0);
  el.hidden = !show;
  if (show) el.removeAttribute("hidden");
  else el.setAttribute("hidden", "");
  el.classList.toggle("is-senior", n >= STARS_SENIOR_GOAL);
  el.title =
    _t("stars.softRankTip") ||
    "Soft match rank on — better mix when the lobby is busy";
  el.setAttribute("aria-label", el.title);
}

/** Remote: mutual-friend bond chip (graph signal, not stars). */
function syncRemoteMutualChip() {
  const el = $("remote-mutual-chip");
  if (!el) return;
  const uid = String(primaryPartnerUserId || lastMatchMeta?.user_id || "").trim();
  const live = !!(matched || inFriendCall);
  let mutual = false;
  try {
    mutual = !!(uid && typeof isMutualFriend === "function" && isMutualFriend(uid));
  } catch (_) {
    mutual = false;
  }
  // Prefer stronger ★ mutual bond if friends list says so
  let mutualStar = false;
  try {
    const fr = (friendsCache || []).find((f) => f && f.user_id === uid);
    mutualStar = !!(fr && fr.mutual_star);
  } catch (_) {}
  const show = live && (mutual || mutualStar);
  el.hidden = !show;
  if (show) el.removeAttribute("hidden");
  else el.setAttribute("hidden", "");
  if (show) {
    if (mutualStar) {
      el.textContent = _t("stars.mutualStarChip") || "★↔";
      el.title =
        _t("stars.mutualStarTip") || "You both gifted each other ★";
      el.classList.add("is-star-bond");
    } else {
      el.textContent = _t("stars.mutualChip") || "↔ friend";
      el.title =
        _t("stars.mutualChipTip") || "Mutual friend — real social bond";
      el.classList.remove("is-star-bond");
    }
    el.setAttribute("aria-label", el.title);
  }
}

/** Partner social proof: “praised by N”. */
function syncPartnerPraiseChip(opts = {}) {
  const el = $("remote-praise-chip");
  if (!el) return;
  const live = !!(matched || inFriendCall);
  const g =
    opts.gifters != null
      ? Math.max(0, Number(opts.gifters) || 0)
      : Math.max(0, Number(partnerTrustGifters) || 0);
  const trust =
    opts.trust != null
      ? Math.max(0, Number(opts.trust) || 0)
      : Math.max(0, Number(partnerTrust) || 0);
  const show = live && (g > 0 || trust > 0);
  el.hidden = !show;
  if (show) el.removeAttribute("hidden");
  else el.setAttribute("hidden", "");
  if (!show) {
    el.textContent = "";
    return;
  }
  if (g > 0) {
    el.textContent =
      _t("stars.praisedByN", { n: g }) || `praised by ${g}`;
    el.title =
      _t("stars.praisedByTip", { n: g, t: trust }) ||
      `${g} unique people gifted them ★ after chats` +
        (trust ? ` · trust ${trust}` : "");
  } else {
    el.textContent =
      _t("stars.praiseTrustOnly", { t: trust }) || `trust ${trust}`;
    el.title =
      _t("stars.praiseTrustOnlyTip", { t: trust }) ||
      `Public trust ${trust} · no gifter count yet`;
  }
  el.setAttribute("aria-label", el.title);
  el.classList.toggle("is-hot", g >= TRUSTED_MIN_GIFTERS);
}

function clearTrustTierChips() {
  setTrustTierChip("remote", 0, { forceShow: false });
  const remote = $("remote-trust-chip");
  if (remote) {
    remote.hidden = true;
    remote.setAttribute("hidden", "");
  }
  const mutual = $("remote-mutual-chip");
  if (mutual) {
    mutual.hidden = true;
    mutual.setAttribute("hidden", "");
  }
  setTrustTierChip("local", myTrust);
  syncLocalSoftRankChip(myTrustEffective || myTrust);
}

/** Spendable-balance “wealth” level for chrome (independent of trust tier). */
function starsWealthLevel(balance) {
  const b = Math.max(0, Number(balance) || 0);
  if (b >= 250) return 4;
  if (b >= 100) return 3;
  if (b >= 50) return 2;
  if (b >= 10) return 1;
  return 0;
}

function syncStarsSheetUi() {
  const balN = Math.max(0, Number(myStars) || 0);
  const trustN = Math.max(0, Number(myTrust) || 0);
  const effN = Math.max(
    0,
    Number(myTrustEffective) || clientEffectiveTrust(trustN, myTrustGifters)
  );
  /** Ladder / trust tier uses effective trust (peer gifts + floors) */
  const n = effN;
  const w = reportWeightForStars(n);
  const isSenior = n >= STARS_SENIOR_GOAL;
  const isTrusted = n >= STARS_TRUSTED_GOAL;
  const wealth = starsWealthLevel(balN);
  const live = !!(matched || inFriendCall);
  const hasPartner = !!(primaryPartnerUserId || lastMatchMeta?.user_id);

  const bal = $("stars-sheet-balance");
  if (bal) bal.textContent = String(balN);
  const balChip = $("stars-sheet-balance-chip");
  if (balChip) balChip.textContent = String(balN);
  try {
    const dualBal = document.querySelector(".stars-dual-chip.is-balance");
    dualBal?.classList.toggle("is-hot", wealth >= 3);
  } catch (_) {}
  const trustEl = $("stars-sheet-trust");
  if (trustEl) {
    trustEl.textContent =
      effN !== trustN ? `${trustN}→${effN}` : String(trustN);
  }
  const giftersEl = $("stars-sheet-gifters");
  if (giftersEl) {
    giftersEl.textContent = String(Math.max(0, Number(myTrustGifters) || 0));
  }
  const floorEl = $("stars-gifters-floor-hint");
  if (floorEl) {
    const g = Math.max(0, Number(myTrustGifters) || 0);
    // High balance but no peer trust — explain the dual system
    if (balN >= 50 && trustN < STARS_TRUSTED_GOAL) {
      floorEl.hidden = false;
      floorEl.textContent =
        _t("stars.wealthNoTrust", { n: balN, need: STARS_TRUSTED_GOAL }) ||
        `★${balN} ready to spend · Trust grows only from peer gifts (need ${STARS_TRUSTED_GOAL} trust for Trusted).`;
    } else if (trustN >= STARS_SENIOR_GOAL && g < SENIOR_MIN_GIFTERS) {
      floorEl.hidden = false;
      floorEl.textContent =
        _t("stars.floorSenior", { n: SENIOR_MIN_GIFTERS, have: g }) ||
        `Need ${SENIOR_MIN_GIFTERS} unique gifters for senior (have ${g}).`;
    } else if (trustN >= STARS_TRUSTED_GOAL && g < TRUSTED_MIN_GIFTERS) {
      floorEl.hidden = false;
      floorEl.textContent =
        _t("stars.floorTrusted", { n: TRUSTED_MIN_GIFTERS, have: g }) ||
        `Need ${TRUSTED_MIN_GIFTERS} unique gifters for trusted (have ${g}).`;
    } else if (g < TRUSTED_MIN_GIFTERS && trustN > 0) {
      floorEl.hidden = false;
      floorEl.textContent =
        _t("stars.floorHint", {
          n: TRUSTED_MIN_GIFTERS,
          have: g,
          s: SENIOR_MIN_GIFTERS,
        }) ||
        `Trusted needs ${TRUSTED_MIN_GIFTERS}+ gifters · senior ${SENIOR_MIN_GIFTERS}+ (you have ${g}).`;
    } else {
      floorEl.hidden = true;
    }
  }

  // Hero: social status chip + wealth chrome (balance can look premium even if trust is low)
  const chip = $("stars-tier-chip");
  if (chip) {
    if (isSenior) {
      chip.textContent = _t("stars.chipSenior") || "Senior";
      chip.title =
        _t("stars.chipSeniorTip") ||
        "Senior · soft match rank · gift up to 3★ · harder to auto-ban";
    } else if (isTrusted) {
      chip.textContent = _t("stars.chipTrusted") || "Trusted";
      chip.title =
        _t("stars.chipTrustedTip") ||
        "Trusted · soft match rank · gift up to 2★";
    } else if (wealth >= 4) {
      // 250+ spendable ★ — unmistakable legend pill (trust may still be ×1)
      chip.textContent =
        _t("stars.chipWealthLegend") || "✦✦ legend";
      chip.title =
        _t("stars.chipWealthTip") ||
        "High balance for gifts — peer ★ still build Trust separately";
    } else if (wealth >= 3) {
      chip.textContent =
        _t("stars.chipWealthRich") || "✦ rich";
      chip.title =
        _t("stars.chipWealthTip") ||
        "High balance for gifts — peer ★ still build Trust separately";
    } else if (wealth >= 1) {
      chip.textContent =
        _t("stars.chipWealthUp") || "✦";
      chip.title =
        _t("stars.chipWealthTip") ||
        "Growing balance for gifts";
    } else {
      chip.textContent = `×${w}`;
      chip.title = "";
    }
    chip.dataset.tier = String(w);
    chip.dataset.wealth = String(wealth);
    chip.classList.toggle("is-trusted", w === 2);
    chip.classList.toggle("is-senior", w >= 3);
    chip.classList.toggle("is-wealth", wealth >= 2 && w < 2);
    chip.classList.toggle("is-wealth-legend", wealth >= 4 && w < 3);
  }
  const tierName = $("stars-tier-name");
  if (tierName) {
    // Dynamic label — strip data-i18n so a later applyI18n cannot clobber wealth text
    try {
      tierName.removeAttribute("data-i18n");
    } catch (_) {}
    if (isSenior) {
      tierName.textContent =
        _t("stars.tierSenior") || "Senior";
    } else if (isTrusted) {
      tierName.textContent =
        _t("stars.tierTrusted") || "Trusted";
    } else if (wealth >= 4) {
      tierName.textContent =
        _t("stars.tierWealthLegend") || "Legendary balance";
    } else if (wealth >= 3) {
      tierName.textContent =
        _t("stars.tierWealthGold") || "Rich balance";
    } else if (wealth >= 2) {
      tierName.textContent =
        _t("stars.tierWealthSilver") || "Solid balance";
    } else if (trustN > 0) {
      tierName.textContent = _t("stars.chipKnown") || "Known";
    } else {
      tierName.textContent = _t("stars.chipNew") || "New";
    }
  }
  const hero = $("stars-sheet-hero");
  if (hero) {
    hero.classList.toggle("is-normal", !isTrusted && !isSenior);
    hero.classList.toggle("is-trusted", isTrusted && !isSenior);
    hero.classList.toggle("is-senior", isSenior);
    hero.classList.remove(
      "is-wealth-1",
      "is-wealth-2",
      "is-wealth-3",
      "is-wealth-4"
    );
    if (wealth >= 1) hero.classList.add(`is-wealth-${wealth}`);
    hero.dataset.wealth = String(wealth);
    hero.dataset.balance = String(balN);
  }
  // One-line “what this unlocks” — dual system after brigade v1
  const unlock = $("stars-unlock-line");
  if (unlock) {
    if (isSenior) {
      unlock.textContent =
        _t("stars.unlockSeniorV2") ||
        "Senior · gift up to 3★ · soft match rank · stronger shield";
    } else if (isTrusted) {
      unlock.textContent =
        _t("stars.unlockTrustedV2") ||
        "Trusted · gift up to 2★ · soft match rank · 250 trust → Senior";
    } else if (balN >= 50 && trustN < STARS_TRUSTED_GOAL) {
      unlock.textContent =
        _t("stars.unlockWealthOnly", { n: balN }) ||
        `★${balN} for gifts · peer ★ gifts build Trust (100 → Trusted)`;
    } else {
      unlock.textContent =
        _t("stars.unlockNormalV2") ||
        "Balance = gifts · Trust = peer ★ · 100 trust → Trusted status";
    }
  }

  // Early-rate ramp copy on earn step
  const earnTitle = document.querySelector(
    '#stars-panel-overview [data-i18n="stars.earnStep1Title"]'
  );
  const earnBody = document.querySelector(
    '#stars-panel-overview [data-i18n="stars.earnStep1BodyShort"]'
  );
  const needM = Math.max(1, Math.round((starRateMinSecs || STAR_MIN_SECS) / 60));
  if (earnTitle) {
    if (earlyRatesLeft > 0) {
      earnTitle.textContent =
        _t("stars.earnStep1TitleEarly", { m: needM, n: earlyRatesLeft }) ||
        `Gift after ${needM}+ min (first chats)`;
    } else {
      earnTitle.textContent =
        _t("stars.earnStep1Title") || "Gift after 15+ minutes";
    }
  }
  if (earnBody) {
    if (earlyRatesLeft > 0) {
      earnBody.textContent =
        _t("stars.earnStep1BodyEarly", { n: earlyRatesLeft, m: needM }) ||
        `${earlyRatesLeft} early unlocks left · then 15 min`;
    } else {
      earnBody.textContent =
        _t("stars.earnStep1BodyShort") || "Optional stars once per person";
    }
  }
  // Overall progress 0→250 **trust** with marks at 100 and 250
  const fill = $("stars-progress-fill");
  const countEl = $("stars-progress-count");
  const bar = $("stars-progress-bar");
  const hintProg = $("stars-progress-hint");
  const wrap = $("stars-progress-wrap");
  const label = $("stars-progress-label");
  const pctOverall = Math.min(
    100,
    Math.round((n / STARS_SENIOR_GOAL) * 1000) / 10
  );
  if (fill) fill.style.width = pctOverall + "%";
  if (countEl) {
    if (isSenior) {
      countEl.textContent =
        _t("stars.progressDoneSenior", { n }) || `trust ${n} · max`;
    } else if (isTrusted) {
      countEl.textContent = `${n} / ${STARS_SENIOR_GOAL}`;
    } else {
      countEl.textContent = `${n} / ${STARS_TRUSTED_GOAL}`;
    }
  }
  // Senior: compact “maxed” progress chrome
  if (wrap) {
    wrap.classList.toggle("is-maxed", isSenior);
  }
  if (bar) {
    bar.setAttribute("aria-valuenow", String(Math.min(n, STARS_SENIOR_GOAL)));
    bar.setAttribute("aria-valuemax", String(STARS_SENIOR_GOAL));
  }
  if (wrap) {
    wrap.classList.toggle("is-trusted", isTrusted && !isSenior);
    wrap.classList.toggle("is-senior", isSenior);
  }
  if (label) {
    label.textContent = isSenior
      ? _t("stars.progressLabelSenior") || "Senior status"
      : isTrusted
        ? _t("stars.progressLabelNext") || "Next: Senior"
        : _t("stars.progressLabel") || "Trusted status";
  }
  if (hintProg) {
    const g = Math.max(0, Number(myTrustGifters) || 0);
    const rawLeftTrusted = Math.max(0, STARS_TRUSTED_GOAL - trustN);
    const rawLeftSenior = Math.max(0, STARS_SENIOR_GOAL - trustN);
    const hintSub = $("stars-progress-hint-sub");
    const setSub = (text) => {
      if (!hintSub) return;
      if (text) {
        hintSub.textContent = text;
        hintSub.hidden = false;
        hintSub.removeAttribute("hidden");
      } else {
        hintSub.textContent = "";
        hintSub.hidden = true;
        hintSub.setAttribute("hidden", "");
      }
    };
    if (isSenior) {
      hintProg.textContent =
        _t("stars.progressSeniorV2", { g }) ||
        `Senior trust · gift up to 3★ · ${g} gifters.`;
      setSub(
        _t("stars.progressSeniorSub") ||
          "Other seniors can’t auto-ban you."
      );
    } else if (isTrusted) {
      hintProg.textContent =
        _t("stars.progressHintSeniorLeftV2", { n: rawLeftSenior, g }) ||
        `Trusted · ${rawLeftSenior} more trust to senior.`;
      setSub(
        g < SENIOR_MIN_GIFTERS
          ? _t("stars.needGiftersSeniorClean", {
              n: SENIOR_MIN_GIFTERS - g,
              have: g,
            }) ||
              `Need ${SENIOR_MIN_GIFTERS - g} more unique gifters (have ${g}).`
          : ""
      );
    } else {
      // Keep balance out of this line — hero already shows it
      hintProg.textContent =
        balN >= 50
          ? _t("stars.progressHintWealth", { b: balN, n: rawLeftTrusted }) ||
            `★${balN} to spend · ${rawLeftTrusted} peer trust to Trusted status.`
          : _t("stars.progressHintLeftShortV2", { n: rawLeftTrusted }) ||
            `${rawLeftTrusted} more peer trust to Trusted.`;
      setSub(
        g < TRUSTED_MIN_GIFTERS
          ? _t("stars.needGiftersTrustedClean", {
              n: TRUSTED_MIN_GIFTERS - g,
              have: g,
            }) ||
              `Need ${TRUSTED_MIN_GIFTERS - g} more unique gifters (have ${g}).`
          : _t("stars.progressHintTrustOnly") ||
              "Trust comes only from peer ★ gifts after chat."
      );
    }
  }

  // Ladder highlight current tier
  document.querySelectorAll("#stars-ladder .stars-ladder-step").forEach((el) => {
    const t = Number(el.getAttribute("data-tier") || 0);
    el.classList.toggle("is-current", t === w);
    el.classList.toggle("is-done", t < w);
  });

  // Gifter progress strip (unique peers · floors at 5 and 12)
  try {
    syncGiftersStrip(Math.max(0, Number(myTrustGifters) || 0));
  } catch (_) {}

  // Soft-rank pill under hero
  try {
    const rankPill = $("stars-soft-rank-pill");
    if (rankPill) {
      if (isTrusted || isSenior) {
        rankPill.hidden = false;
        rankPill.removeAttribute("hidden");
        rankPill.textContent =
          _t("stars.softRankOn") ||
          "↗ Soft match rank on · better mix when lobby is busy";
        rankPill.classList.toggle("is-senior", isSenior);
      } else {
        rankPill.hidden = true;
        rankPill.setAttribute("hidden", "");
        rankPill.textContent = "";
      }
    }
    syncLocalSoftRankChip(n);
  } catch (_) {}

  // Power tab social map
  try {
    syncStarsPowerMap({
      balN,
      trustN,
      effN: n,
      gifters: Math.max(0, Number(myTrustGifters) || 0),
      isTrusted,
      isSenior,
    });
  } catch (_) {}

  // Stuck-floor CTA (high balance / raw trust but floors or peer path blocked)
  try {
    syncStarsStuckCta({
      balN,
      trustN,
      effN: n,
      gifters: Math.max(0, Number(myTrustGifters) || 0),
      isTrusted,
      isSenior,
    });
  } catch (_) {}

  // Milestones (safe to call often — one-shot keys)
  maybeStarsMilestones({ gifters: myTrustGifters, balance: balN });

  // Trust body note
  const trust = $("stars-sheet-trust-body");
  if (trust) {
    if (isSenior) {
      trust.textContent =
        _t("stars.trustYouAreSeniorV2") ||
        "Senior status · gift up to 3★ · soft match rank · stronger shield.";
    } else if (isTrusted) {
      trust.textContent =
        _t("stars.trustYouAreV2") ||
        "Trusted status · gift up to 2★ · soft match rank · 250 trust → Senior.";
    } else if (balN >= 50) {
      trust.textContent =
        _t("stars.trustWealthOnlyBody", { n: balN }) ||
        `You have ★${balN} to spend on gifts. Trust only rises when others gift you after chats.`;
    } else {
      trust.textContent =
        _t("stars.trustStepBodyV2") ||
        "Balance spends on gifts. Trust from peer ★ unlocks status, gift limits, and soft match help.";
    }
  }

  // Live partner line
  const liveLine = $("stars-live-line");
  if (liveLine) {
    if (live && hasPartner) {
      const name =
        (lastMatchMeta?.name || "").trim() ||
        _t("partnerMenu.title") ||
        "Partner";
      const ps = Math.max(0, Number(partnerStars) || 0);
      liveLine.hidden = false;
      liveLine.removeAttribute("hidden");
      liveLine.textContent =
        _t("stars.liveWithPartner", { name, n: ps }) ||
        `Live with ${name} · they have ★ ${ps}`;
    } else {
      liveLine.hidden = true;
      liveLine.setAttribute("hidden", "");
      liveLine.textContent = "";
    }
  }

  // Gifts — enable each card by its own cost
  const minCost = 1;
  const hint = $("stars-sheet-gift-hint");
  if (hint) {
    if (!live) {
      hint.textContent =
        _t("stars.spendIdleHint") ||
        "Start a live chat to unlock gifts below.";
    } else if (!hasPartner) {
      hint.textContent =
        _t("stars.noPartner") || "No one to gift right now";
    } else if (n < minCost) {
      hint.textContent =
        _t("stars.needStars", { n: minCost, have: n }) ||
        `Need ${minCost}★ (you have ${n})`;
    } else {
      hint.textContent =
        _t("stars.spendLiveHint") ||
        "Tap a gift to send it to the person you’re chatting with.";
    }
    hint.hidden = false;
  }
  const giftsBox = $("stars-sheet-gifts");
  if (giftsBox) giftsBox.classList.toggle("is-live", !!(live && hasPartner));
  document.querySelectorAll("#stars-sheet-gifts [data-effect]").forEach((b) => {
    const kind = b.getAttribute("data-effect") || "";
    const cost = giftCost(kind);
    const ok = live && hasPartner && n >= cost;
    b.disabled = !ok;
    b.classList.toggle("is-disabled", !ok);
    b.setAttribute("aria-disabled", ok ? "false" : "true");
  });
}

/**
 * Open Stars guide sheet (settings-style). Always available on ★ click.
 * @param {HTMLElement | null} [_anchor]
 */
/** Compact glass Stars popover sizing (wider, shorter than Settings). */
function starsFlyoutMaxHeight() {
  const vh = window.innerHeight || 640;
  return Math.min(vh * 0.78, 640);
}

function positionStarsSheet(sheet) {
  if (!sheet) return;
  const maxH = starsFlyoutMaxHeight();
  const anchor = $("local-stars-badge") || $("btn-settings");
  try {
    positionDockFlyout(sheet, anchor, {
      align: "end",
      maxWidth: 448,
      maxHeight: maxH,
      fixedHeight: false,
    });
  } catch (_) {
    sheet.style.right = "0.75rem";
    sheet.style.bottom = "4.5rem";
    sheet.style.width = "min(448px, calc(100vw - 1rem))";
  }
  // Measure natural content height, then clamp so .settings-body can scroll
  // (height:auto + max-height alone clips without enabling child scroll).
  sheet.style.maxHeight = `${maxH}px`;
  sheet.style.height = "auto";
  void sheet.offsetHeight;
  const natural = Math.ceil(sheet.scrollHeight || 0);
  const h = Math.max(220, Math.min(natural || maxH, maxH));
  sheet.style.height = `${h}px`;
}

/** Switch Stars sheet tab: overview | gifts | power */
function setStarsSheetTab(tab) {
  const t = ["overview", "gifts", "power"].includes(tab) ? tab : "overview";
  const sheet = $("stars-sheet");
  if (sheet) sheet.dataset.activeTab = t;
  const root = sheet || document;
  root.querySelectorAll(".stars-tab").forEach((btn) => {
    const on = btn.getAttribute("data-stars-tab") === t;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
    btn.tabIndex = on ? 0 : -1;
  });
  root.querySelectorAll(".stars-panel").forEach((panel) => {
    const on = panel.getAttribute("data-stars-panel") === t;
    panel.classList.toggle("is-active", on);
    if (on) {
      panel.hidden = false;
      panel.removeAttribute("hidden");
      panel.style.removeProperty("display");
    } else {
      panel.hidden = true;
      panel.setAttribute("hidden", "");
      panel.style.display = "none";
    }
  });
  if (sheet?.classList.contains("is-open")) {
    // Re-measure height after panel swap
    requestAnimationFrame(() => {
      try {
        positionStarsSheet(sheet);
      } catch (_) {}
    });
  }
}

function wireStarsSheetTabs() {
  const nav = $("stars-tabs");
  if (!nav || nav.dataset.wired) return;
  nav.dataset.wired = "1";
  nav.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("[data-stars-tab]");
    if (!btn) return;
    setStarsSheetTab(btn.getAttribute("data-stars-tab") || "overview");
    trackEvent("stars_tab", { tab: btn.getAttribute("data-stars-tab") || "" });
  });
}

function openStarsSheet(_anchor) {
  try {
    closePartnerMenu();
    closeStarGiftPop();
  } catch (_) {}
  closeAllDockFlyouts?.("stars");
  const sheet = $("stars-sheet");
  const bd = $("sheet-backdrop");
  if (!sheet) return;
  wireStarsSheetTabs();
  try {
    NextfaceI18n?.applyI18n?.(sheet);
  } catch (_) {}
  syncStarsSheetUi();
  // Live chat → Gifts first; otherwise Overview
  const live = !!(matched || inFriendCall);
  setStarsSheetTab(live ? "gifts" : "overview");
  sheet.hidden = false;
  sheet.removeAttribute("hidden");
  positionStarsSheet(sheet);
  void sheet.offsetWidth;
  sheet.classList.add("is-open");
  if (bd) {
    bd.hidden = false;
    bd.removeAttribute("hidden");
    bd.classList.add("is-open");
  }
  bindSheetFocusTrap?.(sheet);
  trackEvent("stars_sheet_open", {
    stars: myStars || 0,
    live: live ? 1 : 0,
    tab: live ? "gifts" : "overview",
  });
}

function closeStarsSheet() {
  const sheet = $("stars-sheet");
  const bd = $("sheet-backdrop");
  releaseSheetFocusTrap?.(sheet);
  sheet?.classList.remove("is-open");
  // Only hide backdrop if no other sheets open
  const otherOpen =
    settingsIsOpen() ||
    friendsIsOpen() ||
    (typeof messagesIsOpen === "function" && messagesIsOpen());
  if (!otherOpen) {
    bd?.classList.remove("is-open");
  }
  setTimeout(() => {
    if (sheet && !sheet.classList.contains("is-open")) {
      sheet.hidden = true;
      sheet.setAttribute("hidden", "");
    }
    if (bd && !otherOpen && !settingsIsOpen() && !friendsIsOpen()) {
      bd.hidden = true;
    }
  }, 160);
}

function openStarGiftPop(_anchor) {
  openStarsSheet(_anchor);
}

function wireStarBadgeInteractions() {
  const onBadgeActivate = (which, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const badge = $(which === "local" ? "local-stars-badge" : "remote-stars-badge");
    if (!badge || badge.hidden) return;
    openStarsSheet(badge);
  };
  ["local", "remote"].forEach((which) => {
    const badge = $(which === "local" ? "local-stars-badge" : "remote-stars-badge");
    if (!badge || badge.dataset.starWired) return;
    badge.dataset.starWired = "1";
    badge.addEventListener("click", (e) => onBadgeActivate(which, e));
  });
  $("btn-stars-sheet-back")?.addEventListener("click", () => closeStarsSheet());
  // Gift cards (any data-effect)
  $("stars-sheet-gifts")?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("[data-effect]");
    if (!btn || btn.disabled) return;
    e.stopPropagation();
    if (!matched && !inFriendCall) {
      setStatus(_t("stars.needLive") || "Only during a live chat");
      return;
    }
    const kind = btn.getAttribute("data-effect") || "";
    closeStarsSheet();
    spendEffectOnPartner(kind);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && starsSheetIsOpen()) closeStarsSheet();
  });
}

function clearPartnerStarsBadge() {
  partnerStars = 0;
  partnerTrust = 0;
  partnerTrustGifters = 0;
  setStarsBadge("remote", 0);
  try {
    const pc = $("remote-praise-chip");
    if (pc) {
      pc.hidden = true;
      pc.setAttribute("hidden", "");
      pc.textContent = "";
    }
  } catch (_) {}
  try {
    const chip = $("remote-trust-chip");
    if (chip) {
      chip.hidden = true;
      chip.setAttribute("hidden", "");
    }
  } catch (_) {}
  try {
    closeStarGiftPop();
  } catch (_) {}
}

/**
 * Post-call star gift: keep partner ★ badge off (they're gone) and play a
 * short award animation in the conversationalist / empty partner window.
 * @param {{ amount?: number, name?: string, total?: number }} [opts]
 */
function playPostCallStarAwardFx(opts = {}) {
  try {
    // Never leave their ★ chip on an empty tile after hangup
    clearPartnerStarsBadge();
    const tile = $("tile-remote");
    if (!tile) return;
    tile.querySelectorAll(".star-award-fx").forEach((n) => n.remove());
    const amount = Math.max(1, Math.min(5, Number(opts.amount) || 1));
    const name = String(opts.name || "").trim().slice(0, 24);
    const total = Math.max(0, Number(opts.total) || 0);
    const fx = document.createElement("div");
    // Intensity scales with gift amount (1–3 common; up to 5 for big gifts)
    const intensity = amount >= 3 ? 3 : amount >= 2 ? 2 : 1;
    fx.className = `star-award-fx star-award-lv${intensity}`;
    fx.setAttribute("aria-hidden", "true");
    fx.dataset.amount = String(amount);
    const sparkCount = intensity === 3 ? 14 : intensity === 2 ? 10 : 7;
    let sparkles = "";
    for (let i = 0; i < sparkCount; i++) {
      sparkles += `<span class="star-award-spark" style="--i:${i};--n:${sparkCount}" aria-hidden="true">★</span>`;
    }
    const plus =
      amount > 1
        ? `★ +${amount}`
        : _t("stars.awardFxTitle") || "★ Awarded";
    const sub = total
      ? _t("stars.awardFxBody", { n: total, name: name || "them" }) ||
        (name ? `${name} · total ★ ${total}` : `Total ★ ${total}`)
      : name || "";
    const burstGlyph = intensity >= 3 ? "★★★" : intensity === 2 ? "★★" : "★";
    fx.innerHTML = `
      <div class="star-award-core">
        <span class="star-award-burst" aria-hidden="true">${burstGlyph}</span>
        <span class="star-award-label">${escapeHtml(plus)}</span>
        ${sub ? `<span class="star-award-sub">${escapeHtml(sub)}</span>` : ""}
      </div>
      <div class="star-award-sparks">${sparkles}</div>`;
    tile.appendChild(fx);
    // Haptic scales with amount
    try {
      softHaptic?.(
        intensity >= 3
          ? [18, 28, 22, 28, 40]
          : intensity === 2
            ? [14, 28, 22]
            : [12, 30, 18]
      );
    } catch (_) {}
    const holdMs = intensity >= 3 ? 2000 : 1600;
    const outMs = holdMs + 500;
    setTimeout(() => {
      try {
        fx.classList.add("is-out");
      } catch (_) {}
    }, holdMs);
    setTimeout(() => {
      try {
        fx.remove();
      } catch (_) {}
    }, outMs);
  } catch (_) {}
}
/** Keep your ★ visible/clickable during a live chat. */
function refreshLocalStarsVisibility() {
  setStarsBadge("local", myStars, { trust: myTrust });
  if (matched || inFriendCall) {
    setStarsBadge("remote", partnerStars);
  }
}

function unixNowSec() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Apply or clear a star gift overlay on a tile.
 * @param {"local"|"remote"} which
 * @param {string} kind gift kind or ""
 * @param {number} until unix seconds
 */
/** Dedupe TikTok-style impact so the 1s FX ticker doesn't re-fire every tick. */
const _giftImpactKey = { local: "", remote: "" };

/**
 * @param {"local"|"remote"} which
 * @param {string} kind
 * @param {number} until unix seconds
 * @param {number} [level] intensity 1–3
 */
function setFxOverlay(which, kind, until, level) {
  const k = String(kind || "").toLowerCase();
  const u = Math.max(0, Number(until) || 0);
  const lvl = Math.max(1, Math.min(3, Math.floor(Number(level) || 1)));
  const now = unixNowSec();
  const isStay = k === "please_stay" || k === "stay" || k === "dont_skip";
  const cosmeticKinds = [
    "bars",
    "flowers",
    "balloons",
    "confetti",
    "heart",
    "fireworks",
  ];
  const active =
    !!k && u > now && (cosmeticKinds.includes(k) || isStay);

  const pick = (base) =>
    $(which === "local" ? `local-fx-${base}` : `remote-fx-${base}`);
  const pickT = (base) =>
    $(which === "local" ? `local-fx-${base}-timer` : `remote-fx-${base}-timer`);

  // Please stay is independent of cosmetic gifts (can layer).
  if (isStay) {
    const el = pick("please_stay");
    const timerEl = pickT("please_stay");
    if (which === "local") {
      selfNoSkipUntil = active ? u : 0;
      updateNextSkipLockUi();
    }
    if (active && el) {
      el.hidden = false;
      el.removeAttribute("hidden");
      el.dataset.until = String(u);
      el.dataset.level = "1";
      el.classList.remove("fx-lvl-1", "fx-lvl-2", "fx-lvl-3");
      el.classList.add("fx-lvl-1");
      if (timerEl) {
        const left = Math.max(0, u - now);
        timerEl.textContent =
          _t("stars.pleaseStayTimer", { s: left }) || `🙏 ${left}s`;
      }
      const stayKey = `please_stay:${u}`;
      if (_giftImpactKey[which + "_stay"] !== stayKey) {
        _giftImpactKey[which + "_stay"] = stayKey;
        triggerGiftImpact(el, "please_stay", { combo: 1 });
      }
      ensureFxTicker();
    } else {
      if (el) {
        el.hidden = true;
        el.setAttribute("hidden", "");
        delete el.dataset.until;
        delete el.dataset.level;
        el.classList.remove("fx-lvl-1", "fx-lvl-2", "fx-lvl-3");
      }
      if (timerEl) timerEl.textContent = "";
      _giftImpactKey[which + "_stay"] = "";
      if (which === "local" && !active) {
        selfNoSkipUntil = 0;
        updateNextSkipLockUi();
      }
    }
    applyFxTileFlavor(which, "", 1);
    return;
  }

  const kinds = cosmeticKinds;
  const els = Object.fromEntries(kinds.map((x) => [x, pick(x)]));
  const timers = Object.fromEntries(kinds.map((x) => [x, pickT(x)]));

  if (which === "local") {
    selfFx = active ? { kind: k, until: u, level: lvl } : null;
  } else {
    partnerFx = active ? { kind: k, until: u, level: lvl } : null;
  }

  const hide = (el, timerEl) => {
    if (el) {
      el.hidden = true;
      el.setAttribute("hidden", "");
      el.classList.remove("fx-lvl-1", "fx-lvl-2", "fx-lvl-3");
      delete el.dataset.level;
      delete el.dataset.until;
    }
    if (timerEl) timerEl.textContent = "";
  };
  const show = (el, timerEl, label) => {
    if (!el) return;
    el.hidden = false;
    el.removeAttribute("hidden");
    el.dataset.until = String(u);
    el.dataset.level = String(lvl);
    el.classList.remove("fx-lvl-1", "fx-lvl-2", "fx-lvl-3");
    el.classList.add(`fx-lvl-${lvl}`);
    // Force particle rebuild when level changes so density tracks stack
    const layer =
      el.querySelector(".fx-balloons-layer") ||
      el.querySelector(".fx-heart-layer") ||
      el.querySelector(".fx-flowers-ring") ||
      el.querySelector(".fx-confetti-layer") ||
      el.querySelector(".fx-fireworks-layer");
    if (layer && layer.dataset.fxLvl !== String(lvl)) {
      delete layer.dataset.ready;
      layer.dataset.fxLvl = String(lvl);
    }
    if (el.classList.contains("fx-flowers")) ensureFlowerPetals(el, lvl);
    if (el.classList.contains("fx-balloons")) ensureBalloons(el, lvl);
    if (el.classList.contains("fx-confetti")) ensureConfetti(el, lvl);
    if (el.classList.contains("fx-heart")) ensureHeartsFx(el, lvl);
    if (el.classList.contains("fx-fireworks")) ensureFireworks(el, lvl);
    if (timerEl) {
      const cost = giftCost(k);
      const secs = giftSecs(k);
      const lvlBit = lvl >= 2 ? ` ×${lvl}` : "";
      timerEl.textContent =
        label +
        lvlBit +
        (which === "remote" && myStars >= cost && k !== "please_stay"
          ? ` · +${secs}s = ${cost}★`
          : "");
    }
  };

  const hideAll = () => {
    kinds.forEach((x) => hide(els[x], timers[x]));
  };

  const left = Math.max(0, u - now);
  const timerKey = {
    bars: "stars.barsTimer",
    flowers: "stars.flowersTimer",
    balloons: "stars.balloonsTimer",
    confetti: "stars.confettiTimer",
    heart: "stars.heartTimer",
    fireworks: "stars.fireworksTimer",
  };
  const timerFb = {
    bars: `🔒 ${left}s`,
    flowers: `🌸 ${left}s`,
    balloons: `🎈 ${left}s`,
    confetti: `🎊 ${left}s`,
    heart: `💖 ${left}s`,
    fireworks: `🎆 ${left}s`,
  };

  hideAll();
  if (active && els[k]) {
    show(els[k], timers[k], _t(timerKey[k], { s: left }) || timerFb[k]);
    applyFxTileFlavor(which, k, lvl);
    // TikTok-style impact when gift instance or level changes
    const impactKey = `${k}:${u}:L${lvl}`;
    if (_giftImpactKey[which] !== impactKey) {
      _giftImpactKey[which] = impactKey;
      const combo = Math.max(lvl, nextGiftCombo(which, k));
      triggerGiftImpact(els[k], k, { combo, level: lvl });
      try {
        els[k].dataset.giftCombo = String(combo);
      } catch (_) {}
    }
    ensureFxTicker();
  } else {
    _giftImpactKey[which] = "";
    applyFxTileFlavor(which, "", 1);
  }
}

/**
 * Per-kind tile flavor so mid-tier gifts feel different (CSS filters on video tile).
 * @param {"local"|"remote"} which
 * @param {string} kind
 * @param {number} level
 */
function applyFxTileFlavor(which, kind, level) {
  const tile =
    which === "local"
      ? document.querySelector(".tile-local") || $("local")?.closest?.(".tile")
      : $("tile-remote") || document.querySelector(".tile-remote");
  if (!tile) return;
  tile.classList.remove(
    "fx-flavor-bars",
    "fx-flavor-flowers",
    "fx-flavor-balloons",
    "fx-flavor-confetti",
    "fx-flavor-heart",
    "fx-flavor-fireworks",
    "fx-flavor-l2",
    "fx-flavor-l3"
  );
  const k = String(kind || "").toLowerCase();
  if (!k || k === "please_stay") return;
  tile.classList.add(`fx-flavor-${k}`);
  const lvl = Math.max(1, Math.min(3, Number(level) || 1));
  if (lvl >= 2) tile.classList.add("fx-flavor-l2");
  if (lvl >= 3) tile.classList.add("fx-flavor-l3");
}

/**
 * While Please stay is active: Next stays clickable (visual press) but no-ops.
 * Label becomes “Please stay” instead of Next.
 */
function updateNextSkipLockUi() {
  const locked = selfNoSkipUntil > unixNowSec();
  const next = $("btn-next");
  if (next) {
    // Keep enabled so :active / click feel works; handler no-ops when locked.
    next.disabled = false;
    next.classList.toggle("is-no-skip-locked", !!locked);
    next.setAttribute("aria-disabled", locked ? "true" : "false");
    const label = next.querySelector("[data-i18n='btn.next'], .next-label, span:not(.icon)");
    if (label && !label.classList?.contains?.("icon") && label.tagName !== "SVG") {
      if (locked) {
        if (!label.dataset.nextLabelOrig) {
          label.dataset.nextLabelOrig = label.textContent || "Next";
        }
        label.textContent =
          _t("stars.pleaseStayBtn") || "Please stay";
      } else if (label.dataset.nextLabelOrig) {
        label.textContent =
          _t("btn.next") || label.dataset.nextLabelOrig || "Next";
        delete label.dataset.nextLabelOrig;
      }
    }
    next.title = locked
      ? _t("stars.pleaseStayLockedTitle") || "Please stay"
      : _t("btn.nextTitle") || next.getAttribute("data-i18n-title") || "Next";
  }
  document.documentElement.classList.toggle("no-skip-locked", !!locked);
}

function isSelfNoSkipLocked() {
  return selfNoSkipUntil > unixNowSec();
}

/**
 * Heart-curve points (classic cardioid heart), normalized to 0–1.
 * Used to place many petals around the partner frame — center stays clear.
 */
function heartCurvePoints(count) {
  const raw = [];
  const n = Math.max(12, count | 0);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const st = Math.sin(t);
    const x = 16 * st * st * st;
    // Flip Y so the point sits at the bottom (CSS y grows downward)
    const y = -(
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t)
    );
    raw.push({ x, y });
  }
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of raw) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  // Fit heart into the frame with a little inset so blooms sit on the border
  const padX = 0.04;
  const padY = 0.05;
  return raw.map((p) => ({
    x: padX + ((p.x - minX) / w) * (1 - padX * 2),
    y: padY + ((p.y - minY) / h) * (1 - padY * 2),
  }));
}

/** Same-gift combo within a short window (TikTok-style ×2 / ×3…). */
const GIFT_COMBO_WINDOW_MS = 2800;
let giftComboState = { key: "", count: 0, at: 0 };

function nextGiftCombo(which, kind) {
  const k = String(kind || "").toLowerCase();
  if (!k) return 1;
  const key = `${which || "x"}:${k}`;
  const now = Date.now();
  if (giftComboState.key === key && now - giftComboState.at < GIFT_COMBO_WINDOW_MS) {
    giftComboState.count = Math.min(99, (giftComboState.count || 1) + 1);
  } else {
    giftComboState.key = key;
    giftComboState.count = 1;
  }
  giftComboState.at = now;
  return giftComboState.count;
}

/**
 * TikTok-style impact: flash + hero glyph + combo banner on gift show.
 * @param {HTMLElement} overlay
 * @param {string} kind
 * @param {{ combo?: number }} [opts]
 */
function triggerGiftImpact(overlay, kind, opts = {}) {
  if (!overlay || !kind) return;
  const k = String(kind).toLowerCase();
  const combo = Math.max(1, Math.min(99, Number(opts.combo) || 1));
  const meta = {
    heart: { ico: "💖", name: "Heart", accent: "#ff5a8a" },
    flowers: { ico: "🌸", name: "Flowers", accent: "#ff6bb5" },
    balloons: { ico: "🎈", name: "Balloons", accent: "#5ad4ff" },
    confetti: { ico: "🎊", name: "Confetti", accent: "#ffd14a" },
    fireworks: { ico: "🎆", name: "Fireworks", accent: "#ffb020" },
    bars: { ico: "🔒", name: "Behind bars", accent: "#a0b0c8" },
    please_stay: { ico: "🙏", name: "Please stay", accent: "#ff8fab" },
  }[k] || { ico: "★", name: "Gift", accent: "#ffd54a" };

  const mega = combo >= 3 || (k === "fireworks" && combo >= 2);
  const big = combo >= 2 || k === "fireworks";

  let flash = overlay.querySelector(".fx-impact-flash");
  if (!flash) {
    flash = document.createElement("div");
    flash.className = "fx-impact-flash";
    flash.setAttribute("aria-hidden", "true");
    overlay.appendChild(flash);
  }
  flash.style.setProperty("--fx-accent", meta.accent);
  flash.classList.toggle("is-mega", mega);
  flash.classList.remove("is-on");
  void flash.offsetWidth;
  flash.classList.add("is-on");
  setTimeout(() => flash.classList.remove("is-on", "is-mega"), mega ? 900 : 700);

  let hero = overlay.querySelector(".fx-impact-hero");
  if (!hero) {
    hero = document.createElement("div");
    hero.className = "fx-impact-hero";
    hero.setAttribute("aria-hidden", "true");
    overlay.appendChild(hero);
  }
  hero.textContent = combo >= 2 ? `${meta.ico}`.repeat(Math.min(3, combo)).slice(0, 6) || meta.ico : meta.ico;
  if (combo >= 2) {
    // Prefer single icon + scale rather than broken multi-emoji for some fonts
    hero.textContent = meta.ico;
  }
  hero.classList.toggle("is-combo", combo >= 2);
  hero.classList.toggle("is-mega", mega);
  hero.classList.remove("is-on");
  void hero.offsetWidth;
  hero.classList.add("is-on");
  setTimeout(() => hero.classList.remove("is-on", "is-combo", "is-mega"), mega ? 1400 : 1100);

  let banner = overlay.querySelector(".fx-combo-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.className = "fx-combo-banner";
    banner.setAttribute("aria-hidden", "true");
    overlay.appendChild(banner);
  }
  const comboLabel =
    combo >= 5 ? "MAX" : combo >= 2 ? `×${combo}` : "×1";
  banner.innerHTML = `<span class="fx-combo-ico">${meta.ico}</span><span class="fx-combo-name">${meta.name}</span><span class="fx-combo-x${
    combo >= 2 ? " is-hot" : ""
  }${mega ? " is-mega" : ""}">${comboLabel}</span>`;
  banner.style.setProperty("--fx-accent", meta.accent);
  banner.classList.toggle("is-combo", combo >= 2);
  banner.classList.toggle("is-mega", mega);
  banner.classList.remove("is-on");
  void banner.offsetWidth;
  banner.classList.add("is-on");
  setTimeout(
    () => banner.classList.remove("is-on", "is-combo", "is-mega"),
    mega ? 2800 : 2200
  );

  // Tile shake — stronger for fireworks / high combos
  if (big || k === "confetti" || k === "please_stay") {
    const tile = overlay.closest(".tile");
    if (tile) {
      tile.classList.remove("fx-tile-shake", "fx-tile-shake-hard");
      void tile.offsetWidth;
      tile.classList.add(mega || k === "fireworks" ? "fx-tile-shake-hard" : "fx-tile-shake");
      setTimeout(() => {
        tile.classList.remove("fx-tile-shake", "fx-tile-shake-hard");
      }, mega ? 720 : 520);
    }
  }

  // Premium fireworks — multi-wave canvas cinematic (TikTok-tier without Lottie)
  if (k === "fireworks") {
    try {
      playFireworksCanvasBurst(overlay, {
        mega: mega || combo >= 2,
        combo,
        waves: mega ? 3 : combo >= 2 ? 2 : 1,
      });
    } catch (_) {}
    overlay.classList.remove("fx-fw-combo-pop", "fx-fw-mega-flash");
    void overlay.offsetWidth;
    overlay.classList.add("fx-fw-combo-pop");
    if (mega || combo >= 3) overlay.classList.add("fx-fw-mega-flash");
    setTimeout(
      () => overlay.classList.remove("fx-fw-combo-pop", "fx-fw-mega-flash"),
      mega ? 1800 : 1200
    );
  }
  // Confetti also gets a short canvas glitter wave
  if (k === "confetti" && (combo >= 2 || mega)) {
    try {
      playConfettiCanvasBurst(overlay, { mega, combo });
    } catch (_) {}
  }
}

/** Populate petals along a heart outline. @param {number} [level] denser at L2+ */
function ensureFlowerPetals(overlay, level) {
  const ring = overlay?.querySelector?.(".fx-flowers-ring");
  if (!ring) return;
  const lvl = Math.max(1, Math.min(3, Math.floor(Number(level) || 1)));
  const tag = `flowers-v6-L${lvl}`;
  if (ring.dataset.ready === tag) return;
  const glyphs = [
    "🌸", "💗", "🌺", "💕", "🌹", "🌷", "💮", "💖", "🌼", "💞",
    "🩷", "❤️", "💐", "❣️", "🎀", "💗", "🌸", "❤️‍🔥",
  ];
  const outerN = 36 + lvl * 10;
  const midN = 28 + lvl * 8;
  const innerN = 18 + lvl * 6;
  const outer = heartCurvePoints(outerN);
  const mid = heartCurvePoints(midN).map((p) => ({
    x: 0.5 + (p.x - 0.5) * 0.88,
    y: 0.5 + (p.y - 0.5) * 0.88,
  }));
  const inner = heartCurvePoints(innerN).map((p) => ({
    x: 0.5 + (p.x - 0.5) * 0.74,
    y: 0.5 + (p.y - 0.5) * 0.74,
  }));
  let html = "";
  let i = 0;
  const place = (pts, sizeClass) => {
    for (const p of pts) {
      const g = glyphs[i % glyphs.length];
      const rot = ((i * 41) % 56) - 28;
      const scale =
        sizeClass === "lg"
          ? 1.12 + (i % 4) * 0.1 + (lvl - 1) * 0.06
          : sizeClass === "md"
            ? 0.95 + (i % 3) * 0.08
            : 0.72 + (i % 3) * 0.07;
      html += `<span class="fx-petal fx-petal-${sizeClass}" style="--x:${(
        p.x * 100
      ).toFixed(2)}%;--y:${(p.y * 100).toFixed(2)}%;--i:${i};--rot:${rot}deg;--s:${scale.toFixed(
        2
      )}" aria-hidden="true">${g}</span>`;
      i++;
    }
  };
  place(outer, "lg");
  place(mid, "md");
  place(inner, "sm");
  const sparkN = 12 + lvl * 6;
  for (let s = 0; s < sparkN; s++) {
    const hp = heartCurvePoints(sparkN)[s];
    if (!hp) continue;
    const jx = (Math.sin(s * 2.3) * 0.05).toFixed(3);
    const jy = (Math.cos(s * 1.9) * 0.05).toFixed(3);
    html += `<span class="fx-sparkle" style="--x:${((hp.x + Number(jx)) * 100).toFixed(
      2
    )}%;--y:${((hp.y + Number(jy)) * 100).toFixed(2)}%;--i:${s}" aria-hidden="true">✨</span>`;
  }
  ring.innerHTML = html;
  ring.dataset.ready = tag;
  ring.dataset.fxLvl = String(lvl);
}

/** Rising balloons across the partner window. @param {number} [level] 1–3 density */
function ensureBalloons(overlay, level) {
  const layer = overlay?.querySelector?.(".fx-balloons-layer");
  if (!layer) return;
  const lvl = Math.max(1, Math.min(3, Math.floor(Number(level) || 1)));
  const tag = `balloons-v3-L${lvl}`;
  if (layer.dataset.ready === tag) return;
  const colors = [
    "#ff5a7a", "#ff8a3d", "#ffd14a", "#5ad48a", "#4db7ff",
    "#a78bfa", "#ff6bcb", "#f472b6", "#34d399", "#60a5fa",
    "#fb7185", "#fbbf24",
  ];
  let html = "";
  const n = 18 + lvl * 12; // L1=30, L2=42, L3=54
  for (let i = 0; i < n; i++) {
    const left = 2 + ((i * 13 + (i % 7) * 11) % 94);
    const delay = ((i * 0.28) % 5.2).toFixed(2);
    const dur = (6.2 + (i % 7) * 0.55).toFixed(2);
    const size = (1.05 + (i % 6) * 0.2).toFixed(2);
    const drift = (((i * 17) % 48) - 24).toFixed(0);
    const color = colors[i % colors.length];
    const sway = (1.8 + (i % 5) * 0.35).toFixed(2);
    html += `<span class="fx-balloon" style="--left:${left}%;--delay:${delay}s;--dur:${dur}s;--size:${size};--drift:${drift}px;--color:${color};--sway:${sway}s" aria-hidden="true">
      <span class="fx-balloon-body"><span class="fx-balloon-shine"></span></span>
      <span class="fx-balloon-knot"></span>
      <span class="fx-balloon-string"></span>
    </span>`;
  }
  layer.innerHTML = html;
  layer.dataset.ready = tag;
  layer.dataset.fxLvl = String(lvl);
}

/** Floating hearts (1★) — denser rise with side sway. @param {number} [level] */
function ensureHeartsFx(overlay, level) {
  const layer = overlay?.querySelector?.(".fx-heart-layer");
  if (!layer) return;
  const lvl = Math.max(1, Math.min(3, Math.floor(Number(level) || 1)));
  const tag = `heart-v3-L${lvl}`;
  if (layer.dataset.ready === tag) return;
  const icons = ["💖", "💗", "❤️", "💕", "💘", "🩷", "❤️‍🔥", "❣️"];
  let html = "";
  // Hero big heart (bigger at L2+)
  html += `<span class="fx-heart-hero" style="--scale:${1 + (lvl - 1) * 0.25}" aria-hidden="true">💖</span>`;
  const n = 22 + lvl * 14;
  for (let i = 0; i < n; i++) {
    const left = 2 + ((i * 11 + (i % 5) * 13) % 94);
    const delay = ((i * 0.16) % 3.6).toFixed(2);
    const dur = (2.8 + (i % 5) * 0.5).toFixed(2);
    const size = (0.75 + (i % 6) * 0.22).toFixed(2);
    const sway = (((i * 19) % 50) - 25).toFixed(0);
    html += `<span class="fx-heart-bit" style="--left:${left}%;--delay:${delay}s;--dur:${dur}s;--size:${size};--sway:${sway}px" aria-hidden="true">${
      icons[i % icons.length]
    }</span>`;
  }
  layer.innerHTML = html;
  layer.dataset.ready = tag;
  layer.dataset.fxLvl = String(lvl);
}

/** Premium fireworks — CSS sparks + canvas cinematic bursts. @param {number} [level] */
function ensureFireworks(overlay, level) {
  const layer = overlay?.querySelector?.(".fx-fireworks-layer");
  if (!layer) return;
  const lvl = Math.max(1, Math.min(3, Math.floor(Number(level) || 1)));
  const tag = `fw-v5-L${lvl}`;
  if (layer.dataset.ready === tag) return;
  const colors = [
    "#ff5a7a", "#ffd14a", "#5ad48a", "#4db7ff", "#a78bfa",
    "#ff8a3d", "#fff", "#ff6bcb", "#fde68a", "#fbbf24",
  ];
  let html = "";
  const bursts = 8 + lvl * 6;
  for (let b = 0; b < bursts; b++) {
    const cx = 6 + ((b * 21 + (b % 4) * 9) % 88);
    const cy = 10 + ((b * 17) % 62);
    const delay = (b * 0.32).toFixed(2);
    const scale = (0.9 + (b % 5) * 0.18).toFixed(2);
    html += `<span class="fx-fw-burst" style="--cx:${cx}%;--cy:${cy}%;--delay:${delay}s;--bscale:${scale}" aria-hidden="true">`;
    const sparks = 22 + (b % 4) * 4;
    for (let p = 0; p < sparks; p++) {
      const ang = (p / sparks) * 360 + (b % 2) * 6;
      const col = colors[(b + p) % colors.length];
      const dist = 52 + (p % 6) * 11;
      html += `<span class="fx-fw-spark" style="--ang:${ang}deg;--color:${col};--dist:${dist}px"></span>`;
    }
    html += `<span class="fx-fw-core" style="--color:${colors[b % colors.length]}"></span>`;
    html += `</span>`;
  }
  html += `<span class="fx-fw-emoji" style="--left:50%;--delay:0.05s" aria-hidden="true">🎆</span>`;
  html += `<span class="fx-fw-emoji" style="--left:18%;--delay:0.55s" aria-hidden="true">✨</span>`;
  html += `<span class="fx-fw-emoji" style="--left:82%;--delay:0.95s" aria-hidden="true">🎇</span>`;
  html += `<span class="fx-fw-emoji" style="--left:36%;--delay:1.35s" aria-hidden="true">💥</span>`;
  html += `<span class="fx-fw-emoji" style="--left:64%;--delay:1.7s" aria-hidden="true">🌟</span>`;
  html += `<canvas class="fx-fw-canvas" aria-hidden="true"></canvas>`;
  layer.innerHTML = html;
  layer.dataset.ready = tag;
  layer.dataset.fxLvl = String(lvl);
}

/**
 * Multi-wave canvas fireworks: rockets rise → shell burst → gold rain.
 * No external Lottie/WebM — pure canvas for low asset cost.
 * @param {HTMLElement} overlay
 * @param {{ mega?: boolean, combo?: number, waves?: number }} [opts]
 */
function playFireworksCanvasBurst(overlay, opts = {}) {
  if (!overlay) return;
  ensureFireworks(overlay);
  const layer = overlay.querySelector(".fx-fireworks-layer");
  const canvas = layer?.querySelector?.(".fx-fw-canvas");
  if (!canvas || !canvas.getContext) return;
  const rect = overlay.getBoundingClientRect();
  const w = Math.max(120, Math.floor(rect.width) || 320);
  const h = Math.max(120, Math.floor(rect.height) || 320);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const combo = Math.max(1, Number(opts.combo) || 1);
  const mega = !!opts.mega || combo >= 2;
  const waves = Math.max(1, Math.min(4, Number(opts.waves) || (mega ? 2 : 1)));
  const colors = [
    "#ff5a7a", "#ffd14a", "#5ad48a", "#4db7ff", "#a78bfa",
    "#ff8a3d", "#ffffff", "#ff6bcb", "#fde68a", "#60a5fa",
    "#fbbf24", "#fb7185",
  ];
  /** @type {Array<object>} */
  const particles = [];

  function spawnShell(cx, cy, col, n, power) {
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.25;
      const spd = power * (0.75 + Math.random() * 0.9);
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 1,
        decay: 0.01 + Math.random() * 0.016,
        r: 1.1 + Math.random() * 2.6,
        col: Math.random() > 0.82 ? "#fff" : col,
        trail: Math.random() > 0.4,
        kind: "spark",
      });
    }
    // white core
    particles.push({
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      life: 1,
      decay: 0.05,
      r: mega ? 14 : 9,
      col: "#fff",
      trail: false,
      kind: "core",
    });
    // gold rain
    const rain = mega ? 18 : 10;
    for (let i = 0; i < rain; i++) {
      particles.push({
        x: cx + (Math.random() - 0.5) * 20,
        y: cy,
        vx: (Math.random() - 0.5) * 0.8,
        vy: 0.4 + Math.random() * 1.2,
        life: 1,
        decay: 0.008 + Math.random() * 0.01,
        r: 0.8 + Math.random() * 1.4,
        col: Math.random() > 0.5 ? "#fde68a" : "#ffd14a",
        trail: true,
        kind: "rain",
      });
    }
  }

  function launchRocket(delayMs, targetX, targetY, col) {
    const x0 = targetX + (Math.random() - 0.5) * w * 0.08;
    const y0 = h + 8;
    particles.push({
      x: x0,
      y: y0,
      vx: (targetX - x0) * 0.012,
      vy: -(2.8 + Math.random() * 1.4) * (mega ? 1.15 : 1),
      life: 1,
      decay: 0.004,
      r: 2.2,
      col: "#fff7cc",
      trail: true,
      kind: "rocket",
      explodeAt: performance.now() + delayMs + 280 + Math.random() * 180,
      shellCol: col,
      shellN: mega ? 48 + Math.floor(Math.random() * 16) : 32 + Math.floor(Math.random() * 12),
      shellPower: mega ? 3.6 : 2.6,
      tx: targetX,
      ty: targetY,
    });
  }

  // Schedule waves of rockets
  const shellsPerWave = mega ? 4 : 3;
  for (let wave = 0; wave < waves; wave++) {
    for (let s = 0; s < shellsPerWave; s++) {
      const cx = w * (0.14 + Math.random() * 0.72);
      const cy = h * (0.12 + Math.random() * 0.42);
      const col = colors[(wave * 3 + s * 2) % colors.length];
      launchRocket(wave * 380 + s * 90, cx, cy, col);
    }
  }

  let raf = 0;
  const t0 = performance.now();
  const maxMs = mega ? 2400 + (waves - 1) * 350 : 1600 + (waves - 1) * 280;
  const flash = { a: mega ? 0.55 : 0.35 };

  const tick = (now) => {
    const elapsed = now - t0;
    ctx.clearRect(0, 0, w, h);

    // Ambient warm glow + initial flash
    if (flash.a > 0.01) {
      ctx.globalAlpha = flash.a;
      const fg = ctx.createRadialGradient(w / 2, h * 0.35, 4, w / 2, h * 0.35, w * 0.7);
      fg.addColorStop(0, "rgba(255,230,160,0.9)");
      fg.addColorStop(0.45, "rgba(255,120,60,0.25)");
      fg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, w, h);
      flash.a *= 0.9;
      ctx.globalAlpha = 1;
    }

    let alive = 0;
    for (const p of particles) {
      if (p.life <= 0) continue;

      // Rocket reaches apex → explode into shell
      if (p.kind === "rocket" && (now >= p.explodeAt || p.y <= p.ty)) {
        spawnShell(p.x, p.y, p.shellCol, p.shellN, p.shellPower);
        flash.a = Math.max(flash.a, mega ? 0.4 : 0.22);
        p.life = 0;
        continue;
      }

      alive++;
      p.x += p.vx;
      p.y += p.vy;
      if (p.kind === "rocket") {
        p.vy += 0.012;
        // smoke puffs
        if (Math.random() > 0.55) {
          particles.push({
            x: p.x + (Math.random() - 0.5) * 3,
            y: p.y + 4,
            vx: (Math.random() - 0.5) * 0.3,
            vy: 0.4,
            life: 0.55,
            decay: 0.04,
            r: 1.5 + Math.random(),
            col: "rgba(255,220,160,0.5)",
            trail: false,
            kind: "smoke",
          });
        }
      } else if (p.kind === "rain") {
        p.vy += 0.06;
        p.vx *= 0.985;
      } else if (p.kind !== "core" && p.kind !== "smoke") {
        p.vy += 0.038;
        p.vx *= 0.988;
      }
      p.life -= p.decay;
      if (p.life <= 0) continue;

      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      if (p.trail) {
        ctx.strokeStyle = p.col;
        ctx.lineWidth = Math.max(0.5, p.r * (p.kind === "rocket" ? 0.9 : 0.4));
        ctx.lineCap = "round";
        ctx.beginPath();
        const tl = p.kind === "rocket" ? 5 : 2.4;
        ctx.moveTo(p.x - p.vx * tl, p.y - p.vy * tl);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      ctx.fillStyle = p.col;
      ctx.beginPath();
      const rr = p.kind === "core" ? p.r * p.life : p.r * (0.6 + 0.4 * p.life);
      ctx.arc(p.x, p.y, Math.max(0.4, rr), 0, Math.PI * 2);
      ctx.fill();
    }
    // prune dead occasionally to keep array small
    if (particles.length > 900) {
      for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].life <= 0) particles.splice(i, 1);
      }
    }
    ctx.globalAlpha = 1;
    if ((alive > 0 || flash.a > 0.02) && elapsed < maxMs) {
      raf = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, w, h);
      cancelAnimationFrame(raf);
    }
  };
  cancelAnimationFrame(canvas._fwRaf || 0);
  canvas._fwRaf = requestAnimationFrame(tick);
  try {
    trackEvent("gift_fx_fireworks", { mega: mega ? 1 : 0, combo, waves });
  } catch (_) {}
}

/**
 * Short confetti glitter on canvas for combo confetti gifts.
 * @param {HTMLElement} overlay
 * @param {{ mega?: boolean, combo?: number }} [opts]
 */
function playConfettiCanvasBurst(overlay, opts = {}) {
  if (!overlay) return;
  ensureConfetti(overlay);
  const layer = overlay.querySelector(".fx-confetti-layer");
  if (!layer) return;
  let canvas = layer.querySelector(".fx-confetti-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "fx-confetti-canvas";
    canvas.setAttribute("aria-hidden", "true");
    layer.appendChild(canvas);
  }
  const rect = overlay.getBoundingClientRect();
  const w = Math.max(100, Math.floor(rect.width) || 280);
  const h = Math.max(100, Math.floor(rect.height) || 280);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5";
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const mega = !!opts.mega;
  const colors = ["#ff5a7a", "#ffd14a", "#5ad48a", "#4db7ff", "#a78bfa", "#fff", "#f472b6"];
  const bits = [];
  const n = mega ? 80 : 55;
  for (let i = 0; i < n; i++) {
    bits.push({
      x: Math.random() * w,
      y: -10 - Math.random() * h * 0.3,
      vx: (Math.random() - 0.5) * 3,
      vy: 1.5 + Math.random() * 3.5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
      w: 4 + Math.random() * 7,
      h: 3 + Math.random() * 5,
      col: colors[i % colors.length],
      life: 1,
      decay: 0.008 + Math.random() * 0.01,
    });
  }
  const t0 = performance.now();
  const tick = (now) => {
    ctx.clearRect(0, 0, w, h);
    let alive = 0;
    for (const b of bits) {
      if (b.life <= 0) continue;
      alive++;
      b.x += b.vx;
      b.y += b.vy;
      b.vy += 0.04;
      b.rot += b.vr;
      b.life -= b.decay;
      ctx.save();
      ctx.globalAlpha = Math.max(0, b.life);
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = b.col;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
    if (alive > 0 && now - t0 < 1400) {
      canvas._cfRaf = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, w, h);
      cancelAnimationFrame(canvas._cfRaf || 0);
    }
  };
  cancelAnimationFrame(canvas._cfRaf || 0);
  canvas._cfRaf = requestAnimationFrame(tick);
}

/** Falling confetti burst — denser at higher stack levels. @param {number} [level] */
function ensureConfetti(overlay, level) {
  const layer = overlay?.querySelector?.(".fx-confetti-layer");
  if (!layer) return;
  const lvl = Math.max(1, Math.min(3, Math.floor(Number(level) || 1)));
  const tag = `confetti-v3-L${lvl}`;
  if (layer.dataset.ready === tag) return;
  const colors = [
    "#ff5a7a", "#ffd14a", "#5ad48a", "#4db7ff", "#a78bfa",
    "#ff8a3d", "#f472b6", "#fff", "#34d399", "#fbbf24",
  ];
  const shapes = ["rect", "rect", "circle", "heart", "rect", "ribbon"];
  let html = "";
  // Burst-heavy: more bits, slightly shorter default fall at L1
  const n = 48 + lvl * 28;
  for (let i = 0; i < n; i++) {
    const left = 1 + ((i * 13 + (i % 9) * 9) % 97);
    const delay = ((i * 0.08) % 1.8).toFixed(2);
    const dur = (2.0 + (i % 5) * 0.35 + (lvl - 1) * 0.15).toFixed(2);
    const size = (7 + (i % 7) * 2.2 + (lvl - 1) * 1.5).toFixed(0);
    const rot = ((i * 53) % 360).toFixed(0);
    const color = colors[i % colors.length];
    const shape = shapes[i % shapes.length];
    const spin = (0.8 + (i % 5) * 0.35).toFixed(2);
    html += `<span class="fx-confetti-bit fx-confetti-${shape}" style="--left:${left}%;--delay:${delay}s;--dur:${dur}s;--size:${size}px;--rot:${rot}deg;--color:${color};--spin:${spin}s" aria-hidden="true"></span>`;
  }
  const emoN = 8 + lvl * 6;
  for (let i = 0; i < emoN; i++) {
    const left = 5 + ((i * 19) % 88);
    const delay = (0.1 + i * 0.15).toFixed(2);
    const dur = (2.8 + (i % 4) * 0.35).toFixed(2);
    const emos = ["💖", "✨", "🎉", "⭐", "💫"];
    html += `<span class="fx-confetti-emoji" style="--left:${left}%;--delay:${delay}s;--dur:${dur}s" aria-hidden="true">${
      emos[i % emos.length]
    }</span>`;
  }
  layer.innerHTML = html;
  layer.dataset.ready = tag;
  layer.dataset.fxLvl = String(lvl);
}

/** Soft celebration pop + sound when you receive a gift. */
function playGiftCelebrate(kind, combo = 1) {
  try {
    playGiftSound(kind);
  } catch (_) {}
  const el = $("gift-celebrate");
  if (!el) return;
  const n = Math.max(1, Math.min(99, Number(combo) || 1));
  const mega = kind === "fireworks" || n >= 3;
  const icon =
    kind === "flowers"
      ? "🌸"
      : kind === "balloons"
        ? "🎈"
        : kind === "confetti"
          ? "🎊"
          : kind === "heart"
            ? "💖"
            : kind === "fireworks"
              ? "🎆"
              : kind === "please_stay"
                ? "🙏"
                : kind === "bars"
                  ? "🔒"
                  : "★";
  const name =
    kind === "flowers"
      ? "Flowers"
      : kind === "balloons"
        ? "Balloons"
        : kind === "confetti"
          ? "Confetti"
          : kind === "heart"
            ? "Heart"
            : kind === "fireworks"
              ? "Fireworks"
              : kind === "please_stay"
                ? "Please stay"
                : kind === "bars"
                  ? "Behind bars"
                  : "Gift";
  const xLabel = n >= 5 ? "MAX" : `×${n}`;
  el.innerHTML = `<span class="gift-celebrate-ico">${icon}</span><span class="gift-celebrate-name">${name}</span><span class="gift-celebrate-x${
    n >= 2 ? " is-hot" : ""
  }${mega ? " is-mega" : ""}">${xLabel}</span>`;
  el.hidden = false;
  el.removeAttribute("hidden");
  el.classList.remove("is-pop", "is-combo", "is-mega-gift");
  el.classList.toggle("is-combo", n >= 2);
  el.classList.toggle("is-mega-gift", mega);
  void el.offsetWidth;
  el.classList.add("is-pop");
  // Full-viewport flash for premium fireworks receive
  if (kind === "fireworks") {
    try {
      document.documentElement.classList.add("gift-fw-flash");
      setTimeout(
        () => document.documentElement.classList.remove("gift-fw-flash"),
        mega ? 900 : 600
      );
    } catch (_) {}
  }
  setTimeout(() => {
    el.classList.remove("is-pop", "is-combo", "is-mega-gift");
    el.hidden = true;
    el.setAttribute("hidden", "");
  }, mega ? 2200 : n >= 2 ? 1850 : 1650);
}

/** Short WebAudio “whoosh / pop” — no external files. */
function playGiftSound(kind) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!playGiftSound._ctx) playGiftSound._ctx = new AC();
    const ctx = playGiftSound._ctx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t0 = ctx.currentTime;
    const freqs =
      kind === "bars"
        ? [180, 140, 110]
        : kind === "balloons"
          ? [520, 660, 780, 920]
          : kind === "confetti"
            ? [880, 1100, 1320, 990, 1480]
            : kind === "fireworks"
              ? [90, 160, 320, 640, 980, 1400, 1800]
              : kind === "heart"
                ? [520, 660, 784, 988]
                : kind === "please_stay"
                  ? [392, 494, 587]
                  : [440, 554, 659, 880];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type =
        kind === "bars"
          ? "triangle"
          : kind === "fireworks"
            ? "sawtooth"
            : "sine";
      o.frequency.value = f;
      const peak =
        kind === "fireworks" ? 0.1 / (i + 1) : 0.09 / (i + 1);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015 + i * 0.035);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32 + i * 0.06);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0 + i * 0.035);
      o.stop(t0 + 0.4 + i * 0.06);
    });
    // Soft noise burst for confetti/fireworks
    if (kind === "confetti" || kind === "fireworks") {
      try {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.04, t0);
        ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
        src.connect(ng);
        ng.connect(ctx.destination);
        src.start(t0);
      } catch (_) {}
    }
  } catch (_) {}
}

/** Quick gift strip over partner video (long-press). */
function giftStripOpen() {
  const strip = $("gift-strip");
  if (!strip) return;
  if (!matched && !inFriendCall) return;
  strip.hidden = false;
  strip.removeAttribute("hidden");
  strip.classList.add("is-open");
  // Enable/disable by balance (per gift cost)
  strip.querySelectorAll("[data-gift]").forEach((btn) => {
    const g = btn.getAttribute("data-gift") || "";
    const ok = myStars >= giftCost(g);
    btn.disabled = !ok;
    btn.classList.toggle("is-disabled", !ok);
  });
  trackEvent("gift_strip_open");
}

function giftStripClose() {
  const strip = $("gift-strip");
  if (!strip) return;
  strip.classList.remove("is-open");
  setTimeout(() => {
    if (!strip.classList.contains("is-open")) {
      strip.hidden = true;
      strip.setAttribute("hidden", "");
    }
  }, 160);
}

/** Cancel pending gift-strip long-press (shared with swipe). */
function clearGiftStripLongPress() {
  if (giftStripLongPressTimer) {
    clearTimeout(giftStripLongPressTimer);
    giftStripLongPressTimer = 0;
  }
}

/**
 * Swipe left or right on partner video → Next (skip conversationalist).
 * Does not run on pure friend calls (no Next button).
 * Coordinates with long-press gift strip (horizontal drag cancels long-press).
 */
function canSwipeSkipPartner() {
  if (!matched && !inFriendCall) return false;
  // Match Next button policy: pure 1v1 friend call has no Next
  const pureFriend = inFriendCall && matchMode === "friend" && !trioBrowse;
  if (pureFriend) return false;
  if (isSelfNoSkipLocked()) return false;
  const next = $("btn-next");
  if (next?.hidden) return false;
  return true;
}

function partnerSwipeChromeSelector() {
  return (
    ".side-rail, .tile-dock, .tile-floor, .partner-menu, .gift-strip, " +
    ".debate-overlay, .debate-mobile-bar, .debate-card, " +
    ".swipe-skip-hint, button, a, input, select, textarea, label, " +
    ".stars-badge, .tile-corner-btn, .tile-tag, .chat-panel"
  );
}

function resetPartnerSwipeVisual() {
  const tile = $("tile-remote");
  if (!tile) return;
  tile.classList.remove(
    "is-swiping",
    "swipe-exit-left",
    "swipe-exit-right",
    "swipe-armed"
  );
  tile.style.removeProperty("--swipe-x");
  tile.style.removeProperty("--swipe-o");
  const hint = $("swipe-skip-hint");
  if (hint) {
    hint.hidden = true;
    hint.setAttribute("hidden", "");
    hint.classList.remove("is-left", "is-right", "is-armed");
  }
}

function applyPartnerSwipeVisual(dx, width) {
  const tile = $("tile-remote");
  if (!tile) return;
  const max = Math.max(120, width * 0.45);
  const clamped = Math.max(-max, Math.min(max, dx));
  const progress = Math.min(1, Math.abs(clamped) / Math.max(72, width * 0.22));
  tile.classList.add("is-swiping");
  tile.classList.toggle("swipe-armed", progress >= 0.92);
  tile.style.setProperty("--swipe-x", `${clamped.toFixed(1)}px`);
  tile.style.setProperty("--swipe-o", String(1 - progress * 0.28));
  const hint = $("swipe-skip-hint");
  if (hint) {
    hint.hidden = false;
    hint.removeAttribute("hidden");
    hint.classList.toggle("is-left", clamped < 0);
    hint.classList.toggle("is-right", clamped > 0);
    hint.classList.toggle("is-armed", progress >= 0.92);
    const lab = hint.querySelector(".swipe-skip-label");
    if (lab) {
      lab.textContent =
        _t("swipe.next") || _t("btn.next") || "Next";
    }
  }
}

function commitPartnerSwipeSkip(dir) {
  const tile = $("tile-remote");
  swipeSkipSuppressClick = true;
  giftStripSuppressClick = true;
  clearGiftStripLongPress();
  try {
    giftStripClose();
  } catch (_) {}
  if (tile) {
    tile.classList.remove("is-swiping", "swipe-armed");
    tile.classList.add(dir < 0 ? "swipe-exit-left" : "swipe-exit-right");
  }
  try {
    navigator.vibrate?.(18);
  } catch (_) {}
  trackEvent("swipe_skip", { dir: dir < 0 ? "left" : "right" });
  // Fire Next after a short fly-off so it feels intentional
  setTimeout(() => {
    resetPartnerSwipeVisual();
    const next = $("btn-next");
    if (next && !next.hidden) {
      next.click();
    }
    // Allow menu clicks again shortly after
    setTimeout(() => {
      swipeSkipSuppressClick = false;
    }, 320);
  }, 160);
}

function wirePartnerSwipe() {
  const tile = $("tile-remote");
  if (!tile || tile.dataset.swipeWired) return;
  tile.dataset.swipeWired = "1";

  const endSwipe = (e, cancelled) => {
    const st = partnerSwipe;
    if (!st || !st.tracking) {
      partnerSwipe = null;
      return;
    }
    if (st.id != null && e?.pointerId != null && e.pointerId !== st.id) return;
    st.tracking = false;
    const dx = (e?.clientX != null ? e.clientX : st.lastX) - st.x0;
    const dy = (e?.clientY != null ? e.clientY : st.lastY) - st.y0;
    const dt = Math.max(1, Date.now() - st.t0);
    const w = tile.clientWidth || 320;
    const distOk = Math.abs(dx) >= Math.max(64, w * 0.18);
    const velocity = Math.abs(dx) / dt; // px/ms
    const flickOk = Math.abs(dx) >= 42 && velocity > 0.55;
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.05;
    const giftOpen =
      $("gift-strip") &&
      !$("gift-strip").hidden &&
      $("gift-strip").classList.contains("is-open");
    if (
      !cancelled &&
      !giftOpen &&
      st.moved &&
      horizontal &&
      (distOk || flickOk) &&
      canSwipeSkipPartner()
    ) {
      commitPartnerSwipeSkip(dx < 0 ? -1 : 1);
    } else {
      // Spring back
      if (st.moved) {
        tile.classList.add("swipe-snapback");
        tile.style.setProperty("--swipe-x", "0px");
        tile.style.setProperty("--swipe-o", "1");
        setTimeout(() => {
          tile.classList.remove("swipe-snapback");
          resetPartnerSwipeVisual();
        }, 180);
        // Drop suppress after this gesture so a later tap can open the menu
        setTimeout(() => {
          if (!partnerSwipe) {
            swipeSkipSuppressClick = false;
            giftStripSuppressClick = false;
          }
        }, 280);
      } else {
        resetPartnerSwipeVisual();
      }
    }
    partnerSwipe = null;
  };

  tile.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button != null && e.button !== 0) return;
      if (e.target?.closest?.(partnerSwipeChromeSelector())) return;
      if (!canSwipeSkipPartner()) return;
      // Don't start swipe while gift strip is open (tap outside closes it)
      const gs = $("gift-strip");
      if (gs && !gs.hidden && gs.classList.contains("is-open")) return;
      partnerSwipe = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        t0: Date.now(),
        tracking: true,
        moved: false,
      };
    },
    { passive: true }
  );

  tile.addEventListener(
    "pointermove",
    (e) => {
      const st = partnerSwipe;
      if (!st?.tracking) return;
      if (st.id != null && e.pointerId !== st.id) return;
      st.lastX = e.clientX;
      st.lastY = e.clientY;
      const dx = e.clientX - st.x0;
      const dy = e.clientY - st.y0;
      // Cancel gift long-press once the finger drifts
      if (Math.abs(dx) + Math.abs(dy) > 12) clearGiftStripLongPress();
      // Mostly vertical — let it go (no skip visual)
      if (Math.abs(dy) > 28 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        st.tracking = false;
        resetPartnerSwipeVisual();
        partnerSwipe = null;
        return;
      }
      if (Math.abs(dx) < 10) return;
      st.moved = true;
      // Suppress partner-menu click for this gesture
      giftStripSuppressClick = true;
      swipeSkipSuppressClick = true;
      applyPartnerSwipeVisual(dx, tile.clientWidth || 320);
    },
    { passive: true }
  );

  tile.addEventListener("pointerup", (e) => endSwipe(e, false));
  tile.addEventListener("pointercancel", (e) => endSwipe(e, true));
  // If pointer leaves the tile while dragging, still finish on up (capture helps)
  tile.addEventListener("lostpointercapture", (e) => {
    if (partnerSwipe?.tracking) endSwipe(e, true);
  });
}

function wireGiftStrip() {
  const strip = $("gift-strip");
  const tile = $("tile-remote");
  if (!tile || tile.dataset.giftStripWired) return;
  tile.dataset.giftStripWired = "1";

  tile.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button != null && e.button !== 0) return;
      if (
        e.target?.closest?.(
          ".side-rail, .tile-dock, .tile-floor, .partner-menu, .gift-strip, .debate-overlay, .debate-mobile-bar, button, a, input, select, textarea, label, .fx-overlay"
        )
      ) {
        return;
      }
      if (!matched && !inFriendCall) return;
      clearGiftStripLongPress();
      giftStripLongPressTimer = setTimeout(() => {
        giftStripLongPressTimer = 0;
        // Don't open gifts if a swipe is already in progress
        if (partnerSwipe?.moved) return;
        giftStripSuppressClick = true;
        try {
          e.target?.setPointerCapture?.(e.pointerId);
        } catch (_) {}
        giftStripOpen();
        // Soft haptic
        try {
          navigator.vibrate?.(12);
        } catch (_) {}
      }, 480);
    },
    { passive: true }
  );
  tile.addEventListener("pointerup", clearGiftStripLongPress);
  tile.addEventListener("pointercancel", clearGiftStripLongPress);
  tile.addEventListener("pointerleave", clearGiftStripLongPress);
  tile.addEventListener("pointermove", (e) => {
    // Cancel if finger drifts too far
    if (!giftStripLongPressTimer) return;
    // movement cancels long-press slightly
    if (Math.abs(e.movementX) + Math.abs(e.movementY) > 14) clearGiftStripLongPress();
  });

  strip?.querySelectorAll("[data-gift]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const kind = btn.getAttribute("data-gift") || "";
      giftStripClose();
      spendEffectOnPartner(kind);
    });
  });
  $("gift-strip-more")?.addEventListener("click", (e) => {
    e.stopPropagation();
    giftStripClose();
    openStarsSheet($("local-stars-badge"));
  });
  // Tap outside strip closes it
  document.addEventListener("pointerdown", (e) => {
    const s = $("gift-strip");
    if (!s || s.hidden || !s.classList.contains("is-open")) return;
    if (e.target?.closest?.("#gift-strip, .gift-strip")) return;
    giftStripClose();
  });
}

/** Remove partner (remote tile) gift overlays — bars / flowers. */
function clearPartnerFx() {
  setFxOverlay("remote", "", 0);
}

/**
 * Clear gift overlays that sit on the conversationalist window.
 * Call whenever the remote tile leaves a live partner (skip / next / stop / they leave).
 * Keeps self (local) effects if still server-timed — those are on *your* cam.
 */
function clearRemoteMatchFx() {
  try {
    clearPartnerFx();
  } catch (_) {}
  try {
    giftStripClose();
  } catch (_) {}
}

function ensureFxTicker() {
  if (fxTickTimer) return;
  fxTickTimer = setInterval(() => {
    const now = unixNowSec();
    let any = false;
    if (partnerFx && partnerFx.until > now) {
      setFxOverlay(
        "remote",
        partnerFx.kind,
        partnerFx.until,
        partnerFx.level || 1
      );
      any = true;
    } else if (partnerFx) {
      setFxOverlay("remote", "", 0);
    }
    if (selfFx && selfFx.until > now) {
      setFxOverlay("local", selfFx.kind, selfFx.until, selfFx.level || 1);
      any = true;
    } else if (selfFx) {
      setFxOverlay("local", "", 0);
    }
    // Please stay timer on self (independent of cosmetic selfFx)
    if (selfNoSkipUntil > now) {
      setFxOverlay("local", "please_stay", selfNoSkipUntil);
      any = true;
    } else if (selfNoSkipUntil) {
      selfNoSkipUntil = 0;
      setFxOverlay("local", "please_stay", 0);
      updateNextSkipLockUi();
    }
    // Partner please_stay visual (element id remote-fx-please_stay)
    const stayRemote = $("remote-fx-please_stay");
    if (stayRemote && !stayRemote.hidden) {
      const tEl = $("remote-fx-please_stay-timer");
      const m = String(tEl?.textContent || "").match(/(\d+)\s*s/);
      // re-tick from data attribute if set
      const untilAttr = Number(stayRemote.dataset.until || 0);
      if (untilAttr > now) {
        if (tEl)
          tEl.textContent =
            _t("stars.pleaseStayTimer", { s: untilAttr - now }) ||
            `🙏 ${untilAttr - now}s`;
        any = true;
      } else if (untilAttr) {
        setFxOverlay("remote", "please_stay", 0);
      }
    }
    if (!any && fxTickTimer) {
      clearInterval(fxTickTimer);
      fxTickTimer = 0;
    }
  }, 1000);
}

/** Spend stars on a partner gift effect. */
function spendEffectOnPartner(effect) {
  const kind = String(effect || "bars").toLowerCase();
  const cost = giftCost(kind);
  const uid = primaryPartnerUserId || lastMatchMeta?.user_id || "";
  if (!uid) {
    setStatus(_t("stars.noPartner") || "No partner to gift");
    return;
  }
  if (!matched && !inFriendCall) {
    setStatus(_t("stars.needLive") || "Only during a live chat");
    return;
  }
  if (myStars < cost) {
    setStatus(
      _t("stars.needStars", { n: cost, have: myStars }) ||
        `Need ${cost} stars (you have ${myStars})`
    );
    return;
  }
  const nowMs = Date.now();
  if (lastGiftSpendAt && nowMs - lastGiftSpendAt < GIFT_RATE_LIMIT_MS) {
    const wait = Math.ceil((GIFT_RATE_LIMIT_MS - (nowMs - lastGiftSpendAt)) / 1000);
    setStatus(
      _t("stars.giftRateLimit", { s: wait }) ||
        `Easy — wait ${wait}s before another gift`
    );
    return;
  }
  lastGiftSpendAt = nowMs;
  trackEvent("star_spend", { effect: kind, cost });
  // Idempotency key: hub applies each op_id at most once (retry-safe, anti double-spend)
  const op_id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `sp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  send({ type: "spend_stars", to_user_id: uid, effect: kind, op_id });
  closePartnerMenu();
  giftStripClose();
}

function spendBarsOnPartner() {
  spendEffectOnPartner("bars");
}
function spendFlowersOnPartner() {
  spendEffectOnPartner("flowers");
}
function spendBalloonsOnPartner() {
  spendEffectOnPartner("balloons");
}
function spendConfettiOnPartner() {
  spendEffectOnPartner("confetti");
}
function spendHeartOnPartner() {
  spendEffectOnPartner("heart");
}
function spendFireworksOnPartner() {
  spendEffectOnPartner("fireworks");
}

/**
 * Apply hub rate-window hints (hello_ok / after local rate).
 * @param {{ rate_min_secs?: number, early_rates_left?: number }} msg
 */
function applyStarRateWindowFromHub(msg) {
  try {
    if (msg && msg.rate_min_secs != null) {
      const n = Math.max(60, Math.floor(Number(msg.rate_min_secs) || STAR_MIN_SECS));
      starRateMinSecs = n;
    }
    if (msg && msg.early_rates_left != null) {
      earlyRatesLeft = Math.max(
        0,
        Math.min(STAR_FIRST_RATE_SLOTS, Math.floor(Number(msg.early_rates_left) || 0))
      );
      // Keep min in sync if hub only sent left
      if (msg.rate_min_secs == null) {
        starRateMinSecs =
          earlyRatesLeft > 0 ? STAR_FIRST_RATE_SECS : STAR_MIN_SECS;
      }
    }
  } catch (_) {}
  try {
    syncStarsSheetUi?.();
  } catch (_) {}
}

/** After a successful local rate (gift or skip), consume one early slot. */
/** Remember a peer who praised us (for gift-back / reciprocity UI). */
function notePraiseReceived(uid, name, kind) {
  const id = String(uid || "").trim();
  if (!id || id === myUserId) return;
  try {
    if (!recentPraiseBy || typeof recentPraiseBy !== "object") {
      recentPraiseBy = {};
    }
    recentPraiseBy[id] = {
      name: String(name || "Partner").trim() || "Partner",
      kind: kind === "thanks" ? "thanks" : "star",
      ts: Date.now(),
    };
    // Cap map size
    const keys = Object.keys(recentPraiseBy);
    if (keys.length > 40) {
      keys
        .sort((a, b) => (recentPraiseBy[a].ts || 0) - (recentPraiseBy[b].ts || 0))
        .slice(0, keys.length - 30)
        .forEach((k) => delete recentPraiseBy[k]);
    }
  } catch (_) {}
}

/**
 * Soft nudge after someone praises you — gift back after long chats.
 * Once per uid per session (localStorage hour bucket).
 */
function maybeShowReciprocityNudge(uid, name, kind) {
  const id = String(uid || "").trim();
  if (!id) return;
  try {
    const key = `rulet_recip_${id}`;
    const hour = Math.floor(Date.now() / 3600000);
    if (sessionStorage.getItem(key) === String(hour)) return;
    sessionStorage.setItem(key, String(hour));
  } catch (_) {}
  const nm = String(name || "Partner").trim() || "Partner";
  const title =
    kind === "thanks"
      ? _t("stars.recipThanksTitle") || "They said thanks"
      : _t("stars.recipStarTitle") || "They praised you ★";
  const body =
    kind === "thanks"
      ? _t("stars.recipThanksBody", { name: nm }) ||
        `${nm} thanked you. After a long chat you can gift ★ or thank back.`
      : _t("stars.recipStarBody", { name: nm }) ||
        `${nm} gifted you ★. After long chats you can gift back once per person.`;
  try {
    showStarFeedbackToast("gift", { title, body });
  } catch (_) {
    setStatus(title);
  }
  trackEvent("stars_reciprocity_nudge", { kind: kind || "star" });
}

function noteLocalStarRateCompleted() {
  if (earlyRatesLeft > 0) {
    earlyRatesLeft = Math.max(0, earlyRatesLeft - 1);
  }
  starRateMinSecs =
    earlyRatesLeft > 0 ? STAR_FIRST_RATE_SECS : STAR_MIN_SECS;
  try {
    syncStarsSheetUi?.();
  } catch (_) {}
}

/**
 * Mid-chat ★ unlock progress (bar + status). 50% / 80% toasts; bar from ~20s.
 * @param {number} elapsedSec
 */
function maybeStarChatProgress(elapsedSec) {
  if (!matched && !inFriendCall) return;
  const need = Math.max(60, Number(starRateMinSecs) || STAR_MIN_SECS);
  const secs = Math.max(0, Math.floor(Number(elapsedSec) || 0));
  if (secs < 15) {
    hideStarUnlockBar();
    return;
  }
  const pct = Math.min(100, Math.round((secs / need) * 1000) / 10);
  const left = Math.max(0, need - secs);
  const lm = Math.floor(left / 60);
  const ls = left % 60;
  const leftStr = `${lm}:${String(ls).padStart(2, "0")}`;
  const early = earlyRatesLeft > 0 || need <= STAR_FIRST_RATE_SECS + 30;
  // Timer title
  try {
    const el = $("match-timer");
    if (el && !el.hidden) {
      if (secs < need) {
        el.title =
          (_t("stars.timerUnlock", {
            t: leftStr,
            m: Math.round(need / 60),
          }) ||
            `★ gift unlocks in ${leftStr} (${Math.round(need / 60)} min chat)`) +
          (early ? " · early" : "");
      } else {
        el.title =
          _t("stars.timerUnlockReady") ||
          "★ gift unlocks when chat ends (long enough)";
      }
    }
  } catch (_) {}
  // Visible unlock bar next to timer
  try {
    syncStarUnlockBar(pct, secs, need, leftStr, early);
  } catch (_) {}
  if (secs >= need) {
    if (!starProgressReadyShown) {
      starProgressReadyShown = true;
      setStatus(
        _t("stars.progressReady") ||
          "★ gift unlocked — you’ll be offered a star when the chat ends"
      );
      trackEvent("star_progress_ready", {
        need,
        early: early ? 1 : 0,
      });
    }
    return;
  }
  const half = need * 0.5;
  const near = need * 0.8;
  if (!starProgressHalfShown && secs >= half) {
    starProgressHalfShown = true;
    const leftM = Math.max(1, Math.ceil((need - secs) / 60));
    setStatus(
      _t("stars.progressHalf", { m: leftM, need: Math.round(need / 60) }) ||
        `Halfway to ★ — about ${leftM} min left to unlock gift`
    );
    trackEvent("star_progress_half", {
      need,
      early: early ? 1 : 0,
    });
  } else if (!starProgressNearShown && secs >= near) {
    starProgressNearShown = true;
    const leftM = Math.max(1, Math.ceil((need - secs) / 60));
    setStatus(
      _t("stars.progressNear", { m: leftM }) ||
        `Almost there — ~${leftM} min until you can gift a star`
    );
    trackEvent("star_progress_near", {
      need,
      early: early ? 1 : 0,
    });
  }
}

/**
 * On Next / Stop: if chat was ≥80% of gift-unlock need but not yet there,
 * nudge once so users know they left early.
 * Call while match is still live (before timer teardown).
 */
function maybeAlmostGiftUnlockOnLeave(reason) {
  try {
    if (!matched && !inFriendCall) return;
    // Friend party-browse next keeps the friend — no leave tip for that path
    if (reason === "next" && (inFriendCall || matchMode === "friend") && yourRole === "party") {
      return;
    }
    const need = Math.max(60, Number(starRateMinSecs) || STAR_MIN_SECS);
    let secs = 0;
    if (matchTimerStartedAt) {
      secs = Math.max(0, Math.floor((Date.now() - matchTimerStartedAt) / 1000));
    } else {
      secs = Math.max(0, Math.floor(Number(lastMatchDurationSec) || 0));
    }
    if (secs < need * 0.8 || secs >= need) return;
    const left = Math.max(1, need - secs);
    const leftM = Math.max(1, Math.ceil(left / 60));
    const leftS = left % 60;
    const leftStr =
      left >= 60
        ? `${leftM} min`
        : `${leftS}s`;
    const pct = Math.round((secs / need) * 100);
    showStarFeedbackToast("gift", {
      title: _t("stars.leaveAlmostTitle") || "Almost unlocked ★",
      body:
        _t("stars.leaveAlmostBody", { t: leftStr, pct }) ||
        `You were ${pct}% there — stay ~${leftStr} next time to unlock a star gift.`,
      corner: true,
      ico: "★",
      level: 1,
    });
    trackEvent("star_leave_almost", {
      need,
      secs,
      pct,
      reason: String(reason || "leave"),
      friend: inFriendCall || matchMode === "friend" ? 1 : 0,
    });
  } catch (_) {}
}

function hideStarUnlockBar() {
  const bar = $("star-unlock-bar");
  if (!bar) return;
  bar.hidden = true;
  bar.setAttribute("hidden", "");
  bar.classList.remove("is-ready", "is-near");
}

function syncStarUnlockBar(pct, secs, need, leftStr, early) {
  const bar = $("star-unlock-bar");
  const fill = $("star-unlock-fill");
  const lbl = $("star-unlock-lbl");
  if (!bar) return;
  const live = !!(matched || inFriendCall);
  if (!live || secs < 20) {
    hideStarUnlockBar();
    return;
  }
  bar.hidden = false;
  bar.removeAttribute("hidden");
  const ready = secs >= need;
  bar.classList.toggle("is-ready", ready);
  bar.classList.toggle("is-near", !ready && pct >= 80);
  if (fill) fill.style.width = `${Math.min(100, Math.max(2, pct))}%`;
  if (lbl) {
    if (ready) {
      lbl.textContent = _t("stars.unlockBarReady") || "★ ready";
    } else {
      lbl.textContent =
        _t("stars.unlockBarLeft", { t: leftStr }) || `★ ${leftStr}`;
    }
  }
  bar.title = ready
    ? _t("stars.timerUnlockReady") || "★ gift unlocks when chat ends"
    : (_t("stars.timerUnlock", {
        t: leftStr,
        m: Math.round(need / 60),
      }) ||
        `★ gift unlocks in ${leftStr}`) + (early ? " · early" : "");
  bar.setAttribute("aria-valuenow", String(Math.round(pct)));
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("role", "progressbar");
}

/**
 * After RatePrompt from hub (chat long enough): gift 1–3★ (by your tier) or skip.
 * First 3 unique partners: 5 min · after that: 15 min.
 * Normal → max 1 · Trusted 100+ → max 2 · Senior 250+ → max 3.
 * Same pair can only review once (server-enforced).
 */
function showStarReviewPrompt(msg) {
  try {
    const uid = String(msg?.user_id || "").trim();
    if (!uid) return;
    if ($("star-review-toast")) return;
    const name = String(msg?.name || lastMatchMeta?.name || "Partner").trim() || "Partner";
    const minReq = Math.max(
      60,
      Number(msg?.min_secs) || starRateMinSecs || STAR_MIN_SECS
    );
    const secs = Math.max(0, Number(msg?.duration_secs) || minReq);
    const mins = Math.max(1, Math.floor(secs / 60));
    const hourChat = secs >= 3600;
    const early = !!(msg?.early || minReq < STAR_MIN_SECS);
    // Prefer server max_gift; fall back to local tier
    let maxGift = Math.max(1, Math.min(3, Number(msg?.max_gift) || 0));
    if (!maxGift || maxGift < 1) {
      maxGift = reportWeightForStars(myTrustEffective || myTrust); // effective tier
    }
    maxGift = Math.max(1, Math.min(3, maxGift));
    const theyPraised = !!(recentPraiseBy && recentPraiseBy[uid]);
    const toast = document.createElement("div");
    toast.id = "star-review-toast";
    toast.className =
      "friend-soft-toast star-review-toast" +
      (theyPraised ? " is-reciprocity" : "");
    toast.setAttribute("role", "dialog");
    toast.style.pointerEvents = "auto";
    let body =
      maxGift >= 3
        ? _t("stars.reviewBodySenior", { name, m: mins, n: maxGift }) ||
          `${name} · ${mins}+ min. As a senior you can gift up to ${maxGift}★.`
        : maxGift >= 2
          ? _t("stars.reviewBodyTrusted", { name, m: mins, n: maxGift }) ||
            `${name} · ${mins}+ min. As trusted you can gift up to ${maxGift}★.`
          : hourChat
            ? _t("stars.reviewBodyHour", { name, m: mins }) ||
              `${name} · you talked ${mins}+ min. You both already earned a star for 1 hour — gift an extra?`
            : early
              ? _t("stars.reviewBodyEarly", { name, m: mins }) ||
                `${name} · ${mins}+ min (first chats unlock earlier). Give a star?`
              : _t("stars.reviewBody", { name, m: mins }) ||
                `${name} · you talked ${mins}+ min. Give a star?`;
    if (theyPraised) {
      body =
        (_t("stars.reviewBodyReciprocity", { name, m: mins }) ||
          `${name} praised you earlier · ${mins}+ min — gift back?`) +
        (maxGift > 1 ? ` (up to ${maxGift}★)` : "");
    }
    const title = theyPraised
      ? _t("stars.reviewTitleReciprocity") || "Gift back?"
      : maxGift >= 2
        ? _t("stars.reviewTitleMulti", { n: maxGift }) || `Gift stars (up to ${maxGift}★)?`
        : hourChat
          ? _t("stars.reviewTitleExtra") || "Gift an extra star?"
          : early
            ? _t("stars.reviewTitleEarly") || "Rate this chat? (early unlock)"
            : _t("stars.reviewTitle") || "Rate this chat?";
    let giftBtns = "";
    for (let a = 1; a <= maxGift; a++) {
      const label =
        theyPraised && a === 1
          ? _t("stars.giftBack1") || "★ Gift back"
          : a === 1
            ? _t("stars.give1") || "★ 1"
            : a === 2
              ? _t("stars.give2") || "★★ 2"
              : _t("stars.give3") || "★★★ 3";
      const primary = theyPraised && a === 1 ? " accent" : "";
      giftBtns += `<button type="button" class="pill tight${primary} btn-star-yes" data-star-amount="${a}">${escapeHtml(
        label
      )}</button>`;
    }
    // Reciprocity: gift buttons first (primary CTA), then thanks / skip
    toast.innerHTML = theyPraised
      ? `
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(body)}</span>
      <div class="export-nudge-actions star-review-actions" style="margin-top:0.45rem">
        ${giftBtns}
        <button type="button" class="pill tight ghost" id="btn-star-thanks">${escapeHtml(
          _t("stars.thanks") || "Thanks"
        )}</button>
        <button type="button" class="pill tight ghost" id="btn-star-no">${escapeHtml(
          _t("stars.skip") || "No star"
        )}</button>
      </div>`
      : `
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(body)}</span>
      <div class="export-nudge-actions star-review-actions" style="margin-top:0.45rem">
        <button type="button" class="pill tight ghost" id="btn-star-no">${escapeHtml(
          _t("stars.skip") || "No star"
        )}</button>
        <button type="button" class="pill tight ghost" id="btn-star-thanks">${escapeHtml(
          _t("stars.thanks") || "Thanks"
        )}</button>
        ${giftBtns}
      </div>`;
    document.body.appendChild(toast);
    const dismiss = () => {
      if (toast.parentNode) toast.remove();
    };
    const sendRate = (amount, thanks) => {
      const star = amount > 0;
      trackEvent("star_rate", {
        star: star ? 1 : 0,
        amount: amount || 0,
        thanks: thanks ? 1 : 0,
        max: maxGift,
        early: early ? 1 : 0,
        min: minReq,
      });
      send({
        type: "rate_partner",
        user_id: uid,
        star: !!star,
        amount: star ? amount : 0,
        thanks: !star && !!thanks,
      });
      noteLocalStarRateCompleted();
      dismiss();
      setStatus(
        star
          ? amount > 1
            ? _t("stars.givenN", { n: amount }) || `★ ${amount} given`
            : _t("stars.given") || "Star given"
          : thanks
            ? _t("stars.thanksSent") || "Thanks sent"
            : _t("stars.skipped") || "No star"
      );
    };
    $("btn-star-no")?.addEventListener("click", () => {
      sendRate(0, false);
      setTimeout(() => {
        try {
          maybeShowPostMatchFriendNudge("after_star_review", { force: true });
        } catch (_) {}
      }, 400);
    });
    $("btn-star-thanks")?.addEventListener("click", () => {
      sendRate(0, true);
      setTimeout(() => {
        try {
          maybeShowPostMatchFriendNudge("after_star_thanks", { force: true });
        } catch (_) {}
      }, 400);
    });
    toast.querySelectorAll("[data-star-amount]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = Math.max(1, Math.min(3, Number(btn.getAttribute("data-star-amount")) || 1));
        sendRate(a, false);
        setTimeout(() => {
          try {
            maybeShowPostMatchFriendNudge("after_star_gift", { force: true });
          } catch (_) {}
        }, 600);
      });
    });
    // Auto-dismiss without rating after 50s (user can only rate while pending on server)
    setTimeout(() => {
      dismiss();
      try {
        maybeShowPostMatchFriendNudge("after_star_timeout", { force: true });
      } catch (_) {}
    }, 50000);
  } catch (_) {}
}

/**
 * Capture last stranger so user can Report/Block after hangup or drop.
 * Always schedules for strangers with a user id (no min duration).
 * Friend-add nudge still lives in schedulePostMatchFriendNudge.
 */
function schedulePostMatchSafetyNudge(reason) {
  try {
    if (matchMode === "friend" || inFriendCall) return;
    const uid = String(
      primaryPartnerUserId || lastMatchMeta?.user_id || ""
    ).trim();
    if (!uid || uid === myUserId) return;
    if ((blockedCache || []).includes(uid)) return;
    if (safetyNudgeShown.has(uid)) return;
    postMatchSafetySnap = {
      uid,
      name:
        lastMatchMeta?.name ||
        lastMatchMeta?.short_id ||
        _t("remote.tag") ||
        "Partner",
      short_id: lastMatchMeta?.short_id || "",
      friend_code: lastMatchMeta?.friend_code || "",
      reason: reason || "",
    };
    // Ensure they appear in Call history for later Block
    try {
      pushHistory({
        kind: "stranger",
        name: postMatchSafetySnap.name,
        user_id: uid,
        friend_code: postMatchSafetySnap.friend_code,
        short_id: postMatchSafetySnap.short_id,
      });
    } catch (_) {}
    if (postMatchSafetyNudgeTimer) {
      clearTimeout(postMatchSafetyNudgeTimer);
      postMatchSafetyNudgeTimer = 0;
    }
    postMatchSafetyNudgeTimer = setTimeout(() => {
      postMatchSafetyNudgeTimer = 0;
      maybeShowPostMatchSafetyNudge(reason);
    }, 450);
  } catch (_) {}
}

function maybeShowPostMatchSafetyNudge(reason) {
  try {
    const snap = postMatchSafetySnap;
    const uid = String(snap?.uid || "").trim();
    if (!uid) return;
    if (safetyNudgeShown.has(uid)) return;
    if ((blockedCache || []).includes(uid)) return;
    if ($("post-match-safety-nudge")) return;
    // Don't fight star review / friend nudge — wait a beat
    if ($("star-review-toast") || $("post-match-friend-nudge")) {
      postMatchSafetyNudgeTimer = setTimeout(() => {
        postMatchSafetyNudgeTimer = 0;
        maybeShowPostMatchSafetyNudge(reason || snap?.reason);
      }, 2800);
      return;
    }
    safetyNudgeShown.add(uid);
    postMatchSafetySnap = null;
    const name = snap?.name || "Partner";
    const code = String(snap?.friend_code || "").trim().toUpperCase();
    const canAddFriend =
      !!code &&
      !isPartnerAlreadyFriend(uid, code) &&
      !isPartnerRequestPending(uid, code);
    const toast = document.createElement("div");
    toast.id = "post-match-safety-nudge";
    toast.className =
      "friend-soft-toast post-match-friend-nudge post-match-safety-nudge is-force";
    toast.setAttribute("role", "dialog");
    toast.style.pointerEvents = "auto";
    const addFriendBtn = canAddFriend
      ? `<button type="button" class="pill tight accent post-match-primary" id="btn-post-safety-add">${escapeHtml(
          _t("friends.add") || "Add friend"
        )}</button>`
      : "";
    toast.innerHTML = `
      <strong>${escapeHtml(
        _t("friends.safetyNudgeTitle") || "Last partner"
      )}</strong>
      <span>${escapeHtml(
        canAddFriend
          ? _t("friends.safetyNudgeBodyAdd", { n: name }) ||
              `${name} — Add as friend to Call later, or Report / Block if needed. Also under Friends → Call history.`
          : _t("friends.safetyNudgeBody", { n: name }) ||
              `${name} — Report or Block if they broke the rules. Also under Friends → Call history → All.`
      )}</span>
      <div class="export-nudge-actions post-match-actions post-match-actions-force" style="margin-top:0.55rem">
        ${addFriendBtn}
        <button type="button" class="pill tight danger" id="btn-post-safety-report">${escapeHtml(
          _t("partnerMenu.reportNext") || "Report · Block"
        )}</button>
        <button type="button" class="pill tight danger" id="btn-post-safety-block">${escapeHtml(
          _t("friends.blockFromHistory") || "Block"
        )}</button>
        <button type="button" class="pill tight ghost" id="btn-post-safety-history">${escapeHtml(
          _t("friends.openHistory") || "Call history"
        )}</button>
        <button type="button" class="pill tight ghost" id="btn-post-safety-dismiss">${escapeHtml(
          _t("friends.postMatchNo") || "Dismiss"
        )}</button>
      </div>`;
    document.body.appendChild(toast);
    trackEvent("safety_nudge_show", {
      reason: reason || snap?.reason || "",
      can_add: canAddFriend ? 1 : 0,
    });
    const dismiss = () => {
      if (toast.parentNode) toast.remove();
    };
    $("btn-post-safety-dismiss")?.addEventListener("click", () => {
      trackEvent("safety_nudge_dismiss");
      dismiss();
    });
    $("btn-post-safety-history")?.addEventListener("click", () => {
      trackEvent("safety_nudge_history");
      dismiss();
      try {
        openFriends();
        historyFilterMode = "all";
        try {
          syncHistoryFilterUi();
        } catch (_) {}
        setFriendsSheetTab("history");
        renderHistoryList();
      } catch (_) {}
    });
    $("btn-post-safety-add")?.addEventListener("click", () => {
      trackEvent("safety_nudge_add_friend");
      try {
        const ok = requestAddFriend(code);
        if (ok) {
          try {
            friendNudgeShown.add(uid || code);
          } catch (_) {}
          // Morph into request-sent step (same funnel as friend nudge)
          try {
            showPostMatchFriendSentStep(toast, { name, code });
            return;
          } catch (_) {}
        }
      } catch (_) {}
      dismiss();
    });
    $("btn-post-safety-block")?.addEventListener("click", () => {
      trackEvent("safety_nudge_block");
      dismiss();
      try {
        blockUserId(uid, { fromHistory: true, removeFromHistory: false });
      } catch (_) {}
    });
    $("btn-post-safety-report")?.addEventListener("click", () => {
      trackEvent("safety_nudge_report");
      dismiss();
      try {
        // Offline report + block (no live match required)
        saveLocalReport({
          t: Date.now(),
          user_id: uid,
          name: snap?.name || "",
          short_id: snap?.short_id || "",
          friend_code: snap?.friend_code || "",
          reason: "explicit",
        });
        send({
          type: "report_user",
          user_id: uid,
          reason: "explicit",
        });
        blockUserId(uid, {
          silent: true,
          skipToast: false,
          fromHistory: true,
          removeFromHistory: false,
        });
        setStatus(
          _t("partnerMenu.reportOkFull") ||
            "Reported · blocked. You will not match them again."
        );
      } catch (_) {}
    });
    setTimeout(dismiss, 28000);
  } catch (_) {}
}

function schedulePostMatchFriendNudge(reason) {
  try {
    // Always offer Report/Block for last stranger (safety > retention)
    try {
      schedulePostMatchSafetyNudge(reason);
    } catch (_) {}
    if (matchMode === "friend" || inFriendCall) return;
    const code = String(lastMatchMeta?.friend_code || "").toUpperCase();
    const uid = primaryPartnerUserId || lastMatchMeta?.user_id || "";
    if (!code && !uid) return;
    if (isPartnerAlreadyFriend(uid, code) || isPartnerRequestPending(uid, code)) {
      return;
    }
    if (!code) return;
    const sec = matchDurationSec();
    if (sec < POST_MATCH_FRIEND_MIN_SEC) return;
    const key = uid || code;
    if (friendNudgeShown.has(key)) return;
    postMatchFriendSnap = {
      code,
      uid,
      name:
        lastMatchMeta?.name || lastMatchMeta?.short_id || code || "Partner",
      sec,
      reason: reason || "",
      key,
    };
    if (postMatchFriendNudgeTimer) {
      clearTimeout(postMatchFriendNudgeTimer);
      postMatchFriendNudgeTimer = 0;
    }
    // ≥15 min chats often get rate_prompt first — wait a beat so both don't fight.
    const delay = sec >= 15 * 60 ? 3200 : sec >= 5 * 60 ? 900 : 280;
    postMatchFriendNudgeTimer = setTimeout(() => {
      postMatchFriendNudgeTimer = 0;
      maybeShowPostMatchFriendNudge(reason, { fromSchedule: true });
    }, delay);
  } catch (_) {}
}

/**
 * Morph post-match toast into “request sent → Call later” so the funnel continues.
 */
function showPostMatchFriendSentStep(toast, { name, code }) {
  if (!toast || !toast.parentNode) return;
  toast.classList.add("is-sent");
  toast.innerHTML = `
      <strong>${escapeHtml(
        _t("friends.postMatchSentTitle") || "Request sent"
      )}</strong>
      <span>${escapeHtml(
        _t("friends.postMatchSentBody", { name: name || "them" }) ||
          `When ${name || "they"} Accept, you’ll both show Online — tap Call back.`
      )}</span>
      <span class="post-match-steps">${escapeHtml(
        _t("friends.postMatchSentSteps") ||
          "They Accept → you see them Online → Call back"
      )}</span>
      <span class="post-match-code mono">${escapeHtml(
        (_t("friends.theirCode") || "Code") + ": " + (code || "")
      )}</span>
      <div class="export-nudge-actions post-match-actions" style="margin-top:0.45rem">
        <button type="button" class="pill tight ghost" id="btn-post-friend-done">${escapeHtml(
          _t("friends.postMatchDone") || "Got it"
        )}</button>
        <button type="button" class="pill tight accent" id="btn-post-friend-open">${escapeHtml(
          _t("friends.open") || "Friends"
        )}</button>
      </div>`;
  const dismiss = () => {
    if (toast.parentNode) toast.remove();
  };
  $("btn-post-friend-done")?.addEventListener("click", dismiss);
  $("btn-post-friend-open")?.addEventListener("click", () => {
    trackEvent("friend_nudge_open_friends_after_add");
    dismiss();
    try {
      openFriends();
      try {
        setFriendsSheetTab("history");
      } catch (_) {}
    } catch (_) {}
  });
  setTimeout(dismiss, 22000);
  trackEvent("friend_nudge_sent_step");
}

function maybeShowPostMatchFriendNudge(reason, opts = {}) {
  try {
    // Week-2 retention: always show real toast (not SOFT_POPUPS-gated).
    if (matchMode === "friend" || inFriendCall) return;
    // Prefer scheduled snapshot (survives stop/next clearing partner fields)
    const snap = postMatchFriendSnap;
    const code = String(
      snap?.code || lastMatchMeta?.friend_code || ""
    ).toUpperCase();
    const uid =
      snap?.uid || primaryPartnerUserId || lastMatchMeta?.user_id || "";
    if (!code && !uid) return;
    if (isPartnerAlreadyFriend(uid, code) || isPartnerRequestPending(uid, code)) {
      return;
    }
    if (!code) return;
    const sec = Math.max(
      0,
      Number(snap?.sec) || matchDurationSec() || 0
    );
    if (sec < POST_MATCH_FRIEND_MIN_SEC) return;
    const key = uid || code;
    if (friendNudgeShown.has(key)) return;
    if ($("post-match-friend-nudge")) return;
    // If star review is open, wait until it closes (re-schedule once)
    if ($("star-review-toast") && !opts.force) {
      if (!opts.fromSchedule) schedulePostMatchFriendNudge(reason || snap?.reason);
      return;
    }
    friendNudgeShown.add(key);
    postMatchFriendSnap = null;
    const name =
      snap?.name ||
      lastMatchMeta?.name ||
      lastMatchMeta?.short_id ||
      code ||
      "Partner";
    const longChat = sec >= 5 * 60;
    const deepChat = sec >= 15 * 60;
    const mins = Math.max(1, Math.floor(sec / 60));
    const toast = document.createElement("div");
    toast.id = "post-match-friend-nudge";
    toast.className =
      "friend-soft-toast post-match-friend-nudge is-force" +
      (longChat ? " is-warm" : "") +
      (deepChat ? " is-deep" : "");
    toast.setAttribute("role", "dialog");
    toast.style.pointerEvents = "auto";
    const title = deepChat
      ? _t("friends.postMatchTitleLong") || "Great chat — stay in touch?"
      : longChat
        ? _t("friends.postMatchTitleWarm") || "Liked the chat?"
        : _t("friends.postMatchTitle") || "Add as friend?";
    const body = deepChat
      ? _t("friends.postMatchBodyLong", { name, m: mins }) ||
        `${name} · ${mins}+ min. Add them to Call later when online.`
      : longChat
        ? _t("friends.postMatchBodyWarm", { name, m: mins }) ||
          `${name} · ${mins} min. Request them — Call when you’re both free.`
        : _t("friends.postMatchBody", { name }) ||
          `${name} · request them to Call later when online.`;
    const steps =
      _t("friends.postMatchSteps") ||
      "Add → they Accept → Call when online";
    toast.innerHTML = `
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(body)}</span>
      <span class="post-match-steps">${escapeHtml(steps)}</span>
      <span class="post-match-code mono">${escapeHtml(
        (_t("friends.theirCode") || "Code") + ": " + code
      )}</span>
      <div class="export-nudge-actions post-match-actions post-match-actions-force" style="margin-top:0.55rem">
        <button type="button" class="pill tight accent post-match-primary" id="btn-post-friend-yes">${escapeHtml(
          _t("friends.postMatchYes") || "Add friend"
        )}</button>
        <button type="button" class="pill tight ghost" id="btn-post-friend-copy">${escapeHtml(
          _t("friends.copyCode") || "Copy code"
        )}</button>
        <button type="button" class="pill tight ghost" id="btn-post-friend-no">${escapeHtml(
          _t("friends.postMatchNo") || "No thanks"
        )}</button>
      </div>`;
    document.body.appendChild(toast);
    trackEvent("friend_nudge_show", {
      reason: reason || snap?.reason || "",
      sec,
      long: longChat ? 1 : 0,
      deep: deepChat ? 1 : 0,
      force: 1,
    });
    const dismiss = () => {
      if (toast.parentNode) toast.remove();
    };
    $("btn-post-friend-no")?.addEventListener("click", () => {
      trackEvent("friend_nudge_dismiss", {
        reason: reason || snap?.reason || "",
        sec,
      });
      dismiss();
    });
    $("btn-post-friend-copy")?.addEventListener("click", async () => {
      trackEvent("friend_nudge_copy_code", {
        reason: reason || snap?.reason || "",
      });
      try {
        await copyToClipboard(code, "friends.codeCopied");
      } catch (_) {
        setStatus(code);
      }
    });
    $("btn-post-friend-yes")?.addEventListener("click", () => {
      trackEvent("friend_nudge_accept", {
        reason: reason || snap?.reason || "",
        sec,
      });
      const ok = requestAddFriend(code);
      if (ok !== false) {
        showPostMatchFriendSentStep(toast, { name, code });
      } else {
        dismiss();
      }
    });
    // Longer window — primary retention moment
    setTimeout(dismiss, deepChat ? 32000 : longChat ? 28000 : 22000);
  } catch (_) {}
}

/** Soft invite after Stop when the public pool was quiet — once, never a nag loop. */
const STOP_INVITE_KEY = "ruletka-stop-invite-nudge-v1";

function stopInviteNudgeDone() {
  try {
    return localStorage.getItem(STOP_INVITE_KEY) === "1";
  } catch {
    return true;
  }
}

function markStopInviteNudgeDone() {
  try {
    localStorage.setItem(STOP_INVITE_KEY, "1");
  } catch (_) {}
}

function maybeShowStopInviteNudge() {
  try {
    if (!SOFT_POPUPS_ENABLED) {
      markStopInviteNudgeDone();
      return;
    }
    if (stopInviteNudgeDone()) return;
    if (matched || inFriendCall || inQueue || wantSearch) return;
    if (
      $("post-match-friend-nudge") ||
      $("stop-invite-nudge") ||
      $("star-review-toast")
    )
      return;
    // Only when pool felt empty (alone / quiet)
    const others = Math.max(0, (lastWaitingCount || 0) - 1);
    if (others > 0) return;
    markStopInviteNudgeDone();
    const toast = document.createElement("div");
    toast.id = "stop-invite-nudge";
    toast.className = "friend-soft-toast stop-invite-nudge is-warm";
    toast.setAttribute("role", "status");
    toast.style.pointerEvents = "auto";
    const code = String(myFriendCode || "").toUpperCase();
    const codeLine = code
      ? `<span class="post-match-code mono">${escapeHtml(
          (_t("friends.yourCode") || "Your code") + ": " + code
        )}</span>`
      : "";
    toast.innerHTML = `
      <strong>${escapeHtml(
        _t("remote.stopInviteTitle") || "Bring a friend"
      )}</strong>
      <span>${escapeHtml(
        _t("remote.stopInviteBody") ||
          "Pool was quiet — share your invite so a friend can join and Call you."
      )}</span>
      <span class="post-match-steps">${escapeHtml(
        _t("friends.postMatchSteps") ||
          "Add → they Accept → Call when online"
      )}</span>
      ${codeLine}
      <div class="export-nudge-actions" style="margin-top:0.45rem">
        <button type="button" class="pill tight ghost" id="btn-stop-invite-later">${escapeHtml(
          _t("friends.exportNudgeLater") || "Later"
        )}</button>
        <button type="button" class="pill tight" id="btn-stop-invite-friends">${escapeHtml(
          _t("friends.open") || "Friends"
        )}</button>
        <button type="button" class="pill tight accent" id="btn-stop-invite-share">${escapeHtml(
          _t("friends.inviteLiveCta") || "Share invite · I’m live"
        )}</button>
      </div>`;
    document.body.appendChild(toast);
    trackEvent("stop_invite_show");
    const dismiss = () => {
      if (toast.parentNode) toast.remove();
    };
    $("btn-stop-invite-later")?.addEventListener("click", () => {
      trackEvent("stop_invite_later");
      dismiss();
    });
    $("btn-stop-invite-friends")?.addEventListener("click", () => {
      trackEvent("stop_invite_friends");
      dismiss();
      openFriends();
    });
    $("btn-stop-invite-share")?.addEventListener("click", async () => {
      trackEvent("stop_invite_share");
      dismiss();
      try {
        await shareFriendInvite({ preferShare: true, liveNow: true });
      } catch (_) {
        if (ROOMS_ENABLED) {
          shareOrCopy(
            roomShareUrl({ mintIfEmpty: true }),
            siteBrandName() + " room",
            "room.shared",
            "room.copied",
            { preferShare: true }
          );
        }
      }
    });
    setTimeout(dismiss, 18000);
  } catch (_) {}
}

function refreshHubChip() {
  const chip = $("hub-chip");
  const label = $("hub-chip-label");
  if (!chip || !label) return;
  let base = location.origin;
  try {
    if (typeof RuletHub !== "undefined" && RuletHub.base) base = RuletHub.base();
  } catch (_) {}
  let host = "";
  try {
    host = new URL(base).host;
  } catch {
    host = String(base || "").replace(/^https?:\/\//, "");
  }
  // Hide when same as brand seed names and same origin (less chrome noise)
  const pageHost = location.host;
  if (!host || host === pageHost) {
    chip.hidden = true;
    return;
  }
  label.textContent = host;
  chip.hidden = false;
  chip.title = (_t("hub.current") || "Current hub") + ": " + base;
}

function renderChatBubbleEl(msg) {
  const d = document.createElement("div");
  const cls = msg.cls || (msg.mine ? "mine" : "theirs");
  d.className = "chat-bubble " + (cls === "mine" ? "mine" : cls === "theirs" ? "theirs" : "sys");
  if (msg.author && !msg.mine) {
    const w = document.createElement("span");
    w.className = "who";
    w.textContent = msg.author;
    d.appendChild(w);
  }
  appendLinkified(d, msg.body || "");
  return d;
}

/** Auto-link http(s) URLs in chat bodies. */
function appendLinkified(parent, text) {
  const re = /(https?:\/\/[^\s<>"']+)/gi;
  let last = 0;
  let m;
  const s = String(text || "");
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) {
      parent.appendChild(document.createTextNode(s.slice(last, m.index)));
    }
    let href = m[1];
    // strip trailing punctuation often stuck to URLs
    let trail = "";
    while (/[.,);:!?]/.test(href.slice(-1))) {
      trail = href.slice(-1) + trail;
      href = href.slice(0, -1);
    }
    const a = document.createElement("a");
    a.className = "chat-link";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = href;
    parent.appendChild(a);
    if (trail) parent.appendChild(document.createTextNode(trail));
    last = m.index + m[0].length;
  }
  if (last < s.length) {
    parent.appendChild(document.createTextNode(s.slice(last)));
  }
}

function renderThreadToDom(threadKey) {
  const box = $("chat-messages");
  if (!box) return;
  clearChatDom();
  const map = loadChatThreads();
  const thr = map[threadKey];
  if (!thr || !Array.isArray(thr.msgs)) return;
  for (const msg of thr.msgs) {
    box.appendChild(renderChatBubbleEl(msg));
  }
  box.scrollTop = box.scrollHeight;
}

/** True if any live peer has an open chat data channel (E2E path). */
function anyChatDcOpen() {
  for (const pc of peerPcs.values()) {
    if (pc && typeof pc.isChatDcOpen === "function" && pc.isChatDcOpen()) return true;
  }
  return false;
}

/**
 * Peers that should receive live match chat (strangers/party; friend when in friend call).
 * @returns {InstanceType<typeof RouletteWebRtc>[]}
 */
function chatPeerPcs() {
  const out = [];
  for (const pc of peerPcs.values()) {
    if (!pc) continue;
    const role = pc._role || "stranger";
    if (role === "friend") {
      if (matchMode === "friend" || inFriendCall) out.push(pc);
    } else {
      out.push(pc);
    }
  }
  return out;
}

/**
 * Send live match/friend-call chat. Prefers WebRTC data channel (E2E);
 * falls back to bridge WSS so chat still works before ICE completes.
 * @param {string} body
 * @param {{ asFriend?: boolean, peerUserId?: string }} [opts]
 * @returns {"p2p"|"hub"|false}
 */
/* ── Typing indicators (P2P datachannel) ── */
const TYPING_IDLE_MS = 2500;
const TYPING_REMOTE_HOLD_MS = 3200;
let typingLocalOn = false;
let typingIdleTimer = 0;
let typingRemoteTimer = 0;
/** @type {{ userId: string, name: string, until: number } | null} */
let typingRemote = null;

function sendTypingP2p(on) {
  const payload = {
    v: 1,
    type: on ? "typing" : "typing_stop",
    user_id: myUserId || "",
    name: getDisplayName() || "anon",
    ts: Date.now(),
  };
  let ok = false;
  for (const pc of chatPeerPcs()) {
    if (pc?.sendChatMessage?.(payload)) ok = true;
  }
  // Fallback: primary rtc if chatPeerPcs empty mid-handshake
  if (!ok && rtc?.sendChatMessage?.(payload)) ok = true;
  return ok;
}

function notifyLocalTyping() {
  // Only while live match/friend call with a partner
  if (!matched && !inFriendCall) return;
  if (!primaryPartnerUserId && !activeChat?.peerUserId) return;
  if (!anyChatDcOpen() && !rtc?.isChatDcOpen?.()) return;
  if (!typingLocalOn) {
    typingLocalOn = true;
    sendTypingP2p(true);
  }
  if (typingIdleTimer) clearTimeout(typingIdleTimer);
  typingIdleTimer = setTimeout(() => {
    typingIdleTimer = 0;
    stopLocalTyping();
  }, TYPING_IDLE_MS);
}

function stopLocalTyping() {
  if (typingIdleTimer) {
    clearTimeout(typingIdleTimer);
    typingIdleTimer = 0;
  }
  if (!typingLocalOn) return;
  typingLocalOn = false;
  try {
    sendTypingP2p(false);
  } catch (_) {}
}

function clearRemoteTyping(fromUserId) {
  if (
    fromUserId &&
    typingRemote?.userId &&
    fromUserId !== typingRemote.userId
  ) {
    return;
  }
  typingRemote = null;
  if (typingRemoteTimer) {
    clearTimeout(typingRemoteTimer);
    typingRemoteTimer = 0;
  }
  updateTypingUi();
}

function handleTypingP2pMessage(msg) {
  const uid = String(msg.user_id || "").slice(0, 64);
  if (!uid || uid === myUserId) return;
  // Only show for current live partner (or active friend thread)
  const partner =
    primaryPartnerUserId ||
    (activeChat?.live ? activeChat.peerUserId : "") ||
    "";
  if (partner && uid !== partner) return;
  const name = String(
    msg.name ||
      lastMatchMeta?.name ||
      friendDisplayName(friendsCache.find((f) => f.user_id === uid)) ||
      _t("remote.tag") ||
      "Partner"
  ).slice(0, 32);
  if (msg.type === "typing_stop") {
    clearRemoteTyping(uid);
    return;
  }
  typingRemote = {
    userId: uid,
    name,
    until: Date.now() + TYPING_REMOTE_HOLD_MS,
  };
  if (typingRemoteTimer) clearTimeout(typingRemoteTimer);
  typingRemoteTimer = setTimeout(() => {
    typingRemoteTimer = 0;
    if (typingRemote && Date.now() >= typingRemote.until) {
      typingRemote = null;
      updateTypingUi();
    }
  }, TYPING_REMOTE_HOLD_MS);
  updateTypingUi();
}

function updateTypingUi() {
  const show = !!(typingRemote && Date.now() < typingRemote.until);
  const label =
    show && typingRemote
      ? _t("chat.typing", { n: typingRemote.name }) ||
        `${typingRemote.name} is typing…`
      : "";
  const setEl = (wrapId, labelId) => {
    const wrap = $(wrapId);
    const lab = $(labelId);
    if (!wrap) return;
    if (show && label) {
      wrap.hidden = false;
      wrap.removeAttribute("hidden");
      if (lab) lab.textContent = label;
    } else {
      wrap.hidden = true;
      wrap.setAttribute("hidden", "");
    }
  };
  setEl("chat-typing", "chat-typing-label");
  setEl("compose-typing", "compose-typing-label");
  setEl("msg-typing", "msg-typing-label");
}

function wireTypingInputs() {
  const onInput = () => notifyLocalTyping();
  const onBlur = () => stopLocalTyping();
  for (const id of ["msg", "msg-compose-input"]) {
    const el = $(id);
    if (!el || el.dataset.typingWired) continue;
    el.dataset.typingWired = "1";
    el.addEventListener("input", onInput);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") stopLocalTyping();
    });
    el.addEventListener("blur", onBlur);
  }
}

/** Curated emoji set for dock + messages compose (no external CDN). */
const EMOJI_PICKER_SET = [
  "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "🥰", "😘", "😗", "😋",
  "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "😐", "😑", "😶", "🙄", "😏", "😣", "😥", "😮",
  "😯", "😪", "😫", "🥱", "😴", "😌", "😛", "😢", "😭", "😤", "😠", "😡", "🤬", "😈", "👿", "💀",
  "💩", "🤡", "👻", "👽", "🤖", "🎃", "😺", "😸", "😹", "😻", "👋", "🤚", "✋", "🖖", "👌", "🤌",
  "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "👍", "👎", "✊", "👊", "👏", "🙌",
  "👐", "🤲", "🤝", "🙏", "💪", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️",
  "💕", "💞", "💓", "💗", "💖", "💘", "💝", "🔥", "⭐", "🌟", "✨", "💫", "💥", "🎉", "🎊", "🎈",
  "🎁", "🏆", "🥇", "⚽", "🏀", "🎮", "🎵", "🎶", "🍕", "🍔", "🍟", "🌮", "🍣", "🍩", "☕", "🍺",
  "🍻", "🥂", "🍷", "🍸", "🍹", "🌍", "🏠", "🚗", "✈️", "🚀", "☀️", "🌙", "⭐", "🌈", "❄️", "☔",
  "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🦄",
];

const EMOJI_RECENTS_KEY = "ruletka-emoji-recents-v1";
const EMOJI_RECENTS_MAX = 16;

/** @returns {string[]} */
function loadEmojiRecents() {
  try {
    const raw = localStorage.getItem(EMOJI_RECENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((e) => String(e || "").trim())
      .filter(Boolean)
      .slice(0, EMOJI_RECENTS_MAX);
  } catch {
    return [];
  }
}

function pushEmojiRecent(emoji) {
  const em = String(emoji || "").trim();
  if (!em) return;
  try {
    const next = [em, ...loadEmojiRecents().filter((x) => x !== em)].slice(
      0,
      EMOJI_RECENTS_MAX
    );
    localStorage.setItem(EMOJI_RECENTS_KEY, JSON.stringify(next));
  } catch (_) {}
  // Refresh recents row if picker is open
  try {
    paintEmojiRecentsRow();
  } catch (_) {}
}

/** @type {HTMLInputElement | HTMLTextAreaElement | null} */
let emojiPickerInput = null;
let emojiPickerBuilt = false;
let emojiOutsideWired = false;

function insertEmojiAtCursor(input, emoji) {
  if (!input || !emoji) return;
  try {
    input.focus();
  } catch (_) {}
  const start = typeof input.selectionStart === "number" ? input.selectionStart : input.value.length;
  const end = typeof input.selectionEnd === "number" ? input.selectionEnd : start;
  const val = String(input.value || "");
  const max = Number(input.maxLength) > 0 ? Number(input.maxLength) : 500;
  const next = (val.slice(0, start) + emoji + val.slice(end)).slice(0, max);
  input.value = next;
  const caret = Math.min(start + emoji.length, next.length);
  try {
    input.setSelectionRange(caret, caret);
  } catch (_) {}
  try {
    input.dispatchEvent(new Event("input", { bubbles: true }));
  } catch (_) {}
  notifyLocalTyping();
  pushEmojiRecent(emoji);
}

function onEmojiPickerItemClick(e, em) {
  e.preventDefault();
  e.stopPropagation();
  if (emojiPickerInput) insertEmojiAtCursor(emojiPickerInput, em);
  // Keep open for multi-insert; user closes via outside tap or Esc
}

function paintEmojiRecentsRow() {
  const row = $("emoji-picker-recents");
  if (!row) return;
  const recents = loadEmojiRecents();
  row.hidden = recents.length === 0;
  if (recents.length === 0) {
    row.setAttribute("hidden", "");
    row.innerHTML = "";
    return;
  }
  row.hidden = false;
  row.removeAttribute("hidden");
  row.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const em of recents) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "emoji-picker-item emoji-picker-recent";
    btn.textContent = em;
    btn.setAttribute("aria-label", em);
    btn.addEventListener("click", (e) => onEmojiPickerItemClick(e, em));
    frag.appendChild(btn);
  }
  row.appendChild(frag);
}

function ensureEmojiPickerBuilt() {
  if (emojiPickerBuilt) return;
  const grid = $("emoji-picker-grid");
  if (!grid) return;
  emojiPickerBuilt = true;
  // Recents strip above full grid (injected once)
  let recents = $("emoji-picker-recents");
  if (!recents) {
    const wrap = grid.parentElement;
    recents = document.createElement("div");
    recents.id = "emoji-picker-recents";
    recents.className = "emoji-picker-recents";
    recents.setAttribute("role", "group");
    recents.setAttribute(
      "aria-label",
      _t("chat.emojiRecents") || "Recent emoji"
    );
    recents.hidden = true;
    if (wrap) wrap.insertBefore(recents, grid);
    else grid.parentNode?.insertBefore(recents, grid);
  }
  const frag = document.createDocumentFragment();
  for (const em of EMOJI_PICKER_SET) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "emoji-picker-item";
    btn.textContent = em;
    btn.setAttribute("aria-label", em);
    btn.addEventListener("click", (e) => onEmojiPickerItemClick(e, em));
    frag.appendChild(btn);
  }
  grid.appendChild(frag);
  paintEmojiRecentsRow();
}

function positionEmojiPicker(anchorBtn) {
  const picker = $("emoji-picker");
  if (!picker || !anchorBtn) return;
  const r = anchorBtn.getBoundingClientRect();
  const pad = 8;
  const vw = window.innerWidth || 360;
  const vh = window.innerHeight || 640;
  // Measure after unhiding
  picker.style.visibility = "hidden";
  picker.hidden = false;
  picker.removeAttribute("hidden");
  const pr = picker.getBoundingClientRect();
  let left = r.left + r.width / 2 - pr.width / 2;
  left = Math.max(pad, Math.min(left, vw - pr.width - pad));
  // Prefer above the button; if no room, place below
  let top = r.top - pr.height - 6;
  if (top < pad) top = Math.min(r.bottom + 6, vh - pr.height - pad);
  top = Math.max(pad, top);
  picker.style.left = `${Math.round(left)}px`;
  picker.style.top = `${Math.round(top)}px`;
  picker.style.visibility = "";
}

function openEmojiPicker(anchorBtn, inputEl) {
  ensureEmojiPickerBuilt();
  try {
    paintEmojiRecentsRow();
  } catch (_) {}
  const picker = $("emoji-picker");
  if (!picker) return;
  emojiPickerInput = inputEl || $("msg") || $("msg-compose-input");
  positionEmojiPicker(anchorBtn);
  picker.hidden = false;
  picker.removeAttribute("hidden");
  try {
    const label = _t("chat.emoji") || "Emoji";
    picker.setAttribute("aria-label", label);
  } catch (_) {}
  if (!emojiOutsideWired) {
    emojiOutsideWired = true;
    document.addEventListener(
      "pointerdown",
      (e) => {
        const picker = $("emoji-picker");
        if (!picker || picker.hidden) return;
        if (e.target?.closest?.("#emoji-picker")) return;
        if (e.target?.closest?.("#btn-emoji-dock, #btn-emoji-msg")) return;
        closeEmojiPicker();
      },
      true
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeEmojiPicker();
    });
    window.addEventListener(
      "resize",
      () => {
        if ($("emoji-picker") && !$("emoji-picker").hidden) closeEmojiPicker();
      },
      { passive: true }
    );
  }
}

function closeEmojiPicker() {
  const picker = $("emoji-picker");
  if (!picker) return;
  picker.hidden = true;
  picker.setAttribute("hidden", "");
  emojiPickerInput = null;
}

function wireEmojiPicker() {
  const pairs = [
    ["btn-emoji-dock", "msg"],
    ["btn-emoji-msg", "msg-compose-input"],
  ];
  for (const [btnId, inputId] of pairs) {
    const btn = $(btnId);
    if (!btn || btn.dataset.emojiWired) continue;
    btn.dataset.emojiWired = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const picker = $("emoji-picker");
      const input = $(inputId);
      if (picker && !picker.hidden && emojiPickerInput === input) {
        closeEmojiPicker();
        return;
      }
      openEmojiPicker(btn, input);
      try {
        input?.focus();
      } catch (_) {}
    });
  }
}

function sendLiveChat(body, opts = {}) {
  const text = String(body || "").trim().slice(0, 500);
  if (!text) return false;
  // Sending a message ends our typing state
  stopLocalTyping();
  const id =
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const ts = Date.now();
  const asFriend = !!opts.asFriend;
  const payload = {
    v: 1,
    type: asFriend ? "friend_chat" : "chat",
    id,
    body: text,
    name: getDisplayName() || "anon",
    user_id: myUserId || "",
    to_user_id: opts.peerUserId || "",
    ts,
  };
  let p2p = false;
  for (const pc of chatPeerPcs()) {
    if (pc.sendChatMessage && pc.sendChatMessage(payload)) p2p = true;
  }
  if (p2p) {
    if (asFriend && opts.peerUserId) {
      // Keep friend thread context
      activeChat = {
        mode: "friend",
        peerUserId: opts.peerUserId,
        peerName:
          friendDisplayName(
            friendsCache.find((f) => f.user_id === opts.peerUserId)
          ) || activeChat.peerName || "friend",
        threadKey: friendThreadKey(opts.peerUserId),
        live: true,
      };
    }
    recordChatMessage({
      author: payload.name,
      body: text,
      mine: true,
      id,
      ts,
      fromUserId: myUserId || "",
      via: "p2p",
    });
    noteP2pChatId(id, text, ts);
    trackEvent("chat_p2p", { friend: asFriend ? 1 : 0 });
    // Friend offline store: still mirror to hub (receiver skips UI dup if P2P won)
    if (asFriend && opts.peerUserId && ws && ws.readyState === WebSocket.OPEN) {
      send({
        type: "friend_chat",
        to_user_id: opts.peerUserId,
        body: text,
        // client-only correlation; server ignores unknown fields
        client_id: id,
      });
    }
    return "p2p";
  }
  // Hub relay until data channel is up (server echoes Chat → UI)
  if (ws && ws.readyState === WebSocket.OPEN) {
    if (asFriend && opts.peerUserId) {
      send({ type: "friend_chat", to_user_id: opts.peerUserId, body: text });
    } else {
      send({ type: "chat", body: text });
    }
    return "hub";
  }
  return false;
}

/**
 * Handle inbound P2P data-channel messages (match or friend live chat).
 * @param {object} msg
 * @param {InstanceType<typeof RouletteWebRtc>} [fromPc]
 */
function handleP2pDataMessage(msg, fromPc) {
  if (!msg || typeof msg !== "object") return;
  const t = msg.type;
  // Formal debate control plane (invite / turns / end)
  if (typeof t === "string" && t.startsWith("debate_")) {
    handleDebateP2pMessage(msg, fromPc);
    return;
  }
  // Typing indicators (no body)
  if (t === "typing" || t === "typing_stop") {
    handleTypingP2pMessage(msg);
    return;
  }
  if (t !== "chat" && t !== "friend_chat") return;
  // Incoming text → clear their typing pill
  try {
    clearRemoteTyping(String(msg.user_id || "").slice(0, 64));
  } catch (_) {}
  const body = String(msg.body || "").trim();
  if (!body) return;
  const uid = String(msg.user_id || primaryPartnerUserId || "").slice(0, 64);
  const name = String(
    msg.name ||
      friendDisplayName(friendsCache.find((f) => f.user_id === uid)) ||
      lastMatchMeta?.name ||
      "partner"
  ).slice(0, 32);
  const ts = typeof msg.ts === "number" ? msg.ts : Date.now();
  const id = msg.id || `p2p-${ts}`;

  if (msg.type === "friend_chat" || (inFriendCall && matchMode === "friend")) {
    const peerId = uid === myUserId ? msg.to_user_id || primaryPartnerUserId : uid;
    if (peerId) {
      activeChat = {
        mode: "friend",
        peerUserId: peerId,
        peerName: name,
        threadKey: friendThreadKey(peerId),
        live: true,
      };
    }
  } else if (!activeChat.live && (matched || inFriendCall)) {
    openMatchChatForPartner(
      primaryPartnerUserId
        ? [{ user_id: primaryPartnerUserId, name, role: "stranger" }]
        : null
    );
  }
  recordChatMessage({
    author: name,
    body,
    mine: false,
    id,
    ts,
    fromUserId: uid,
    via: "p2p",
  });
  // Remember recent P2P ids so hub echo of friend_chat can be skipped
  noteP2pChatId(id, body, ts);
  updateChatHeader();
}

/** @type {Map<string, number>} */
const recentP2pChatKeys = new Map();

function noteP2pChatId(id, body, ts) {
  const key = id || `${body}|${Math.floor((ts || Date.now()) / 5000)}`;
  recentP2pChatKeys.set(key, Date.now());
  // prune
  if (recentP2pChatKeys.size > 40) {
    const cutoff = Date.now() - 60_000;
    for (const [k, t] of recentP2pChatKeys) {
      if (t < cutoff) recentP2pChatKeys.delete(k);
    }
  }
}

function wasRecentP2pChat(id, body, ts) {
  if (id && recentP2pChatKeys.has(id)) return true;
  const fuzzy = `${body}|${Math.floor((ts || Date.now()) / 5000)}`;
  if (recentP2pChatKeys.has(fuzzy)) return true;
  // also match body in last 8s
  const now = Date.now();
  for (const [k, t] of recentP2pChatKeys) {
    if (now - t < 8000 && k.startsWith(String(body).slice(0, 80))) return true;
  }
  return false;
}

/**
 * Persist + show a chat message on the active thread.
 * @param {{ author?: string, body: string, mine: boolean, cls?: string, id?: string, ts?: number, fromUserId?: string, via?: string }} msg
 */
function recordChatMessage(msg) {
  if (!msg || !msg.body) return;
  // Ensure we have a thread — create ephemeral match thread if needed
  if (!activeChat.threadKey) {
    const uid = msg.fromUserId || primaryPartnerUserId || "";
    const name = msg.mine
      ? getDisplayName() || "you"
      : msg.author || lastMatchMeta?.name || "partner";
    activeChat = {
      mode: matched || inFriendCall ? "match" : "history",
      peerUserId: uid,
      peerName: name,
      threadKey: matchThreadKey(uid, lastMatchMeta?.friend_code, lastMatchMeta?.short_id),
      live: !!(matched || inFriendCall),
    };
  }
  const ts = msg.ts || Date.now();
  const entry = {
    id: msg.id || `${ts}-${Math.random().toString(36).slice(2, 8)}`,
    author: msg.author || "",
    body: String(msg.body).slice(0, 500),
    mine: !!msg.mine,
    cls: msg.cls || (msg.mine ? "mine" : "theirs"),
    ts,
  };
  const map = loadChatThreads();
  const thr = map[activeChat.threadKey] || {
    title: activeChat.peerName || "Chat",
    peerUserId: activeChat.peerUserId,
    kind: activeChat.mode === "friend" ? "friend" : "match",
    msgs: [],
    updated: ts,
  };
  // Dedupe by id if present (server echo / history merge)
  const isDup = !!(entry.id && thr.msgs.some((m) => m.id === entry.id));
  if (!isDup) {
    thr.msgs.push(entry);
    while (thr.msgs.length > MAX_THREAD_MSGS) thr.msgs.shift();
    // Soft ping for inbound messages (not our own optimistic sends)
    if (!entry.mine && entry.cls !== "sys") {
      try {
        playChatMessageChime();
      } catch (_) {}
    }
  }
  thr.updated = ts;
  thr.title = activeChat.peerName || thr.title;
  thr.peerUserId = activeChat.peerUserId || thr.peerUserId;
  map[activeChat.threadKey] = thr;
  saveChatThreads(map);

  if (isDup) return;

  // Legacy #chat-messages kept in sync for any residual readers; UI is compact sheet only
  const box = $("chat-messages");
  if (box) {
    updateChatHeader();
    box.appendChild(renderChatBubbleEl(entry));
    box.scrollTop = box.scrollHeight;
  }
  appendToInboxIfOpen(entry);
  // Live match: if compact Messages is open on this thread, bubbles already append;
  // if list is open, refresh so unread shows. Never pop the large on-tile panel.
  markThreadRead(activeChat.threadKey, ts);
  if (messagesSheetOpen && !messagesInThread) renderMessagesList();
  updateMessagesBadge();
}

function openMatchChatForPartner(peers) {
  const primary =
    (Array.isArray(peers) &&
      (peers.find((p) => p.role !== "friend" && p.user_id) ||
        peers.find((p) => p.user_id) ||
        peers[0])) ||
    null;
  const uid = primary?.user_id || primaryPartnerUserId || "";
  const name =
    (primary?.name && primary.name !== "anon" ? primary.name : "") ||
    primary?.short_id ||
    lastMatchMeta?.name ||
    "partner";
  const key = matchThreadKey(uid, primary?.friend_code, primary?.short_id);
  activeChat = {
    mode: "match",
    peerUserId: uid,
    peerName: name,
    threadKey: key,
    live: true,
  };
  // Seed empty thread so hangup still has a key
  const map = loadChatThreads();
  if (!map[key]) {
    map[key] = {
      title: name,
      peerUserId: uid,
      kind: "match",
      msgs: [],
      updated: Date.now(),
    };
    saveChatThreads(map);
  } else if (map[key].msgs && map[key].msgs.length) {
    // Rematch same person — restore history into DOM (open via Messages envelope)
    renderThreadToDom(key);
  } else {
    clearChatDom();
  }
  showChatPanel(false);
  updateChatHeader();
}

function openFriendChat(userId, opts = {}) {
  if (!userId) return;
  const fr = friendsCache.find((f) => f.user_id === userId);
  const name =
    opts.name ||
    (fr ? friendDisplayName(fr) : "") ||
    fr?.name ||
    fr?.short_id ||
    "friend";
  const key = friendThreadKey(userId);
  closeFriends();
  openMessages("friends");
  openInboxThread(key, {
    mode: "friend",
    peerUserId: userId,
    peerName: name,
    live: true,
  });
}

/**
 * Build sorted inbox entries for a tab.
 * @param {"friends"|"matches"} tab
 * @returns {Array<{threadKey:string, title:string, preview:string, updated:number, unread:boolean, online:boolean, mode:string, peerUserId:string, live:boolean}>}
 */
function buildInboxEntries(tab) {
  const threads = loadChatThreads();
  const read = loadChatRead();
  const out = [];

  if (tab === "friends") {
    const seen = new Set();
    for (const f of friendsCache) {
      const key = friendThreadKey(f.user_id);
      seen.add(key);
      const thr = threads[key];
      const last = thr?.msgs?.length ? thr.msgs[thr.msgs.length - 1] : null;
      const updated = last?.ts || (f.last_msg_ts ? f.last_msg_ts * 1000 : 0) || thr?.updated || 0;
      const preview = last
        ? (last.mine ? "You: " : "") + last.body
        : f.last_msg || _t("msg.noMessages") || "No messages yet — say hi";
      const unread = !!(
        last &&
        !last.mine &&
        (last.ts || 0) > (read[key] || 0)
      ) || (!last && f.last_msg_ts * 1000 > (read[key] || 0) && f.last_msg);
      out.push({
        threadKey: key,
        title: friendDisplayName(f),
        preview: String(preview).slice(0, 90),
        updated,
        unread: !!unread,
        online: !!f.online,
        mode: "friend",
        peerUserId: f.user_id,
        live: true,
        avatar: f.avatar || "",
      });
    }
    // Friend threads no longer in friends list (removed) but still have history
    for (const [key, thr] of Object.entries(threads)) {
      if (!key.startsWith("friend:") || seen.has(key)) continue;
      if (!thr?.msgs?.length) continue;
      const last = thr.msgs[thr.msgs.length - 1];
      out.push({
        threadKey: key,
        title: thr.title || thr.peerUserId?.slice(0, 8) || "friend",
        preview: ((last.mine ? "You: " : "") + (last.body || "")).slice(0, 90),
        updated: last.ts || thr.updated || 0,
        unread: !last.mine && (last.ts || 0) > (read[key] || 0),
        online: false,
        mode: "friend",
        peerUserId: thr.peerUserId || key.slice(7),
        live: true,
      });
    }
  } else {
    // Matches / previous conversationalists
    for (const [key, thr] of Object.entries(threads)) {
      if (!key.startsWith("match:")) continue;
      if (!thr?.msgs?.length) continue;
      const last = thr.msgs[thr.msgs.length - 1];
      const isLive =
        activeChat.threadKey === key &&
        activeChat.live &&
        (matched || inFriendCall);
      // If this peer is now a friend, still show under Matches (history) but note it
      const isFriend =
        thr.peerUserId && friendsCache.some((f) => f.user_id === thr.peerUserId);
      out.push({
        threadKey: key,
        title: thr.title || last.author || thr.peerUserId?.slice(0, 8) || "match",
        preview: ((last.mine ? "You: " : "") + (last.body || "")).slice(0, 90),
        updated: last.ts || thr.updated || 0,
        unread: !last.mine && (last.ts || 0) > (read[key] || 0),
        online: isLive,
        mode: isLive ? "match" : "history",
        peerUserId: thr.peerUserId || "",
        live: isLive,
        isFriend: !!isFriend,
      });
    }
  }

  out.sort((a, b) => {
    // Newest activity first (date/time). Unread is shown with a badge, not reordering.
    return (Number(b.updated) || 0) - (Number(a.updated) || 0);
  });
  return out;
}

function formatInboxWhen(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60_000) return _t("msg.justNow") || "now";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86400_000) {
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function initialsFor(name) {
  const s = String(name || "?").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

function setMessagesTab(tab) {
  messagesTab = tab === "matches" ? "matches" : "friends";
  const tf = $("msg-tab-friends");
  const tm = $("msg-tab-matches");
  if (tf) {
    tf.classList.toggle("active", messagesTab === "friends");
    tf.setAttribute("aria-selected", messagesTab === "friends" ? "true" : "false");
  }
  if (tm) {
    tm.classList.toggle("active", messagesTab === "matches");
    tm.setAttribute("aria-selected", messagesTab === "matches" ? "true" : "false");
  }
  const hint = $("msg-list-hint");
  if (hint) {
    hint.textContent =
      messagesTab === "friends"
        ? _t("msg.hintFriends") ||
          "Chat with friends anytime — online or offline."
        : _t("msg.hintMatches") ||
          "Past video chats. History is saved on this device.";
  }
  renderMessagesList();
}

function renderMessagesList() {
  const list = $("msg-thread-list");
  if (!list) return;
  const entries = buildInboxEntries(messagesTab);

  // Tab counts (unread)
  const fu = buildInboxEntries("friends").filter((e) => e.unread).length;
  const mu = buildInboxEntries("matches").filter((e) => e.unread).length;
  const cf = $("msg-count-friends");
  const cm = $("msg-count-matches");
  if (cf) {
    cf.hidden = fu === 0;
    cf.textContent = String(fu > 99 ? "99+" : fu);
  }
  if (cm) {
    cm.hidden = mu === 0;
    cm.textContent = String(mu > 99 ? "99+" : mu);
  }
  updateMessagesBadge();

  if (!entries.length) {
    const isFriends = messagesTab === "friends";
    const title = isFriends
      ? _t("msg.emptyFriendsTitle") || "No friend chats yet"
      : _t("msg.emptyMatchesTitle") || "No match chats yet";
    const body = isFriends
      ? _t("msg.emptyFriends") ||
        "Add a friend code, then message them here anytime."
      : _t("msg.emptyMatches") ||
        "When you text someone during a call, it shows up here.";
    const cta = isFriends
      ? `<button type="button" class="pill accent tight sheet-empty-cta" id="msg-empty-cta-friends">${escapeHtml(
          _t("msg.emptyFriendsCta") || "Open Friends"
        )}</button>`
      : `<button type="button" class="pill accent tight sheet-empty-cta" id="msg-empty-cta-start">${escapeHtml(
          _t("msg.emptyMatchesCta") || "Start matching"
        )}</button>`;
    list.innerHTML = `<div class="sheet-empty msg-empty">
      <div class="sheet-empty-icon" aria-hidden="true">${isFriends ? "◎" : "✦"}</div>
      <div class="sheet-empty-title">${escapeHtml(title)}</div>
      <p class="sheet-empty-body">${escapeHtml(body)}</p>
      ${cta}
    </div>`;
    $("msg-empty-cta-friends")?.addEventListener("click", () => {
      closeMessages();
      openFriends();
    });
    $("msg-empty-cta-start")?.addEventListener("click", () => {
      closeMessages();
      if (!matched && !inQueue && !wantSearch) {
        $("btn-start-match")?.click();
      }
    });
    return;
  }

  list.innerHTML = entries
    .map((e) => {
      const liveTag = e.live
        ? ` · ${escapeHtml(_t("msg.live") || "live")}`
        : e.online
          ? ` · ${escapeHtml(_t("friends.online") || "online")}`
          : messagesTab === "friends"
            ? ` · ${escapeHtml(_t("friends.offline") || "offline")}`
            : e.isFriend
              ? ` · ${escapeHtml(_t("friends.kindFriend") || "friend")}`
              : "";
      return `<button type="button" class="msg-thread-row${e.unread ? " unread" : ""}${
        e.online || e.live ? " online" : ""
      }" data-key="${escapeAttr(e.threadKey)}" data-mode="${escapeAttr(e.mode)}" data-uid="${escapeAttr(
        e.peerUserId || ""
      )}" data-name="${escapeAttr(e.title)}" data-live="${e.live ? "1" : "0"}">
        ${
          e.avatar && /^data:image\//i.test(e.avatar)
            ? `<span class="msg-thread-avatar has-img"><img src="${escapeAttr(
                e.avatar
              )}" alt="" /></span>`
            : `<span class="msg-thread-avatar" aria-hidden="true">${escapeHtml(
                initialsFor(e.title)
              )}</span>`
        }
        <span class="meta">
          <strong>${escapeHtml(e.title)}${liveTag ? `<span style="font-weight:500;color:#8b9bb0;font-size:0.75rem">${liveTag}</span>` : ""}</strong>
          <span class="preview">${escapeHtml(e.preview)}</span>
        </span>
        <span class="when">${escapeHtml(formatInboxWhen(e.updated))}</span>
        ${e.unread ? '<span class="unread-dot" aria-hidden="true"></span>' : ""}
      </button>`;
    })
    .join("");

  list.querySelectorAll(".msg-thread-row").forEach((btn) => {
    btn.addEventListener("click", () => {
      openInboxThread(btn.getAttribute("data-key"), {
        mode: btn.getAttribute("data-mode") || "history",
        peerUserId: btn.getAttribute("data-uid") || "",
        peerName: btn.getAttribute("data-name") || "",
        live: btn.getAttribute("data-live") === "1",
      });
    });
  });
}

function showMsgListView() {
  messagesInThread = false;
  const list = $("msg-view-list");
  const thr = $("msg-view-thread");
  if (list) list.hidden = false;
  if (thr) thr.hidden = true;
  renderMessagesList();
}

function showMsgThreadView() {
  messagesInThread = true;
  const list = $("msg-view-list");
  const thr = $("msg-view-thread");
  if (list) list.hidden = true;
  if (thr) thr.hidden = false;
}

function renderInboxThreadBody() {
  const box = $("msg-thread-messages");
  if (!box || !activeChat.threadKey) return;
  box.innerHTML = "";
  const map = loadChatThreads();
  const thr = map[activeChat.threadKey];
  if (!thr?.msgs?.length) {
    box.innerHTML = `<div class="msg-empty">${escapeHtml(
      _t("chat.empty") || "Say hi — messages appear here"
    )}</div>`;
    return;
  }
  for (const msg of thr.msgs) {
    box.appendChild(renderChatBubbleEl(msg));
  }
  box.scrollTop = box.scrollHeight;
}

function updateInboxThreadHeader() {
  const title = $("msg-thread-title");
  const sub = $("msg-thread-sub");
  const input = $("msg-compose-input");
  if (title) title.textContent = activeChat.peerName || _t("chat.title") || "Chat";
  if (sub) {
    if (activeChat.mode === "friend") {
      const fr = friendsCache.find((f) => f.user_id === activeChat.peerUserId);
      sub.textContent = fr?.online
        ? _t("friends.online") || "online"
        : _t("chat.friendOffline") || "offline · delivered when they open chat";
    } else if (activeChat.live) {
      sub.textContent = _t("msg.liveChat") || "Live match chat";
    } else {
      sub.textContent = _t("chat.ended") || "Call ended · chat saved";
    }
  }
  if (input) {
    const canSend =
      activeChat.mode === "friend" ||
      (activeChat.mode === "match" && activeChat.live) ||
      (activeChat.peerUserId &&
        friendsCache.some((f) => f.user_id === activeChat.peerUserId));
    input.disabled = !canSend;
    input.placeholder = canSend
      ? activeChat.mode === "friend" ||
        friendsCache.some((f) => f.user_id === activeChat.peerUserId)
        ? _t("chat.placeholderFriend") || "Message friend…"
        : _t("chat.placeholder") || "Say something…"
      : _t("chat.placeholderEnded") || "Chat saved · match ended";
  }
}

/**
 * Open a thread inside the Messages sheet.
 */
function openInboxThread(threadKey, meta = {}) {
  if (!threadKey) return;
  const map = loadChatThreads();
  const thr = map[threadKey] || null;
  const mode =
    meta.mode ||
    (threadKey.startsWith("friend:")
      ? "friend"
      : thr && activeChat.threadKey === threadKey && activeChat.live
        ? "match"
        : "history");
  const peerUserId =
    meta.peerUserId || thr?.peerUserId || (threadKey.startsWith("friend:") ? threadKey.slice(7) : "");
  const peerName = meta.peerName || thr?.title || "Chat";
  let live = !!meta.live;
  if (mode === "match" && matched && activeChat.threadKey === threadKey) live = true;
  if (mode === "friend") live = true;

  activeChat = {
    mode,
    peerUserId,
    peerName,
    threadKey,
    live,
  };

  // Ensure thread exists in storage
  if (!map[threadKey]) {
    map[threadKey] = {
      title: peerName,
      peerUserId,
      kind: mode === "friend" ? "friend" : "match",
      msgs: [],
      updated: Date.now(),
    };
    saveChatThreads(map);
  }

  // Mirror into legacy chat DOM for storage helpers; UI is compact Messages only
  renderThreadToDom(threadKey);
  showChatPanel(false);
  updateChatHeader();
  updateInboxThreadHeader();
  renderInboxThreadBody();
  showMsgThreadView();
  markThreadRead(threadKey, Date.now());
  renderMessagesList(); // refresh unread badges in background tab counts

  if (mode === "friend" && peerUserId) {
    send({ type: "friend_chat_history", with_user_id: peerUserId });
  }
  setTimeout(() => {
    if (!$("msg-compose-input")?.disabled) $("msg-compose-input")?.focus();
  }, 40);
}

function openMessages(tab) {
  closeAllDockFlyouts("messages");
  if (tab) setMessagesTab(tab);
  else setMessagesTab(messagesTab || "friends");
  messagesSheetOpen = true;
  const sheet = $("messages-sheet");
  const bd = $("messages-backdrop");
  const btn = $("btn-messages");
  if (sheet) {
    sheet.hidden = false;
    sheet.removeAttribute("hidden");
    positionDockFlyout(sheet, btn, { align: "start", maxWidth: 400 });
    void sheet.offsetWidth;
    sheet.classList.add("is-open");
  }
  if (bd) {
    bd.hidden = false;
    bd.removeAttribute("hidden");
    bd.classList.add("is-open");
  }
  setDockFlyoutOpen(btn, true);
  showMsgListView();
  updateMessagesBadge();
  bindSheetFocusTrap(sheet);
  // Soft storage tip when match history is huge
  setTimeout(() => {
    try {
      maybeShowChatCleanupTip();
    } catch (_) {}
  }, 600);
}

function closeMessages() {
  messagesSheetOpen = false;
  messagesInThread = false;
  const sheet = $("messages-sheet");
  const bd = $("messages-backdrop");
  const btn = $("btn-messages");
  releaseSheetFocusTrap(sheet);
  sheet?.classList.remove("is-open");
  bd?.classList.remove("is-open");
  setDockFlyoutOpen(btn, false);
  if (sheet) sheet.hidden = true;
  if (bd) bd.hidden = true;
  // Return to list next open
  showMsgListView();
}

function updateMessagesBadge() {
  const badge = $("messages-badge");
  if (!badge) return;
  const n =
    buildInboxEntries("friends").filter((e) => e.unread).length +
    buildInboxEntries("matches").filter((e) => e.unread).length;
  if (n > 0) {
    badge.hidden = false;
    badge.textContent = String(n > 99 ? "99+" : n);
  } else {
    badge.hidden = true;
    badge.textContent = "0";
  }
}

/** Append to inbox thread body if that thread is open in the sheet. */
function appendToInboxIfOpen(entry) {
  if (!messagesSheetOpen || !messagesInThread) return;
  if (!activeChat.threadKey) return;
  const box = $("msg-thread-messages");
  if (!box) return;
  // Remove empty state
  const empty = box.querySelector(".msg-empty");
  if (empty) empty.remove();
  box.appendChild(renderChatBubbleEl(entry));
  box.scrollTop = box.scrollHeight;
  updateInboxThreadHeader();
}

function mergeFriendHistory(withUserId, messages) {
  if (!withUserId || !Array.isArray(messages)) return;
  const key = friendThreadKey(withUserId);
  const map = loadChatThreads();
  const thr = map[key] || {
    title: activeChat.peerUserId === withUserId ? activeChat.peerName : "friend",
    peerUserId: withUserId,
    kind: "friend",
    msgs: [],
    updated: Date.now(),
  };
  const byId = new Map(thr.msgs.map((m) => [m.id, m]));
  for (const m of messages) {
    if (!m || !m.body) continue;
    const id = m.id || `${m.ts}-${m.from_user_id}`;
    if (byId.has(id)) continue;
    const mine = m.from_user_id === myUserId;
    const entry = {
      id,
      author: mine ? "" : m.from_name || "",
      body: m.body,
      mine,
      cls: mine ? "mine" : "theirs",
      ts: (m.ts || 0) * 1000 || Date.now(),
    };
    byId.set(id, entry);
  }
  thr.msgs = Array.from(byId.values()).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  while (thr.msgs.length > MAX_THREAD_MSGS) thr.msgs.shift();
  thr.updated = Date.now();
  map[key] = thr;
  saveChatThreads(map);
  if (activeChat.threadKey === key) {
    renderThreadToDom(key);
    showChatPanel(false);
    renderInboxThreadBody();
    markThreadRead(key, Date.now());
  }
  if (messagesSheetOpen && !messagesInThread) renderMessagesList();
  updateFriendsUnreadBadge();
  updateMessagesBadge();
}

function handleIncomingFriendChat(msg) {
  if (!msg || !msg.body) return;
  const from = msg.from_user_id || "";
  const to = msg.to_user_id || "";
  // Conversation peer is the other person
  const peerId = from === myUserId ? to : from;
  if (!peerId) return;
  const mine = from === myUserId;
  const tsMs = (msg.ts || 0) * 1000 || Date.now();
  // Already shown via P2P data channel — hub store echo only
  if (
    !mine &&
    wasRecentP2pChat(msg.id || msg.client_id, msg.body, tsMs)
  ) {
    return;
  }
  if (mine && wasRecentP2pChat(msg.id || msg.client_id, msg.body, tsMs)) {
    // Our own hub mirror of a P2P send — skip second bubble
    return;
  }
  const key = friendThreadKey(peerId);
  const name =
    mine
      ? friendsCache.find((f) => f.user_id === peerId)?.name || activeChat.peerName || "friend"
      : msg.from_name || friendsCache.find((f) => f.user_id === peerId)?.name || "friend";

  // If we're viewing this thread, use recordChatMessage path via activeChat
  const viewing = activeChat.threadKey === key;
  if (!viewing) {
    // Store without switching UI (unless no active live match chat)
    const map = loadChatThreads();
    const thr = map[key] || {
      title: name,
      peerUserId: peerId,
      kind: "friend",
      msgs: [],
      updated: Date.now(),
    };
    const id = msg.id || `${msg.ts}-${from}`;
    if (!thr.msgs.some((m) => m.id === id)) {
      thr.msgs.push({
        id,
        author: mine ? "" : name,
        body: msg.body,
        mine,
        cls: mine ? "mine" : "theirs",
        ts: (msg.ts || 0) * 1000 || Date.now(),
      });
      while (thr.msgs.length > MAX_THREAD_MSGS) thr.msgs.shift();
    }
    thr.updated = Date.now();
    thr.title = name;
    map[key] = thr;
    saveChatThreads(map);
    updateFriendsUnreadBadge();
    updateMessagesBadge();
    if (messagesSheetOpen && !messagesInThread) renderMessagesList();
    // Toast-ish status for offline→online delivery
    if (!mine) {
      setStatus(_t("chat.friendMsgFrom", { n: name }) || `Message from ${name}`);
    }
    return;
  }
  // Viewing — switch active context if needed and record
  activeChat = {
    mode: "friend",
    peerUserId: peerId,
    peerName: name,
    threadKey: key,
    live: true,
  };
  recordChatMessage({
    id: msg.id,
    author: mine ? "" : name,
    body: msg.body,
    mine,
    ts: (msg.ts || 0) * 1000 || Date.now(),
  });
}

function friendUnreadCount() {
  const read = loadChatRead();
  const threads = loadChatThreads();
  let n = 0;
  for (const f of friendsCache) {
    const key = friendThreadKey(f.user_id);
    const thr = threads[key];
    if (!thr || !thr.msgs || !thr.msgs.length) continue;
    const last = thr.msgs[thr.msgs.length - 1];
    if (last.mine) continue;
    const lastTs = last.ts || 0;
    if (lastTs > (read[key] || 0)) n++;
  }
  // Also server last_msg_ts when no local thread yet
  for (const f of friendsCache) {
    if (!f.last_msg_ts) continue;
    const key = friendThreadKey(f.user_id);
    const thr = threads[key];
    if (thr && thr.msgs && thr.msgs.length) continue;
    const tsMs = f.last_msg_ts * 1000;
    if (tsMs > (read[key] || 0)) n++;
  }
  return n;
}

const MISSED_CALLS_READ_KEY = "ruletka-missed-calls-read-v1";

function loadMissedCallsReadTs() {
  try {
    return Number(localStorage.getItem(MISSED_CALLS_READ_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function markMissedCallsRead() {
  try {
    localStorage.setItem(MISSED_CALLS_READ_KEY, String(Date.now()));
  } catch (_) {}
  updateFriendsUnreadBadge();
}

function countUnreadMissedCalls() {
  const since = loadMissedCallsReadTs();
  try {
    return loadHistory().filter(
      (h) => h && h.kind === "missed" && (h.t || 0) > since
    ).length;
  } catch {
    return 0;
  }
}

function updateFriendsUnreadBadge() {
  // Friends badge = requests + unread missed calls; chats use Messages badge
  const badge = $("friends-badge");
  if (!badge) return;
  const reqN = (incomingRequests || []).length;
  const missedN = countUnreadMissedCalls();
  const n = reqN + missedN;
  if (n > 0) {
    badge.hidden = false;
    badge.textContent = String(n > 99 ? "99+" : n);
  } else {
    badge.hidden = true;
    badge.textContent = "0";
  }
  updateMessagesBadge();
}

function appendChatBubble(text, cls) {
  // Back-compat helper
  let who = "";
  let body = text;
  const m = /^\[([^\]]+)\]\s*(.*)$/s.exec(text);
  if (m) {
    who = m[1];
    body = m[2];
  }
  recordChatMessage({
    author: who,
    body,
    mine: cls === "mine",
    cls,
  });
}

/** Center-footer “Ищем собеседника…” pill while searching after Start. */
function setFooterSearchStatus(show, label) {
  const el = $("footer-search-status");
  const lab = $("footer-search-label");
  if (!el) return;
  if (!show) {
    el.hidden = true;
    return;
  }
  if (lab) {
    lab.textContent =
      label ||
      _t("conn.searching") ||
      "Searching for a partner…";
  }
  el.hidden = false;
}

function setConnStrip(kind, label, iceHint, opts) {
  const strip = $("conn-strip");
  const lab = $("conn-label");
  const ice = $("conn-ice");
  const retry = $("btn-conn-retry");
  if (lab && label != null) lab.textContent = label;
  // ICE / STUN / TURN hints intentionally not shown in the UI
  if (ice) ice.textContent = "";
  if (retry) {
    const showRetry = !!(opts && opts.showRetry);
    retry.hidden = !showRetry;
  }
  if (!strip) return;
  strip.classList.remove("ok", "warn", "bad", "call", "idle", "is-reconnecting");
  if (kind) strip.classList.add(kind);
  if (opts && opts.reconnecting) strip.classList.add("is-reconnecting");
  // Hide the strip when idle-connected (no status text to show)
  // Searching lives in footer center — never duplicate in header
  const searching =
    kind === "warn" &&
    label &&
    /search|ищем|поиск|looking/i.test(String(label));
  const hide =
    kind === "idle" || (kind === "ok" && !label) || searching;
  strip.hidden = !!hide;
  strip.setAttribute("aria-hidden", hide ? "true" : "false");
  // Bottom reconnect banner for visibility on mobile
  if (opts && opts.reconnecting) showReconnectBanner(label, !!opts.showRetry);
  else if (kind === "ok" || kind === "call" || kind === "idle" || hide) {
    hideReconnectBanner();
  }
}

/** Full-width soft banner while the hub socket is down (not a forced modal). */
function showReconnectBanner(label, showRetry) {
  let el = $("reconnect-banner");
  if (!el) {
    el = document.createElement("div");
    el.id = "reconnect-banner";
    el.className = "reconnect-banner";
    el.setAttribute("role", "status");
    el.innerHTML = `
      <span class="reconnect-banner-dot" aria-hidden="true"></span>
      <span class="reconnect-banner-text" id="reconnect-banner-text"></span>
      <button type="button" class="pill tight accent" id="btn-reconnect-banner" hidden></button>`;
    document.body.appendChild(el);
    $("btn-reconnect-banner")?.addEventListener("click", () => {
      trackEvent("reconnect_banner_click");
      manualReconnect();
    });
  }
  const text = $("reconnect-banner-text");
  if (text) {
    text.textContent =
      label ||
      _t("conn.retrying") ||
      _t("status.reconnecting") ||
      "Reconnecting…";
  }
  const btn = $("btn-reconnect-banner");
  if (btn) {
    btn.hidden = !showRetry;
    btn.textContent = _t("conn.retryNow") || "Retry now";
  }
  el.hidden = false;
}

function hideReconnectBanner() {
  const el = $("reconnect-banner");
  if (el) el.hidden = true;
}

/** Soft confirmation after hub drop recovers (not a nag). */
function showBackOnlineToast() {
  setStatus(
    _t("conn.backOnline") || "Back online — you can search or call again."
  );
}

function updateConnFromState() {
  // No STUN/TURN ice line on the page
  if (!ws || ws.readyState === WebSocket.CONNECTING) {
    setFooterSearchStatus(false);
    setConnStrip("warn", _t("conn.connecting"), "");
    return;
  }
  if (ws.readyState !== WebSocket.OPEN) {
    setFooterSearchStatus(false);
    const retrying = reconnectTimer || reconnectAttempt > 0;
    setConnStrip(
      "bad",
      retrying
        ? _t("conn.retrying") || _t("conn.disconnected")
        : _t("conn.disconnected"),
      "",
      { showRetry: true, reconnecting: true }
    );
    return;
  }
  if (matchMode === "friend" || (inFriendCall && matchMode !== "party_browse")) {
    setFooterSearchStatus(false);
    setConnStrip("call", _t("conn.friend"), "");
    return;
  }
  // Party of 2 hunting a 3rd — center footer shows searching
  if (matchMode === "party_browse" && yourRole === "party") {
    const hunting = !!(wantSearch || inQueue);
    if (hunting) {
      setFooterSearchStatus(
        true,
        _t("trio.searching") || _t("conn.searching")
      );
      setConnStrip("idle", "", "");
    } else {
      setFooterSearchStatus(false);
      setConnStrip("call", _t("conn.party"), "");
    }
    return;
  }
  if (matched) {
    setFooterSearchStatus(false);
    setConnStrip("call", _t("conn.matched"), "");
    return;
  }
  const phase = $("phase")?.className || "";
  const searching =
    phase.includes("waiting") ||
    phase.includes("claiming") ||
    !!(wantSearch || inQueue);
  if (searching) {
    // Center of footer after Start — not header
    setFooterSearchStatus(true, _t("conn.searching"));
    setConnStrip("idle", "", "");
    return;
  }
  // Connected and idle — hide strip (no "Connected — ready" clutter)
  setFooterSearchStatus(false);
  setConnStrip("idle", "", "");
}

/** WebRTC connect watchdog + coach overlay */
let webrtcWatchTimer = 0;
let webrtcWatchSoftTimer = 0;
let webrtcConnectedOk = false;
let coachShownForMatch = false;

function clearWebrtcWatch() {
  if (webrtcWatchTimer) {
    clearTimeout(webrtcWatchTimer);
    webrtcWatchTimer = 0;
  }
  if (webrtcWatchSoftTimer) {
    clearTimeout(webrtcWatchSoftTimer);
    webrtcWatchSoftTimer = 0;
  }
}

function hideCallCoach() {
  const el = $("call-coach");
  if (el) el.hidden = true;
  const allowBtn = $("btn-coach-allow-turn");
  if (allowBtn) allowBtn.hidden = true;
}

/**
 * Prefer Direct (no TURN) failed once this session → auto-allow TURN so
 * harder NATs can connect. User can re-enable Prefer Direct anytime.
 * @returns {boolean} true if we just flipped the pref off
 */
let preferDirectAutoOffDone = false;
/** One-shot VPN/hard-NAT recovery: force TURN relay then rebuild PC. */
let vpnRelayRecoveryDone = false;

function setPreferDirectOnly(on, { silent = false } = {}) {
  const want = !!on;
  // Prefer Direct and Hide IP are mutually exclusive
  if (want && loadPrefs().hideIpRelayOnly) {
    savePrefs({ preferDirectOnly: true, hideIpRelayOnly: false });
    const hideChk = $("chk-hide-ip");
    if (hideChk) hideChk.checked = false;
  } else {
    savePrefs({ preferDirectOnly: want });
  }
  // Prefer Direct cannot use session VPN force-relay
  if (want && typeof setSessionForceRelay === "function") {
    try {
      setSessionForceRelay(false);
    } catch (_) {}
  }
  const chk = $("chk-prefer-direct");
  if (chk) chk.checked = !!loadPrefs().preferDirectOnly;
  if (typeof applyIceDirectPreference === "function") {
    applyIceDirectPreference();
  }
  try {
    syncSettingsSummary?.();
    refreshConnectionDetails?.();
  } catch (_) {}
  if (!silent) {
    setStatus(
      loadPrefs().preferDirectOnly
        ? _t("settings.preferDirectOnStatus") ||
            "Prefer Direct on — next match uses STUN only"
        : _t("settings.preferDirectOffStatus") ||
            "TURN allowed again on next match"
    );
  }
}

/**
 * Hide IP from partner: force TURN relay-only ICE (next PeerConnection).
 * No account — stored in local media prefs (import/export identity stays separate).
 * @param {boolean} on
 * @param {{ silent?: boolean }} [opts]
 */
function setHideIpRelayOnly(on, { silent = false } = {}) {
  const want = !!on;
  const hasTurn =
    !!(window.__hasTurn || window.__iceMeta?.has_turn) ||
    !!(
      typeof getIceMeta === "function" &&
      getIceMeta()?.has_turn
    );
  if (want && !hasTurn) {
    const chk = $("chk-hide-ip");
    if (chk) chk.checked = false;
    savePrefs({ hideIpRelayOnly: false });
    if (!silent) {
      setStatus(
        _t("settings.hideIpNoTurn") ||
          "Hide IP needs TURN on this hub — not available right now"
      );
    }
    try {
      refreshConnectionDetails?.();
    } catch (_) {}
    return false;
  }
  if (want) {
    // Turn off Prefer Direct (can't hide IP without TURN)
    savePrefs({ hideIpRelayOnly: true, preferDirectOnly: false });
    const pd = $("chk-prefer-direct");
    if (pd) pd.checked = false;
  } else {
    savePrefs({ hideIpRelayOnly: false });
  }
  const chk = $("chk-hide-ip");
  if (chk) chk.checked = !!loadPrefs().hideIpRelayOnly;
  if (typeof applyIceDirectPreference === "function") {
    applyIceDirectPreference();
  }
  try {
    syncSettingsSummary?.();
    refreshConnectionDetails?.();
  } catch (_) {}
  if (!silent) {
    setStatus(
      loadPrefs().hideIpRelayOnly
        ? _t("settings.hideIpOnStatus") ||
            "Hide IP on — next match uses TURN only (partner won’t see your IP)"
        : _t("settings.hideIpOffStatus") ||
            "Hide IP off — direct P2P allowed when possible"
    );
  }
  return true;
}

function autoDisablePreferDirectOnFail({ autoNext = true } = {}) {
  const prefer =
    typeof preferDirectOnlyEnabled === "function" && preferDirectOnlyEnabled();
  if (!prefer || preferDirectAutoOffDone) return false;
  preferDirectAutoOffDone = true;
  setPreferDirectOnly(false, { silent: true });
  setStatus(
    _t("conn.preferDirectAutoOff") ||
      "Prefer Direct failed — TURN allowed for the next match"
  );
  showPreferDirectAutoToast();
  trackEvent("prefer_direct_auto_off");
  log("prefer direct auto-off after ICE fail");
  if (autoNext && matched && !inFriendCall) {
    // Soft recovery: skip this partner and try with TURN available
    // (existing PC still has STUN-only servers — must rematch)
    setTimeout(() => {
      if (matched && !webrtcConnectedOk) {
        hideCallCoach();
        $("btn-next")?.click();
      }
    }, 700);
  }
  return true;
}

/**
 * True if remote video/audio tracks are live on the stage.
 */
function hasLiveRemoteMedia() {
  try {
    const streams = [];
    const r = $("remote")?.srcObject;
    if (r) streams.push(r);
    const t = $("remote-third")?.srcObject;
    if (t) streams.push(t);
    for (const s of streams) {
      if ((s.getTracks?.() || []).some((tr) => tr.readyState === "live")) {
        return true;
      }
    }
  } catch (_) {}
  return false;
}

function showPreferDirectAutoToast() {
  setStatus(
    _t("conn.preferDirectAutoOffBody") ||
      "Direct-only couldn’t connect — TURN relay is on again for the next match."
  );
}

function showCallCoach(reasonKey) {
  if (coachShownForMatch && $("call-coach") && !$("call-coach").hidden) return;
  coachShownForMatch = true;
  const el = $("call-coach");
  if (!el) return;
  const prefer =
    typeof preferDirectOnlyEnabled === "function" && preferDirectOnlyEnabled();
  const lead = $("call-coach-lead");
  if (lead) {
    if (prefer && (reasonKey === "coach.failed" || reasonKey === "coach.timeout")) {
      lead.textContent =
        _t("coach.preferDirectFail") ||
        _t(reasonKey || "coach.lead") ||
        "Could not connect with Prefer Direct (no TURN). Allow TURN or try Next.";
    } else {
      lead.textContent = _t(reasonKey || "coach.lead");
    }
  }
  const meta = $("call-coach-meta");
  if (meta) {
    const turn =
      window.__hasTurn || window.__iceMeta?.has_turn
        ? _t("coach.metaTurnOn")
        : _t("coach.metaTurnOff");
    const path = $("ice-path")?.textContent || "";
    const pd = prefer
      ? _t("settings.preferDirectOn") || "Prefer Direct on"
      : "";
    meta.textContent = [turn, path, pd].filter(Boolean).join(" · ");
  }
  const allowBtn = $("btn-coach-allow-turn");
  if (allowBtn) {
    allowBtn.hidden = !prefer;
  }
  el.hidden = false;
  setConnStrip("bad", _t("coach.strip"), "");
  log(_t("log.webrtcFail"));
}

function startWebrtcWatch() {
  clearWebrtcWatch();
  webrtcConnectedOk = false;
  coachShownForMatch = false;
  hideCallCoach();
  // ~8s: Prefer Direct → TURN+Next, else soft ICE restart once while still matched
  webrtcWatchSoftTimer = setTimeout(() => {
    if (!matched || webrtcConnectedOk || hasLiveRemoteMedia()) return;
    if (autoDisablePreferDirectOnFail({ autoNext: true })) return;
    const target = rtc || [...peerPcs.values()][0];
    if (target) trySoftRecoverAny(target, { reason: "watch_mid" });
  }, 8000);
  // If no media path after 14s while still matched → coach
  webrtcWatchTimer = setTimeout(() => {
    if (!matched || webrtcConnectedOk) return;
    if (!hasLiveRemoteMedia()) {
      // Prefer Direct stuck: auto-allow TURN + Next (toast). Else open coach.
      if (!autoDisablePreferDirectOnFail({ autoNext: true })) {
        showCallCoach("coach.timeout");
      }
    }
  }, 14000);
}

function handleWebrtcConnectionState(s, pcHint) {
  setStatus(_t("status.webrtc", { s }));
  if (s === "connected") {
    webrtcConnectedOk = true;
    // Allow another soft-ICE cycle after a successful recovery
    if (pcHint) {
      try {
        pcHint._softIceTried = false;
        pcHint._softReconnectScheduled = false;
        pcHint._iceRestartCount = 0;
      } catch (_) {}
    }
    clearWebrtcWatch();
    hideCallCoach();
    startStats();
    setRemoteEmpty(false);
    ensurePartnerVideoVisible();
    try {
      watchPartnerVideoFrames();
    } catch (_) {}
    setArchPill("p2p");
    setConnStrip(
      "call",
      matchMode === "friend" || inFriendCall
        ? _t("conn.friend") || "Friend call"
        : _t("conn.matched"),
      ""
    );
    updateChatHeader();
    updatePipButton();
    // Soft PWA install after first real media path (not during age-gate)
    try {
      if (typeof RuletPwa !== "undefined" && RuletPwa.tryShow) {
        RuletPwa.tryShow({ engaged: true, delay: 4000 });
      }
    } catch (_) {}
    trackEvent("webrtc_connected", {
      mode: matchMode || "solo",
      friend: inFriendCall || matchMode === "friend" ? 1 : 0,
    });
    markInviteFunnelConnected(
      inFriendCall || matchMode === "friend" ? "friend" : "stranger"
    );
    // Upgrade match toast once media path is live
    showMatchFoundToast({ connected: true });
    flashPartnerTile();
    // Hide compact "In a call" if ice-path badge is showing
    const liveChip = $("live-compact-chip");
    if (liveChip && $("ice-path") && !$("ice-path").hidden) {
      liveChip.hidden = true;
    }
  } else if (s === "failed") {
    webrtcConnectedOk = false;
    // Soft-recover find-3rd / multi-peer without killing the first partner
    if (pcHint && trySoftRecoverPeer(pcHint)) {
      return;
    }
    // Prefer Direct ICE fail: auto-allow TURN + soft Next (once/session)
    // Must rematch — existing PC still has STUN-only iceServers.
    if (autoDisablePreferDirectOnFail({ autoNext: true })) {
      /* toast + Next scheduled */
      return;
    }
    // 1v1 / friend: soft ICE restart then hard PC rebuild before coach
    if (pcHint && trySoftRecoverAny(pcHint, { reason: "failed" })) {
      return;
    }
    showCallCoach("coach.failed");
  } else if (s === "disconnected") {
    // Brief network blip — stay in call and try to recover (do not tear down)
    webrtcConnectedOk = false;
    setConnStrip(
      "warn",
      _t("conn.reconnectingMedia") || "Connection weak — reconnecting…",
      "",
      { reconnecting: true }
    );
    if (pcHint && trySoftRecoverAny(pcHint, { reason: "disconnected" })) {
      return;
    }
  }
}

/** Last Matched.peers list — used for soft ICE reconnect without full rematch. */
let lastMatchedPeers = [];

/**
 * Soft-recover a failed peer (find-3rd stranger) without tearing the teammate link.
 * @param {import('./webrtc.js').RouletteWebRtc | object} pc
 * @returns {boolean} true if recovery was started (caller should not show full coach)
 */
function trySoftRecoverPeer(pc) {
  if (!pc || !matched) return false;
  // Only during multi-peer / party layouts
  if (!(trioBrowse || matchMode === "party_browse" || peerPcs.size > 1)) {
    return false;
  }
  // Never soft-kill the only teammate/friend path
  if (isTeammateRole(pc._role) && peerPcs.size <= 1) return false;

  const peerId =
    pc.remotePeerId ||
    [...peerPcs.entries()].find(([, v]) => v === pc)?.[0] ||
    "";
  if (!peerId) return false;

  // Step 1: ICE restart once
  if (!pc._softIceTried) {
    pc._softIceTried = true;
    setStatus(_t("trio.iceRestart") || "Reconnecting peer…");
    trackEvent("peer_soft_ice", { role: pc._role || "", mode: matchMode || "" });
    Promise.resolve(pc.softIceRestart?.())
      .then((ok) => {
        if (!ok) schedulePeerHardReconnect(peerId, pc);
      })
      .catch(() => schedulePeerHardReconnect(peerId, pc));
    // If still failed after 5s, recreate PC
    setTimeout(() => {
      try {
        const cur = peerPcs.get(peerId);
        if (!cur || cur !== pc) return;
        const ice = cur.pc?.iceConnectionState || cur.pc?.connectionState || "";
        if (ice === "failed" || ice === "disconnected" || ice === "closed") {
          schedulePeerHardReconnect(peerId, pc);
        }
      } catch (_) {}
    }, 5000);
    return true;
  }

  // Step 2 already requested
  if (pc._softReconnectScheduled) return true;
  schedulePeerHardReconnect(peerId, pc);
  return true;
}

/**
 * 1v1 / friend soft ICE restart (no rematch). Prefer Direct is handled
 * separately — STUN-only PCs cannot gain TURN without a new PeerConnection.
 * @param {import('./webrtc.js').RouletteWebRtc | object} pc
 * @param {{ reason?: string }} [opts]
 * @returns {boolean} true if recovery was started
 */
function trySoftRecoverAny(pc, opts = {}) {
  if (!pc || !matched) return false;
  // Multi-peer: dedicated path (may hard-reconnect stranger only)
  if (trioBrowse || matchMode === "party_browse" || peerPcs.size > 1) {
    return trySoftRecoverPeer(pc);
  }
  // Prefer Direct still on + failed → need new PC with TURN (handled by caller)
  if (
    opts.reason === "failed" &&
    typeof preferDirectOnlyEnabled === "function" &&
    preferDirectOnlyEnabled()
  ) {
    return false;
  }
  const peerId =
    pc.remotePeerId ||
    [...peerPcs.entries()].find(([, v]) => v === pc)?.[0] ||
    "";

  // Step 1: ICE restart (once per drop cycle)
  if (!pc._softIceTried) {
    pc._softIceTried = true;
    setStatus(_t("trio.iceRestart") || "Reconnecting…");
    setConnStrip(
      "warn",
      _t("conn.reconnectingMedia") || "Connection weak — reconnecting…",
      "",
      { reconnecting: true }
    );
    trackEvent("solo_soft_ice", {
      reason: opts.reason || "",
      mode: matchMode || "",
      friend: inFriendCall ? 1 : 0,
    });
    Promise.resolve(pc.softIceRestart?.({ force: true })).catch(() => {});
    // If still dead after restart window → rebuild PeerConnection (same match)
    setTimeout(() => {
      try {
        if (!matched) return;
        if (hasLiveRemoteMedia() || webrtcConnectedOk) return;
        const cur =
          (peerId && peerPcs.get(peerId)) ||
          [...peerPcs.values()][0] ||
          pc;
        const ice = cur?.pc?.iceConnectionState || "";
        const cs = cur?.pc?.connectionState || "";
        if (
          ice === "connected" ||
          ice === "completed" ||
          cs === "connected"
        ) {
          return;
        }
        if (peerId) schedulePeerHardReconnect(peerId, cur);
        else if (lastMatchedPeers?.length) {
          schedulePeerHardReconnect(
            lastMatchedPeers[0]?.peer_id || "legacy",
            cur
          );
        }
      } catch (_) {}
    }, 6000);
    return true;
  }

  // Step 2: already tried ICE — hard rebuild once
  if (pc._softReconnectScheduled) return true;
  if (peerId || lastMatchedPeers?.length) {
    schedulePeerHardReconnect(
      peerId || lastMatchedPeers[0]?.peer_id || "legacy",
      pc
    );
    return true;
  }
  return false;
}

/**
 * VPN / strict networks: if direct ICE keeps failing, force TURN relay for this
 * session and rebuild the PeerConnection so media still works.
 * @returns {boolean} true if relay mode was just enabled (caller should rebuild)
 */
function tryVpnRelayRecovery() {
  if (vpnRelayRecoveryDone) return false;
  if (typeof preferDirectOnlyEnabled === "function" && preferDirectOnlyEnabled()) {
    return false; // prefer-direct auto-off handles its own rematch
  }
  if (typeof hideIpRelayOnlyEnabled === "function" && hideIpRelayOnlyEnabled()) {
    return false; // already relay-only by user choice
  }
  if (typeof sessionForceRelayEnabled === "function" && sessionForceRelayEnabled()) {
    return false;
  }
  const hasTurn =
    !!(window.__hasTurn || window.__iceMeta?.has_turn) ||
    !!(typeof getIceMeta === "function" && getIceMeta()?.has_turn);
  if (!hasTurn) return false;
  if (typeof setSessionForceRelay !== "function") return false;
  vpnRelayRecoveryDone = true;
  setSessionForceRelay(true);
  setStatus(
    _t("conn.vpnRelayOn") ||
      "Hard network/VPN — switching to secure relay…"
  );
  trackEvent("vpn_relay_recovery");
  log(_t("conn.vpnRelayOnLog") || "VPN/hard network: forced TURN relay");
  return true;
}

function schedulePeerHardReconnect(peerId, oldPc) {
  if (!matched) return;
  if (oldPc) oldPc._softReconnectScheduled = true;
  if (schedulePeerHardReconnect._busy) return;
  // Before rebuild: force TURN if still failing (VPN / CGNAT / corporate)
  try {
    tryVpnRelayRecovery();
  } catch (_) {}
  schedulePeerHardReconnect._busy = true;
  setStatus(
    _t("conn.reconnectingMedia") ||
      _t("trio.peerRetry") ||
      "Reconnecting media…"
  );
  setConnStrip(
    "warn",
    _t("conn.reconnectingMedia") || "Reconnecting media…",
    "",
    { reconnecting: true }
  );
  trackEvent("peer_soft_reconnect", {
    mode: matchMode || "",
    peer: String(peerId || "").slice(0, 12),
  });
  (async () => {
    try {
      const existing =
        (peerId && peerPcs.get(peerId)) ||
        (oldPc &&
          [...peerPcs.entries()].find(([, v]) => v === oldPc)?.[0] &&
          oldPc) ||
        null;
      const key =
        peerId ||
        (existing &&
          [...peerPcs.entries()].find(([, v]) => v === existing)?.[0]) ||
        "";
      if (key && peerPcs.has(key)) {
        try {
          peerPcs.get(key).closeCall({ keepLocal: true, sendBye: false });
        } catch (_) {}
        peerPcs.delete(key);
      } else if (existing) {
        try {
          existing.closeCall({ keepLocal: true, sendBye: false });
        } catch (_) {}
        for (const [k, v] of [...peerPcs.entries()]) {
          if (v === existing) peerPcs.delete(k);
        }
      }
      // Rebuild from last matched peer list (same conversation — no hub rematch)
      const peers =
        (lastMatchedPeers && lastMatchedPeers.length
          ? lastMatchedPeers
          : []
        ).slice();
      if (!peers.length) return;
      await joinPeers(peers);
      ensurePartnerVideoVisible();
    } catch (e) {
      console.warn("[soft reconnect]", e);
    } finally {
      schedulePeerHardReconnect._busy = false;
    }
  })();
}

function wireCallCoach() {
  on("btn-coach-dismiss", "click", () => hideCallCoach());
  on("btn-coach-next", "click", () => {
    hideCallCoach();
    $("btn-next")?.click();
  });
  on("btn-coach-allow-turn", "click", () => {
    preferDirectAutoOffDone = true;
    setPreferDirectOnly(false, { silent: false });
    // Also enable session relay so the next match works through VPN
    try {
      if (typeof setSessionForceRelay === "function") {
        vpnRelayRecoveryDone = true;
        setSessionForceRelay(true);
      }
    } catch (_) {}
    hideCallCoach();
    trackEvent("prefer_direct_coach_off");
    $("btn-next")?.click();
  });
  on("btn-coach-retry", "click", async () => {
    hideCallCoach();
    mediaPermissionDenied = false;
    try {
      await startPreview();
    } catch (_) {}
    if (matched && !webrtcConnectedOk) {
      // Nudge user to try Next if still no path
      setTimeout(() => {
        if (matched && !webrtcConnectedOk) showCallCoach("coach.stillFail");
      }, 3000);
    }
  });
}

function setPhase(p) {
  const el = $("phase");
  // Map friend_call for i18n fallback
  const label =
    p === "friend_call"
      ? _t("friends.call") || "friend"
      : _phase(p);
  if (el) {
    el.textContent = label;
    el.className = "phase " + p;
    // Hide idle + waiting/claiming — searching is footer center only (no WAITING + searching… by lang)
    el.hidden =
      !p ||
      p === "idle" ||
      p === "waiting" ||
      p === "claiming";
  }
  lastPhaseName = p || "idle";
  const wasQueue = inQueue;
  inQueue = p === "waiting" || p === "claiming";
  if (inQueue) wantSearch = true;
  if (inQueue && !wasQueue) startWaitTipsWatch();
  if (!inQueue) {
    clearWaitTipsWatch();
    hideWaitTips();
  }
  if (p !== "matched" && p !== "friend_call" && !matched) {
    stopMatchTimer();
  }
  updatePoolHint();
  updateFriendActionButtons();
  syncScreenWakeLock();
}

function setSplitRemote(on) {
  // Classic 1v2 solo view (two party members stacked). Not used in stage-trio.
  if (trioBrowse) on = false;
  const stack = $("remote-stack");
  const v2 = $("remote2");
  const wrap = $("remote2-wrap");
  stack?.classList.toggle("split", !!on);
  if (wrap) {
    wrap.hidden = !on;
    if (!on) wrap.setAttribute("hidden", "");
    else wrap.removeAttribute("hidden");
  }
  if (v2) {
    v2.hidden = !on;
    if (!on) {
      try {
        v2.srcObject = null;
      } catch (_) {}
    }
  }
  if (!on) {
    setWhoLabel("remote2", "", "");
    setPeerConnChip("remote2", "");
    setPeerMuteUi("remote2", false);
  }
  try {
    applyStageLayoutMode();
  } catch (_) {}
}

const STAGE_LAYOUT_KEY = "ruletka-stage-layout-v1";
/** @type {"stack"|"grid"} stack = vertical conversationalists; grid = equal windows */
let stageLayoutMode = "stack";

function loadStageLayoutPref() {
  try {
    const v = localStorage.getItem(STAGE_LAYOUT_KEY);
    if (v === "grid" || v === "stack") stageLayoutMode = v;
  } catch (_) {}
}

function saveStageLayoutPref() {
  try {
    localStorage.setItem(STAGE_LAYOUT_KEY, stageLayoutMode);
  } catch (_) {}
}

/** Live remote panes currently shown (not counting local). */
function countLiveRemotePanes() {
  let n = 0;
  const r = $("remote");
  if (r && !r.hidden && r.srcObject) {
    const live = (r.srcObject.getTracks?.() || []).some(
      (t) => t.readyState === "live"
    );
    if (live) n++;
  }
  const r2 = $("remote2");
  const wrap = $("remote2-wrap");
  if (r2 && wrap && !wrap.hidden && !r2.hidden && r2.srcObject) {
    const live = (r2.srcObject.getTracks?.() || []).some(
      (t) => t.readyState === "live"
    );
    if (live) n++;
  }
  const r3 = $("remote-third");
  const t3 = $("tile-third");
  if (r3 && t3 && !t3.hidden && !r3.hidden && r3.srcObject) {
    const live = (r3.srcObject.getTracks?.() || []).some(
      (t) => t.readyState === "live"
    );
    if (live) n++;
  }
  return n;
}

function isMultiPartyStage() {
  if (peerPcs.size >= 2) return true;
  if (trioBrowse) return true;
  if ($("remote-stack")?.classList.contains("split")) return true;
  if (document.querySelector("main.stage")?.classList.contains("stage-trio")) {
    return true;
  }
  return countLiveRemotePanes() >= 2;
}

/**
 * Apply stack (vertical conversationalists) or equal grid layout.
 * Default stack; user can toggle to 2×2 equal windows.
 */
/**
 * Visible stage panes for layout chrome (includes “looking for 3rd” empty tile).
 */
function countVisibleStagePanes() {
  let n = 1; // you
  const rem = $("tile-remote");
  if (rem && !rem.hidden) n++;
  const t3 = $("tile-third");
  if (t3 && !t3.hidden) n++;
  const wrap = $("remote2-wrap");
  if (wrap && !wrap.hidden) n++;
  // Live remotes may add panes even if tile bookkeeping lags
  n = Math.max(n, countLiveRemotePanes() + 1);
  return Math.min(4, n);
}

function applyStageLayoutMode() {
  const stage = document.querySelector("main.stage");
  if (!stage) return;
  const multi = isMultiPartyStage() || !!trioBrowse;
  // Prefer visible tiles so find-3rd (empty third) still counts as 3-way
  const total = multi ? countVisibleStagePanes() : 1;
  stage.classList.toggle("stage-multi", multi);
  stage.classList.toggle(
    "stage-layout-stack",
    multi && stageLayoutMode === "stack"
  );
  stage.classList.toggle(
    "stage-layout-grid",
    multi && stageLayoutMode === "grid"
  );
  stage.classList.toggle("stage-count-2", multi && total === 2);
  stage.classList.toggle("stage-count-3", multi && total === 3);
  stage.classList.toggle("stage-count-4", multi && total >= 4);

  const btn = $("btn-stage-layout");
  if (btn) {
    const wasHidden = btn.hidden;
    btn.hidden = !multi;
    if (multi) btn.removeAttribute("hidden");
    else btn.setAttribute("hidden", "");
    const gridOn = stageLayoutMode === "grid";
    btn.setAttribute("aria-pressed", gridOn ? "true" : "false");
    const gridIco = btn.querySelector(".layout-ico-grid");
    const stackIco = btn.querySelector(".layout-ico-stack");
    if (gridIco) {
      gridIco.hidden = gridOn;
      if (gridOn) gridIco.setAttribute("hidden", "");
      else gridIco.removeAttribute("hidden");
    }
    if (stackIco) {
      stackIco.hidden = !gridOn;
      if (!gridOn) stackIco.setAttribute("hidden", "");
      else stackIco.removeAttribute("hidden");
    }
    // Title describes the layout you SWITCH TO when tapping
    const title = gridOn
      ? _t("layout.stackTitle") || "Vertical stack (partner · 3rd · you)"
      : _t("layout.gridTitle") || "Equal 2×2 grid (up to 4 windows)";
    btn.title = title;
    btn.setAttribute("aria-label", title);
    if (multi && wasHidden) {
      try {
        maybeShowLayoutTip();
      } catch (_) {}
    }
  }
}

const LAYOUT_TIP_SESSION_KEY = "ruletka-layout-tip-v1";

/** Once per tab session when multi-party layout control first appears. */
function maybeShowLayoutTip() {
  try {
    if (sessionStorage.getItem(LAYOUT_TIP_SESSION_KEY) === "1") return;
    sessionStorage.setItem(LAYOUT_TIP_SESSION_KEY, "1");
  } catch {
    /* still show once if storage blocked */
  }
  const msg =
    _t("layout.tip") ||
    "Tap ▦ for equal 2×2 windows · ▤ back to vertical stack";
  try {
    setStatus(msg);
  } catch (_) {}
  try {
    if ($("layout-tip-toast")) return;
    const tip = document.createElement("div");
    tip.id = "layout-tip-toast";
    tip.className = "layout-tip-toast";
    tip.setAttribute("role", "status");
    tip.textContent = msg;
    document.body.appendChild(tip);
    setTimeout(() => {
      try {
        tip.classList.add("is-out");
      } catch (_) {}
      setTimeout(() => {
        try {
          tip.remove();
        } catch (_) {}
      }, 320);
    }, 4200);
  } catch (_) {}
}

function toggleStageLayoutMode() {
  stageLayoutMode = stageLayoutMode === "grid" ? "stack" : "grid";
  saveStageLayoutPref();
  applyStageLayoutMode();
  try {
    trackEvent("stage_layout", { mode: stageLayoutMode });
  } catch (_) {}
  setStatus(
    stageLayoutMode === "grid"
      ? _t("layout.gridOn") || "Equal grid layout"
      : _t("layout.stackOn") || "Vertical stack layout"
  );
}

// Load pref early
try {
  loadStageLayoutPref();
} catch (_) {}

/** Sync local preview into mobile partner PiP (portrait trio). */
function syncLocalPipMirror() {
  const pip = $("local-pip-mirror");
  const local = $("local");
  if (!pip) return;
  try {
    const src = local?.srcObject || previewStream || null;
    if (pip.srcObject !== src) pip.srcObject = src;
    playVideoEl(pip);
  } catch (_) {}
}

/**
 * Three-pane layout for find-third / party member hunting a stranger.
 * Desktop & landscape: Local | Partner | 3rd
 * Mobile portrait: Partner (+ self PiP) | 3rd
 */
/**
 * After a find-3rd / 1v2 session loses one person: keep the remaining peer,
 * switch to normal 2-cam layout (you + them), drop the leaver's video.
 * @param {Array} peers Matched.peers for the survivor pair
 */
function collapseMultiPeerToSoloLayout(peers) {
  const list = Array.isArray(peers) ? peers : [];
  const keepIds = new Set(list.map((p) => p.peer_id).filter(Boolean));
  let keepPeer =
    list.find((p) => p.role === "stranger" || p.role === "party") ||
    list[0] ||
    null;
  let keepPc = keepPeer
    ? peerPcs.get(keepPeer.peer_id) || findPcForPeer(keepPeer.peer_id)
    : null;
  if (!keepPc) {
    // Any live remote still in the keep set or sole remaining live stream
    for (const [pid, pc] of peerPcs.entries()) {
      if (keepIds.size && !keepIds.has(pid)) continue;
      const live = (pc.remoteStream?.getVideoTracks?.() || []).some(
        (t) => t.readyState === "live"
      );
      if (live) {
        keepPc = pc;
        if (!keepPeer) keepPeer = { peer_id: pid, role: "stranger" };
        break;
      }
    }
  }
  // Close the person who left (and any extras)
  for (const [pid, pc] of [...peerPcs.entries()]) {
    if (keepPc && pc === keepPc) continue;
    if (keepPeer && pid === keepPeer.peer_id) continue;
    if (keepIds.has(pid)) continue;
    try {
      pc.closeCall({ keepLocal: true, sendBye: false });
    } catch (_) {}
    peerPcs.delete(pid);
  }
  // Two-cam layout only
  trioBrowse = false;
  findThirdPending = null;
  yourRole = "solo";
  matchMode = "solo";
  inFriendCall = false;
  enableTrioLayout(false);
  setSplitRemote(false);
  showFriendPip(false);
  const r2 = $("remote2");
  if (r2) {
    try {
      r2.srcObject = null;
    } catch (_) {}
    r2.hidden = true;
  }
  const r3 = $("remote-third");
  if (r3) {
    try {
      r3.srcObject = null;
    } catch (_) {}
    r3.hidden = true;
  }
  if (keepPc) {
    if (keepPeer?.peer_id) rekeyPeerPc(keepPeer.peer_id, keepPc);
    keepPc._role = "stranger";
    bindPcVideo(keepPc, $("remote"));
    if (keepPc.remoteStream) {
      paintRemoteFromPc(keepPc, keepPc.remoteStream);
    }
    setRemoteEmpty(false);
    rtc = keepPc;
  } else {
    setRemoteEmpty(true, { force: true });
  }
  setStatus(
    _t("trio.partnerLeftKeep") || "Partner left — still chatting with the other person"
  );
  updateFriendActionButtons();
  trackEvent("trio_collapse_solo", {
    kept: keepPeer?.peer_id ? 1 : 0,
    peers: peerPcs.size,
  });
}

/** Delayed forceThirdBrandLoop timers — must cancel when 3rd video attaches. */
let thirdBrandLoopTimers = [];

function clearThirdBrandLoopTimers() {
  for (const t of thirdBrandLoopTimers) {
    try {
      clearTimeout(t);
    } catch (_) {}
  }
  thirdBrandLoopTimers = [];
}

/** True when #remote-third already has a live stranger stream. */
function thirdSlotHasLiveMedia() {
  const r3 = $("remote-third");
  if (!r3?.srcObject) return false;
  try {
    return (r3.srcObject.getTracks?.() || []).some(
      (t) => t.readyState === "live" && (t.kind === "video" || t.kind === "audio")
    );
  } catch {
    return false;
  }
}

function enableTrioLayout(on, { searching = false } = {}) {
  trioBrowse = !!on;
  const stage = document.querySelector("main.stage");
  stage?.classList.toggle("stage-trio", !!on);
  stage?.classList.toggle("stage-trio-searching", !!(on && searching));
  try {
    applyStageLayoutMode();
  } catch (_) {}
  const third = $("tile-third");
  if (third) third.hidden = !on;
  const empty = $("third-empty");
  const r3 = $("remote-third");
  if (!on) {
    clearThirdBrandLoopTimers();
    if (empty) empty.hidden = true;
    syncThirdEmptyBrand(false);
    if (r3) {
      r3.hidden = true;
      try {
        r3.srcObject = null;
      } catch (_) {}
    }
    const pip = $("local-in-partner-pip");
    if (pip) pip.hidden = true;
    return;
  }
  // Never wipe a live 3rd stream when re-entering layout (rematch / renegotiate)
  if (thirdSlotHasLiveMedia()) {
    clearThirdBrandLoopTimers();
    if (empty) empty.hidden = true;
    if (r3) r3.hidden = false;
    stage?.classList.remove("stage-trio-searching");
    bindFirstPartnerToMain(null);
    syncTrioLayout();
    return;
  }
  if (empty) {
    empty.hidden = !searching;
    empty.removeAttribute("hidden");
    if (!searching) empty.hidden = true;
  }
  if (r3 && searching) {
    r3.hidden = true;
    try {
      r3.srcObject = null;
    } catch (_) {}
  }
  // Brand loop while hunting — cancel these if the 3rd connects mid-delay
  clearThirdBrandLoopTimers();
  if (searching) {
    forceThirdBrandLoop();
    for (const ms of [100, 400, 1000]) {
      thirdBrandLoopTimers.push(
        setTimeout(() => {
          if (!trioBrowse || thirdSlotHasLiveMedia()) return;
          forceThirdBrandLoop();
        }, ms)
      );
    }
  } else {
    syncThirdEmptyBrand(false);
  }
  // Always keep first partner painted when entering trio
  bindFirstPartnerToMain(null);
  syncTrioLayout();
}

/**
 * Middle pane while find-3rd: play loading-screen.mp4 loop (not static logo-hero).
 * Must run after #tile-third is un-hidden — browsers block play on display:none parents.
 * Never runs when a live 3rd stream is already attached (audio-only or video).
 */
function forceThirdBrandLoop() {
  // Critical: delayed timers used to re-run this after the 3rd connected,
  // clearing #remote-third and leaving “Looking for a 3rd…” while audio played.
  if (thirdSlotHasLiveMedia()) return;
  const tile = $("tile-third");
  const empty = $("third-empty");
  const v = $("third-empty-video");
  const poster = $("third-empty-poster");
  if (!tile || !v) return;
  tile.hidden = false;
  tile.removeAttribute("hidden");
  if (empty) {
    empty.hidden = false;
    empty.removeAttribute("hidden");
  }
  // Hide live stranger slot while hunting (only when no live media)
  const r3 = $("remote-third");
  if (r3 && !thirdSlotHasLiveMedia()) {
    r3.hidden = true;
    try {
      r3.srcObject = null;
    } catch (_) {}
  }
  v.hidden = false;
  v.removeAttribute("hidden");
  v.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;display:block!important;opacity:1!important;visibility:visible!important;pointer-events:none;background:#0a0c12;";
  if (!v.getAttribute("src") || v.networkState === 3) {
    v.src = "/brand/loading-screen.mp4?v=5";
  }
  try {
    v.load();
  } catch (_) {}
  playBrandLoopVideo(v, poster, true);
  startBrandKeepalive();
}

function syncTrioLayout() {
  if (!trioBrowse) return;
  const stage = document.querySelector("main.stage");
  if (!stage) return;
  const portrait =
    window.matchMedia &&
    window.matchMedia("(max-width: 900px) and (orientation: portrait)").matches;
  const pip = $("local-in-partner-pip");
  if (pip) {
    pip.hidden = !portrait;
    if (portrait) syncLocalPipMirror();
  }
}

function setThirdSlotStream(stream, label) {
  try {
    setTimeout(() => applyStageLayoutMode(), 0);
  } catch (_) {}
  const r3 = $("remote-third");
  const empty = $("third-empty");
  const tag = $("third-tag");
  const wrap = $("third-tile-tag");
  if (stream && r3) {
    clearThirdBrandLoopTimers();
    prepareVideoEl(r3, { muted: false });
    r3.srcObject = stream;
    r3.hidden = false;
    r3.removeAttribute("hidden");
    playVideoEl(r3);
    // Hide “Looking for a 3rd…” completely (brand loop + empty layer)
    if (empty) {
      empty.hidden = true;
      empty.setAttribute("hidden", "");
    }
    try {
      const bv = $("third-empty-video");
      if (bv) {
        bv.pause?.();
        bv.hidden = true;
      }
      const poster = $("third-empty-poster");
      if (poster) poster.hidden = true;
    } catch (_) {}
    syncThirdEmptyBrand(false);
    document.querySelector("main.stage")?.classList.remove("stage-trio-searching");
    // Ensure audio/video play after autoplay policies
    try {
      ensureMediaUnlocked();
    } catch (_) {}
    applyRemoteVolume();
    setPeerMuteUi("remote-third", !!peerMutedByEl["remote-third"]);
    startThirdSlotWatchdog();
  } else {
    if (r3) {
      r3.hidden = true;
      try {
        r3.srcObject = null;
      } catch (_) {}
    }
    if (empty) {
      empty.hidden = !trioBrowse;
      if (trioBrowse) empty.removeAttribute("hidden");
    }
    document
      .querySelector("main.stage")
      ?.classList.toggle("stage-trio-searching", !!trioBrowse);
    // Middle pane: animated brand loop (not static poster)
    if (trioBrowse) forceThirdBrandLoop();
    else syncThirdEmptyBrand(false);
  }
  if (tag) tag.textContent = label || "";
  if (wrap) wrap.hidden = !label;
}

/** Brand loop behind “Looking for a 3rd…” */
function syncThirdEmptyBrand(showEmpty) {
  if (showEmpty) forceThirdBrandLoop();
  else playBrandLoopVideo($("third-empty-video"), $("third-empty-poster"), false);
}

/* ——— Multi-party polish: who-labels, role strip, per-peer mute, conn chips, 3rd watchdog ——— */

/** Per video-element mute / blur / volume (remote / remote2 / remote-third). */
const peerMutedByEl = {
  remote: false,
  remote2: false,
  "remote-third": false,
};
const peerBlurredByEl = {
  remote: false,
  remote2: false,
  "remote-third": false,
};
const peerVolByEl = {
  remote: 100,
  remote2: 100,
  "remote-third": 100,
};

/** peer_id → { elId, role, name, short, code, ice, conn } */
const peerUiMeta = new Map();

const PEER_SLOT_TILE = {
  remote: "tile-remote",
  remote2: "remote2-wrap",
  "remote-third": "tile-third",
};
const PEER_SLOT_CANVAS = {
  remote: "partner-blur-canvas",
  remote2: "remote2-blur-canvas",
  "remote-third": "third-blur-canvas",
};
/** @type {Record<string, number>} */
const peerBlurRafByEl = {};

let thirdSlotWatchTimer = 0;

function startThirdSlotWatchdog() {
  stopThirdSlotWatchdog();
  thirdSlotWatchTimer = setInterval(() => {
    try {
      if (!trioBrowse || yourRole !== "party") return;
      // Any stranger PC with live media should own the middle tile
      for (const [pid, pc] of peerPcs.entries()) {
        if (!(pc._role === "stranger" || pc._role === "party")) continue;
        const stream = pc.remoteStream;
        if (!stream) continue;
        const live = (stream.getTracks?.() || []).some(
          (t) => t.readyState === "live"
        );
        if (!live) continue;
        const r3 = $("remote-third");
        const empty = $("third-empty");
        const emptyOn = empty && !empty.hidden;
        const r3Ok =
          r3 &&
          r3.srcObject === stream &&
          !r3.hidden &&
          (r3.srcObject.getTracks?.() || []).some((t) => t.readyState === "live");
        if (!r3Ok || emptyOn) {
          const meta = peerUiMeta.get(pid);
          setThirdSlotStream(
            stream,
            meta?.name || pc._displayName || _t("trio.partner") || "Partner"
          );
          if (meta) {
            setWhoLabel(
              "remote-third",
              meta.name,
              formatWhoSub(meta.role, meta.short, meta.code)
            );
          }
          setPeerConnChip(
            "remote-third",
            pc.pc?.connectionState || pc.pc?.iceConnectionState || "connected"
          );
        }
      }
    } catch (_) {}
  }, 2000);
}

function stopThirdSlotWatchdog() {
  if (thirdSlotWatchTimer) {
    clearInterval(thirdSlotWatchTimer);
    thirdSlotWatchTimer = 0;
  }
}

function formatWhoSub(role, shortId, friendCode) {
  const roleLabel =
    role === "friend" || role === "teammate"
      ? _t("trio.roleFriend") || "Friend"
      : role === "stranger" || role === "party"
        ? _t("trio.roleStranger") || "Stranger"
        : _t("trio.rolePartner") || "Partner";
  const idBit = (friendCode || shortId || "").toString().slice(0, 10);
  return idBit ? `${roleLabel} · ${idBit}` : roleLabel;
}

function setWhoLabel(slot, name, sub) {
  // slot: "remote" | "remote2" | "remote-third"
  if (slot === "remote") {
    const subEl = $("remote-who-sub");
    if (subEl) {
      if (sub) {
        subEl.hidden = false;
        subEl.removeAttribute("hidden");
        subEl.textContent = sub;
      } else {
        subEl.hidden = true;
        subEl.textContent = "";
      }
    }
    return;
  }
  if (slot === "remote2") {
    const nameEl = $("remote2-tag");
    const subEl = $("remote2-who-sub");
    if (nameEl) nameEl.textContent = name || "";
    if (subEl) {
      subEl.textContent = sub || "";
      subEl.hidden = !sub;
    }
    return;
  }
  if (slot === "remote-third") {
    const subEl = $("third-who-sub");
    if (subEl) {
      if (sub) {
        subEl.hidden = false;
        subEl.removeAttribute("hidden");
        subEl.textContent = sub;
      } else {
        subEl.hidden = true;
        subEl.textContent = "";
      }
    }
  }
}

function setPeerConnChip(slot, state) {
  const id =
    slot === "remote"
      ? "remote-peer-conn-chip"
      : slot === "remote2"
        ? "remote2-conn-chip"
        : slot === "remote-third"
          ? "third-conn-chip"
          : "";
  const el = id ? $(id) : null;
  if (!el) return;
  const s = String(state || "").toLowerCase();
  if (!s || s === "closed") {
    el.hidden = true;
    el.textContent = "";
    el.classList.remove("is-ok", "is-mid", "is-bad");
    return;
  }
  el.hidden = false;
  el.removeAttribute("hidden");
  el.classList.remove("is-ok", "is-mid", "is-bad");
  let label = s;
  let cls = "is-mid";
  if (s === "connected" || s === "completed") {
    label = _t("trio.connOk") || "Live";
    cls = "is-ok";
  } else if (s === "connecting" || s === "checking" || s === "new") {
    label = _t("trio.connConnecting") || "Connecting";
    cls = "is-mid";
  } else if (s === "disconnected" || s === "failed") {
    label = s === "failed" ? _t("trio.connFailed") || "Failed" : _t("trio.connWeak") || "Weak";
    cls = "is-bad";
  }
  el.textContent = label;
  el.classList.add(cls);
  el.title = state;
}

function peerSlotLive() {
  return !!(matched || inFriendCall || trioBrowse || peerPcs.size > 0);
}

function setPeerMuteUi(slot, muted) {
  const btnId =
    slot === "remote"
      ? "btn-mute-remote-main"
      : slot === "remote2"
        ? "btn-mute-remote2"
        : slot === "remote-third"
          ? "btn-mute-remote-third"
          : "";
  const btn = btnId ? $(btnId) : null;
  if (!btn) return;
  const live = peerSlotLive();
  btn.hidden = !live;
  if (live) btn.removeAttribute("hidden");
  btn.classList.toggle("is-muted", !!muted);
  btn.textContent = muted ? "🔇" : "🔊";
  btn.title = muted
    ? _t("trio.unmuteThis") || "Unmute this person"
    : _t("trio.muteThis") || "Mute this person";
}

function setPeerBlurUi(slot, blurred) {
  const btnId =
    slot === "remote"
      ? "btn-blur-remote-main"
      : slot === "remote2"
        ? "btn-blur-remote2"
        : slot === "remote-third"
          ? "btn-blur-remote-third"
          : "";
  const btn = btnId ? $(btnId) : null;
  if (btn) {
    const live = peerSlotLive();
    btn.hidden = !live;
    if (live) btn.removeAttribute("hidden");
    btn.classList.toggle("is-active", !!blurred);
    btn.title = blurred
      ? _t("trio.unblurThis") || "Unblur this person"
      : _t("trio.blurThis") || "Blur this person";
  }
  const tileId = PEER_SLOT_TILE[slot];
  const tile = tileId ? $(tileId) : null;
  tile?.classList.toggle("peer-slot-blurred", !!blurred);
  // Keep legacy class on main tile for side-rail blur button styling
  if (slot === "remote") {
    $("tile-remote")?.classList.toggle("partner-blurred", !!blurred);
    partnerBlurred = !!blurred;
    try {
      updateSideIcons();
    } catch (_) {}
  }
}

function setPeerVolUi(slot, vol) {
  const inputId =
    slot === "remote"
      ? "vol-remote"
      : slot === "remote2"
        ? "vol-remote2"
        : slot === "remote-third"
          ? "vol-remote-third"
          : "";
  const wrapId =
    slot === "remote"
      ? "vol-remote-wrap"
      : slot === "remote2"
        ? "vol-remote2-wrap"
        : slot === "remote-third"
          ? "vol-remote-third-wrap"
          : "";
  const pctId =
    slot === "remote"
      ? "vol-remote-pct"
      : slot === "remote2"
        ? "vol-remote2-pct"
        : slot === "remote-third"
          ? "vol-remote-third-pct"
          : "";
  const input = inputId ? $(inputId) : null;
  const wrap = wrapId ? $(wrapId) : null;
  const pctEl = pctId ? $(pctId) : null;
  const n = Math.max(0, Math.min(100, Math.round(Number(vol) || 0)));
  const live = peerSlotLive();
  if (wrap) {
    wrap.hidden = !live;
    if (live) wrap.removeAttribute("hidden");
  }
  if (input && Number(input.value) !== n) input.value = String(n);
  if (pctEl) pctEl.textContent = `${n}%`;
  if (wrap) wrap.style.setProperty("--vol-pct", String(n));
}

function togglePeerElMute(slot) {
  if (!peerMutedByEl.hasOwnProperty(slot)) return;
  peerMutedByEl[slot] = !peerMutedByEl[slot];
  // Global partner mute follows primary remote
  if (slot === "remote") {
    partnerMuted = peerMutedByEl.remote;
    updateSideIcons();
  }
  applyRemoteVolume();
  setPeerMuteUi(slot, peerMutedByEl[slot]);
  trackEvent("peer_mute_toggle", { slot, muted: peerMutedByEl[slot] ? 1 : 0 });
}

function togglePeerElBlur(slot) {
  if (!peerBlurredByEl.hasOwnProperty(slot)) return;
  // User control — cancel intro auto-unblur when touching main remote
  if (slot === "remote") {
    clearIntroBlurTimer();
    introBlurGen++;
  }
  setPeerElBlur(slot, !peerBlurredByEl[slot]);
  trackEvent("peer_blur_toggle", {
    slot,
    blurred: peerBlurredByEl[slot] ? 1 : 0,
  });
}

function setPeerElBlur(slot, on) {
  if (!peerBlurredByEl.hasOwnProperty(slot)) return;
  peerBlurredByEl[slot] = !!on;
  setPeerBlurUi(slot, peerBlurredByEl[slot]);
  if (peerBlurredByEl[slot]) startPeerBlurCanvas(slot);
  else stopPeerBlurCanvas(slot);
  if (slot === "remote") {
    log(peerBlurredByEl[slot] ? _t("log.blurOn") : _t("log.blurOff"));
  }
}

function setPeerElVolume(slot, vol) {
  if (!peerVolByEl.hasOwnProperty(slot)) return;
  const v = Math.max(0, Math.min(100, Number(vol) || 0));
  peerVolByEl[slot] = v;
  setPeerVolUi(slot, v);
  applyRemoteVolume();
  // Keep global slider in sync when adjusting main remote
  if (slot === "remote") {
    syncVolumeSliders(v);
    savePrefs({ volume: v });
  }
}

function stopPeerBlurCanvas(slot) {
  if (peerBlurRafByEl[slot]) {
    cancelAnimationFrame(peerBlurRafByEl[slot]);
    peerBlurRafByEl[slot] = 0;
  }
  const canvasId = PEER_SLOT_CANVAS[slot];
  const c = canvasId ? $(canvasId) : null;
  if (c) {
    c.classList.remove("is-active");
    c.hidden = true;
  }
}

function startPeerBlurCanvas(slot) {
  if (!needsCanvasVideoBlur()) {
    // Desktop: CSS filter on .peer-slot-blurred is enough
    stopPeerBlurCanvas(slot);
    return;
  }
  const tileId = PEER_SLOT_TILE[slot];
  const canvasId = PEER_SLOT_CANVAS[slot];
  const video = $(slot);
  if (!tileId || !canvasId || !video) return;
  const canvas = ensureVideoBlurCanvas(tileId, canvasId);
  if (!canvas) return;
  canvas.hidden = false;
  canvas.classList.add("is-active");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  const tick = () => {
    if (!peerBlurredByEl[slot]) {
      stopPeerBlurCanvas(slot);
      return;
    }
    drawSoftBlurredVideo(ctx, video, canvas, { mirror: false });
    peerBlurRafByEl[slot] = requestAnimationFrame(tick);
  };
  if (peerBlurRafByEl[slot]) cancelAnimationFrame(peerBlurRafByEl[slot]);
  peerBlurRafByEl[slot] = requestAnimationFrame(tick);
}

function syncAllPeerMediaChrome() {
  for (const slot of ["remote", "remote2", "remote-third"]) {
    setPeerMuteUi(slot, !!peerMutedByEl[slot]);
    setPeerBlurUi(slot, !!peerBlurredByEl[slot]);
    setPeerVolUi(slot, peerVolByEl[slot] ?? 100);
    if (peerBlurredByEl[slot]) startPeerBlurCanvas(slot);
    else stopPeerBlurCanvas(slot);
  }
}

/**
 * Extra conversationalists (2nd/3rd slots) use the same rep / always-blur policy
 * as the main partner — never auto-blur friends/teammates.
 */
function shouldDefaultBlurExtraPeer(peerMeta, elId) {
  if (elId !== "remote2" && elId !== "remote-third") return false;
  if (isTeammateRole(peerMeta?.role)) return false;
  const meta = {
    stars: Math.max(0, Number(peerMeta?.stars) || 0),
    trust: Math.max(
      0,
      Number(
        peerMeta?.trust != null ? peerMeta.trust : peerMeta?.stars
      ) || 0
    ),
  };
  return strangerKeepsBlurUntilUnblur(meta);
}

function registerPeerUi(peerMeta, elId) {
  if (!peerMeta?.peer_id || !elId) return;
  peerUiMeta.set(peerMeta.peer_id, {
    elId,
    role: peerMeta.role || "",
    name: peerMeta.name || peerMeta.short_id || "",
    short: peerMeta.short_id || "",
    code: peerMeta.friend_code || "",
  });
  const sub = formatWhoSub(
    peerMeta.role,
    peerMeta.short_id,
    peerMeta.friend_code
  );
  setWhoLabel(elId === "remote-third" ? "remote-third" : elId, peerMeta.name, sub);
  if (elId === "remote" || elId === "remote2" || elId === "remote-third") {
    setPeerMuteUi(elId, !!peerMutedByEl[elId]);
    if (shouldDefaultBlurExtraPeer(peerMeta, elId)) {
      setPeerElBlur(elId, true);
    } else {
      setPeerBlurUi(elId, !!peerBlurredByEl[elId]);
    }
    setPeerVolUi(elId, peerVolByEl[elId] ?? 100);
  }
}

function updatePartyRoleStrip(msg) {
  const strip = $("party-role-strip");
  const text = $("party-role-text");
  if (!strip || !text) return;
  const peers = Array.isArray(msg?.peers)
    ? msg.peers
    : Array.isArray(lastMatchedPeers)
      ? lastMatchedPeers
      : [];
  const hasStranger = peers.some(
    (p) => p.role === "stranger" || p.role === "party"
  );
  const hasMate = peers.some((p) => isTeammateRole(p.role));
  let line = "";
  let searching = false;
  if (trioBrowse && yourRole === "party") {
    if (hasStranger) {
      line =
        _t("trio.stripWithThird") ||
        "You + friend · with stranger";
    } else {
      line =
        _t("trio.stripHunting") ||
        "You + friend · finding a stranger…";
      searching = true;
    }
  } else if (matchMode === "party_browse" && yourRole === "solo" && hasMate) {
    line =
      _t("trio.stripSoloVsParty") ||
      "You · vs two people";
  } else if (
    matchMode === "party_browse" &&
    yourRole === "party" &&
    hasStranger
  ) {
    // 2v2-ish party member with strangers
    const nOpp = peers.filter(
      (p) => p.role === "stranger" || p.role === "party"
    ).length;
    line =
      nOpp >= 2
        ? _t("trio.strip2v2") || "Your pair · vs their pair"
        : _t("trio.stripWithThird") || "You + friend · with stranger";
  } else if (inFriendCall && matchMode === "friend" && !trioBrowse) {
    line = _t("trio.stripFriendCall") || "Friend call";
  } else {
    strip.hidden = true;
    strip.classList.remove("is-searching");
    return;
  }
  text.textContent = line;
  strip.hidden = false;
  strip.removeAttribute("hidden");
  strip.classList.toggle("is-searching", searching);
}

function clearMultiPartyChrome() {
  stopThirdSlotWatchdog();
  peerUiMeta.clear();
  for (const slot of ["remote", "remote2", "remote-third"]) {
    peerMutedByEl[slot] = false;
    peerBlurredByEl[slot] = false;
    peerVolByEl[slot] = 100;
    stopPeerBlurCanvas(slot);
  }
  partnerBlurred = false;
  setWhoLabel("remote", "", "");
  setWhoLabel("remote2", "", "");
  setWhoLabel("remote-third", "", "");
  setPeerConnChip("remote", "");
  setPeerConnChip("remote2", "");
  setPeerConnChip("remote-third", "");
  syncAllPeerMediaChrome();
  const strip = $("party-role-strip");
  if (strip) {
    strip.hidden = true;
    strip.classList.remove("is-searching");
  }
}

function showFriendPip(show) {
  const wrap = $("friend-pip-wrap");
  const vid = $("friend-pip");
  if (wrap) wrap.hidden = !show;
  if (!show && vid) {
    try {
      vid.srcObject = null;
    } catch (_) {}
  }
}

/**
 * iOS Safari: set playsinline *before* play(); local must stay muted for autoplay.
 */
function prepareVideoEl(el, { muted = false } = {}) {
  if (!el) return;
  try {
    el.playsInline = true;
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "");
    if (muted) {
      el.muted = true;
      el.defaultMuted = true;
      el.setAttribute("muted", "");
    }
  } catch (_) {}
}

function playVideoEl(el) {
  if (!el) return;
  prepareVideoEl(el, { muted: el.id === "local" || el.muted });
  try {
    const p = el.play?.();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (_) {}
}

/** Unlock remote/local media after a user gesture (iOS audio/video policy). */
function ensureMediaUnlocked() {
  try {
    resumeMeterCtx?.();
  } catch (_) {}
  for (const id of ["remote", "remote2", "remote-third", "local", "friend-pip", "local-pip-mirror"]) {
    const v = $(id);
    if (!v?.srcObject) continue;
    playVideoEl(v);
  }
}

/** True when this element is a main partner surface (not friend PiP / local). */
function isMainRemoteVideoEl(el) {
  if (!el || !el.id) return false;
  return (
    el.id === "remote" ||
    el.id === "remote2" ||
    el.id === "remote-third"
  );
}

/**
 * Bind a peer connection’s remote stream to a video element (or detach).
 * Fixes party-browse: friend used to own #remote and blocked the stranger feed.
 * Always clears the empty/brand overlay when a live stream is shown on main remotes
 * (rematch / rebind used to leave empty covering the partner feed).
 */
function bindPcVideo(pc, el) {
  if (!pc) return;
  pc._videoEl = el || null;
  const stream = pc.remoteStream;
  if (el && stream) {
    prepareVideoEl(el, { muted: false });
    if (el.srcObject !== stream) el.srcObject = stream;
    playVideoEl(el);
    try {
      if (typeof applyLowLatencyPlayout === "function" && pc.pc) {
        applyLowLatencyPlayout(pc.pc);
      }
    } catch (_) {}
    if (isMainRemoteVideoEl(el)) {
      setRemoteEmpty(false);
      applyRemoteVolume();
      applySpeaker();
    }
  }
}

function paintRemoteFromPc(pc, stream) {
  const el = pc?._videoEl;
  if (!el) return;
  prepareVideoEl(el, { muted: false });
  const next = stream || pc.remoteStream || null;
  // Avoid thrashing srcObject (resets A/V sync clocks in some browsers)
  if (el.srcObject !== next) el.srcObject = next;
  playVideoEl(el);
  // Keep receive jitter buffers tight so audio doesn't drift behind video
  try {
    if (typeof applyLowLatencyPlayout === "function" && pc?.pc) {
      applyLowLatencyPlayout(pc.pc);
    }
  } catch (_) {}
  // Partner tiles only — not friend PiP / local
  if (isMainRemoteVideoEl(el)) {
    setRemoteEmpty(false);
    applyRemoteVolume();
    applySpeaker();
  }
}

/** If any main remote already has a live stream, hide empty overlay + ensure play. */
function ensurePartnerVideoVisible() {
  for (const id of ["remote", "remote2", "remote-third"]) {
    const el = $(id);
    if (!el?.srcObject) continue;
    const live = (el.srcObject.getTracks?.() || []).some(
      (t) => t.kind === "video" && t.readyState === "live"
    );
    if (!live) continue;
    setRemoteEmpty(false);
    playVideoEl(el);
  }
  // Also re-paint from peer map (srcObject may be set but overlay still up)
  for (const pc of peerPcs.values()) {
    if (!pc?.remoteStream || !isMainRemoteVideoEl(pc._videoEl)) continue;
    const hasVid = (pc.remoteStream.getVideoTracks?.() || []).some(
      (t) => t.readyState === "live"
    );
    if (hasVid) {
      paintRemoteFromPc(pc, pc.remoteStream);
    }
  }
}

/**
 * Find an existing RTC peer for a match peer_id.
 * Exact map key or pc.remotePeerId only — never “the only live PC”.
 * (Loose fallback re-keyed the first partner under the 3rd’s id and froze video.)
 */
function findPcForPeer(peerId) {
  if (!peerId) return null;
  if (peerPcs.has(peerId)) return peerPcs.get(peerId);
  for (const pc of peerPcs.values()) {
    if (pc?.remotePeerId && pc.remotePeerId === peerId) return pc;
  }
  return null;
}

/** Keep map keyed by server peer_id when we recover a PC under another key. */
function rekeyPeerPc(peerId, pc) {
  if (!pc) return;
  if (peerId) {
    for (const [k, v] of [...peerPcs.entries()]) {
      if (v === pc && k !== peerId) peerPcs.delete(k);
    }
    peerPcs.set(peerId, pc);
  }
}

/**
 * Bind first conversationalist (teammate/friend) onto #remote and force video visible.
 * Call on find-third accept and whenever trio layout is active.
 * Never steals the 3rd (stranger) stream onto the main tile.
 */
function bindFirstPartnerToMain(meta) {
  const remote = $("remote");
  if (!remote) return null;
  const peerId = meta?.peer_id || "";
  let pc = findPcForPeer(peerId);
  if (!pc) {
    // Prefer a teammate-marked PC — never grab the 3rd (stranger) stream for main
    for (const p of peerPcs.values()) {
      if (isTeammateRole(p._role) && p.remoteStream) {
        pc = p;
        break;
      }
    }
  }
  if (!pc && peerPcs.size === 1) {
    // Only safe when the sole peer is already a friend/teammate (hunting for 3rd).
    // If the sole peer is the stranger, leave main alone — 3rd belongs on #remote-third.
    const only = [...peerPcs.values()][0];
    if (only && isTeammateRole(only._role) && only.remoteStream) pc = only;
  }
  if (!pc) return null;
  // Never promote stranger/party onto the main “friend” tile
  if (
    !isTeammateRole(pc._role) &&
    (pc._role === "stranger" || pc._role === "party")
  ) {
    return null;
  }
  if (peerId) rekeyPeerPc(peerId, pc);
  if (!pc._role || pc._role === "stranger" || pc._role === "party") {
    pc._role = "teammate";
  }
  // Detach from friend-pip if still there
  showFriendPip(false);
  bindPcVideo(pc, remote);
  const stream = pc.remoteStream;
  if (stream) {
    prepareVideoEl(remote, { muted: false });
    if (remote.srcObject !== stream) remote.srcObject = stream;
    playVideoEl(remote);
    setRemoteEmpty(false);
    applyRemoteVolume();
    applySpeaker();
  }
  const tag = $("remote-tag");
  const wrap = $("remote-tile-tag");
  if (tag) {
    setNameOnTile(
      tag,
      meta?.name || lastMatchMeta?.name || _t("trio.partner") || "Partner",
      meta?.flag || lastMatchMeta?.flag
    );
  }
  syncRemoteTileTagVisibility();
  return pc;
}

/** After stranger leaves, put friend/teammate back on the main remote tile. */
function reattachFriendToMainRemote() {
  showFriendPip(false);
  setSplitRemote(false);
  const mate = [...peerPcs.values()].find((pc) => isTeammateRole(pc._role));
  if (mate) {
    bindFirstPartnerToMain({ peer_id: [...peerPcs.entries()].find(([, p]) => p === mate)?.[0] });
  } else {
    // Trio: still try any live PC (role may lag)
    bindFirstPartnerToMain(null);
  }
  if (trioBrowse) setThirdSlotStream(null);
}

function closeMatchMoreMenu() {
  const menu = $("match-more-menu");
  const btn = $("btn-match-more");
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function openMatchMoreMenu() {
  const menu = $("match-more-menu");
  const btn = $("btn-match-more");
  if (!menu || !btn) return;
  menu.hidden = false;
  btn.setAttribute("aria-expanded", "true");
}

function toggleMatchMoreMenu() {
  const menu = $("match-more-menu");
  if (!menu) return;
  if (menu.hidden) openMatchMoreMenu();
  else closeMatchMoreMenu();
}

function syncMatchMoreVisibility() {
  const wrap = $("match-more-wrap");
  const menu = $("match-more-menu");
  if (!wrap) return;
  const ids = [
    "btn-browse-together",
    "btn-hangup-friend",
    "btn-block",
    "btn-report-dock",
    "btn-find-third",
    "btn-find-third-cancel",
    "btn-spin",
  ];
  let any = false;
  for (const id of ids) {
    const el = $(id);
    if (el && !el.hidden) {
      any = true;
      break;
    }
  }
  wrap.hidden = !any;
  if (!any) closeMatchMoreMenu();
  // Hide empty hint only if menu has no items
  if (menu) {
    const hint = menu.querySelector(".match-more-hint");
    if (hint) hint.hidden = !any;
  }
}

function updateFriendActionButtons() {
  const browse = $("btn-browse-together");
  const hang = $("btn-hangup-friend");
  const block = $("btn-block");
  const findThird = $("btn-find-third");
  const findCancel = $("btn-find-third-cancel");
  if (browse) browse.hidden = !inFriendCall || matchMode === "party_browse";
  if (hang) hang.hidden = !inFriendCall && matchMode !== "friend";
  if (inFriendCall && matchMode === "friend") {
    if (browse) browse.hidden = false;
    if (hang) hang.hidden = false;
  }
  if (matchMode === "party_browse" && yourRole === "party") {
    if (browse) browse.hidden = true;
    // Hang only for real friend parties; stranger find-third uses Stop
    if (hang) hang.hidden = !inFriendCall || trioBrowse;
  }
  // Multi-party entry:
  // - Friend 1v1: primary CTA = "Find stranger together" (browse_together, instant)
  //   secondary = "Find 3rd" (invite confirm, then search)
  // - Stranger 1v1: only "Find 3rd" (invite)
  const hasLivePeer =
    peerPcs.size >= 1 ||
    (typeof partnerHasLiveVideo === "function" && partnerHasLiveVideo());
  const pureFriend1v1 =
    !!inFriendCall &&
    (matchMode === "friend" || matchMode === "solo") &&
    !trioBrowse &&
    yourRole !== "party";
  const pureStranger1v1 =
    !!matched &&
    !inFriendCall &&
    matchMode === "solo" &&
    yourRole === "solo" &&
    !trioBrowse;
  const canFindThird =
    TRIO_FIND_ENABLED &&
    (pureStranger1v1 || pureFriend1v1) &&
    hasLivePeer &&
    findThirdPending !== "out" &&
    findThirdPending !== "in";
  // Browse together:
  // - Friend 1v1 → party of 2 hunting solo (1v2)
  // - Already 3 people mesh → party of 3 hunting solo (3v1)
  const live3mesh =
    !!matched &&
    peerPcs.size >= 2 &&
    (matchMode === "party_browse" ||
      matchMode === "solo" ||
      matchMode === "friend" ||
      inFriendCall);
  if (browse) {
    const showBrowse =
      (pureFriend1v1 && hasLivePeer) || live3mesh;
    browse.hidden = !showBrowse;
    browse.disabled = !showBrowse;
    if (showBrowse) {
      if (live3mesh) {
        browse.textContent =
          _t("trio.findFourth") || "Find stranger together (3v1)";
        browse.title =
          _t("trio.findFourthHint") ||
          "All three of you search for one more stranger — keeps your group";
      } else {
        browse.textContent =
          _t("trio.findStrangerTogether") || "Find stranger together";
        browse.title =
          _t("trio.findStrangerTogetherHint") ||
          "You both search for a stranger now — no invite step";
      }
    }
  }
  if (findThird) {
    // Friend: secondary invite path; Stranger 1v1: only path
    const showFind =
      canFindThird && (pureStranger1v1 || pureFriend1v1);
    findThird.hidden = !showFind;
    findThird.disabled = !showFind;
    findThird.classList.toggle("accent", showFind && pureStranger1v1);
    findThird.classList.toggle("ghost", showFind && pureFriend1v1);
    if (showFind) {
      findThird.textContent = pureFriend1v1
        ? _t("trio.inviteThenSearch") || "Ask friend · Find 3rd"
        : _t("trio.invite") || "Find 3rd";
      findThird.title = pureFriend1v1
        ? _t("trio.inviteFriendTitle") ||
          "Ask your friend first, then search together"
        : _t("trio.invite") || "Find a third person together";
    }
  }
  if (findCancel) {
    findCancel.hidden = findThirdPending !== "out";
  }
  try {
    updatePartyRoleStrip();
  } catch (_) {}
  // Block / Report when in a call with a known partner user_id
  const canMod =
    !!matched &&
    !!primaryPartnerUserId &&
    primaryPartnerUserId !== myUserId;
  if (block) {
    block.hidden = !canMod;
  }
  const repDock = $("btn-report-dock");
  if (repDock) {
    repDock.hidden = !canMod || matchMode === "friend";
  }
  syncMatchMoreVisibility();
  syncMatchChrome();
  syncTrioLayout();
  updatePartnerClickable();
}

/**
 * Header status pill is permanently off (path / search / idle clutter).
 * Callers still pass strings for logging; nothing paints next to language.
 */
function setStatus(s) {
  const el = $("status");
  if (el) {
    el.textContent = "";
    el.hidden = true;
  }
  // Keep a trail in the log for useful non-noise messages only
  const text = s == null ? "" : String(s).trim();
  if (
    text &&
    !/search|ищем|поиск|stopped|idle|ожидание|Direct P2P|path|путь|relay|релей|connecting|подключ|matched|matchedStatus|webrtc|good path|лучший/i.test(
      text
    )
  ) {
    try {
      log(text);
    } catch (_) {}
  }
}

/** Last pool online count (for empty-share presence line). */
let lastOnlineCount = 0;

function setPool({ online, waiting, offers, room }) {
  if (online != null) {
    lastOnlineCount = online;
    if ($("stat-online")) $("stat-online").textContent = String(online);
  }
  if (waiting != null) {
    lastWaitingCount = waiting;
    if ($("stat-waiting")) $("stat-waiting").textContent = String(waiting);
  }
  // offers optional in new UI
  const o = $("stat-offers");
  if (offers != null && o) o.textContent = String(offers);
  if (room !== undefined) updateRoomChip(room);
  else updateRoomChip(currentRoom());
  updatePoolHint();
  updateEmptySharePresence();
  // Mobile invite + alone-search copy depend on pool counts
  updateEmptyShareVisibility();
  if ((inQueue || wantSearch) && !matched) {
    setSearchingEmptyCopy();
  }
}

function updateRoomChip(room) {
  const chip = $("room-chip");
  const label = $("room-chip-label");
  if (!chip) return;
  if (!ROOMS_ENABLED) {
    chip.hidden = true;
    if (label) label.textContent = "";
    return;
  }
  const r = (room != null ? room : currentRoom() || "").trim();
  if (!r) {
    chip.hidden = true;
    if (label) label.textContent = "";
    return;
  }
  chip.hidden = false;
  if (label) label.textContent = r.length > 18 ? r.slice(0, 16) + "…" : r;
  chip.title = _t("room.chipTitle", { r }) || `Room: ${r}`;
}

function updatePoolHint() {
  const hint = $("pool-hint");
  if (!hint) return;
  if (!inQueue && !wantSearch) {
    hint.hidden = true;
    hint.textContent = "";
    return;
  }
  const n = lastWaitingCount || 0;
  const online = lastOnlineCount || 0;
  const others = Math.max(0, n - 1);
  const room = (currentRoom() || "").trim();
  if (room) {
    if (others > 0) {
      hint.textContent = _t("pool.roomOthers", { n: others, r: room });
    } else if (inQueue || wantSearch) {
      hint.textContent =
        _t("pool.roomAlone", { r: room }) ||
        `You’re alone in room “${room}” — share the link so a friend can join.`;
    } else {
      hint.textContent = "";
    }
  } else if (others > 0) {
    hint.textContent = _t("pool.othersWaiting", { n: others });
  } else if (inQueue || wantSearch) {
    // Alone in public pool — point to friend invite (rooms may be off)
    if (online > 1) {
      hint.textContent =
        _t("pool.aloneOnline", { n: online }) ||
        `${online} online, but nobody else is waiting — invite a friend.`;
    } else {
      hint.textContent =
        _t("pool.alone") ||
        "You’re the only one waiting — invite a friend to join you.";
    }
  } else {
    hint.textContent = "";
  }
  hint.hidden = !hint.textContent;
}

/** Empty-card online chip removed for cleaner UI (pool stays in header). */
function updateEmptySharePresence() {
  const chip = $("empty-online-chip");
  if (chip) chip.hidden = true;
  const n = Number(lastOnlineCount) || 0;
  document.documentElement.classList.toggle("has-live-people", n > 1);
}

/** Clipboard only (never opens share sheet). */
async function copyToClipboard(url, okCopyKey) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setStatus(_t(okCopyKey || "room.copied"));
    log(_t(okCopyKey || "room.copied") + ": " + url);
    return "copy";
  } catch (e) {
    log(_t("room.copyFail") + ": " + url);
    return "fail";
  }
}

/**
 * Prefer native share sheet on mobile; fall back to clipboard.
 * @param {{ preferShare?: boolean }} [opts] preferShare=false forces clipboard only
 */
function siteBrandName() {
  try {
    if (typeof RuletBrand !== "undefined" && RuletBrand.name) return RuletBrand.name();
  } catch (_) {}
  return "ruletka.vip";
}

async function shareOrCopy(url, title, okShareKey, okCopyKey, opts) {
  const preferShare = !opts || opts.preferShare !== false;
  const brand = siteBrandName();
  const text = (opts && opts.text) || title || url;
  const copyPayload =
    (opts && opts.copyText) ||
    (text && url && text.indexOf(url) === -1 ? text + "\n" + url : text || url);
  if (preferShare) {
    try {
      if (navigator.share) {
        await navigator.share({
          title: title || brand,
          url,
          text: text || title || url,
        });
        setStatus(_t(okShareKey || "room.shared"));
        log(_t(okShareKey || "room.shared") + ": " + url);
        trackEvent("share", { via: "native", key: okShareKey || "room.shared" });
        return "share";
      }
    } catch (e) {
      if (e && (e.name === "AbortError" || e.name === "NotAllowedError"))
        return "cancel";
    }
  }
  const r = await copyToClipboard(copyPayload, okCopyKey);
  trackEvent("share", { via: "copy", key: okCopyKey || "room.copied" });
  return r;
}

function friendInviteUrl() {
  // Always land on live.html (not homepage) so rules + deep-link apply
  const u = new URL(location.origin + "/live.html");
  if (myFriendCode) u.searchParams.set("friend", myFriendCode);
  const name = getDisplayName();
  if (name && name !== "anon") u.searchParams.set("name", name);
  // Mark growth path for analytics + friendlier landing
  u.searchParams.set("ref", "friend_invite");
  return u.toString();
}

/** Persist ?friend= across rules gate / reconnect so deep links don't get lost. */
const PENDING_FRIEND_KEY = "ruletka-pending-friend-v1";
let pendingFriendInviteHandled = false;

function stashPendingFriendFromUrl() {
  try {
    const q = new URLSearchParams(location.search);
    const raw = q.get("friend");
    if (!raw) return;
    const code = normalizeFriendCodeInput(raw);
    if (code) sessionStorage.setItem(PENDING_FRIEND_KEY, code);
  } catch (_) {}
}

function getPendingFriendCode() {
  try {
    const q = new URLSearchParams(location.search).get("friend");
    if (q) {
      const c = normalizeFriendCodeInput(q);
      if (c) {
        sessionStorage.setItem(PENDING_FRIEND_KEY, c);
        return c;
      }
    }
    return normalizeFriendCodeInput(sessionStorage.getItem(PENDING_FRIEND_KEY) || "");
  } catch {
    return "";
  }
}

function clearPendingFriendCode() {
  try {
    sessionStorage.removeItem(PENDING_FRIEND_KEY);
  } catch (_) {}
  try {
    const u = new URL(location.href);
    if (u.searchParams.has("friend")) {
      u.searchParams.delete("friend");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    }
  } catch (_) {}
}

/**
 * Deep-link live.html?friend=CODE — open Friends, prefill, send request once connected.
 * @returns {boolean} true if request was sent
 */
function applyPendingFriendInvite({ forceOpen = true } = {}) {
  const code = getPendingFriendCode();
  if (!code || pendingFriendInviteHandled) return false;
  const input = $("add-friend-code");
  if (input) {
    input.value = code;
    try {
      input.classList.add("is-invite-prefill");
    } catch (_) {}
  }
  if (forceOpen) {
    try {
      openFriends();
    } catch (_) {}
  }
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    setStatus(
      _t("friends.inviteConnecting", { code }) ||
        `Invite ${code} — connecting, then requesting…`
    );
    return false;
  }
  // Avoid self-add noise before my code is known
  if (
    myFriendCode &&
    code === String(myFriendCode).toUpperCase().replace(/[^A-Z0-9]/g, "")
  ) {
    clearPendingFriendCode();
    pendingFriendInviteHandled = true;
    setStatus(_t("friends.cannotSelf") || "That’s your own invite link");
    return false;
  }
  if (requestAddFriend(code)) {
    pendingFriendInviteHandled = true;
    clearPendingFriendCode();
    setStatus(
      _t("friends.inviteDeepOk", { code }) ||
        `Request sent for ${code} — they Accept, then you can Call`
    );
    trackEvent("friend_invite_deep_link", { ok: 1 });
    markInviteFunnelRequestSent(code);
    // Soft highlight on friends code hero so both sides of the flow feel intentional
    try {
      $("friends-code-hero")?.classList.add("is-invite-highlight");
      setTimeout(
        () => $("friends-code-hero")?.classList.remove("is-invite-highlight"),
        5000
      );
    } catch (_) {}
    return true;
  }
  return false;
}

/**
 * Homepage / share landings: ?invite=1 | ?open=friends | ?ref=invite
 * Opens Friends and nudges sharing your own code (growth for empty pool).
 */
function maybeOpenInviteShareLanding() {
  let openInvite = false;
  try {
    const q = new URLSearchParams(location.search);
    openInvite =
      q.get("invite") === "1" ||
      q.get("open") === "friends" ||
      q.get("ref") === "invite";
    if (!openInvite) return;
    // Clean URL (keep lang)
    ["invite", "open"].forEach((k) => {
      if (q.has(k)) q.delete(k);
    });
    if (q.get("ref") === "invite") q.delete("ref");
    const qs = q.toString();
    history.replaceState(
      null,
      "",
      location.pathname + (qs ? "?" + qs : "") + location.hash
    );
  } catch (_) {
    return;
  }
  trackEvent("invite_landing_open");
  setTimeout(() => {
    try {
      openFriends();
      $("friends-code-hero")?.classList.add("is-invite-highlight");
      setStatus(
        _t("friends.inviteLandingHint") ||
          "Share your code so a friend can add you — then Call when online"
      );
      // One-tap: if code ready, optional auto-focus share
      if (myFriendCode) {
        $("btn-share-invite")?.classList.add("pulse-once");
        setTimeout(() => $("btn-share-invite")?.classList.remove("pulse-once"), 2400);
      }
      setTimeout(
        () => $("friends-code-hero")?.classList.remove("is-invite-highlight"),
        6000
      );
    } catch (_) {}
  }, 500);
}

function clearCallTimeout() {
  if (callTimeoutTimer) {
    clearTimeout(callTimeoutTimer);
    callTimeoutTimer = 0;
  }
}

/** Peer we last tried to ring (for missed-call history on timeout). */
let lastOutgoingCallPeer = null;

function startCallTimeout() {
  clearCallTimeout();
  callTimeoutTimer = setTimeout(() => {
    callTimeoutTimer = 0;
    setStatus(_t("status.callTimeout") || "No answer");
    log(_t("friends.noAnswer") || "No answer");
    const peer = lastOutgoingCallPeer;
    hideOutgoingCallToast();
    if (peer?.user_id) {
      recordMissedCall({
        ...peer,
        name: peer.name || "Friend",
      });
      showNoAnswerToast(peer);
    }
    lastOutgoingCallPeer = null;
  }, 30000);
}

/** Outbound “Calling…” toast with Cancel (Week-4 ring UX). */
function hideOutgoingCallToast() {
  try {
    const el = document.getElementById("outgoing-call-toast");
    if (el) el.remove();
  } catch (_) {}
  // Extra: any leftover class clones
  try {
    document.querySelectorAll(".outgoing-call-toast").forEach((n) => {
      try {
        n.remove();
      } catch (_) {}
    });
  } catch (_) {}
}

/** Connected (media or friend match) — never leave ring UI over the call. */
function dismissFriendRingUi() {
  clearCallTimeout();
  hideOutgoingCallToast();
  lastOutgoingCallPeer = null;
  try {
    hideIncomingCall();
  } catch (_) {}
}

function showOutgoingCallToast(peer, opts = {}) {
  hideOutgoingCallToast();
  const name = peer?.name || peer?.short_id || "Friend";
  const uid = peer?.user_id || "";
  const isJoin = !!opts.join;
  const toast = document.createElement("div");
  toast.id = "outgoing-call-toast";
  toast.className =
    "call-toast outgoing-call-toast" + (isJoin ? " is-join-invite" : "");
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  const statusLine = isJoin
    ? _t("friends.invitingJoinToast") ||
      _t("friends.invitingJoin") ||
      "Adding to this call…"
    : _t("status.calling") || "Calling…";
  toast.innerHTML = `
    <div class="call-toast-body">
      <strong>${escapeHtml(name)}</strong>
      <span class="outgoing-call-dots">${escapeHtml(statusLine)}</span>
    </div>
    <div class="call-toast-actions">
      <button type="button" class="pill danger" id="btn-cancel-call">${escapeHtml(
        _t("friends.cancelCall") || "Cancel"
      )}</button>
    </div>`;
  document.body.appendChild(toast);
  trackEvent("outgoing_call_show", { join: isJoin ? 1 : 0 });
  $("btn-cancel-call")?.addEventListener("click", () => {
    trackEvent("outgoing_call_cancel");
    cancelOutgoingCall(uid);
  });
}

function cancelOutgoingCall(userId) {
  const uid = (userId || lastOutgoingCallPeer?.user_id || "").trim();
  clearCallTimeout();
  hideOutgoingCallToast();
  if (uid) {
    try {
      send({ type: "call_cancel", user_id: uid });
    } catch (_) {}
  }
  lastOutgoingCallPeer = null;
  setStatus(_t("friends.callCancelled") || "Call cancelled");
}

/** No answer — offer Call again if still online. */
function showNoAnswerToast(peer) {
  try {
    if (!peer?.user_id) return;
    if (matched || inFriendCall) return;
    const id = "no-answer-toast";
    $(id)?.remove?.();
    const name = peer.name || "Friend";
    const online = !!(friendsCache || []).find(
      (f) => f && f.user_id === peer.user_id && f.online
    );
    const toast = document.createElement("div");
    toast.id = id;
    toast.className = "friend-soft-toast post-match-friend-nudge is-force is-no-answer";
    toast.setAttribute("role", "status");
    toast.style.pointerEvents = "auto";
    toast.innerHTML = `
      <strong>${escapeHtml(
        _t("friends.noAnswerTitle") || "No answer"
      )}</strong>
      <span>${escapeHtml(
        online
          ? _t("friends.noAnswerBodyOnline", { name }) ||
              `${name} didn’t pick up — try Call back.`
          : _t("friends.noAnswerBody", { name }) ||
              `${name} didn’t pick up. Call when they’re online.`
      )}</span>
      <div class="export-nudge-actions post-match-actions" style="margin-top:0.45rem">
        ${
          online
            ? `<button type="button" class="pill tight accent post-match-primary" id="btn-no-answer-retry">${escapeHtml(
                _t("friends.redial") || "Call back"
              )}</button>`
            : ""
        }
        <button type="button" class="pill tight ghost" id="btn-no-answer-ok">${escapeHtml(
          _t("friends.postMatchDone") || "Got it"
        )}</button>
      </div>`;
    document.body.appendChild(toast);
    trackEvent("no_answer_toast", { online: online ? 1 : 0 });
    const dismiss = () => {
      if (toast.parentNode) toast.remove();
    };
    $("btn-no-answer-ok")?.addEventListener("click", dismiss);
    $("btn-no-answer-retry")?.addEventListener("click", () => {
      trackEvent("no_answer_retry");
      dismiss();
      placeFriendCall(peer.user_id, { closePanel: false });
    });
    setTimeout(dismiss, 16000);
  } catch (_) {}
}

/** Last missed call for in-app Call back banner (not only OS notif). */
const LAST_MISSED_CALL_KEY = "ruletka-last-missed-call-v1";

function saveLastMissedCall(entry) {
  try {
    if (!entry?.user_id) return;
    localStorage.setItem(
      LAST_MISSED_CALL_KEY,
      JSON.stringify({
        user_id: entry.user_id,
        name: entry.name || "Friend",
        friend_code: entry.friend_code || "",
        short_id: entry.short_id || "",
        t: Date.now(),
      })
    );
  } catch (_) {}
}

function loadLastMissedCall() {
  try {
    const o = JSON.parse(localStorage.getItem(LAST_MISSED_CALL_KEY) || "null");
    if (!o || !o.user_id) return null;
    // Expire after 24h
    if (Date.now() - (o.t || 0) > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(LAST_MISSED_CALL_KEY);
      return null;
    }
    return o;
  } catch {
    return null;
  }
}

function clearLastMissedCall() {
  try {
    localStorage.removeItem(LAST_MISSED_CALL_KEY);
  } catch (_) {}
}

/**
 * When free: banner for recent missed call → Call back (if online) or open History.
 */
function maybeShowMissedCallBackBanner() {
  try {
    if (matched || inFriendCall || trioBrowse) return;
    if ($("missed-call-banner") || $("call-toast") || $("outgoing-call-toast"))
      return;
    const m = loadLastMissedCall();
    if (!m?.user_id) return;
    // Don't spam: once per session after save
    try {
      if (sessionStorage.getItem("ruletka-missed-banner-shown") === m.user_id + ":" + m.t)
        return;
    } catch (_) {}
    const fr = (friendsCache || []).find((f) => f && f.user_id === m.user_id);
    const online = !!(fr && fr.online);
    const name = (fr && friendDisplayName(fr)) || m.name || "Friend";
    const toast = document.createElement("div");
    toast.id = "missed-call-banner";
    toast.className =
      "friend-soft-toast post-match-friend-nudge is-force is-missed-banner";
    toast.setAttribute("role", "status");
    toast.style.pointerEvents = "auto";
    toast.innerHTML = `
      <strong>${escapeHtml(
        _t("friends.missedBannerTitle") || "Missed call"
      )}</strong>
      <span>${escapeHtml(
        online
          ? _t("friends.missedBannerOnline", { name }) ||
              `${name} called — they’re online now. Call back?`
          : _t("friends.missedBannerBody", { name }) ||
              `Missed call from ${name}. Open history when they’re online.`
      )}</span>
      <div class="export-nudge-actions post-match-actions" style="margin-top:0.45rem">
        ${
          online
            ? `<button type="button" class="pill tight accent post-match-primary" id="btn-missed-call-now">${escapeHtml(
                _t("friends.redial") || "Call back"
              )}</button>`
            : `<button type="button" class="pill tight accent" id="btn-missed-open-hist">${escapeHtml(
                _t("friends.openHistory") || "Call history"
              )}</button>`
        }
        <button type="button" class="pill tight ghost" id="btn-missed-dismiss">${escapeHtml(
          _t("friends.postMatchDone") || "Got it"
        )}</button>
      </div>`;
    document.body.appendChild(toast);
    try {
      sessionStorage.setItem(
        "ruletka-missed-banner-shown",
        m.user_id + ":" + m.t
      );
    } catch (_) {}
    trackEvent("missed_call_banner_show", { online: online ? 1 : 0 });
    const dismiss = (clear) => {
      if (toast.parentNode) toast.remove();
      if (clear) clearLastMissedCall();
    };
    $("btn-missed-dismiss")?.addEventListener("click", () => {
      trackEvent("missed_call_banner_dismiss");
      dismiss(true);
    });
    $("btn-missed-call-now")?.addEventListener("click", () => {
      trackEvent("missed_call_banner_call");
      dismiss(true);
      placeFriendCall(m.user_id, { closePanel: false });
    });
    $("btn-missed-open-hist")?.addEventListener("click", () => {
      trackEvent("missed_call_banner_history");
      dismiss(false);
      try {
        openFriends();
        setFriendsSheetTab("history");
      } catch (_) {}
    });
    setTimeout(() => dismiss(false), 20000);
  } catch (_) {}
}

function rulesAccepted() {
  try {
    return localStorage.getItem(RULES_KEY) === "1";
  } catch {
    return false;
  }
}

function showAgeStep() {
  const ov = $("rules-overlay");
  const step = $("age-gate-step");
  const sheet = $("agree-sheet");
  const scrim = $("agree-sheet-scrim");
  const under = $("age-gate-underage");
  if (step) step.hidden = false;
  if (sheet) sheet.hidden = true;
  if (scrim) scrim.hidden = true;
  ov?.classList.remove("has-agree-open");
  if (under) under.hidden = true;
}

function showAgreeSheet() {
  const ov = $("rules-overlay");
  const sheet = $("agree-sheet");
  const scrim = $("agree-sheet-scrim");
  const under = $("age-gate-underage");
  if (under) under.hidden = true;
  if (sheet) sheet.hidden = false;
  if (scrim) scrim.hidden = false;
  ov?.classList.add("has-agree-open");
}

function hideRulesGate() {
  const ov = $("rules-overlay");
  if (ov) {
    releaseSheetFocusTrap(ov);
    ov.hidden = true;
    ov.classList.remove("has-agree-open");
  }
  const sheet = $("agree-sheet");
  const scrim = $("agree-sheet-scrim");
  if (sheet) sheet.hidden = true;
  if (scrim) scrim.hidden = true;
}

function showRulesGate() {
  const ov = $("rules-overlay");
  if (!ov || rulesAccepted()) return false;
  ov.hidden = false;
  showAgeStep();
  // Brand logo / name if available
  try {
    if (typeof RuletBrand !== "undefined" && RuletBrand.apply) {
      RuletBrand.apply(ov);
    }
  } catch (_) {}
  // Focus primary age action for keyboard / screen-reader entry
  setTimeout(() => {
    try {
      $("btn-age-yes")?.focus?.();
    } catch (_) {}
  }, 80);
  bindSheetFocusTrap(ov);
  return true;
}

function acceptRulesAndEnter() {
  try {
    localStorage.setItem(RULES_KEY, "1");
  } catch (_) {}
  hideRulesGate();
  try {
    trackEvent("rules_accept");
  } catch (_) {}
  // Keep ?friend= invite through the gate
  try {
    stashPendingFriendFromUrl();
  } catch (_) {}
  // Warm media after Accept (user gesture) so Start is faster
  startSession({ forceMedia: true });
  // User gesture — start partner empty brand loop
  showPartnerEmptyWithBrand({ searching: false });
  // Deep-link friend invite: open Friends + request as soon as hub is ready
  setTimeout(() => {
    try {
      applyPendingFriendInvite({ forceOpen: true });
    } catch (_) {}
  }, 500);
  // Point at the main action immediately
  const pendingFriend = getPendingFriendCode();
  setStatus(
    pendingFriend
      ? _t("friends.inviteConnecting", { code: pendingFriend }) ||
          `Invite ${pendingFriend} — connecting, then requesting…`
      : _t("status.afterRules") ||
          "Tap Start to meet someone — allow camera when asked"
  );
  try {
    showStartButton(true);
    const btn = $("btn-start-match");
    btn?.classList.add("is-pulse-start");
    setTimeout(() => btn?.classList.remove("is-pulse-start"), 4800);
    setTimeout(() => {
      try {
        btn?.focus?.({ preventScroll: true });
      } catch (_) {
        try {
          btn?.focus?.();
        } catch (_) {}
      }
    }, 120);
  } catch (_) {}
  try {
    updateFirstRunEmptyHint();
  } catch (_) {}
  // Room invite deep-link: join as soon as gate is done
  setTimeout(() => maybeAutoJoinRoomInvite(), 350);
  setTimeout(() => {
    try {
      maybeShowFirstSessionGuide();
    } catch (_) {}
  }, 400);
}

function wireRulesGate() {
  const ov = $("rules-overlay");
  if (!ov) return;

  $("btn-age-yes")?.addEventListener("click", () => {
    try {
      trackEvent("age_yes");
    } catch (_) {}
    showAgreeSheet();
    // Move focus into agreement sheet primary action
    setTimeout(() => {
      try {
        $("btn-rules-accept")?.focus?.();
      } catch (_) {}
    }, 80);
  });
  $("btn-age-no")?.addEventListener("click", () => {
    const under = $("age-gate-underage");
    if (under) under.hidden = false;
    const actions = document.querySelector(".age-gate-actions");
    if (actions) actions.hidden = true;
    // Offer a safe exit to the homepage (not the chat)
    let exit = $("btn-age-exit");
    if (!exit) {
      exit = document.createElement("a");
      exit.id = "btn-age-exit";
      exit.className = "age-gate-btn ghost";
      exit.href = "/";
      exit.style.marginTop = "0.75rem";
      exit.textContent = _t("rules.underageExit") || "Back to homepage";
      $("age-gate-step")?.appendChild(exit);
    }
    exit.hidden = false;
    setTimeout(() => {
      try {
        exit.focus?.();
      } catch (_) {}
    }, 40);
    try {
      trackEvent("age_no");
    } catch (_) {}
  });
  $("btn-rules-accept")?.addEventListener("click", () => {
    acceptRulesAndEnter();
  });
  $("btn-agree-cancel")?.addEventListener("click", () => {
    showAgeStep();
    setTimeout(() => {
      try {
        $("btn-age-yes")?.focus?.();
      } catch (_) {}
    }, 40);
  });
  $("btn-agree-close")?.addEventListener("click", () => {
    showAgeStep();
  });
  $("agree-sheet-scrim")?.addEventListener("click", () => {
    showAgeStep();
  });

  if (!rulesAccepted()) {
    ov.hidden = false;
    showAgeStep();
    setTimeout(() => {
      try {
        $("btn-age-yes")?.focus?.();
      } catch (_) {}
    }, 100);
    bindSheetFocusTrap(ov);
  }
}

function setLocalEmpty(show) {
  $("local-empty")?.classList.toggle("hidden", !show);
  // Belt-and-suspenders: when we have a live feed, never leave the empty card up
  if (!show) {
    try {
      $("tile-local")?.classList.add("has-local-feed");
    } catch (_) {}
  } else if (!localVideoTrackLive()) {
    try {
      $("tile-local")?.classList.remove("has-local-feed");
    } catch (_) {}
  }
}

/** Mark tile as having a live local feed (CSS forces empty overlay off). */
function markLocalFeedActive(on) {
  try {
    $("tile-local")?.classList.toggle("has-local-feed", !!on);
  } catch (_) {}
  if (on) {
    try {
      $("local-empty")?.classList.add("hidden");
    } catch (_) {}
  }
}

/** Live video tracks on partner surfaces (main remotes). */
function partnerHasLiveVideo() {
  for (const id of ["remote", "remote2", "remote-third"]) {
    const el = $(id);
    if (!el?.srcObject) continue;
    try {
      if (
        (el.srcObject.getVideoTracks?.() || []).some(
          (t) => t.readyState === "live"
        )
      ) {
        return true;
      }
    } catch (_) {}
  }
  for (const pc of peerPcs.values()) {
    try {
      if (
        (pc.remoteStream?.getVideoTracks?.() || []).some(
          (t) => t.readyState === "live"
        )
      ) {
        return true;
      }
    } catch (_) {}
  }
  return false;
}

/**
 * True when partner video element is actually painting frames (not blank/white void).
 * A live MediaStreamTrack can exist before first decoded frame → empty light canvas.
 */
function partnerVideoHasFrames() {
  const el = $("remote");
  if (!el) return false;
  try {
    // videoWidth/Height stay 0 until first frame
    if (el.videoWidth > 8 && el.videoHeight > 8) return true;
  } catch (_) {}
  return false;
}

/** Watch for blank partner feed after match and surface a clear status (not a crash). */
let blankVideoWatchTimer = 0;
function watchPartnerVideoFrames() {
  if (blankVideoWatchTimer) {
    clearInterval(blankVideoWatchTimer);
    blankVideoWatchTimer = 0;
  }
  if (!matched && !inFriendCall) return;
  let ticks = 0;
  blankVideoWatchTimer = setInterval(() => {
    ticks++;
    if (!matched && !inFriendCall) {
      clearInterval(blankVideoWatchTimer);
      blankVideoWatchTimer = 0;
      return;
    }
    if (partnerVideoHasFrames()) {
      clearInterval(blankVideoWatchTimer);
      blankVideoWatchTimer = 0;
      return;
    }
    // After ~3s with a "live" track but no frames, tell the user what's going on
    if (ticks === 6 && partnerHasLiveVideo()) {
      setStatus(
        _t("conn.waitingPartnerVideo") ||
          "Connected — waiting for their camera…"
      );
      trackEvent("partner_video_blank", { t: 3 });
    }
    // After ~10s still blank: soft recovery nudge
    if (ticks >= 20) {
      clearInterval(blankVideoWatchTimer);
      blankVideoWatchTimer = 0;
      if (!partnerVideoHasFrames() && (matched || inFriendCall)) {
        setStatus(
          _t("conn.partnerVideoBlank") ||
            "Their video is blank — they may have camera off, or Next for someone else."
        );
        trackEvent("partner_video_blank", { t: 10 });
        // Try soft ICE once in case path is stuck
        try {
          const pc = rtc || [...peerPcs.values()][0];
          if (pc && !webrtcConnectedOk) {
            trySoftRecoverAny(pc, { reason: "blank_video" });
          }
        } catch (_) {}
      }
    }
  }, 500);
}

/**
 * @param {boolean} show
 * @param {{ force?: boolean }} [opts] force=true allows connecting overlay even if a stream is briefly present
 */
function setRemoteEmpty(show, opts) {
  // Never cover a live partner feed with the brand empty layer (unless forced connect flash)
  if (show && !opts?.force && matched && partnerHasLiveVideo()) {
    show = false;
  }
  $("remote-empty")?.classList.toggle("hidden", !show);
  // Hide partner name chip when no one is connected
  if (show) {
    const wrap = $("remote-tile-tag");
    const tag = $("remote-tag");
    if (wrap) wrap.hidden = true;
    if (tag) tag.textContent = "";
    setTileAvatar("remote", "");
    // Never leave bars/flowers over Start / brand empty (skip either side)
    clearRemoteMatchFx();
  }
  // Brand poster always; loop video only while empty (lazy src for mobile)
  syncEmptyBrandMedia(show);
  // Start button only when idle empty (not while searching)
  if (show) {
    updateStartButtonVisibility();
  } else {
    showStartButton(false);
  }
  updateEmptyShareVisibility();
  try {
    updateFirstRunEmptyHint();
  } catch (_) {}
}

/**
 * Empty partner tile: looping /brand/loading-screen.mp4 only (no static poster).
 */
function syncEmptyBrandMedia(showEmpty) {
  playBrandLoopVideo($("remote-empty-video"), null, showEmpty);
}

/**
 * Force brand mp4 to loop. No static image behind it.
 */
function playBrandLoopVideo(v, poster, showEmpty) {
  if (!v && !poster) return;

  const reduce =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!showEmpty) {
    try {
      v?.pause?.();
    } catch (_) {}
    if (v) v.dataset.wantPlay = "0";
    if (poster) poster.classList.remove("is-covered");
    return;
  }

  if (reduce) {
    try {
      v?.pause?.();
    } catch (_) {}
    if (v) v.style.opacity = "0";
    if (poster) poster.classList.remove("is-covered");
    return;
  }

  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    try {
      v?.pause?.();
    } catch (_) {}
    return;
  }

  if (!v) return;

  v.dataset.wantPlay = "1";
  // Critical: never leave [hidden] on the brand loop
  v.hidden = false;
  v.removeAttribute("hidden");
  // Inline styles must not dim the brand clip (CSS already tunes opacity)
  v.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:1;display:block!important;opacity:1!important;visibility:visible!important;pointer-events:none;filter:none!important;";

  // Lazy-load brand loop (preload=none in HTML) so JS/ICE win first bytes
  const wantSrc =
    v.getAttribute("data-src") || "/brand/loading-screen.mp4?v=8";
  if (!v.getAttribute("src") || !String(v.src || "").includes("loading-screen")) {
    v.src = wantSrc;
    try {
      v.load?.();
    } catch (_) {}
  }

  try {
    v.muted = true;
    v.defaultMuted = true;
    v.volume = 0;
    v.setAttribute("muted", "");
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.loop = true;
    v.autoplay = true;

    const markPlaying = () => {
      if (v.dataset.wantPlay !== "1") return;
      if (poster) poster.classList.add("is-covered");
      v.hidden = false;
      v.removeAttribute("hidden");
    };

    if (!v._brandLoopWired) {
      v._brandLoopWired = true;
      v.addEventListener("playing", markPlaying);
      v.addEventListener("timeupdate", () => {
        if (v.currentTime > 0.05) markPlaying();
      });
      v.addEventListener("ended", () => {
        if (v.dataset.wantPlay !== "1") return;
        try {
          v.currentTime = 0;
          v.play()?.catch?.(() => {});
        } catch (_) {}
      });
    }

    const go = () => {
      if (v.dataset.wantPlay !== "1") return;
      try {
        if (v.ended) v.currentTime = 0;
      } catch (_) {}
      const p = v.play();
      if (p && typeof p.then === "function") {
        p.then(markPlaying).catch(() => {});
      }
    };
    go();
    requestAnimationFrame(go);
    setTimeout(go, 50);
    setTimeout(go, 250);
    setTimeout(go, 800);
  } catch (_) {}
}

let brandKeepaliveTimer = 0;

function startBrandKeepalive() {
  if (brandKeepaliveTimer) return;
  brandKeepaliveTimer = setInterval(() => {
    const emptyOn = isRemoteEmptyVisible();
    const thirdOn =
      !!trioBrowse && !!$("third-empty") && !$("third-empty").hidden;
    if (!emptyOn && !thirdOn) return;
    if (emptyOn) {
      const v = $("remote-empty-video");
      if (v && (v.paused || v.ended || v.currentTime < 0.01)) {
        playBrandLoopVideo(v, $("remote-empty-poster"), true);
      }
    }
    if (thirdOn) {
      const v3 = $("third-empty-video");
      if (v3 && (v3.paused || v3.ended || v3.currentTime < 0.01)) {
        playBrandLoopVideo(v3, $("third-empty-poster"), true);
      }
    }
  }, 1000);
}

function kickEmptyBrandMedia() {
  startBrandKeepalive();
  const empty = $("remote-empty");
  if (empty && !empty.classList.contains("hidden") && !matched) {
    playBrandLoopVideo($("remote-empty-video"), $("remote-empty-poster"), true);
  } else if (isRemoteEmptyVisible()) {
    playBrandLoopVideo($("remote-empty-video"), $("remote-empty-poster"), true);
  }
  if (trioBrowse) {
    const empty3 = $("third-empty");
    if (empty3 && !empty3.hidden) {
      playBrandLoopVideo($("third-empty-video"), $("third-empty-poster"), true);
    }
  }
}

function isRemoteEmptyVisible() {
  const empty = $("remote-empty");
  if (!empty || empty.classList.contains("hidden")) return false;
  if (trioBrowse && yourRole === "party") return false;
  if (matched && !inQueue && matchMode !== "party_browse") return false;
  if (inFriendCall && matchMode === "friend" && !trioBrowse) return false;
  return true;
}

function showPartnerEmptyWithBrand({ searching = false } = {}) {
  try {
    const r = $("remote");
    if (r && !matched) {
      if (!peerPcs.size || ![...peerPcs.values()].some((pc) => pc.remoteStream)) {
        r.srcObject = null;
      }
    }
  } catch (_) {}
  setRemoteEmpty(true, { force: true });
  const empty = $("remote-empty");
  if (empty) {
    empty.classList.toggle("is-searching", !!searching);
    empty.classList.remove("hidden");
  }
  // Always play brand loop directly (bypass isRemoteEmptyVisible edge cases)
  playBrandLoopVideo($("remote-empty-video"), $("remote-empty-poster"), true);
  startBrandKeepalive();
}

/** True when nobody else is waiting (self in queue counts as 1). */
function isPoolAlone() {
  const waiting = lastWaitingCount || 0;
  if (inQueue || wantSearch) return Math.max(0, waiting - 1) === 0;
  return waiting === 0;
}

/**
 * Empty partner tile + mobile strip:
 * - Rooms on: room share tools
 * - Rooms off + alone searching: friend invite strip (growth path)
 */
function updateEmptyShareVisibility() {
  const invite = $("footer-invite");
  const mobile = $("mobile-invite");
  const empty = $("remote-empty");
  const emptyOpen =
    !!empty &&
    !empty.classList.contains("hidden") &&
    !matched &&
    !inFriendCall &&
    !trioBrowse;
  const alone = isPoolAlone();
  const searchingAlone =
    emptyOpen && alone && (inQueue || wantSearch) && !trioBrowse;
  const showRoomTools = !!(ROOMS_ENABLED && emptyOpen);
  if (invite) invite.hidden = !showRoomTools;

  // Mobile alone-invite under Start removed — keep shell hidden
  if (mobile) {
    mobile.hidden = true;
    mobile.setAttribute("hidden", "");
    mobile.classList.remove("is-searching-alone");
  }

  if (showRoomTools && alone && (inQueue || wantSearch)) {
    maybeStartLongWaitBoost();
  } else if (searchingAlone) {
    // Friend-invite path still gets the 8s alone toast boost
    maybeStartLongWaitBoost();
    hideEmptyShareQr();
  } else {
    if (!showRoomTools) hideEmptyShareQr();
    clearLongWaitBoost();
  }
  const localFloor = $("tile-floor-local");
  if (localFloor) {
    localFloor.classList.toggle(
      "has-invite",
      !!(invite && !invite.hidden) || searchingAlone
    );
  }
  updateFriendsOnlineStrip();
  updateEmptyAloneActions();
  updateEmptyIdleInvite();
  updateEmptyRecentStrip();
  try {
    updateFirstRunEmptyHint();
  } catch (_) {}
  try {
    updateEmptyWindowChip();
  } catch (_) {}
}

/**
 * Idle empty card: friend code + Share under Start.
 * Disabled — cleaner idle: Start only (code lives in Friends sheet).
 */
function updateEmptyIdleInvite() {
  const row = $("empty-idle-invite");
  if (row) {
    row.hidden = true;
    row.setAttribute("hidden", "");
  }
}

/**
 * Empty card strip: mutual friends only (call / message).
 * Disabled — open Friends sheet instead (cleaner idle empty card).
 */
function updateEmptyRecentStrip() {
  const strip = $("empty-recent-strip");
  const row = $("empty-recent-row");
  if (strip) {
    strip.hidden = true;
    strip.setAttribute("hidden", "");
  }
  if (row) row.innerHTML = "";
}

/**
 * While idle/searching: chip strip of online friends (call / open chat).
 * Disabled on empty card — use Friends sheet.
 */
function updateFriendsOnlineStrip() {
  const strip = $("friends-online-strip");
  const row = $("friends-online-row");
  if (strip) {
    strip.hidden = true;
    strip.setAttribute("hidden", "");
  }
  if (row) row.innerHTML = "";
}

/** After ~12s alone in queue, emphasize invite + one-tap share toast. */
let longWaitTimer = 0;
let aloneInviteToastShown = false;
function clearLongWaitBoost() {
  if (longWaitTimer) {
    clearTimeout(longWaitTimer);
    longWaitTimer = 0;
  }
  $("footer-invite")?.classList.remove("is-long-wait");
  $("mobile-invite")?.classList.remove("is-long-wait");
}
function maybeStartLongWaitBoost() {
  if (longWaitTimer) return;
  if (matched || inFriendCall || trioBrowse) return;
  if (!inQueue && !wantSearch) return;
  if (!isPoolAlone()) return;
  longWaitTimer = setTimeout(() => {
    longWaitTimer = 0;
    if (matched || inFriendCall || trioBrowse) return;
    if (!inQueue && !wantSearch) return;
    if (!isPoolAlone()) return;
    const footer = $("footer-invite");
    if (footer && !footer.hidden) footer.classList.add("is-long-wait");
    const mobile = $("mobile-invite");
    if (mobile && !mobile.hidden) mobile.classList.add("is-long-wait");
    maybeShowAloneInviteToast();
  }, 8_000); // sooner invite when alone
}

/**
 * Soft toast while alone searching (once per search session).
 * Rooms off: friend invite / copy code. Rooms on: share room.
 */
function maybeShowAloneInviteToast() {
  try {
    // Invite UI lives on the empty partner card — no floating popup.
    if (!SOFT_POPUPS_ENABLED) {
      aloneInviteToastShown = true;
      return;
    }
    if (aloneInviteToastShown) return;
    if (matched || inFriendCall || trioBrowse) return;
    if (!inQueue && !wantSearch) return;
    if (!isPoolAlone()) return;
    if ($("alone-invite-toast") || $("stop-invite-nudge") || $("post-match-friend-nudge"))
      return;
    aloneInviteToastShown = true;
    const toast = document.createElement("div");
    toast.id = "alone-invite-toast";
    toast.className = "friend-soft-toast alone-invite-toast";
    toast.setAttribute("role", "status");
    toast.style.pointerEvents = "auto";
    const codeBit = myFriendCode
      ? ` · ${myFriendCode}`
      : "";
    const title = ROOMS_ENABLED
      ? _t("remote.shareHintEmpty") ||
        "Pool is empty — share so someone can join you."
      : _t("friends.aloneInviteBody") ||
        "Few people online. Invite a friend to live — they add your code, you Accept, then Call.";
    toast.innerHTML = `
      <strong>${escapeHtml(
        _t("friends.aloneInviteTitle") || "Invite someone to live"
      )}${escapeHtml(codeBit)}</strong>
      <span>${escapeHtml(title)}</span>
      <div class="export-nudge-actions" style="margin-top:0.45rem">
        <button type="button" class="pill tight ghost" id="btn-alone-invite-later">${escapeHtml(
          _t("friends.exportNudgeLater") || "Later"
        )}</button>
        <button type="button" class="pill tight" id="btn-alone-copy-code">${escapeHtml(
          _t("friends.copyCode") || "Copy code"
        )}</button>
        <button type="button" class="pill tight accent" id="btn-alone-invite-share">${escapeHtml(
          _t("friends.inviteNow") || "Invite friend"
        )}</button>
      </div>`;
    document.body.appendChild(toast);
    trackEvent("alone_invite_toast_show", { rooms: ROOMS_ENABLED ? 1 : 0 });
    const dismiss = () => {
      if (toast.parentNode) toast.remove();
    };
    $("btn-alone-invite-later")?.addEventListener("click", () => {
      trackEvent("alone_invite_later");
      dismiss();
    });
    $("btn-alone-copy-code")?.addEventListener("click", async () => {
      trackEvent("alone_invite_copy_code");
      dismiss();
      try {
        await shareFriendInvite({ preferShare: false, liveNow: true });
      } catch (_) {}
    });
    $("btn-alone-invite-share")?.addEventListener("click", async () => {
      trackEvent("alone_invite_share", { rooms: ROOMS_ENABLED ? 1 : 0 });
      dismiss();
      if (ROOMS_ENABLED) {
        await shareOrCopy(
          roomShareUrl({ mintIfEmpty: true }),
          siteBrandName() + " room",
          "room.shared",
          "room.copied",
          { preferShare: true }
        );
      } else {
        try {
          await shareFriendInvite({ preferShare: true, liveNow: true });
        } catch (_) {
          try {
            openFriends();
          } catch (_) {}
        }
      }
    });
    setTimeout(dismiss, 18000);
  } catch (_) {}
}

/** Soft idle nudge when people are online — once per day, not a nag loop. */
const PEOPLE_ONLINE_NUDGE_KEY = "ruletka-people-online-nudge-day-v1";
function peopleOnlineNudgeDayDone() {
  try {
    const d = new Date().toISOString().slice(0, 10);
    return localStorage.getItem(PEOPLE_ONLINE_NUDGE_KEY) === d;
  } catch {
    return true;
  }
}
function markPeopleOnlineNudgeDay() {
  try {
    const d = new Date().toISOString().slice(0, 10);
    localStorage.setItem(PEOPLE_ONLINE_NUDGE_KEY, d);
  } catch (_) {}
}
function maybeShowPeopleOnlineNudge() {
  try {
    if (!SOFT_POPUPS_ENABLED) return;
    if (peopleOnlineNudgeDayDone()) return;
    if (matched || inFriendCall || inQueue || wantSearch || trioBrowse) return;
    const online = lastOnlineCount || 0;
    if (online < 2) return;
    if ($("people-online-nudge") || $("alone-invite-toast") || $("stop-invite-nudge"))
      return;
    // Delay slightly so Start paint settles
    setTimeout(() => {
      try {
        if (peopleOnlineNudgeDayDone()) return;
        if (matched || inFriendCall || inQueue || wantSearch) return;
        if ((lastOnlineCount || 0) < 2) return;
        if ($("people-online-nudge")) return;
        markPeopleOnlineNudgeDay();
        const n = lastOnlineCount || online;
        const toast = document.createElement("div");
        toast.id = "people-online-nudge";
        toast.className = "friend-soft-toast people-online-nudge";
        toast.setAttribute("role", "status");
        toast.style.pointerEvents = "auto";
        toast.innerHTML = `
          <strong>${escapeHtml(
            _t("pool.peopleOnlineTitle") || "People are online"
          )}</strong>
          <span>${escapeHtml(
            _t("pool.peopleOnlineBody", { n }) ||
              `${n} online right now — tap Start to find a match.`
          )}</span>
          <div class="export-nudge-actions" style="margin-top:0.45rem">
            <button type="button" class="pill tight ghost" id="btn-people-online-later">${escapeHtml(
              _t("friends.exportNudgeLater") || "Later"
            )}</button>
            <button type="button" class="pill tight accent" id="btn-people-online-start">${escapeHtml(
              _t("btn.start") || "Start"
            )}</button>
          </div>`;
        document.body.appendChild(toast);
        trackEvent("people_online_nudge_show", { n });
        const dismiss = () => {
          if (toast.parentNode) toast.remove();
        };
        $("btn-people-online-later")?.addEventListener("click", () => {
          trackEvent("people_online_nudge_later");
          dismiss();
        });
        $("btn-people-online-start")?.addEventListener("click", () => {
          trackEvent("people_online_nudge_start");
          dismiss();
          startMatchFromIdle();
        });
        setTimeout(dismiss, 12000);
      } catch (_) {}
    }, 1800);
  } catch (_) {}
}

/** @type {"room"|"friend"|null} */
let emptyShareQrMode = null;

/** Dynamic script loader (QR / invite helpers — off critical path). */
const _scriptLoadCache = Object.create(null);
function loadScriptOnce(src) {
  if (_scriptLoadCache[src]) return _scriptLoadCache[src];
  _scriptLoadCache[src] = new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-dyn-src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.dynSrc = src;
    s.onload = () => resolve();
    s.onerror = () => {
      delete _scriptLoadCache[src];
      reject(new Error("load " + src));
    };
    document.head.appendChild(s);
  });
  return _scriptLoadCache[src];
}

/** Lazy-load QR libs only when user opens a QR (saves ~56KB on first paint). */
let _qrLoadPromise = null;
function ensureRuletQr() {
  if (typeof RuletQr !== "undefined" && typeof RuletQr.render === "function") {
    return Promise.resolve(true);
  }
  if (_qrLoadPromise) return _qrLoadPromise;
  _qrLoadPromise = loadScriptOnce("/qrcode-generator.js?v=2")
    .then(() => loadScriptOnce("/qr.js?v=2"))
    .then(
      () =>
        typeof RuletQr !== "undefined" && typeof RuletQr.render === "function"
    )
    .catch(() => {
      _qrLoadPromise = null;
      return false;
    });
  return _qrLoadPromise;
}

/** Tonight-window helper — tiny, but not needed until empty/alone UI paints. */
function ensureLiveWindow() {
  if (typeof RuletLiveWindow !== "undefined") return Promise.resolve(true);
  return loadScriptOnce("/live-window.js?v=2")
    .then(() => typeof RuletLiveWindow !== "undefined")
    .catch(() => false);
}

/** Invite copy pack helper — load on first share. */
function ensureInviteCopy() {
  if (typeof RuletInviteCopy !== "undefined") return Promise.resolve(true);
  return loadScriptOnce("/invite-copy.js?v=2")
    .then(() => typeof RuletInviteCopy !== "undefined")
    .catch(() => false);
}

function hideEmptyShareQr() {
  const qr = $("empty-share-qr");
  if (qr) {
    qr.hidden = true;
    qr.innerHTML = "";
  }
  emptyShareQrMode = null;
  const btn = $("btn-empty-qr");
  if (btn) btn.textContent = _t("remote.showQr") || "QR";
}

function showEmptyShareQr(mode) {
  const qr = $("empty-share-qr");
  if (!qr) return;
  // Friend QR UI removed — room QR only when rooms enabled
  if (mode === "friend" || !ROOMS_ENABLED) {
    hideEmptyShareQr();
    return;
  }
  if (emptyShareQrMode === mode && !qr.hidden && qr.innerHTML) {
    hideEmptyShareQr();
    return;
  }
  const url = roomShareUrl();
  const alt = "Room QR";
  qr.hidden = false;
  emptyShareQrMode = mode;
  const btn = $("btn-empty-qr");
  if (btn) {
    btn.textContent = _t("remote.hideQr") || "Hide QR";
  }
  // Local QR — loaded on demand (not on first paint)
  ensureRuletQr().then((ok) => {
    if (emptyShareQrMode !== mode || qr.hidden) return;
    if (ok && typeof RuletQr !== "undefined" && RuletQr.render) {
      RuletQr.render(qr, url, { size: 140, margin: 2, alt });
    } else {
      const src =
        "https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=6&data=" +
        encodeURIComponent(url);
      qr.innerHTML = `<img src="${src}" width="140" height="140" alt="${escapeAttr(
        alt
      )}" loading="lazy" />`;
    }
  });
}

function toggleEmptyShareQr() {
  showEmptyShareQr("room");
}

/**
 * Footer + Start chrome state machine:
 *  idle     → Start only (no Spin / Next / Stop)
 *  search   → Stop only
 *  matched  → Next + Stop (Spin stays hidden)
 *  friend   → Stop only (Next hidden unless party/trio)
 */
function syncMatchChrome() {
  const empty = $("remote-empty");
  const startBtn = $("btn-start-match");
  const next = $("btn-next");
  const stop = $("btn-stop");
  const spin = $("btn-spin");

  const emptyOpen =
    !!empty && !empty.classList.contains("hidden") && !matched && !inFriendCall;
  const isIdle =
    emptyOpen && !inQueue && !wantSearch && !trioBrowse && !findThirdPending;
  const isSearching =
    !matched && !inFriendCall && (inQueue || wantSearch) && !trioBrowse;
  const isLive =
    matched || inFriendCall || !!trioBrowse;

  if (startBtn) startBtn.hidden = !isIdle;
  document.documentElement.classList.toggle("start-idle", isIdle);
  document.documentElement.classList.toggle("match-searching", isSearching);
  document.documentElement.classList.toggle("match-live", isLive);
  // Quieter header while matched: compact "In a call" instead of Online/Waiting
  const liveChip = $("live-compact-chip");
  if (liveChip) {
    const pathShown = $("ice-path") && !$("ice-path").hidden;
    liveChip.hidden = !isLive || pathShown;
  }

  if (spin) spin.hidden = true; // Spin is redundant with Start / Next

  if (isIdle) {
    if (next) next.hidden = true;
    if (stop) stop.hidden = true;
  } else if (isSearching) {
    if (next) next.hidden = true;
    if (stop) stop.hidden = false;
  } else if (isLive) {
    // Pure 1v1 friend call: hang-up is the main exit; Next is for strangers
    const pureFriend = inFriendCall && matchMode === "friend" && !trioBrowse;
    if (next) next.hidden = pureFriend;
    if (stop) stop.hidden = false;
  } else {
    if (next) next.hidden = false;
    if (stop) stop.hidden = false;
  }

  if (empty) {
    empty.classList.toggle("is-searching", isSearching);
    if (isIdle) empty.classList.remove("is-searching");
  }
  // Partner tray: hide compose until live; while searching keep Stop tappable
  const partnerFloor = $("tile-floor-partner");
  if (partnerFloor) {
    partnerFloor.classList.toggle("is-idle", isIdle);
    partnerFloor.classList.toggle("is-searching", isSearching);
    partnerFloor.classList.toggle("is-active", isSearching || isLive);
  }
  const localFloor = $("tile-floor-local");
  if (localFloor) {
    localFloor.classList.toggle("is-idle", isIdle);
    localFloor.classList.toggle("has-invite", !!( $("footer-invite") && !$("footer-invite").hidden ));
  }
  updateEmptyShareVisibility();
  if (isIdle) maybeShowPeopleOnlineNudge();
}

/** @deprecated use syncMatchChrome — kept for call sites that pass a bool */
function showStartButton(show) {
  if (show) {
    // Force idle-looking Start if caller wants it (e.g. after Stop)
    const empty = $("remote-empty");
    if (empty) empty.classList.remove("hidden");
  }
  syncMatchChrome();
  if (!show) {
    const startBtn = $("btn-start-match");
    if (startBtn) startBtn.hidden = true;
    document.documentElement.classList.remove("start-idle");
  }
}

function updateStartButtonVisibility() {
  syncMatchChrome();
}

/** Set partner-tile title while searching (no invite/Accept→Call coaching under Start). */
function setSearchingEmptyCopy() {
  const empty = $("remote-empty");
  const titleEl = empty?.querySelector(".empty-title");
  const subEl = empty?.querySelector(".empty-sub") || $("remote-empty-sub");
  const room = currentRoom();
  if (titleEl) {
    if (room && ROOMS_ENABLED) {
      titleEl.textContent =
        _t("remote.searchingRoom", { r: room }) ||
        `Waiting in room “${room}”…`;
    } else {
      titleEl.textContent =
        _t("remote.searchingTitle") || "Looking for a partner…";
    }
  }
  // Never show invite/Accept→Call lines on the empty Start card
  if (subEl) {
    subEl.hidden = true;
    subEl.setAttribute("hidden", "");
    subEl.textContent = "";
  }
  empty?.classList.remove("alone-invite-sub");
  document.documentElement.classList.remove("alone-searching");
  updateEmptyAloneActions();
  maybeScheduleAloneSearchCopy();
}

/** Auto-expand invite QR while alone-searching (dominant path). */
let aloneQrAutoTimer = 0;

/**
 * Tonight-live chip on empty card.
 * Disabled — quieter idle (just Start).
 */
function updateEmptyWindowChip() {
  const chip = $("empty-window-chip");
  if (chip) {
    chip.hidden = true;
    chip.setAttribute("hidden", "");
  }
}

/**
 * Alone / quiet-pool invite CTA under Start — permanently off (clean Start).
 * Friends invite remains in Friends sheet only.
 */
function updateEmptyAloneActions() {
  const row = $("empty-alone-actions");
  if (row) {
    row.hidden = true;
    row.setAttribute("hidden", "");
    row.setAttribute("aria-hidden", "true");
    row.classList.remove("is-dominant");
  }
  document.documentElement.classList.remove("alone-searching");
  if (aloneQrAutoTimer) {
    clearTimeout(aloneQrAutoTimer);
    aloneQrAutoTimer = 0;
  }
  try {
    updateEmptyWindowChip();
  } catch (_) {}
  try {
    updateEmptyIdleInvite();
  } catch (_) {}
}

let aloneSearchCopyTimer = 0;
function maybeScheduleAloneSearchCopy() {
  if (aloneSearchCopyTimer) return;
  if (matched || inFriendCall || trioBrowse) return;
  if (!inQueue && !wantSearch) return;
  aloneSearchCopyTimer = setTimeout(() => {
    aloneSearchCopyTimer = 0;
    if (matched || inFriendCall || trioBrowse) return;
    if (!inQueue && !wantSearch) return;
    setSearchingEmptyCopy();
    updateEmptyShareVisibility();
  }, 12_000);
}

/** Begin matchmaking from the big Start button (same path as Spin). */
function startMatchFromIdle() {
  // Ensure rules + media before searching
  if (!rulesAccepted()) {
    showRulesGate();
    return;
  }
  // Warm / refresh ICE (TURN credentials) before first PC is built
  try {
    if (typeof loadRtcConfig === "function") {
      loadRtcConfig(hubBase()).catch(() => {});
    }
  } catch (_) {}
  // First Start completes cold-start path
  let wasFirst = false;
  try {
    wasFirst = !firstSessionGuideDone();
    markFirstSessionGuideDone();
    updateFirstRunEmptyHint();
  } catch (_) {}
  aloneInviteToastShown = false;
  try {
    $("alone-invite-toast")?.remove?.();
    $("people-online-nudge")?.remove?.();
  } catch (_) {}
  trackEvent("start_match", { first: wasFirst ? 1 : 0 });
  maybeShowCellularDataTip();
  setStatus(
    _t("status.startingCam") ||
      "Starting camera… then looking for a partner"
  );
  startSession({ forceMedia: true });
  showStartButton(false);
  // Brand loop behind “Looking for a partner…” (user gesture from Start click)
  showPartnerEmptyWithBrand({ searching: true });
  setSearchingEmptyCopy();
  // Reuse Spin path
  $("btn-spin")?.click();
}

/**
 * Deep-link from Share room: live.html?room=code
 * Show invite copy; auto-start once after rules + socket (not a nag — purpose of the link).
 */
let pendingRoomInvite = false;
let roomInviteAutoStarted = false;

function applyRoomInviteCopy() {
  if (!pendingRoomInvite && !roomInviteAutoStarted) return;
  const room = currentRoom();
  if (!room) return;
  if (matched || inFriendCall || inQueue || wantSearch) return;
  const titleEl = $("remote-empty")?.querySelector(".empty-title");
  if (titleEl) {
    titleEl.textContent =
      _t("remote.roomInviteTitle", { r: room }) ||
      `Room “${room}” — tap Start to meet them`;
  }
}

function maybeAutoJoinRoomInvite() {
  if (!ROOMS_ENABLED) {
    pendingRoomInvite = false;
    return;
  }
  if (!pendingRoomInvite || roomInviteAutoStarted) return;
  if (qHasNoconnect()) {
    pendingRoomInvite = false;
    return;
  }
  if (!rulesAccepted()) {
    applyRoomInviteCopy();
    return;
  }
  if (!isWsOpen()) return;
  if (matched || inFriendCall || inQueue || wantSearch) {
    pendingRoomInvite = false;
    return;
  }
  const room = currentRoom();
  if (!room) {
    pendingRoomInvite = false;
    return;
  }
  roomInviteAutoStarted = true;
  pendingRoomInvite = false;
  trackEvent("room_invite_auto_join", { rlen: room.length });
  setStatus(
    _t("remote.roomInviteJoining", { r: room }) ||
      `Joining room “${room}”…`
  );
  startMatchFromIdle();
}

const CELLULAR_TIP_KEY = "ruletka-cellular-tip-v1";

function isOnCellular() {
  try {
    const c =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;
    if (!c) return false;
    if (c.type === "wifi" || c.type === "ethernet" || c.type === "bluetooth") {
      return false;
    }
    // Chromium on Android: type === "cellular" when on mobile data
    if (c.type === "cellular" || c.type === "wimax") return true;
    // Fallback: save-data often implies metered / cellular
    if (c.saveData && c.type !== "wifi") return true;
    return false;
  } catch (_) {
    return false;
  }
}

/**
 * One soft tip when starting search on mobile data (not a forced block).
 */
function maybeShowCellularDataTip() {
  try {
    if (!SOFT_POPUPS_ENABLED) return;
    if (!isLikelyMobile()) return;
    if (!isOnCellular()) return;
    try {
      if (localStorage.getItem(CELLULAR_TIP_KEY) === "1") return;
    } catch {
      return;
    }
    if ($("cellular-data-tip") || $("pwa-install-banner")) return;
    try {
      localStorage.setItem(CELLULAR_TIP_KEY, "1");
    } catch (_) {}
    const tip = document.createElement("div");
    tip.id = "cellular-data-tip";
    tip.className = "weak-conn-tip cellular-data-tip";
    tip.setAttribute("role", "status");
    tip.style.pointerEvents = "auto";
    tip.innerHTML = `
      <span>${escapeHtml(
        _t("conn.cellularTip") ||
          "You’re on mobile data — video uses your plan. Wi‑Fi is usually smoother and cheaper."
      )}</span>
      <button type="button" class="pill tight accent" id="btn-cellular-tip-ok">${escapeHtml(
        _t("pwa.iosGotIt") || "Got it"
      )}</button>`;
    document.body.appendChild(tip);
    const dismiss = () => {
      if (tip.parentNode) tip.remove();
    };
    $("btn-cellular-tip-ok")?.addEventListener("click", dismiss);
    setTimeout(dismiss, 10000);
    trackEvent("cellular_tip_show");
  } catch (_) {}
}

function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
    return true;
  }
  return false;
}

/** True if uid is on our mutual friends list (hub-synced). */
function isMutualFriend(userId) {
  const uid = (userId || "").trim();
  if (!uid) return false;
  return (friendsCache || []).some((f) => f && f.user_id === uid);
}

/**
 * True when we can invite a friend into the *current* 1v1 without hanging up.
 * (Not already 3+ people, not hunting party queue alone.)
 */
function canInviteJoinToCall() {
  if (trioBrowse && peerPcs.size >= 2) return false;
  if (peerPcs.size >= 2) return false;
  // Active friend 1v1 or stranger 1v1
  if (inFriendCall && matchMode === "friend") return true;
  if (matched && matchMode === "solo" && yourRole === "solo") return true;
  if (
    matched &&
    matchMode === "friend" &&
    peerPcs.size <= 1
  ) {
    return true;
  }
  return false;
}

/** Place a friend call (ring). Only mutual friends — never strangers.
 *  While already in a 1v1, defaults to join:true so we don't drop the other person.
 */
function placeFriendCall(userId, { closePanel = true, join = null } = {}) {
  const uid = (userId || "").trim();
  if (!uid) return false;
  if (!isMutualFriend(uid)) {
    clearCallTimeout();
    hideOutgoingCallToast();
    setStatus(
      _t("friends.callOnlyFriends") ||
        "Only friends can call — add them by code first"
    );
    log(_t("friends.callOnlyFriends") || "only friends can call");
    return false;
  }
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    clearCallTimeout();
    hideOutgoingCallToast();
    setStatus(_t("status.disconnected") || "disconnected — reconnecting…");
    log(_t("status.disconnected") || "not connected");
    try {
      if (typeof connect === "function") connect(true);
    } catch (_) {}
    return false;
  }
  const fr = (friendsCache || []).find((f) => f && f.user_id === uid);
  lastOutgoingCallPeer = {
    user_id: uid,
    name: friendDisplayName(fr) || fr?.name || "",
    friend_code: fr?.friend_code || "",
    short_id: fr?.short_id || "",
  };
  // Join current 1v1 as 3rd when already talking — never hang up the other person
  const wantJoin = join === null ? canInviteJoinToCall() : !!join;
  if (!wantJoin && matched && !inFriendCall) {
    // Classic private call: leave stranger match first
    try {
      send({ type: "stop" });
    } catch (_) {}
  }
  if (
    !send({
      type: "call_friend",
      user_id: uid,
      join: wantJoin,
    })
  ) {
    clearCallTimeout();
    hideOutgoingCallToast();
    lastOutgoingCallPeer = null;
    setStatus(_t("status.disconnected") || "disconnected — reconnecting…");
    log(_t("status.disconnected") || "not connected");
    return false;
  }
  const offlineHint =
    fr && !fr.online
      ? ` · ${_t("friends.mayBeOffline") || "may be offline"}`
      : "";
  const joinHint = wantJoin
    ? ` · ${_t("friends.invitingJoin") || "adding to this call (won't drop partner)"}`
    : "";
  setStatus((_t("status.calling") || "Calling…") + joinHint + offlineHint);
  showOutgoingCallToast(lastOutgoingCallPeer, { join: wantJoin });
  startCallTimeout();
  log((_t("status.calling") || "Calling…") + joinHint + offlineHint);
  trackEvent("friend_call_place", {
    offline: fr && !fr.online ? 1 : 0,
    join: wantJoin ? 1 : 0,
  });
  if (closePanel) closeFriends();
  return true;
}

function currentRoom() {
  if (!ROOMS_ENABLED) return "";
  return ($("room")?.value || $("room-settings")?.value || "").trim();
}

function syncRoomInputs(value) {
  if (!ROOMS_ENABLED) {
    if ($("room")) $("room").value = "";
    if ($("room-settings")) $("room-settings").value = "";
    updateRoomChip("");
    updatePoolHint();
    return;
  }
  const v = value == null ? currentRoom() : String(value);
  if ($("room") && $("room").value !== v) $("room").value = v;
  if ($("room-settings") && $("room-settings").value !== v) $("room-settings").value = v;
  updateRoomChip(v);
  updatePoolHint();
}

function spinPayload() {
  const room = currentRoom();
  return { type: "spin", room };
}

function nextPayload() {
  const room = currentRoom();
  return { type: "next", room };
}

/** Keep address bar shareable: ?room=code&lang=ru */
function syncRoomUrl() {
  try {
    const u = new URL(location.href);
    const room = currentRoom();
    if (room) u.searchParams.set("room", room);
    else u.searchParams.delete("room");
    const lang = NextfaceI18n?.getLang?.();
    if (lang && lang !== "en") u.searchParams.set("lang", lang);
    history.replaceState(null, "", u.pathname + u.search + u.hash);
  } catch (_) {}
}

/** Short private room code (no ambiguous 0/O/1/l). */
function generateRoomCode(len = 6) {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  let s = "";
  try {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) s += alphabet[arr[i] % alphabet.length];
  } catch (_) {
    for (let i = 0; i < len; i++)
      s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

/**
 * Share room must land a friend in the *same* lobby.
 * If the field is empty (public), mint a code and apply it before building the URL.
 */
function ensureShareableRoom() {
  if (!ROOMS_ENABLED) return "";
  let room = currentRoom();
  if (room) return room;
  room = generateRoomCode(6);
  syncRoomInputs(room);
  savePrefs({ room });
  syncRoomUrl();
  if (isWsOpen()) {
    send({ type: "set_room", room });
    // Already matchmaking in public → re-enter queue under the new private room
    if ((inQueue || wantSearch) && !matched && !inFriendCall) {
      try {
        send(spinPayload());
      } catch (_) {}
    }
  }
  setStatus(
    _t("room.minted", { r: room }) ||
      `Room “${room}” ready — share so a friend joins you`
  );
  trackEvent("room_mint", { len: room.length });
  return room;
}

/** @param {{ mintIfEmpty?: boolean }} [opts] */
function roomShareUrl(opts) {
  // When rooms are off, this is just the public live URL (no ?room=)
  if (ROOMS_ENABLED && opts && opts.mintIfEmpty) ensureShareableRoom();
  const u = new URL(location.origin + location.pathname);
  const room = currentRoom();
  if (room) u.searchParams.set("room", room);
  const lang = NextfaceI18n?.getLang?.();
  if (lang && lang !== "en") u.searchParams.set("lang", lang);
  return u.toString();
}

async function copyRoomLink() {
  if (!ROOMS_ENABLED) {
    // Fallback: share public site while rooms are hidden
    const url = location.origin + "/live.html";
    try {
      await shareOrCopy(url, siteBrandName(), "room.shared", "room.copied", {
        preferShare: true,
      });
    } catch (e) {
      log(_t("room.copyFail") + ": " + url);
    }
    return;
  }
  const url = roomShareUrl({ mintIfEmpty: true });
  try {
    await shareOrCopy(
      url,
      siteBrandName() + " room",
      "room.shared",
      "room.copied"
    );
  } catch (e) {
    log(_t("room.copyFail") + ": " + url);
  }
}

function matchSoundEnabled() {
  const prefs = loadPrefs();
  if (typeof prefs.matchSound === "boolean") return prefs.matchSound;
  return true;
}

/** Soft chime for inbound text chat (separate from match ring). Default on. */
function chatSoundEnabled() {
  const prefs = loadPrefs();
  if (typeof prefs.chatSound === "boolean") return prefs.chatSound;
  // Fall back to match sound preference if never set
  if (typeof prefs.matchSound === "boolean") return prefs.matchSound;
  return true;
}

/** Soft phone haptic when match/friend events fire (no-op if unsupported). */
function softHaptic(pattern) {
  try {
    if (typeof navigator === "undefined" || !navigator.vibrate) return;
    // Respect reduced-motion users
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    navigator.vibrate(pattern || 28);
  } catch (_) {}
}

/** Keep phone screen on during live video (Screen Wake Lock API). */
let screenWakeLock = null;
let lastPhaseName = "idle";

async function requestScreenWakeLock() {
  try {
    if (!navigator.wakeLock || typeof navigator.wakeLock.request !== "function") {
      return;
    }
    if (screenWakeLock) return;
    screenWakeLock = await navigator.wakeLock.request("screen");
    screenWakeLock.addEventListener("release", () => {
      screenWakeLock = null;
    });
  } catch (_) {
    screenWakeLock = null;
  }
}

function releaseScreenWakeLock() {
  try {
    if (screenWakeLock) {
      const w = screenWakeLock;
      screenWakeLock = null;
      w.release().catch(() => {});
    }
  } catch (_) {
    screenWakeLock = null;
  }
}

function syncScreenWakeLock() {
  const need =
    !!matched ||
    !!inFriendCall ||
    lastPhaseName === "matched" ||
    lastPhaseName === "friend_call";
  if (need && document.visibilityState === "visible") {
    requestScreenWakeLock();
  } else if (!need) {
    releaseScreenWakeLock();
  }
}

/** Short dual-tone chime (no asset files). */
function playMatchChime() {
  softHaptic([18, 40, 28]);
  if (!matchSoundEnabled()) return;
  playToneSequence(
    [
      { f: 660, t: 0, d: 0.09, type: "sine", gain: 0.12 },
      { f: 880, t: 0.08, d: 0.12, type: "sine", gain: 0.12 },
    ]
  );
}

/**
 * Soft single blip for inbound chat (quieter than match chime).
 * Rate-limited so spam doesn't hammer the speaker.
 * Rules:
 *  - Respect chatSound pref
 *  - Mute during active debate (timer/turn audio already busy)
 *  - When tab is hidden: always chime (if enabled) so background pings land
 *  - When visible: skip if compose already focused (user is typing)
 */
let lastChatChimeAt = 0;
function playChatMessageChime() {
  if (!chatSoundEnabled()) return;
  try {
    if (debate && debate.active) return;
  } catch (_) {}
  const hidden =
    typeof document !== "undefined" && document.visibilityState === "hidden";
  if (!hidden) {
    try {
      const active = document.activeElement;
      if (
        active &&
        (active.id === "msg" ||
          active.id === "chat-compose-input" ||
          active.classList?.contains("tile-compose-input") ||
          (active.tagName === "INPUT" &&
            active.closest?.("#compose, .tile-compose, .chat-compose")))
      ) {
        return;
      }
    } catch (_) {}
  }
  const now = Date.now();
  // Slightly longer gap when tab visible; snappier when backgrounded
  const minGap = hidden ? 350 : 450;
  if (now - lastChatChimeAt < minGap) return;
  lastChatChimeAt = now;
  softHaptic(hidden ? 18 : 12);
  const gainBoost = hidden ? 1.35 : 1;
  playToneSequence([
    { f: 920, t: 0, d: 0.055, type: "sine", gain: 0.055 * gainBoost },
    { f: 1240, t: 0.04, d: 0.07, type: "sine", gain: 0.04 * gainBoost },
  ]);
}

/**
 * @param {{ f: number, t: number, d: number, type?: string, gain?: number }[]} tones
 */
function playToneSequence(tones) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!chimeCtx || chimeCtx.state === "closed") chimeCtx = new AC();
    const ctx = chimeCtx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    for (const { f, t, d, type, gain } of tones || []) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || "sine";
      o.frequency.value = f;
      const peak = Math.max(0.01, Number(gain) || 0.1);
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(peak, now + t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + d);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + t);
      o.stop(now + t + d + 0.02);
    }
  } catch (_) {}
}

/** Incoming friend-call ring (repeats until answered/declined). */
let ringTimer = 0;
let titleFlashTimer = 0;
let titleFlashBase = "";
/** @type {Notification | null} */
let activeCallNotification = null;

function playRingBurst() {
  if (!matchSoundEnabled()) return;
  playToneSequence([
    { f: 520, t: 0, d: 0.14, type: "triangle", gain: 0.14 },
    { f: 780, t: 0.16, d: 0.16, type: "triangle", gain: 0.14 },
    { f: 520, t: 0.36, d: 0.14, type: "triangle", gain: 0.14 },
  ]);
}

function startIncomingRing(name) {
  stopIncomingRing();
  playRingBurst();
  tryVibrateRing();
  ringTimer = setInterval(() => {
    if (!incomingCallFrom) {
      stopIncomingRing();
      return;
    }
    playRingBurst();
    tryVibrateRing();
    // Re-assert OS notification while tab stays in background
    if (document.visibilityState !== "visible") {
      tryShowCallNotification(name, { renotify: true });
    }
  }, 2200);
  // Flash document title when tab is in background
  titleFlashBase = document.title;
  let flip = false;
  titleFlashTimer = setInterval(() => {
    if (!incomingCallFrom) {
      stopIncomingRing();
      return;
    }
    flip = !flip;
    document.title = flip
      ? `📞 ${name || "Call"} — ruletka.vip`
      : titleFlashBase || "ruletka.vip";
  }, 900);
  // System notification if page is hidden (or not focused)
  tryShowCallNotification(name, { renotify: false });
  // If user returns to tab mid-ring, focus Answer
  try {
    document.addEventListener("visibilitychange", onRingVisibility, {
      passive: true,
    });
  } catch (_) {}
}

function onRingVisibility() {
  if (!incomingCallFrom) return;
  if (document.visibilityState === "visible") {
    try {
      $("btn-accept-call")?.focus?.();
    } catch (_) {}
  }
}

function tryVibrateRing() {
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate([120, 80, 120, 80, 200]);
    }
  } catch (_) {}
}

function stopIncomingRing() {
  if (ringTimer) {
    clearInterval(ringTimer);
    ringTimer = 0;
  }
  if (titleFlashTimer) {
    clearInterval(titleFlashTimer);
    titleFlashTimer = 0;
  }
  if (titleFlashBase) {
    document.title = titleFlashBase;
    titleFlashBase = "";
  }
  if (activeCallNotification) {
    try {
      activeCallNotification.close();
    } catch (_) {}
    activeCallNotification = null;
  }
  try {
    document.removeEventListener("visibilitychange", onRingVisibility);
  } catch (_) {}
  try {
    if (typeof navigator.vibrate === "function") navigator.vibrate(0);
  } catch (_) {}
}

/**
 * OS notification for incoming friend call (background / other tab).
 * @param {string} name
 * @param {{ renotify?: boolean }} [opts]
 */
function tryShowCallNotification(name, opts = {}) {
  if (typeof Notification === "undefined") return;
  // Visible + focused: in-page toast is enough
  if (
    document.visibilityState === "visible" &&
    (typeof document.hasFocus !== "function" || document.hasFocus())
  ) {
    return;
  }
  const show = () => {
    try {
      // Close previous same-tag so renotify works on some browsers
      if (activeCallNotification) {
        try {
          activeCallNotification.close();
        } catch (_) {}
        activeCallNotification = null;
      }
      activeCallNotification = new Notification(
        _t("friends.incomingNotifTitle") || "Incoming call",
        {
          body:
            _t("friends.incomingNotifBody", { n: name || "Friend" }) ||
            `${name || "Friend"} is calling — tap to answer`,
          tag: "ruletka-friend-call",
          renotify: opts.renotify !== false,
          requireInteraction: true,
          silent: false,
        }
      );
      activeCallNotification.onclick = () => {
        try {
          window.focus();
        } catch (_) {}
        try {
          activeCallNotification?.close();
        } catch (_) {}
        // Jump to answer control
        try {
          $("btn-accept-call")?.focus?.();
          $("call-toast")?.scrollIntoView?.({ block: "nearest" });
        } catch (_) {}
        trackEvent("call_notif_click");
      };
      trackEvent("call_notif_show", {
        renotify: opts.renotify ? 1 : 0,
      });
    } catch (_) {}
  };
  if (Notification.permission === "granted") {
    show();
  } else if (
    Notification.permission === "default" &&
    friendCallAlertsEnabled()
  ) {
    // User already opted in (Accept prompt) but OS dialog not finished
    Notification.requestPermission().then((p) => {
      trackEvent("notif_permission", { p: String(p || ""), src: "call_ring" });
      if (
        p === "granted" &&
        incomingCallFrom &&
        document.visibilityState !== "visible"
      ) {
        show();
      }
    });
  }
}

/**
 * Alerts for friend online + incoming calls (same pref — one opt-in).
 * Only after explicit user action (Friends toggle or post-Accept toast).
 */
function friendOnlineNotifEnabled() {
  try {
    return loadPrefs().friendOnlineNotif === true;
  } catch {
    return false;
  }
}

/** Alias: call + online share the same opt-in. */
function friendCallAlertsEnabled() {
  return friendOnlineNotifEnabled();
}

function syncFriendOnlineNotifUi() {
  const chk = $("chk-friend-online-notif");
  if (!chk) return;
  chk.checked = friendOnlineNotifEnabled();
}

/** Called when Friends opens — never prompts unless already opted in. */
function ensureNotifPermissionSoft() {
  if (!friendOnlineNotifEnabled()) return;
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "default") return;
  try {
    Notification.requestPermission().then((p) => {
      trackEvent("notif_permission", { p: String(p || ""), src: "soft" });
    });
  } catch (_) {}
}

async function setFriendOnlineNotif(on) {
  savePrefs({ friendOnlineNotif: !!on });
  syncFriendOnlineNotifUi();
  trackEvent("friend_online_notif_pref", { on: on ? 1 : 0 });
  if (!on) {
    setStatus(
      _t("friends.notifOffline") || "Call & online alerts off"
    );
    return;
  }
  if (typeof Notification === "undefined") {
    setStatus(
      _t("friends.notifUnsupported") || "Notifications not supported here"
    );
    savePrefs({ friendOnlineNotif: false });
    syncFriendOnlineNotifUi();
    return;
  }
  if (Notification.permission === "granted") {
    setStatus(
      _t("friends.notifOnCalls") ||
        "Alerts on — calls & friends online when this tab is in the background"
    );
    return;
  }
  if (Notification.permission === "denied") {
    setStatus(
      _t("friends.notifDenied") ||
        "Notifications blocked — enable them in browser settings"
    );
    savePrefs({ friendOnlineNotif: false });
    syncFriendOnlineNotifUi();
    return;
  }
  try {
    const p = await Notification.requestPermission();
    trackEvent("notif_permission", { p: String(p || ""), src: "opt_in" });
    if (p === "granted") {
      setStatus(
        _t("friends.notifOnCalls") ||
          "Alerts on — calls & friends online when this tab is in the background"
      );
    } else {
      savePrefs({ friendOnlineNotif: false });
      syncFriendOnlineNotifUi();
      setStatus(
        _t("friends.notifDenied") || "Notifications not allowed"
      );
    }
  } catch (_) {
    savePrefs({ friendOnlineNotif: false });
    syncFriendOnlineNotifUi();
  }
}

/** One-shot: after first mutual Accept, offer call alerts (not a cold nag). */
const NOTIF_OPTIN_KEY = "ruletka-notif-optin-prompt-v1";

function notifOptInPromptDone() {
  try {
    return localStorage.getItem(NOTIF_OPTIN_KEY) === "1";
  } catch {
    return true;
  }
}

function markNotifOptInPromptDone() {
  try {
    localStorage.setItem(NOTIF_OPTIN_KEY, "1");
  } catch (_) {}
}

/**
 * Soft toast after first friend Accept — Enable alerts for missed calls.
 * Skipped if already opted in, denied, or unsupported.
 */
function maybeShowNotifOptInAfterAccept() {
  try {
    if (notifOptInPromptDone()) return;
    if (friendOnlineNotifEnabled()) {
      markNotifOptInPromptDone();
      return;
    }
    if (typeof Notification === "undefined") {
      markNotifOptInPromptDone();
      return;
    }
    if (Notification.permission === "denied") {
      markNotifOptInPromptDone();
      return;
    }
    if (matched || inFriendCall || trioBrowse) return;
    if ($("notif-optin-toast") || $("call-toast")) return;
    // Defer so Accept toast can show first; then offer alerts
    setTimeout(() => {
      try {
        if (notifOptInPromptDone() || friendOnlineNotifEnabled()) return;
        if ($("call-toast") || matched || inFriendCall) return;
        // Remove accepted toast if still open — single focused CTA
        try {
          $("friend-accepted-toast")?.remove?.();
        } catch (_) {}
        markNotifOptInPromptDone();
        const toast = document.createElement("div");
        toast.id = "notif-optin-toast";
        toast.className =
          "friend-soft-toast post-match-friend-nudge is-force is-notif-optin";
        toast.setAttribute("role", "dialog");
        toast.style.pointerEvents = "auto";
        toast.innerHTML = `
          <strong>${escapeHtml(
            _t("friends.notifOptInTitle") || "Don’t miss the next Call"
          )}</strong>
          <span>${escapeHtml(
            _t("friends.notifOptInBody") ||
              "Turn on alerts so you hear friend calls when this tab is in the background."
          )}</span>
          <div class="export-nudge-actions post-match-actions" style="margin-top:0.5rem">
            <button type="button" class="pill tight accent post-match-primary" id="btn-notif-optin-yes">${escapeHtml(
              _t("friends.notifOptInYes") || "Enable alerts"
            )}</button>
            <button type="button" class="pill tight ghost" id="btn-notif-optin-no">${escapeHtml(
              _t("friends.notifOptInNo") || "Not now"
            )}</button>
          </div>`;
        document.body.appendChild(toast);
        trackEvent("notif_optin_show");
        const dismiss = () => {
          if (toast.parentNode) toast.remove();
        };
        $("btn-notif-optin-no")?.addEventListener("click", () => {
          trackEvent("notif_optin_dismiss");
          dismiss();
        });
        $("btn-notif-optin-yes")?.addEventListener("click", async () => {
          trackEvent("notif_optin_accept");
          dismiss();
          await setFriendOnlineNotif(true);
        });
        setTimeout(dismiss, 24000);
      } catch (_) {}
    }, 4200);
  } catch (_) {}
}

function flashPartnerTile() {
  const tile = $("tile-remote");
  if (!tile) return;
  tile.classList.remove("match-flash");
  // reflow to restart animation
  void tile.offsetWidth;
  tile.classList.add("match-flash");
  setTimeout(() => tile.classList.remove("match-flash"), 1100);
}

/**
 * Match landed / connected.
 * Strangers → status only. Friend call → small top-right toast under stars.
 */
function showMatchFoundToast(opts = {}) {
  const friend = matchMode === "friend" || inFriendCall;
  let title;
  let body = "";
  const tierBit = (() => {
    try {
      if (friend) return "";
      const t = Math.max(0, Number(partnerStars) || 0);
      const label = trustTierLabel(t);
      return label
        ? _t("match.partnerTier", { tier: label, n: t }) ||
            (t > 0 ? `${label} · trust ${t}` : label)
        : "";
    } catch (_) {
      return "";
    }
  })();
  if (opts.connected) {
    title =
      _t("match.connectedTitle") ||
      (friend ? "Friend call connected" : "Connected");
    const path = ($("ice-path")?.textContent || "").trim();
    body =
      [path, tierBit].filter(Boolean).join(" · ") ||
      _t("match.connectedBody") ||
      (friend ? "Private call · P2P video" : "Video is peer-to-peer");
  } else {
    title =
      _t("match.foundTitle") || (friend ? "Friend connected" : "Partner found");
    body =
      tierBit ||
      _t("match.foundBody") ||
      (friend ? "Connecting video…" : "Connecting video…");
  }
  setStatus(body ? `${title} · ${body}` : title);
  // Friend connect only — corner toast under ★ (not the old bottom popup)
  if (!friend) return;
  try {
    const id = "friend-connect-toast";
    $(id)?.remove?.();
    const toast = document.createElement("div");
    toast.id = id;
    toast.className = "corner-toast friend-connect-toast";
    toast.setAttribute("role", "status");
    toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(
      body
    )}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, opts.connected ? 3200 : 2600);
  } catch (_) {}
}

function setArchPill(mode) {
  const el = $("arch-pill");
  if (!el) return;
  el.classList.remove("p2p-live", "path-relay", "path-direct");
  if (mode === "p2p") {
    el.textContent = _t("arch.p2p");
    el.classList.add("p2p-live");
  } else if (mode === "freenet") {
    el.textContent = _t("arch.freenet");
  } else if (mode === "relay") {
    el.textContent = _t("arch.relay");
    el.classList.add("path-relay");
  } else if (mode === "direct") {
    el.textContent = _t("arch.direct");
    el.classList.add("p2p-live", "path-direct");
  } else {
    el.textContent = _t("arch.default");
  }
}

function setFedChip(on) {
  const el = $("fed-chip");
  if (!el) return;
  el.hidden = !on;
  if (on) {
    el.title = _t("arch.fedTitle");
    const span = el.querySelector("[data-i18n]") || el;
    if (span) span.textContent = _t("arch.fed");
  }
}

const PATH_STATS_KEY = "ruletka-ice-path-stats-v1";

function loadPathStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(PATH_STATS_KEY) || "{}");
    return {
      direct: Number(raw.direct) || 0,
      relay: Number(raw.relay) || 0,
      unknown: Number(raw.unknown) || 0,
    };
  } catch {
    return { direct: 0, relay: 0, unknown: 0 };
  }
}

function savePathStats(s) {
  try {
    localStorage.setItem(PATH_STATS_KEY, JSON.stringify(s));
  } catch (_) {}
}

/** Record settled path once per match (avoid double-count on stats poll). */
let pathStatRecordedForMatch = false;

function recordIcePathStat(kind) {
  if (!matched && !inFriendCall) return;
  if (pathStatRecordedForMatch) return;
  if (kind !== "direct" && kind !== "relay") return;
  pathStatRecordedForMatch = true;
  const s = loadPathStats();
  s[kind] = (s[kind] || 0) + 1;
  savePathStats(s);
  refreshPathStatsUi();
  trackEvent("ice_path", { kind });
  // One soft status line when path settles (not a nag sheet)
  if (kind === "direct") {
    // Path quality stays in Settings / ice chip — not the header
    log(_t("conn.pathDirectOk") || "Direct P2P — best path");
  } else if (kind === "relay") {
    const prefer =
      typeof preferDirectOnlyEnabled === "function" && preferDirectOnlyEnabled();
    setStatus(
      prefer
        ? _t("conn.pathRelayPreferDirect") ||
            "Relay path — Prefer Direct is on but network needs TURN"
        : _t("conn.pathRelayOk") || "Relay (TURN) — higher latency is normal"
    );
  }
  maybeShowPathStatsTip();
}

const PATH_TIP_KEY = "ruletka-path-stats-tip-v1";

function pathStatsTipDone() {
  try {
    return localStorage.getItem(PATH_TIP_KEY) === "1";
  } catch {
    return true;
  }
}

function markPathStatsTipDone() {
  try {
    localStorage.setItem(PATH_TIP_KEY, "1");
  } catch (_) {}
}

/**
 * After several settled calls: if Prefer Direct is on but most paths are relay,
 * soft one-shot tip to turn it off (TURN helps hard NATs).
 */
function maybeShowPathStatsTip() {
  try {
    if (!SOFT_POPUPS_ENABLED) {
      try {
        markPathStatsTipDone?.();
      } catch (_) {}
      return;
    }
    if (pathStatsTipDone()) return;
    if ($("path-stats-tip") || $("weak-conn-tip") || $("prefer-direct-auto-toast"))
      return;
    const prefer =
      typeof preferDirectOnlyEnabled === "function" && preferDirectOnlyEnabled();
    if (!prefer) return;
    const s = loadPathStats();
    const total = (s.direct || 0) + (s.relay || 0);
    if (total < 4) return;
    const relayShare = (s.relay || 0) / total;
    if (relayShare < 0.5) return;
    markPathStatsTipDone();
    const tip = document.createElement("div");
    tip.id = "path-stats-tip";
    tip.className = "weak-conn-tip path-stats-tip";
    tip.setAttribute("role", "status");
    tip.style.pointerEvents = "auto";
    tip.innerHTML = `
      <span>${escapeHtml(
        _t("conn.pathStatsTip") ||
          "Many of your calls use TURN relay while Prefer Direct is on. Turning Prefer Direct off can connect more reliably on mobile networks."
      )}</span>
      <button type="button" class="pill tight ghost" id="btn-path-tip-later">${escapeHtml(
        _t("friends.exportNudgeLater") || "Later"
      )}</button>
      <button type="button" class="pill tight accent" id="btn-path-tip-off">${escapeHtml(
        _t("conn.pathStatsTipOff") || "Turn Prefer Direct off"
      )}</button>`;
    document.body.appendChild(tip);
    const dismiss = () => {
      if (tip.parentNode) tip.remove();
    };
    $("btn-path-tip-later")?.addEventListener("click", () => {
      trackEvent("path_stats_tip_later");
      dismiss();
    });
    $("btn-path-tip-off")?.addEventListener("click", () => {
      trackEvent("path_stats_tip_off");
      preferDirectAutoOffDone = false;
      setPreferDirectOnly(false, { silent: false });
      dismiss();
    });
    setTimeout(dismiss, 14000);
    trackEvent("path_stats_tip_show", {
      relay: s.relay || 0,
      direct: s.direct || 0,
    });
  } catch (_) {}
}

function pathDirectPercent() {
  const s = loadPathStats();
  const total = (s.direct || 0) + (s.relay || 0);
  if (!total) return null;
  return Math.round((100 * s.direct) / total);
}

function refreshPathStatsUi() {
  const el = $("conn-detail-direct-rate");
  if (!el) return;
  const s = loadPathStats();
  const total = (s.direct || 0) + (s.relay || 0);
  if (!total) {
    el.textContent = _t("settings.connDirectNone") || "No settled calls yet";
    return;
  }
  const pct = Math.round((100 * s.direct) / total);
  const labeled =
    _t("settings.connDirectRate", {
      pct,
      d: s.direct,
      total,
    }) || `${pct}% Direct (${s.direct} of ${total})`;
  el.textContent =
    labeled + (s.relay ? ` · ${s.relay} relay` : "");
}

function setIcePathBadge(kind) {
  const el = $("ice-path");
  if (!el) return;
  el.hidden = false;
  el.classList.remove("path-direct", "path-relay", "path-unknown", "path-weak");
  // Hide generic arch-pill while live path badge is shown (avoids dual "Direct P2P")
  const arch = $("arch-pill");
  if (arch) arch.hidden = true;
  // Path badge replaces compact "In a call" chip
  const liveChip = $("live-compact-chip");
  if (liveChip) liveChip.hidden = true;
  if (kind === "direct") {
    el.textContent = _t("sec.pathDirect") || "Direct P2P";
    el.classList.add("path-direct");
    el.title = _t("sec.pathDirectTitle") || "Media path is peer-to-peer (best quality)";
    recordIcePathStat("direct");
  } else if (kind === "relay") {
    const hideIp =
      (typeof hideIpRelayOnlyEnabled === "function" && hideIpRelayOnlyEnabled()) ||
      !!loadPrefs().hideIpRelayOnly;
    el.textContent = hideIp
      ? _t("sec.pathRelayPrivate") || "Relay (private)"
      : _t("sec.pathRelay") || "Relay (TURN)";
    el.classList.add("path-relay");
    el.title = hideIp
      ? _t("sec.pathRelayPrivateTitle") ||
        "Media via TURN only — partner does not see your IP (higher latency is normal)"
      : _t("sec.pathRelayTitle") ||
        "Media via TURN relay — often higher latency; try better network if video freezes";
    recordIcePathStat("relay");
  } else {
    el.textContent = _t("sec.pathUnknown") || "Connecting…";
    el.classList.add("path-unknown");
    el.title = _t("sec.pathUnknownTitle") || "Media path not ready yet";
  }
  updateQualityStrip();
}

/** Optional quality hint from adaptive WebRTC tier (high/mid/low/min). */
let lastQualityTier = "";
function setQualityTierHint(tier) {
  lastQualityTier = String(tier || "");
  updateQualityStrip();
}

function updateQualityStrip() {
  const el = $("ice-path");
  if (!el || el.hidden) return;
  el.classList.remove("path-weak");
  // Strip any previous quality suffix
  let base = el.textContent.replace(/\s*·\s*(weak link|слабая связь).*$/i, "").trim();
  // Recover path label if empty
  if (!base) {
    if (el.classList.contains("path-direct")) base = _t("sec.pathDirect") || "Direct P2P";
    else if (el.classList.contains("path-relay")) base = _t("sec.pathRelay") || "Relay (TURN)";
    else base = _t("sec.pathUnknown") || "Connecting…";
  }
  if (lastQualityTier === "low" || lastQualityTier === "min") {
    el.classList.add("path-weak");
    el.textContent = base + " · " + (_t("sec.qualityWeak") || "weak link");
    const tip =
      _t("sec.qualityWeakTitle") ||
      "High loss or latency; video may auto-lower quality";
    // Keep path title + tip without stacking forever
    const pathTip =
      el.classList.contains("path-relay")
        ? _t("sec.pathRelayTitle") || ""
        : el.classList.contains("path-direct")
          ? _t("sec.pathDirectTitle") || ""
          : "";
    el.title = [pathTip, tip].filter(Boolean).join(" — ");
  } else {
    el.textContent = base;
  }
}

function clearIcePathBadge() {
  const el = $("ice-path");
  lastQualityTier = "";
  if (el) {
    el.hidden = true;
    el.textContent = "";
    el.classList.remove("path-direct", "path-relay", "path-unknown", "path-weak");
  }
  // Restore generic arch pill when path-specific badge is gone
  const arch = $("arch-pill");
  if (arch) arch.hidden = false;
}

/** i18n helper: never leave raw keys like "sec.mediaP2pShort" in the UI */
function tt(key, fallback) {
  const s = _t(key);
  if (s && s !== key && !String(s).startsWith("sec.") && !String(s).startsWith("settings.")) {
    return s;
  }
  if (fallback) {
    const f = _t(fallback);
    if (f && f !== fallback) return f;
    if (typeof fallback === "string" && !fallback.includes(".")) return fallback;
  }
  return typeof fallback === "string" && !fallback.includes(".")
    ? fallback
    : s || key;
}

function turnTrustLabel(meta) {
  const trust = meta?.security?.turn_trust || "";
  if (trust === "open_relay_demo") return tt("sec.turnOpenShort", "Demo TURN");
  if (trust === "self_hosted_ephemeral")
    return tt("sec.turnEphemeralShort", "Self-hosted TURN");
  if (trust === "self_hosted_static")
    return tt("sec.turnStaticShort", "Self-hosted TURN");
  if (trust === "no_turn") return tt("sec.turnNoneShort", "No TURN");
  if (meta?.has_turn) return tt("sec.turnOnShort", "TURN on");
  return tt("sec.turnNoneShort", "No TURN");
}

function turnTrustHint(meta) {
  const trust = meta?.security?.turn_trust || "";
  if (trust === "open_relay_demo")
    return (
      _t("settings.connTurnDemoHint") ||
      "Public demo relay — fine for testing, not for privacy-sensitive use."
    );
  if (trust === "self_hosted_ephemeral" || trust === "self_hosted_static")
    return (
      _t("settings.connTurnSelfHint") ||
      "Relay is hosted by this hub with short-lived credentials when possible."
    );
  if (meta?.has_turn)
    return _t("settings.connTurnOnHint") || "TURN is available if direct P2P fails.";
  return (
    _t("settings.connTurnNoneHint") ||
    "No TURN configured — some networks may fail to connect."
  );
}

/** Live refresh while Connection settings is open during a call. */
let connDetailsTimer = 0;

function stopConnDetailsLive() {
  if (connDetailsTimer) {
    clearInterval(connDetailsTimer);
    connDetailsTimer = 0;
  }
}

function maybeStartConnDetailsLive() {
  stopConnDetailsLive();
  const view = $("settings-view-connection");
  const open =
    settingsIsOpen() &&
    view &&
    !view.hidden &&
    view.classList.contains("is-active");
  if (!open) return;
  // Always refresh once; poll only while in a live call so path/quality stay current
  refreshConnectionDetails();
  if (!matched) return;
  connDetailsTimer = setInterval(() => {
    if (!settingsIsOpen() || !matched) {
      stopConnDetailsLive();
      return;
    }
    const v = $("settings-view-connection");
    if (!v || v.hidden) {
      stopConnDetailsLive();
      return;
    }
    refreshConnectionDetails();
  }, 1500);
}

function refreshConnectionDetails() {
  const meta =
    (typeof getIceMeta === "function" && getIceMeta()) || window.__iceMeta || null;
  const pathEl = $("conn-detail-path");
  const pathHint = $("conn-detail-path-hint");
  const turnEl = $("conn-detail-turn");
  const turnHint = $("conn-detail-turn-hint");
  const qualEl = $("conn-detail-quality");
  const resEl = $("conn-detail-resolution");
  const hubEl = $("conn-detail-hub");
  const idEl = $("conn-detail-identity");
  const safetyEl = $("conn-detail-safety");

  if (pathEl) {
    if (matched) {
      const live = $("ice-path")?.textContent;
      pathEl.textContent = live || tt("sec.pathUnknownShort", "Connecting…");
    } else {
      pathEl.textContent = tt("sec.mediaP2pShort", "P2P media · idle");
    }
  }
  if (pathHint) {
    const ice = $("ice-path");
    if (ice?.classList.contains("path-relay")) {
      pathHint.textContent =
        _t("sec.pathRelayTitle") ||
        "Media via TURN — often higher latency on hard networks.";
    } else if (ice?.classList.contains("path-direct")) {
      pathHint.textContent =
        _t("sec.pathDirectTitle") || "Peer-to-peer path (usually best quality).";
    } else if (matched) {
      pathHint.textContent =
        _t("sec.pathUnknownTitle") || "Negotiating media path…";
    } else {
      pathHint.textContent =
        _t("settings.connPathIdleHint") ||
        "Path appears when you are in a live call.";
    }
  }
  if (turnEl) turnEl.textContent = turnTrustLabel(meta);
  if (turnHint) turnHint.textContent = turnTrustHint(meta);
  if (qualEl) {
    if (!matched) qualEl.textContent = tt("settings.connQualityIdle", "—");
    else if (lastQualityTier)
      qualEl.textContent = String(lastQualityTier).toUpperCase();
    else qualEl.textContent = tt("settings.connQualityAuto", "Auto");
  }
  if (resEl) resEl.textContent = videoResLabel(getVideoResolutionPref());
  if (hubEl) {
    try {
      hubEl.textContent =
        (typeof RuletHub !== "undefined" && RuletHub.base && RuletHub.base()) ||
        location.origin;
    } catch (_) {
      hubEl.textContent = location.origin;
    }
  }
  if (idEl) {
    const idn = loadIdentity();
    const cryptoOn = !!idn.cryptoBound || String(idn.user_id || "").startsWith("k");
    idEl.textContent = cryptoOn
      ? tt("sec.idCrypto", "Device key")
      : tt("sec.idLegacy", "Browser id");
  }
  if (safetyEl) {
    safetyEl.textContent = tt(
      "sec.partnerRecordShort",
      "Partner can record — use Block / Report"
    );
  }
  refreshPathStatsUi();
  const directPref = $("conn-detail-direct-pref");
  if (directPref) {
    directPref.textContent = loadPrefs().preferDirectOnly
      ? _t("settings.preferDirectOn") || "On — STUN only (harder NATs may fail)"
      : _t("settings.preferDirectOff") || "Off — TURN available when needed";
  }
  const hideIpEl = $("conn-detail-hide-ip");
  if (hideIpEl) {
    const on = !!loadPrefs().hideIpRelayOnly;
    const hasTurn =
      !!(window.__hasTurn || window.__iceMeta?.has_turn) ||
      !!(typeof getIceMeta === "function" && getIceMeta()?.has_turn);
    if (on && hasTurn) {
      hideIpEl.textContent =
        _t("settings.hideIpOn") || "On — TURN only (IP hidden from partner)";
    } else if (on && !hasTurn) {
      hideIpEl.textContent =
        _t("settings.hideIpNeedTurn") || "On but TURN missing on hub";
    } else {
      hideIpEl.textContent =
        _t("settings.hideIpOff") || "Off — direct P2P allowed";
    }
  }
}

function refreshSecurityPanel() {
  const meta =
    (typeof getIceMeta === "function" && getIceMeta()) || window.__iceMeta || null;
  const pathEl = $("sec-media-path");
  const turnEl = $("sec-turn-trust");
  const idEl = $("sec-identity");
  const noteEl = $("sec-partner-note");
  // Prefer short labels in the settings sheet (long strings truncate / wrap badly)
  if (pathEl) {
    if (matched) {
      const live = $("ice-path")?.textContent;
      pathEl.textContent =
        live || tt("sec.pathUnknownShort", "Connecting…");
    } else {
      pathEl.textContent = tt("sec.mediaP2pShort", "P2P media");
    }
  }
  if (turnEl) turnEl.textContent = turnTrustLabel(meta);
  if (idEl) {
    const idn = loadIdentity();
    const cryptoOn = !!idn.cryptoBound || String(idn.user_id || "").startsWith("k");
    idEl.textContent = cryptoOn
      ? tt("sec.idCrypto", "Device key")
      : tt("sec.idLegacy", "Browser id");
  }
  if (noteEl)
    noteEl.textContent = tt(
      "sec.partnerRecordShort",
      "Partner can record — use Block / Report"
    );
  refreshConnectionDetails();
}

function selectedDevices() {
  const cam = $("sel-camera")?.value || "";
  const mic = $("sel-mic")?.value || "";
  const spk = $("sel-speaker")?.value || "";
  // Empty / "no-*" placeholders only — "default" is a valid Chrome deviceId
  const ok = (v) => (v && String(v).trim() && !String(v).startsWith("no-") ? v : null);
  return {
    videoDeviceId: ok(cam),
    audioDeviceId: ok(mic),
    speakerDeviceId: ok(spk),
  };
}

/** Dedupe by deviceId (browsers sometimes list virtual/default twice). */
function uniqueDevices(list) {
  const seen = new Set();
  const out = [];
  for (const d of list || []) {
    const id = d?.deviceId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(d);
  }
  return out;
}

/** Last enumerateDevices snapshot — restore prefs even before <select> is filled. */
let lastDeviceEnum = {
  videoinput: [],
  audioinput: [],
  audiooutput: [],
  at: 0,
};

function rememberDeviceEnum(cameras, mics, speakers) {
  lastDeviceEnum = {
    videoinput: uniqueDevices(cameras || []),
    audioinput: uniqueDevices(mics || []),
    audiooutput: uniqueDevices(speakers || []),
    at: Date.now(),
  };
}

function normalizeDeviceLabel(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/^(default|communications)\s*[-–—:]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Loose match for “same camera as last time” when browser rotates deviceIds. */
function deviceLabelsMatch(a, b) {
  const x = normalizeDeviceLabel(a);
  const y = normalizeDeviceLabel(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x))) {
    return true;
  }
  return false;
}

/**
 * Resolve saved deviceId for a kind using live enum + label fallback.
 * @param {"videoinput"|"audioinput"|"audiooutput"} kind
 * @param {string} idKey prefs key (cameraId / micId / speakerId)
 * @param {string} labelKey prefs key (cameraLabel / micLabel / speakerLabel)
 * @returns {string|null}
 */
function resolveSavedDeviceId(kind, idKey, labelKey) {
  const prefs = loadPrefs();
  const wantId = prefs[idKey] ? String(prefs[idKey]) : "";
  const wantLabel = prefs[labelKey] ? String(prefs[labelKey]) : "";
  let list =
    kind === "videoinput"
      ? lastDeviceEnum.videoinput
      : kind === "audioinput"
        ? lastDeviceEnum.audioinput
        : lastDeviceEnum.audiooutput;
  // Fallback: options already in the matching select
  if (!list?.length) {
    const selId =
      kind === "videoinput"
        ? "sel-camera"
        : kind === "audioinput"
          ? "sel-mic"
          : "sel-speaker";
    const sel = $(selId);
    if (sel?.options?.length) {
      list = [...sel.options]
        .filter((o) => o.value && !String(o.value).startsWith("no-"))
        .map((o) => ({ deviceId: o.value, label: o.textContent || "" }));
    }
  }
  if (!list?.length) {
    // Still return raw id so GUM can try { ideal } before enum labels exist
    return wantId || null;
  }
  if (wantId && list.some((d) => d.deviceId === wantId)) return wantId;
  if (wantLabel) {
    const hit = list.find((d) => deviceLabelsMatch(d.label, wantLabel));
    if (hit?.deviceId) return hit.deviceId;
  }
  return null;
}

function isKnownDeviceId(deviceId, kind) {
  if (!deviceId) return false;
  const list =
    kind === "videoinput"
      ? lastDeviceEnum.videoinput
      : kind === "audioinput"
        ? lastDeviceEnum.audioinput
        : lastDeviceEnum.audiooutput;
  if (list?.some((d) => d.deviceId === deviceId)) return true;
  const selId =
    kind === "videoinput"
      ? "sel-camera"
      : kind === "audioinput"
        ? "sel-mic"
        : "sel-speaker";
  const sel = $(selId);
  if (sel?.options?.length) {
    return [...sel.options].some((o) => o.value === deviceId);
  }
  return false;
}

/**
 * Persist last-used devices (id + human label) so next visit can reopen them.
 * @param {MediaStream|null|undefined} stream
 * @param {{ speakerId?: string|null }} [extra]
 */
function persistLastMediaDevices(stream, extra = {}) {
  try {
    const patch = {};
    const v = stream?.getVideoTracks?.()?.[0];
    const a = stream?.getAudioTracks?.()?.[0];
    const vId = v?.getSettings?.()?.deviceId || null;
    const aId = a?.getSettings?.()?.deviceId || null;
    if (vId) {
      patch.cameraId = vId;
      if (v?.label) patch.cameraLabel = v.label;
    }
    if (aId) {
      patch.micId = aId;
      if (a?.label) patch.micLabel = a.label;
    }
    if (extra.speakerId != null) {
      const sid = String(extra.speakerId || "");
      patch.speakerId = sid;
      if (sid) {
        const sp = lastDeviceEnum.audiooutput.find((d) => d.deviceId === sid);
        if (sp?.label) patch.speakerLabel = sp.label;
        else {
          const opt = [...($("sel-speaker")?.options || [])].find(
            (o) => o.value === sid
          );
          if (opt?.textContent) patch.speakerLabel = opt.textContent;
        }
      }
    }
    if (Object.keys(patch).length) savePrefs(patch);
  } catch (_) {}
}

/**
 * Apply volume / mirror / speaker / select values from localStorage.
 * Call after refreshDevices so selects have options.
 */
function restoreMediaUiFromPrefs() {
  const prefs = loadPrefs();
  try {
    if (typeof prefs.volume === "number" && Number.isFinite(prefs.volume)) {
      syncVolumeSliders(prefs.volume);
      peerVolByEl.remote = Math.max(0, Math.min(100, prefs.volume));
      applyRemoteVolume();
    }
  } catch (_) {}
  try {
    applyLocalMirrorClass();
  } catch (_) {}
  // Re-select saved devices (id → label rematch inside fillSelect already ran)
  try {
    const camId = resolveSavedDeviceId("videoinput", "cameraId", "cameraLabel");
    if (camId && $("sel-camera") && isKnownDeviceId(camId, "videoinput")) {
      $("sel-camera").value = camId;
      forceCameraDeviceId = camId;
    }
    const micId = resolveSavedDeviceId("audioinput", "micId", "micLabel");
    if (micId && $("sel-mic") && isKnownDeviceId(micId, "audioinput")) {
      $("sel-mic").value = micId;
    }
    const spkId = resolveSavedDeviceId(
      "audiooutput",
      "speakerId",
      "speakerLabel"
    );
    if (spkId && $("sel-speaker") && isKnownDeviceId(spkId, "audiooutput")) {
      $("sel-speaker").value = spkId;
    }
  } catch (_) {}
  try {
    applySpeaker();
  } catch (_) {}
  try {
    syncLowLatencyAudioToggles?.();
  } catch (_) {}
}

function fillSelect(sel, devices, kindLabel, prefKey, labelKey) {
  if (!sel) return;
  const prev = sel.value;
  const prefs = loadPrefs();
  const preferred = prefs[prefKey];
  const preferredLabel = labelKey ? prefs[labelKey] : "";
  const list = uniqueDevices(devices);

  sel.disabled = false;
  sel.innerHTML = list.length
    ? list
        .map(
          (d, i) =>
            `<option value="${escapeAttr(d.deviceId)}">${escapeHtml(
              d.label || `${kindLabel} ${i + 1}`
            )}</option>`
        )
        .join("")
    : `<option value="">${escapeHtml(_t("device.none", { kind: kindLabel }))}</option>`;

  const has = (id) => id && [...sel.options].some((o) => o.value === id);
  if (prev && has(prev)) sel.value = prev;
  else if (preferred && has(preferred)) sel.value = preferred;
  else if (preferredLabel) {
    const hit = list.find((d) => deviceLabelsMatch(d.label, preferredLabel));
    if (hit && has(hit.deviceId)) sel.value = hit.deviceId;
  }
}

async function refreshDevices() {
  try {
    const { cameras, mics, speakers } = await listMediaDevices();
    // Show all real cameras (do not hide Kiyo — user may only have that device,
    // or USB may be busy with PipeWire). Ranking demotes black-prone labels.
    const camList = cameras || [];
    rememberDeviceEnum(camList, mics, speakers);
    fillSelect(
      $("sel-camera"),
      camList,
      _t("device.camera"),
      "cameraId",
      "cameraLabel"
    );
    fillSelect($("sel-mic"), mics, _t("device.mic"), "micId", "micLabel");
    fillSelect(
      $("sel-speaker"),
      speakers,
      _t("device.speaker"),
      "speakerId",
      "speakerLabel"
    );
    if (!speakers?.length && $("sel-speaker")) {
      $("sel-speaker").innerHTML = `<option value="">${escapeHtml(
        _t("device.defaultSpeaker")
      )}</option>`;
    }
    restoreMediaUiFromPrefs();
    syncSettingsSummary();
    log(
      _t("log.devices", {
        c: uniqueDevices(cameras).length,
        m: uniqueDevices(mics).length,
        s: uniqueDevices(speakers).length || 0,
      })
    );
  } catch (e) {
    log(_t("log.devicesFail", { e: e.message || e }));
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function syncVolumeSliders(val) {
  const n = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
  const v = String(n);
  if ($("remote-vol")) $("remote-vol").value = v;
  if ($("remote-vol-sheet")) $("remote-vol-sheet").value = v;
  paintVolumePct(n);
}

/** Side-rail + sheet volume percentage label. */
function paintVolumePct(val) {
  const n = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
  const label = `${n}%`;
  const pct = $("remote-vol-pct");
  if (pct) pct.textContent = label;
  const sheetPct = $("remote-vol-sheet-pct");
  if (sheetPct) sheetPct.textContent = label;
  // CSS custom prop for filled track height on vertical slider
  const volWrap = $("remote-vol")?.closest?.(".side-vol");
  if (volWrap) volWrap.style.setProperty("--vol-pct", String(n));
}

function stopMeter() {
  if (meterRaf) cancelAnimationFrame(meterRaf);
  meterRaf = 0;
  try {
    meterSource?.disconnect();
  } catch (_) {}
  meterSource = null;
  meterAnalyser = null;
  if (meterCtx) {
    meterCtx.close().catch(() => {});
    meterCtx = null;
  }
  const m = $("mic-meter");
  if (m) {
    m.style.transform = "scaleY(0)";
    m.style.height = "100%";
  }
  updateMicPill(0);
}

/** Resume AudioContext — browsers suspend it after async getUserMedia. */
async function resumeMeterCtx() {
  if (!meterCtx) return false;
  if (meterCtx.state === "running") return true;
  try {
    await meterCtx.resume();
  } catch (_) {}
  return meterCtx.state === "running";
}

/**
 * Visual mic level from the preview/call audio track.
 * Must resume AudioContext after getUserMedia (gesture often already spent).
 */
async function startMeter(stream) {
  stopMeter();
  if (!stream?.getAudioTracks?.().length) {
    log(_t("log.meterNoTrack"));
    return;
  }
  const track = stream.getAudioTracks()[0];
  if (track.readyState === "ended") {
    log(_t("log.meterEnded"));
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      log(_t("log.meterNoAc"));
      return;
    }
    meterCtx = new AC();
    // Critical: context is often "suspended" until resume() after async media.
    await resumeMeterCtx();
    if (meterCtx.state !== "running") {
      log(_t("log.meterLocked"));
    }

    meterSource = meterCtx.createMediaStreamSource(stream);
    meterAnalyser = meterCtx.createAnalyser();
    meterAnalyser.fftSize = 512;
    meterAnalyser.smoothingTimeConstant = 0.4;
    // Analyser does not need to be connected to destination (and must not be —
    // that would play mic into speakers). Source → analyser is enough.
    meterSource.connect(meterAnalyser);

    const data = new Uint8Array(meterAnalyser.fftSize);
    let smooth = 0;
    const tick = () => {
      if (!meterAnalyser) return;
      // Keep trying to wake a suspended context (autoplay policy).
      if (meterCtx && meterCtx.state === "suspended") {
        meterCtx.resume().catch(() => {});
      }

      // Silence when intentionally muted (track.enabled = false).
      if (micMuted || track.enabled === false) {
        smooth = 0;
        const m = $("mic-meter");
        if (m) m.style.transform = "scaleY(0)";
        updateMicPill(0);
        meterRaf = requestAnimationFrame(tick);
        return;
      }

      meterAnalyser.getByteTimeDomainData(data);
      let sum = 0;
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
        const a = Math.abs(v);
        if (a > peak) peak = a;
      }
      const rms = Math.sqrt(sum / data.length);
      // Boost for typical speech levels (often very small RMS).
      const instant = Math.min(1, Math.max(rms * 6, peak * 2.2));
      smooth = smooth * 0.65 + instant * 0.35;
      const pct = Math.min(100, Math.round(smooth * 100));
      const m = $("mic-meter");
      if (m) m.style.transform = `scaleY(${pct / 100})`;
      updateMicPill(pct);
      meterRaf = requestAnimationFrame(tick);
    };
    tick();
  } catch (e) {
    console.warn("mic meter", e);
    log(_t("log.meterFail", { e: e.message || e }));
  }
}

// User gesture can unlock a suspended meter context.
document.addEventListener(
  "pointerdown",
  () => {
    resumeMeterCtx();
  },
  { capture: true }
);

function updateMicPill(_level) {
  // Mic/live pill removed from tile — level still drives side meter / icons
}

function updateSideIcons() {
  // SVG icons toggle via .muted-on / .active CSS (icon-on / icon-off)
  // Cam on/off control removed — camera always on; privacy is Hide (self-blur)
  if (camOff) {
    camOff = false;
    previewStream?.getVideoTracks().forEach((tr) => {
      tr.enabled = true;
    });
    pushOutboundVideoTracks().catch(() => {});
  }
  $("btn-mute-mic")?.classList.toggle("muted-on", micMuted);
  $("btn-mute-remote")?.classList.toggle("muted-on", partnerMuted);
  $("btn-blur-remote")?.classList.toggle("active", partnerBlurred);
  $("tile-remote")?.classList.toggle("partner-blurred", partnerBlurred);
  $("btn-blur-self")?.classList.toggle("active", selfBlurred);
  $("tile-local")?.classList.toggle("self-blurred", selfBlurred);
  // Partner blur: Blur them ↔ Unblur
  try {
    syncPartnerBlurButtonLabels();
  } catch (_) {}
  // Label on self-blur button
  const selfLbl = $("btn-blur-self")?.querySelector(".lbl");
  if (selfLbl) {
    selfLbl.textContent = selfBlurred
      ? _t("btn.selfReveal") || "Reveal"
      : _t("btn.selfBlur") || "Hide";
  }
  const badge = $("self-blur-badge");
  if (badge) badge.hidden = !selfBlurred;
}

/** Black silent canvas stream for privacy hide (partner sees black, local keeps preview). */
let _blackVideoTrack = null;
function getBlackVideoTrack() {
  if (_blackVideoTrack && _blackVideoTrack.readyState === "live") return _blackVideoTrack;
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 480;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#0a0b0e";
  ctx.fillRect(0, 0, c.width, c.height);
  // Keep canvas "live" for some browsers
  const tick = () => {
    if (!_blackVideoTrack || _blackVideoTrack.readyState !== "live") return;
    ctx.fillStyle = "#0a0b0e";
    ctx.fillRect(0, 0, c.width, c.height);
    requestAnimationFrame(tick);
  };
  const stream = c.captureStream(5);
  _blackVideoTrack = stream.getVideoTracks()[0] || null;
  if (_blackVideoTrack) requestAnimationFrame(tick);
  return _blackVideoTrack;
}

async function pushOutboundVideoTracks() {
  const real = previewStream?.getVideoTracks()?.[0] || null;
  // Local element always uses real preview stream (CSS handles self-blur look)
  // Never attach the privacy black canvas track to #local — only outbound PC.
  const local = $("local");
  if (local && previewStream) {
    if (local.srcObject !== previewStream) {
      local.srcObject = previewStream;
      prepareVideoEl(local, { muted: true });
      playVideoEl(local);
    }
  }
  for (const pc of peerPcs.values()) {
    try {
      if (camOff) {
        pc.setCamEnabled?.(false);
        continue;
      }
      if (selfBlurred) {
        const black = getBlackVideoTrack();
        if (black && pc.pc) {
          const vSender = pc.pc.getSenders().find((s) => s.track?.kind === "video");
          if (vSender) await vSender.replaceTrack(black);
          else pc.pc.addTrack(black, new MediaStream([black]));
        } else {
          pc.setCamEnabled?.(false);
        }
      } else if (real) {
        real.enabled = true;
        if (pc.pc) {
          const vSender = pc.pc.getSenders().find((s) => s.track?.kind === "video");
          if (vSender) await vSender.replaceTrack(real);
        }
        pc.setCamEnabled?.(true);
      }
    } catch (e) {
      console.warn("[self-blur] push tracks", e);
      try {
        if (selfBlurred || camOff) pc.setCamEnabled?.(false);
        else pc.setCamEnabled?.(true);
      } catch (_) {}
    }
  }
  // Local track enabled for preview when cam on (even if self-blurred — CSS blurs)
  previewStream?.getVideoTracks().forEach((t) => {
    t.enabled = !camOff;
  });
  updateSideIcons();
}

/**
 * Mobile browsers (esp. iOS Safari) often paint CSS filter:blur() on <video> as solid black.
 * Use a canvas that samples the video at low res + soft upscale (works everywhere).
 */
function needsCanvasVideoBlur() {
  try {
    // Coarse pointer / no hover ≈ phone/tablet; also force for iOS UA
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod|Android|Mobile|webOS/i.test(ua)) return true;
    if (window.matchMedia?.("(hover: none)").matches) return true;
    if (window.matchMedia?.("(pointer: coarse)").matches) return true;
  } catch (_) {}
  return false;
}

/** @type {number} */
let partnerBlurRaf = 0;
/** @type {number} */
let selfBlurRaf = 0;

function ensureVideoBlurCanvas(tileId, canvasId) {
  const tile = $(tileId);
  if (!tile) return null;
  let c = $(canvasId);
  if (!c) {
    c = document.createElement("canvas");
    c.id = canvasId;
    c.className = "video-blur-canvas";
    c.setAttribute("aria-hidden", "true");
    // Sit above videos, below chrome (stars/fs are z 7–8)
    tile.appendChild(c);
  }
  return c;
}

/**
 * Soft blur by multi-pass downscale (no CSS filter on <video> — avoids black frame on iOS).
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLVideoElement} video
 * @param {HTMLCanvasElement} canvas
 * @param {{ mirror?: boolean }} [opts]
 */
function drawSoftBlurredVideo(ctx, video, canvas, opts = {}) {
  const vw = video.videoWidth || 0;
  const vh = video.videoHeight || 0;
  if (!vw || !vh || video.readyState < 2) {
    // Not ready — soft slate (not pure black)
    const w = canvas.width || 160;
    const h = canvas.height || 90;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#1c2230");
    g.addColorStop(1, "#12161e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  // Target display buffer (modest for CPU on phones)
  const outW = 360;
  const outH = Math.max(1, Math.round((vh / vw) * outW));
  if (canvas.width !== outW || canvas.height !== outH) {
    canvas.width = outW;
    canvas.height = outH;
  }
  // Tiny intermediate for heavy blur feel
  const tinyW = 48;
  const tinyH = Math.max(1, Math.round((vh / vw) * tinyW));
  if (!drawSoftBlurredVideo._tiny) {
    drawSoftBlurredVideo._tiny = document.createElement("canvas");
  }
  const tiny = drawSoftBlurredVideo._tiny;
  if (tiny.width !== tinyW || tiny.height !== tinyH) {
    tiny.width = tinyW;
    tiny.height = tinyH;
  }
  const tctx = tiny.getContext("2d");
  if (!tctx) return;
  try {
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(video, 0, 0, tinyW, tinyH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // Optional extra blur if browser supports canvas filter
    try {
      ctx.filter = "blur(6px) saturate(0.9)";
    } catch (_) {
      ctx.filter = "none";
    }
    if (opts.mirror) {
      ctx.save();
      ctx.translate(outW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(tiny, 0, 0, tinyW, tinyH, 0, 0, outW, outH);
      ctx.restore();
    } else {
      ctx.drawImage(tiny, 0, 0, tinyW, tinyH, 0, 0, outW, outH);
    }
    ctx.filter = "none";
    // Slight dim so it reads as “privacy blur”
    ctx.fillStyle = "rgba(10, 12, 18, 0.18)";
    ctx.fillRect(0, 0, outW, outH);
  } catch (_) {
    ctx.fillStyle = "#1a2030";
    ctx.fillRect(0, 0, outW, outH);
  }
}

function stopPartnerBlurCanvas() {
  stopPeerBlurCanvas("remote");
  partnerBlurRaf = 0;
}

function startPartnerBlurCanvas() {
  startPeerBlurCanvas("remote");
  partnerBlurRaf = peerBlurRafByEl.remote || 0;
}

function stopSelfBlurCanvas() {
  if (selfBlurRaf) {
    cancelAnimationFrame(selfBlurRaf);
    selfBlurRaf = 0;
  }
  const c = $("self-blur-canvas");
  if (c) {
    c.classList.remove("is-active");
    c.hidden = true;
  }
}

function startSelfBlurCanvas() {
  if (!needsCanvasVideoBlur()) {
    stopSelfBlurCanvas();
    return;
  }
  const canvas = ensureVideoBlurCanvas("tile-local", "self-blur-canvas");
  const video = $("local");
  if (!canvas || !video) return;
  canvas.hidden = false;
  canvas.classList.add("is-active");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  const tick = () => {
    if (!selfBlurred) {
      stopSelfBlurCanvas();
      return;
    }
    // Match selfie mirror (default) unless user flipped to natural
    const mirror = !video.classList.contains("is-unmirrored");
    drawSoftBlurredVideo(ctx, video, canvas, { mirror });
    selfBlurRaf = requestAnimationFrame(tick);
  };
  if (selfBlurRaf) cancelAnimationFrame(selfBlurRaf);
  selfBlurRaf = requestAnimationFrame(tick);
}

function setPartnerBlur(on) {
  // Side-rail blur = main remote only (3rd/4th use per-tile blur buttons)
  setPeerElBlur("remote", on);
}

function togglePartnerBlur() {
  // User took control — cancel pending auto-unblur
  clearIntroBlurTimer();
  introBlurGen++;
  togglePeerElBlur("remote");
  try {
    syncPartnerBlurButtonLabels();
  } catch (_) {}
  log(
    partnerBlurred
      ? _t("log.blurOn") || "partner video blurred"
      : _t("log.blurOff") || "partner video unblurred"
  );
}

function setSelfBlur(on) {
  selfBlurred = !!on;
  pushOutboundVideoTracks().catch(() => {});
  updateSideIcons();
  if (selfBlurred) startSelfBlurCanvas();
  else stopSelfBlurCanvas();
}

function toggleSelfBlur() {
  setSelfBlur(!selfBlurred);
  log(
    selfBlurred
      ? _t("log.selfBlurOn") || "You are hidden — partner sees black"
      : _t("log.selfBlurOff") || "You revealed yourself"
  );
}

function nsfwAutoEnabled() {
  const prefs = loadPrefs();
  return prefs.nsfwAuto !== false; // default ON
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("load failed: " + src));
    document.head.appendChild(s);
  });
}

async function ensureNsfwModel() {
  if (nsfwModel) return nsfwModel;
  if (nsfwLoadPromise) return nsfwLoadPromise;
  nsfwLoadPromise = (async () => {
    try {
      if (!window.tf) {
        await loadScriptOnce(
          "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"
        );
      }
      if (!window.nsfwjs) {
        await loadScriptOnce(
          "https://cdn.jsdelivr.net/npm/nsfwjs@2.4.2/dist/nsfwjs.min.js"
        );
      }
      if (!window.nsfwjs?.load) throw new Error("nsfwjs unavailable");
      // MobileNet mid size — balance of speed vs accuracy
      nsfwModel = await window.nsfwjs.load();
      return nsfwModel;
    } catch (e) {
      console.warn("[nsfw]", e);
      nsfwLoadPromise = null;
      return null;
    }
  })();
  return nsfwLoadPromise;
}

function stopNsfwWatch() {
  if (nsfwTimer) {
    clearInterval(nsfwTimer);
    nsfwTimer = 0;
  }
  nsfwHitCooldown = false;
}

function startNsfwWatch() {
  stopNsfwWatch();
  if (!nsfwAutoEnabled()) return;
  // Only strangers (not confirmed friend 1:1)
  if (matchMode === "friend") return;
  // Warm model in background
  ensureNsfwModel().then((m) => {
    if (!m) return;
    nsfwTimer = setInterval(() => {
      scanRemoteForNsfw().catch(() => {});
    }, 2200);
  });
}

async function scanRemoteForNsfw() {
  if (!matched || nsfwHitCooldown) return;
  if (!nsfwAutoEnabled()) return;
  if (matchMode === "friend") return;
  const video = $("remote");
  if (!video || video.readyState < 2 || !video.videoWidth) return;
  const model = await ensureNsfwModel();
  if (!model) return;

  const canvas = document.createElement("canvas");
  const size = 224;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  try {
    ctx.drawImage(video, 0, 0, size, size);
  } catch {
    return; // tainted / not ready
  }

  let preds;
  try {
    preds = await model.classify(canvas, 5);
  } catch (e) {
    return;
  }
  const score = (name) =>
    preds.find((p) => p.className === name)?.probability || 0;
  const porn = score("Porn");
  const hentai = score("Hentai");
  const sexy = score("Sexy");
  // Conservative thresholds — prefer false negatives over false positives
  const hit = porn >= 0.72 || hentai >= 0.78 || (porn >= 0.55 && sexy >= 0.5);
  if (hit) {
    await handleNsfwDetected({ porn, hentai, sexy });
  }
}

async function handleNsfwDetected(scores) {
  if (nsfwHitCooldown || !matched) return;
  nsfwHitCooldown = true;
  stopNsfwWatch();
  console.warn("[nsfw] hit", scores);
  setPartnerBlur(true);
  setStatus(_t("nsfw.hit"));
  log(_t("nsfw.hit"));
  const uid = primaryPartnerUserId;
  if (uid) {
    // AI-assisted hub report (needs more unique signals than pure human "explicit")
    send({ type: "report_user", user_id: uid, reason: "explicit_ai" });
    saveLocalReport({
      t: Date.now(),
      user_id: uid,
      name: lastMatchMeta?.name || "",
      short_id: lastMatchMeta?.short_id || "",
      friend_code: lastMatchMeta?.friend_code || "",
      reason: "explicit_ai",
      scores,
    });
    // Silent block — no confirm dialog
    send({ type: "block_user", user_id: uid });
    log(_t("nsfw.blocked"));
    primaryPartnerUserId = "";
  }
  // Skip to next stranger
  wantSearch = true;
  matched = false;
  closeAllPeers({ keepFriend: false });
  setSplitRemote(false);
  setRemoteEmpty(true);
  resetRemoteEmptyCopy();
  updateFriendActionButtons();
  send({ type: "next", room: currentRoom() });
  setPhase("waiting");
  // brief cooldown before scanning next partner
  setTimeout(() => {
    nsfwHitCooldown = false;
  }, 4000);
}

/**
 * Camera LED can be on while the <video> stays black (wrong /dev/video* on Linux,
 * muted track, GPU paint bug, stuck overlay). Heal by re-bind, canvas mirror,
 * then cycle cameras.
 */
let localPreviewHealthTimer = 0;
let localPreviewHealthTries = 0;
let localCanvasRaf = 0;
let localBlackStreak = 0;
let localCameraCycleTried = new Set();
let localCameraCycleBusy = false;
/** When set, startPreview must open this deviceId (user pick) — never silent-fallback to another cam. */
let forceCameraDeviceId = null;

function localVideoTrackLive() {
  try {
    return (previewStream?.getVideoTracks?.() || []).some(
      (t) => t && t.readyState === "live" && t.enabled !== false
    );
  } catch (_) {
    return false;
  }
}

function localVideoTrackMuted() {
  try {
    const t = previewStream?.getVideoTracks?.()?.[0];
    return !!(t && t.muted);
  } catch (_) {
    return false;
  }
}

/** True when the local element has decoded frames (may still be all-black pixels). */
function localPreviewHasFrames() {
  const local = $("local");
  if (!local?.srcObject) return false;
  if (local.paused) return false;
  if ((local.videoWidth || 0) < 2 || (local.videoHeight || 0) < 2) return false;
  if (local.readyState < 2) return false;
  return true;
}

/** Sample average luma of current local frame (0–255). -1 if unreadable. */
function sampleLocalPreviewLuma() {
  const local = $("local");
  if (!local || (local.videoWidth || 0) < 2) return -1;
  try {
    const w = 48;
    const h = 36;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return -1;
    ctx.drawImage(local, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 16) {
      // Rec. 601 luma
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      n++;
    }
    return n ? sum / n : -1;
  } catch (_) {
    return -1;
  }
}

function localPreviewIsPainting() {
  if (!localPreviewHasFrames()) return false;
  // All-black frames still count as "not painting" for UX
  const luma = sampleLocalPreviewLuma();
  if (luma >= 0 && luma < 6) return false;
  return true;
}

function clearStuckLocalBlurCanvas() {
  if (selfBlurred) return;
  try {
    $("tile-local")?.classList.remove("self-blurred");
    const c = $("self-blur-canvas");
    if (c) {
      c.classList.remove("is-active");
      c.style.display = "none";
    }
  } catch (_) {}
}

function ensureLocalPreviewCanvas() {
  let c = $("local-preview-canvas");
  if (c) return c;
  const tile = $("tile-local");
  const local = $("local");
  if (!tile || !local) return null;
  c = document.createElement("canvas");
  c.id = "local-preview-canvas";
  c.className = "local-preview-canvas";
  c.setAttribute("aria-hidden", "true");
  c.hidden = true;
  local.insertAdjacentElement("afterend", c);
  return c;
}

/** Abort handle for MediaStreamTrackProcessor read loop */
let localTrackProcessorAbort = null;

function stopLocalCanvasPreview() {
  if (localCanvasRaf) {
    cancelAnimationFrame(localCanvasRaf);
    localCanvasRaf = 0;
  }
  if (localTrackProcessorAbort) {
    try {
      localTrackProcessorAbort.abort();
    } catch (_) {}
    localTrackProcessorAbort = null;
  }
  const c = $("local-preview-canvas");
  if (c) {
    c.hidden = true;
    c.classList.remove("is-active");
  }
  $("tile-local")?.classList.remove("local-canvas-preview");
}

/** Offscreen <video> used only for decode (main #local can stay GPU-black on Linux). */
function ensureLocalDecodeVideo() {
  let v = $("local-decode-video");
  if (v) return v;
  v = document.createElement("video");
  v.id = "local-decode-video";
  v.muted = true;
  v.defaultMuted = true;
  v.playsInline = true;
  v.setAttribute("playsinline", "");
  v.setAttribute("webkit-playsinline", "");
  v.autoplay = true;
  v.setAttribute("muted", "");
  // Must be in DOM and non-zero size or some Chrome builds never decode
  v.style.cssText =
    "position:fixed;left:0;top:0;width:160px;height:120px;opacity:0.001;pointer-events:none;z-index:-1;";
  document.body.appendChild(v);
  return v;
}

/**
 * Local preview strategy:
 * - Mobile / normal: show <video id="local"> only (works everywhere).
 * - Desktop Linux when <video> stays black: optional canvas mirror.
 * Never leave a blank black canvas covering the video (broke mobile + desktop).
 */
function startLocalCanvasPreview() {
  try { stopLocalCanvasPreview(); } catch (_) {}
}



/** Session devices that delivered black frames (LED on, no picture). */
const LOCAL_CAM_FAILED_KEY = "ruletka-cam-black-ids-v1";

function loadFailedCameraIds() {
  try {
    const raw = sessionStorage.getItem(LOCAL_CAM_FAILED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (_) {
    return new Set();
  }
}

function markCameraFailed(deviceId) {
  if (!deviceId) return;
  try {
    const s = loadFailedCameraIds();
    s.add(deviceId);
    sessionStorage.setItem(LOCAL_CAM_FAILED_KEY, JSON.stringify([...s]));
  } catch (_) {}
  localCameraCycleTried.add(deviceId);
}

function clearFailedCameras() {
  try {
    sessionStorage.removeItem(LOCAL_CAM_FAILED_KEY);
  } catch (_) {}
  localCameraCycleTried.clear();
}

function isBlackProneCameraLabel(label) {
  return /kiyo|razer\s*kiyo/i.test(String(label || ""));
}

function isDesktopLinuxCam() {
  try {
    return !isLikelyMobile() && /Linux/i.test(navigator.userAgent || "");
  } catch (_) {
    return false;
  }
}

/**
 * Sample average luma of a MediaStream via a temporary <video> (and ImageCapture).
 * Returns 0–255, or -1 if unreadable.
 */
async function sampleStreamLuma(stream, waitMs = 550) {
  if (!stream?.getVideoTracks?.()?.length) return -1;
  const v = document.createElement("video");
  v.muted = true;
  v.defaultMuted = true;
  v.playsInline = true;
  v.setAttribute("playsinline", "");
  v.autoplay = true;
  v.style.cssText =
    "position:fixed;left:-9999px;top:0;width:160px;height:120px;opacity:0;pointer-events:none";
  document.body.appendChild(v);
  try {
    v.srcObject = stream;
    try {
      await v.play();
    } catch (_) {}
    await new Promise((r) => setTimeout(r, waitMs));
    let luma = -1;
    if ((v.videoWidth || 0) >= 2 && (v.videoHeight || 0) >= 2) {
      try {
        const w = 48;
        const h = 36;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h).data;
          let sum = 0;
          let n = 0;
          for (let i = 0; i < data.length; i += 16) {
            sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            n++;
          }
          luma = n ? sum / n : -1;
        }
      } catch (_) {}
    }
    // ImageCapture fallback when <video> GPU path is black/zero size
    if (luma < 5) {
      try {
        const track = stream.getVideoTracks()[0];
        if (track && typeof ImageCapture === "function") {
          const bmp = await new ImageCapture(track).grabFrame();
          const w = 48;
          const h = 36;
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(bmp, 0, 0, w, h);
            const data = ctx.getImageData(0, 0, w, h).data;
            let sum = 0;
            let n = 0;
            for (let i = 0; i < data.length; i += 16) {
              sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              n++;
            }
            luma = n ? sum / n : luma;
          }
          try {
            bmp.close?.();
          } catch (_) {}
        }
      } catch (_) {}
    }
    return luma;
  } finally {
    try {
      v.srcObject = null;
      v.remove();
    } catch (_) {}
  }
}

/**
 * Open a single camera by deviceId (video only). Returns stream or null.
 */
async function openVideoDeviceOnly(deviceId) {
  if (!deviceId) return null;
  const tries = [
    {
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    },
    { video: { deviceId: { exact: deviceId } }, audio: false },
    { video: { deviceId: { ideal: deviceId } }, audio: false },
  ];
  for (const c of tries) {
    try {
      return await navigator.mediaDevices.getUserMedia(c);
    } catch (_) {}
  }
  return null;
}

/**
 * Desktop Linux: open cameras that actually paint.
 * NEVER falls back to Razer Kiyo when any non-Kiyo device exists (Kiyo = LED on, black frames).
 */
async function probeOpenBestCamera(audioDeviceId) {
  const ranked = await listVideoCameras();
  if (!ranked.length) return null;

  const good = ranked.filter((c) => !isBlackProneCameraLabel(c.label));
  const bad = ranked.filter((c) => isBlackProneCameraLabel(c.label));
  // If we have USB/etc, never try Kiyo at all
  const order = good.length ? good : bad;

  let best = null; // { stream, id, label, luma }
  for (const cam of order) {
    const s = await openVideoDeviceOnly(cam.id);
    if (!s) {
      log("cam probe fail open: " + (cam.label || cam.id).slice(0, 32));
      continue;
    }
    const luma = await sampleStreamLuma(s, 700);
    log(
      "cam probe: " +
        (cam.label || cam.id.slice(0, 8)).slice(0, 40) +
        " luma=" +
        (luma >= 0 ? Math.round(luma) : "?")
    );
    // Reject solid-black immediately when better options exist
    if (luma >= 0 && luma < 5 && good.length > 0 && isBlackProneCameraLabel(cam.label)) {
      try {
        s.getTracks().forEach((t) => t.stop());
      } catch (_) {}
      continue;
    }
    if (!best || luma > best.luma) {
      if (best?.stream) {
        try {
          best.stream.getTracks().forEach((t) => t.stop());
        } catch (_) {}
      }
      best = { stream: s, id: cam.id, label: cam.label, luma };
    } else {
      try {
        s.getTracks().forEach((t) => t.stop());
      } catch (_) {}
    }
    if (best && best.luma >= 10) break;
  }
  if (!best?.stream) return null;

  // If best is still nearly black and we only tried "good" list, return it anyway
  // (dim room) — caller uses luma threshold.
  try {
    const a = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: audioDeviceId
        ? {
            deviceId: { ideal: audioDeviceId },
            echoCancellation: true,
            noiseSuppression: true,
          }
        : {
            echoCancellation: true,
            noiseSuppression: true,
          },
    });
    a.getAudioTracks().forEach((t) => best.stream.addTrack(t));
  } catch (_) {}
  return best;
}

/**
 * After GUM: if we got Kiyo while a normal webcam exists, drop Kiyo and open that cam.
 * Desktop Linux only. Always stops tracks first so USB is free.
 */
async function rejectBlackProneIfAlternatives(stream, audioDeviceId) {
  if (!stream || !isDesktopLinuxCam()) return stream;
  const track = stream.getVideoTracks?.()?.[0];
  const label = track?.label || "";
  if (!isBlackProneCameraLabel(label)) return stream;

  let devices = [];
  try {
    devices = await navigator.mediaDevices.enumerateDevices();
  } catch (_) {
    return stream;
  }
  const videos = (devices || []).filter(
    (d) => d.kind === "videoinput" && d.deviceId
  );
  const alt = videos.find(
    (d) =>
      !isBlackProneCameraLabel(d.label || "") &&
      /usb|webcam|vitade|microdia|c9\d\d|hd |integrated|face/i.test(
        d.label || ""
      )
  ) || videos.find((d) => !isBlackProneCameraLabel(d.label || ""));
  if (!alt) return stream;

  log("switch off Kiyo → " + (alt.label || alt.deviceId).slice(0, 40));
  try {
    stream.getTracks().forEach((t) => t.stop());
  } catch (_) {}
  await new Promise((r) => setTimeout(r, 350));

  const tries = [
    {
      video: {
        deviceId: { exact: alt.deviceId },
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: true,
    },
    { video: { deviceId: { exact: alt.deviceId } }, audio: true },
    { video: { deviceId: { ideal: alt.deviceId } }, audio: true },
  ];
  for (const c of tries) {
    try {
      const s = await navigator.mediaDevices.getUserMedia(c);
      try {
        savePrefs({ cameraId: alt.deviceId });
        if ($("sel-camera")) $("sel-camera").value = alt.deviceId;
      } catch (_) {}
      return s;
    } catch (_) {}
  }
  return null;
}

async function listVideoCameras() {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    const failed = loadFailedCameraIds();
    const desktopLinux = isDesktopLinuxCam();
    // List every videoinput — never hide devices (after unplug/replug Chrome
    // needs every node; hard-banning Kiyo made "no camera" when USB was busy).
    const cams = (all || []).filter(
      (d) => d.kind === "videoinput" && d.deviceId
    );
    // Prefer working webcams; demote black-prone / IR / virtual (still tryable)
    return cams
      .map((d) => {
        const l = (d.label || "").toLowerCase();
        let score = 10;
        if (/integrated|webcam|usb 2\.0|usb camera|hd |face|c920|c922|brill|vitade|microdia/.test(l))
          score += 20;
        // Kiyo often black on Linux UVC — demote, do not remove
        if (/kiyo/.test(l)) score += desktopLinux ? -25 : 1;
        if (/razer/.test(l) && desktopLinux) score -= 10;
        if (/logitech|hd pro|c9\d\d/.test(l)) score += 8;
        if (/ir\b|infrared|depth|meta|virtual|obs|snap|manycam|ndi|dummy/.test(l))
          score -= 20;
        if (failed.has(d.deviceId) || localCameraCycleTried.has(d.deviceId))
          score -= 50;
        if (!l) score -= 2;
        return { id: d.deviceId, label: d.label || "Camera", score };
      })
      .sort((a, b) => b.score - a.score);
  } catch (_) {
    return [];
  }
}

/** Nudge auto-exposure / gain when the stream is live but frames are black. */
async function tryBoostCameraExposure(track) {
  if (!track?.applyConstraints) return false;
  const tries = [
    {
      advanced: [
        { exposureMode: "continuous" },
        { whiteBalanceMode: "continuous" },
        { focusMode: "continuous" },
      ],
    },
    {
      advanced: [
        { exposureMode: "manual", exposureCompensation: 1.5 },
        { brightness: 128 },
        { contrast: 32 },
      ],
    },
    { advanced: [{ exposureTime: 100 }, { iso: 800 }] },
  ];
  for (const c of tries) {
    try {
      await track.applyConstraints(c);
      return true;
    } catch (_) {}
  }
  return false;
}

/**
 * Wait for non-black frames. Returns true if preview looks usable.
 * Autoexposure often needs 0.5–2s after open.
 */
async function waitForLocalPreviewPaint(maxMs = 2200) {
  const start = Date.now();
  let best = -1;
  while (Date.now() - start < maxMs) {
    await ensureLocalPreviewVisible("wait-paint");
    if (localPreviewIsPainting()) {
      const luma = sampleLocalPreviewLuma();
      if (luma > best) best = luma;
      if (luma >= 10) return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  // Soft pass if we got any real brightness (dim room)
  return best >= 8 || localPreviewIsPainting();
}

/**
 * If current camera stays black, mark it failed and open the next device.
 */
async function recoverBlackLocalCamera(reason = "") {
  const track = previewStream?.getVideoTracks?.()?.[0];
  const id = track?.getSettings?.()?.deviceId || "";
  if (id) markCameraFailed(id);
  // One shot: try exposure boost on current device first
  if (track) {
    await tryBoostCameraExposure(track);
    if (await waitForLocalPreviewPaint(900)) {
      // recovery without switch
      showLocalCamRestart(false);
      return true;
    }
  }
  showLocalCamRestart(true);
  return tryNextLocalCamera(reason || "black");
}

function showLocalCamRestart(show) {
  const btn = $("btn-restart-cam");
  const wrap = $("local-cam-restart");
  if (wrap) {
    wrap.hidden = !show;
    if (show) wrap.removeAttribute("hidden");
    else wrap.setAttribute("hidden", "");
  }
  if (btn) btn.hidden = !show;
  if (show) {
    // Keep video/canvas visible under a floating chip — do NOT cover the tile
    // with the full empty card (that made "cam on, still black" look like no video).
    if (localVideoTrackLive()) {
      setLocalEmpty(false);
      const sub = $("local-empty-sub");
      if (sub) {
        sub.textContent =
          _t("local.camBlackHint") ||
          "Camera on but black — try another camera";
      }
      const enableBtn = $("btn-enable-cam");
      if (enableBtn) enableBtn.hidden = true;
    } else {
      setLocalEmpty(true);
      showEnableCamButton(
        true,
        _t("local.camBlackHint") ||
          "Camera on but black — try another camera"
      );
    }
  }
}

/** Fully release camera hardware so the next getUserMedia can open a different /dev/video*. */
async function hardReleaseLocalCamera(ms = 280) {
  try {
    stopLocalCanvasPreview();
  } catch (_) {}
  if (previewStream) {
    try {
      previewStream.getTracks().forEach((tr) => {
        try {
          tr.stop();
        } catch (_) {}
      });
    } catch (_) {}
    previewStream = null;
  }
  const local = $("local");
  if (local) {
    try {
      local.srcObject = null;
    } catch (_) {}
    try {
      local.removeAttribute("src");
      local.load?.();
    } catch (_) {}
  }
  mediaPreviewBusy = false;
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

/**
 * Stop current preview and open the next camera device (skip already tried).
 * Fixes Linux multi-/dev/video* black feeds.
 */
async function tryNextLocalCamera(reason = "") {
  if (localCameraCycleBusy) return false;
  localCameraCycleBusy = true;
  try {
    const cams = await listVideoCameras();
    if (!cams.length) return false;
    const cur =
      previewStream?.getVideoTracks?.()?.[0]?.getSettings?.()?.deviceId || "";
    if (cur) localCameraCycleTried.add(cur);
    const next = cams.find((c) => !localCameraCycleTried.has(c.id));
    if (!next) {
      // Exhausted list — reset and show help
      localCameraCycleTried.clear();
      setStatus(
        _t("local.camBlackAll") ||
          "All cameras look black — close other apps using the camera, then Enable again"
      );
      showEnableCamButton(
        true,
        _t("local.camBlackHint") ||
          "Camera is on but preview is blank — try Enable again"
      );
      return false;
    }
    localCameraCycleTried.add(next.id);
    log(
      (_t("local.camSwitch") || "Trying camera") +
        ": " +
        (next.label || next.id.slice(0, 8))
    );
    setStatus(
      (_t("local.camSwitch") || "Trying camera") +
        ": " +
        (next.label || "…")
    );
    savePrefs({ cameraId: next.id });
    try {
      if ($("sel-camera")) {
        const sel = $("sel-camera");
        if (![...sel.options].some((o) => o.value === next.id)) {
          const opt = document.createElement("option");
          opt.value = next.id;
          opt.textContent = next.label || next.id.slice(0, 12);
          sel.appendChild(opt);
        }
        sel.value = next.id;
      }
    } catch (_) {}
    stopLocalCanvasPreview();
    // Don't call stopPreview→startPreview recursion through mediaPreviewBusy; open directly
    if (previewStream) {
      try {
        previewStream.getTracks().forEach((tr) => tr.stop());
      } catch (_) {}
      previewStream = null;
    }
    if ($("local")) $("local").srcObject = null;
    // Clear busy so startPreview can run
    mediaPreviewBusy = false;
    await startPreview();
    const ok = await waitForLocalPreviewPaint(2000);
    if (ok) {
      showLocalCamRestart(false);
      showEnableCamButton(false, _t("local.emptySub"));
      setLocalEmpty(false);
      return true;
    }
    // Still black — mark this one failed too and continue chain once
    const tid = previewStream?.getVideoTracks?.()?.[0]?.getSettings?.()?.deviceId;
    if (tid) markCameraFailed(tid);
    return false;
  } catch (e) {
    console.warn("[cam-cycle]", e);
    return false;
  } finally {
    localCameraCycleBusy = false;
  }
}

/**
 * Rebind stream → force play → hide empty overlay → canvas if needed.
 * @returns {Promise<boolean>} true if painting or no live video track to show
 */
async function ensureLocalPreviewVisible(reason = "") {
  const local = $("local");
  if (!local) return false;
  if (!previewStream) return false;

  try {
    if (local.srcObject !== previewStream) local.srcObject = previewStream;
  } catch (_) {}

  previewStream.getVideoTracks?.().forEach((t) => {
    try {
      if (t.readyState === "live") t.enabled = !camOff;
    } catch (_) {}
  });

  clearStuckLocalBlurCanvas();
  if (localVideoTrackLive()) {
    setLocalEmpty(false);
    markLocalFeedActive(true);
    // Hide canvas overlay unless desktop linux needs it later
    try {
      const c = $("local-preview-canvas");
      if (c && !c.classList.contains("is-active")) {
        c.hidden = true;
        c.style.display = "none";
      }
    } catch (_) {}
  }

  prepareVideoEl(local, { muted: true });
  try {
    local.muted = true;
    local.defaultMuted = true;
    local.playsInline = true;
    await local.play();
  } catch (_) {
    setTimeout(() => playVideoEl(local), 80);
  }

  // Desktop Linux only: canvas fallback if still black after play
  if (isDesktopLinuxCam() && localVideoTrackLive() && !localPreviewIsPainting()) {
    try {
      startLocalCanvasPreview();
    } catch (_) {}
  }

  if (localPreviewIsPainting()) {
    showEnableCamButton(false, _t("local.emptySub"));
    setLocalEmpty(false);
    showLocalCamRestart(false);
    localBlackStreak = 0;
  } else if (localVideoTrackLive() && isDesktopLinuxCam()) {
    showLocalCamRestart(true);
  }

  if (reason) {
    try {
      trackEvent("local_preview_heal", { reason: String(reason).slice(0, 40) });
    } catch (_) {}
  }
  return localPreviewIsPainting() || !localVideoTrackLive();
}

function wireLocalPreviewHealth(stream) {
  /* disabled */
}


function startLocalPreviewHealthWatch() {
  if (localPreviewHealthTimer) {
    clearInterval(localPreviewHealthTimer);
    localPreviewHealthTimer = 0;
  }
}


function startLocalCanvasPreview() {
  try { stopLocalCanvasPreview(); } catch (_) {}
}


/**
 * Attach a MediaStream to the local preview UI.
 * Restored simple path (HEAD) — experimental canvas/recreate broke all platforms.
 */
async function attachLocalStream(stream) {
  if (previewStream && previewStream !== stream) {
    previewStream.getTracks().forEach((t) => {
      try { t.stop(); } catch (_) {}
    });
  }
  previewStream = stream;
  try {
    applyMicTracks();
  } catch (_) {
    previewStream.getAudioTracks().forEach((t) => {
      t.enabled = !micMuted;
    });
  }
  previewStream.getVideoTracks().forEach((t) => {
    t.enabled = !camOff;
  });

  try { stopLocalCanvasPreview(); } catch (_) {}
  try {
    const c = $("local-preview-canvas");
    if (c) {
      c.hidden = true;
      c.classList.remove("is-active");
      c.style.cssText = "display:none!important;visibility:hidden!important;z-index:-1!important;";
    }
    $("tile-local")?.classList.remove("local-canvas-preview");
  } catch (_) {}

  const local = $("local");
  if (local) {
    prepareVideoEl(local, { muted: true });
    local.srcObject = previewStream;
    prepareVideoEl(local, { muted: true });
    try {
      await local.play();
    } catch (_) {
      setTimeout(() => playVideoEl(local), 100);
    }
  }
  showEnableCamButton(false, _t("local.emptySub"));
  setLocalEmpty(false);
  try { markLocalFeedActive(true); } catch (_) {}
  try { clearStuckLocalBlurCanvas(); } catch (_) {}

  await startMeter(previewStream);
  updateSideIcons();
  if (!(ws && ws.readyState === WebSocket.OPEN)) {
    setStatus(_t("status.previewOn"));
  }
  log(_t("log.previewStart"));
  await resumeMeterCtx();

  const vTrack = previewStream.getVideoTracks()[0];
  const aTrack = previewStream.getAudioTracks()[0];
  const vId = vTrack?.getSettings?.().deviceId || null;
  const aId = aTrack?.getSettings?.().deviceId || null;
  persistLastMediaDevices(previewStream);
  try {
    if (vTrack?.label) {
      setStatus((_t("status.previewOn") || "Camera on") + " · " + String(vTrack.label).slice(0, 32));
    }
  } catch (_) {}

  for (const pc of peerPcs.values()) {
    pc.setLocalStream(previewStream);
    await pc.syncLocalTracksToPc();
  }
  await pushOutboundVideoTracks();
  try {
    const el = $("local");
    if (el && previewStream) {
      if (el.srcObject !== previewStream) el.srcObject = previewStream;
      playVideoEl(el);
    }
  } catch (_) {}

  await refreshDevices().catch(() => {});
  if (vId && $("sel-camera") && [...$("sel-camera").options].some((o) => o.value === vId)) {
    $("sel-camera").value = vId;
  }
  if (aId && $("sel-mic") && [...$("sel-mic").options].some((o) => o.value === aId)) {
    $("sel-mic").value = aId;
  }
}


/** Android / iOS — stale desktop deviceIds often break getUserMedia. */
function isLikelyMobile() {
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile|webOS|IEMobile/i.test(ua);
}

/** Front (`user`) vs rear (`environment`) — used when starting getUserMedia. */
let cameraFacing = (() => {
  try {
    const f = loadPrefs().cameraFacing;
    if (f === "environment" || f === "user") return f;
  } catch (_) {}
  return "user";
})();
/** When true, do not soft-fallback to the opposite facingMode (user picked front/back). */
let facingModeStrict = false;

/**
 * Infer facingMode from a device label (iOS: "Front Camera" / "Back Camera").
 * @returns {"user"|"environment"|""}
 */
function inferFacingFromLabel(label) {
  const s = String(label || "").toLowerCase();
  if (!s) return "";
  // Rear / world-facing first (avoid "front" false positives)
  if (
    /\b(back|rear|environment|world|outer|задн|задня|сзади|trasera|arrière|hinten)\b/i.test(
      s
    )
  ) {
    return "environment";
  }
  if (
    /\b(front|user|face|facetime|selfie|передн|передня|фронт|frontal|avant|vorder)\b/i.test(
      s
    )
  ) {
    return "user";
  }
  return "";
}

/** Label for the currently selected camera option (or given deviceId). */
function cameraOptionLabel(deviceId) {
  const sel = $("sel-camera");
  if (!sel) return "";
  const id = deviceId != null ? String(deviceId) : sel.value || "";
  const opt = [...(sel.options || [])].find((o) => o.value === id);
  return (opt?.textContent || opt?.label || "").trim();
}

/**
 * Apply camera choice from Settings / select: set facing for mobile + prefs.
 * Critical for iPhone — mobile GUM was ignoring deviceId and always used front.
 */
function applyCameraChoice(deviceId) {
  const id = String(deviceId || "").trim();
  const label = cameraOptionLabel(id);
  // Prefer non-Kiyo on Linux when user picked nothing useful — but honor explicit pick
  const face = inferFacingFromLabel(label);
  if (face === "environment" || face === "user") {
    cameraFacing = face;
    facingModeStrict = true; // don't fall back to the other lens
  } else if (id) {
    // Unknown label but explicit pick — prefer deviceId path, keep last facing
    facingModeStrict = false;
  }
  // Explicit pick: force this device next startPreview
  forceCameraDeviceId = id || null;
  if (id) {
    try {
      const failed = loadFailedCameraIds();
      if (failed.has(id)) {
        failed.delete(id);
        sessionStorage.setItem(
          LOCAL_CAM_FAILED_KEY,
          JSON.stringify([...failed])
        );
      }
    } catch (_) {}
    localCameraCycleTried.delete(id);
  }
  try {
    const patch = {
      cameraId: id || "",
      cameraFacing: cameraFacing === "environment" ? "environment" : "user",
    };
    if (label) patch.cameraLabel = label;
    savePrefs(patch);
  } catch (_) {}
  try {
    syncCamFacingButtons?.();
  } catch (_) {}
  return { id, label, face: cameraFacing };
}

/** True if this deviceId is known for GUM on this device (select or last enum). */
function isKnownCameraId(deviceId) {
  return isKnownDeviceId(deviceId, "videoinput");
}
function isKnownMicId(deviceId) {
  return isKnownDeviceId(deviceId, "audioinput");
}

/** Prefer mirrored selfie preview (true) or natural left/right (false). Reverse toggles this. */
function getLocalMirrored() {
  const v = loadPrefs().localMirrored;
  return v !== false && v !== 0 && v !== "0";
}

function applyLocalMirrorClass() {
  const mirrored = getLocalMirrored();
  const local = $("local");
  if (local) {
    // is-unmirrored = natural orientation (as others typically see you)
    local.classList.toggle("is-unmirrored", !mirrored);
    // Keep facing-environment in sync for any residual CSS, but Reverse no longer switches cams
    try {
      const face = previewStream
        ?.getVideoTracks?.()?.[0]
        ?.getSettings?.()?.facingMode;
      if (face === "environment" || face === "user") {
        local.classList.toggle("facing-environment", face === "environment");
        cameraFacing = face;
      }
    } catch (_) {}
  }
  const canvas = $("local-preview-canvas");
  if (canvas) canvas.classList.toggle("is-unmirrored", !mirrored);
  const pip = $("local-pip-mirror");
  if (pip) pip.classList.toggle("is-unmirrored", !mirrored);
  const btn = $("btn-flip-cam");
  if (btn) {
    btn.classList.toggle("is-active", !mirrored);
    btn.setAttribute("aria-pressed", mirrored ? "false" : "true");
  }
}

function currentTrackFacingMode() {
  try {
    const face = previewStream
      ?.getVideoTracks?.()?.[0]
      ?.getSettings?.()?.facingMode;
    if (face === "environment" || face === "user") return face;
  } catch (_) {}
  return "";
}

/**
 * Pick a camera deviceId for the requested facing when facingMode alone is weak (desktop).
 * Heuristic: labels with "back/rear/environment" → environment; front/user/facetime → user.
 */
function findDeviceIdForFacing(wantFace) {
  const sel = $("sel-camera");
  if (!sel || !sel.options?.length) return "";
  const wantEnv = wantFace === "environment";
  const score = (label) => {
    const s = String(label || "").toLowerCase();
    if (!s) return 0;
    if (wantEnv) {
      if (/back|rear|environment|world|outer|главн|задн/i.test(s)) return 3;
      if (/front|user|face|facetime|передн|селф/i.test(s)) return -2;
    } else {
      if (/front|user|face|facetime|передн|селф|integrated/i.test(s)) return 3;
      if (/back|rear|environment|world|outer|задн/i.test(s)) return -2;
    }
    return 0;
  };
  let best = "";
  let bestScore = 0;
  for (const opt of sel.options) {
    const sc = score(opt.textContent || opt.label || opt.value);
    if (sc > bestScore) {
      bestScore = sc;
      best = opt.value || "";
    }
  }
  return bestScore > 0 ? best : "";
}

/** Camera resolution presets (height-based, 16:9-ish). */
const VIDEO_RES_PRESETS = {
  auto: null, // device-aware defaults below
  "360": { width: 640, height: 360, frameRate: 24 },
  "480": { width: 854, height: 480, frameRate: 28 },
  "720": { width: 1280, height: 720, frameRate: 30 },
  "1080": { width: 1920, height: 1080, frameRate: 30 },
};

function normalizeVideoResolution(raw) {
  const s = String(raw || "auto").toLowerCase().trim();
  if (s === "360" || s === "480" || s === "720" || s === "1080" || s === "auto") return s;
  return "auto";
}

function getVideoResolutionPref() {
  return normalizeVideoResolution(loadPrefs().videoResolution);
}

function videoResLabel(id) {
  const k = normalizeVideoResolution(id);
  if (k === "auto") {
    // Hint effective auto target on mobile data (does not change explicit presets)
    if (isLikelyMobile() && isOnCellular()) {
      return (
        (_t("settings.resAuto") || "Auto") +
        " · " +
        (_t("settings.resAutoCellular") || "~480p on data")
      );
    }
    return _t("settings.resAuto") || "Auto";
  }
  if (k === "360") return _t("settings.res360") || "360p · low data";
  if (k === "480") return _t("settings.res480") || "480p · balanced";
  if (k === "720") return _t("settings.res720") || "720p · HD";
  if (k === "1080") return _t("settings.res1080") || "1080p · max";
  return k;
}

/**
 * Ideal/max constraints for a named resolution, plus a softer fallback size.
 * @returns {{ primary: object, fallback: object }}
 */
function videoSizeForPref(pref) {
  const id = normalizeVideoResolution(pref);
  if (id !== "auto" && VIDEO_RES_PRESETS[id]) {
    const p = VIDEO_RES_PRESETS[id];
    const primary = {
      width: { ideal: p.width, max: p.width },
      height: { ideal: p.height, max: p.height },
      frameRate: { ideal: p.frameRate, max: 30 },
    };
    // Step down one rung if device rejects exact size
    const order = ["360", "480", "720", "1080"];
    const idx = order.indexOf(id);
    const lower = idx > 0 ? VIDEO_RES_PRESETS[order[idx - 1]] : VIDEO_RES_PRESETS["360"];
    const fallback = {
      width: { ideal: lower.width, max: p.width },
      height: { ideal: lower.height, max: p.height },
      frameRate: { ideal: Math.min(24, lower.frameRate), max: 30 },
    };
    return { primary, fallback };
  }
  // Auto: desktop 720p; mobile Wi‑Fi ~540p; mobile cellular ~480p (saves data/CPU)
  if (isLikelyMobile()) {
    if (isOnCellular()) {
      return {
        primary: {
          width: { ideal: 854, max: 960 },
          height: { ideal: 480, max: 540 },
          frameRate: { ideal: 24, max: 28 },
        },
        fallback: {
          width: { ideal: 640, max: 854 },
          height: { ideal: 360, max: 480 },
          frameRate: { ideal: 20, max: 24 },
        },
      };
    }
    return {
      primary: {
        width: { ideal: 960, max: 1280 },
        height: { ideal: 540, max: 720 },
        frameRate: { ideal: 28, max: 30 },
      },
      fallback: {
        width: { ideal: 640, max: 960 },
        height: { ideal: 480, max: 540 },
        frameRate: { ideal: 24, max: 30 },
      },
    };
  }
  return {
    primary: {
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
      frameRate: { ideal: 30, max: 30 },
    },
    fallback: {
      width: { ideal: 640, max: 960 },
      height: { ideal: 480, max: 540 },
      frameRate: { ideal: 24, max: 30 },
    },
  };
}

/**
 * Build getUserMedia attempts.
 * - Desktop: deviceId first.
 * - Mobile: if user picked a known camera (Settings), try that deviceId first,
 *   then facingMode (user/environment) so rear cam works on iPhone.
 * Uses Settings → Camera resolution when set.
 */
function buildMediaAttempts(videoDeviceId, audioDeviceId) {
  // Low capture latency + AEC — reduces “sound lags picture” (AEC alone can add 20–80ms)
  const audioBase =
    typeof lowLatencyAudioConstraints === "function"
      ? lowLatencyAudioConstraints()
      : {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          latency: { ideal: 0.01, max: 0.04 },
        };
  const { primary: videoHi, fallback: videoMid } = videoSizeForPref(getVideoResolutionPref());
  const attempts = [];
  const mobile = isLikelyMobile();
  const face =
    cameraFacing === "environment" ? "environment" : "user";
  const faceAlt = face === "user" ? "environment" : "user";

  // Only trust deviceIds that are in the live select (avoids stale desktop ids on phone)
  const camId =
    videoDeviceId && (!mobile || isKnownCameraId(videoDeviceId))
      ? videoDeviceId
      : null;
  const micId = audioDeviceId || null;

  // Explicit camera pick: deviceId first (iOS lists Front/Back with stable ids after permission)
  if (camId) {
    attempts.push({
      video: { deviceId: { exact: camId }, ...videoHi },
      audio: micId ? { deviceId: { ideal: micId }, ...audioBase } : audioBase,
    });
    attempts.push({
      video: { deviceId: { ideal: camId }, ...videoHi },
      audio: micId ? { deviceId: { ideal: micId }, ...audioBase } : audioBase,
    });
    attempts.push({
      video: { deviceId: { ideal: camId }, ...videoMid },
      audio: micId ? { deviceId: { ideal: micId }, ...audioBase } : true,
    });
    attempts.push({
      video: { deviceId: { ideal: camId } },
      audio: true,
    });
    // Pair deviceId with facingMode when we know front/back (helps some WebKits)
    attempts.push({
      video: {
        deviceId: { ideal: camId },
        facingMode: { ideal: face },
        ...videoMid,
      },
      audio: true,
    });
  }

  // Mobile / strict facing: facingMode path (rear = environment)
  if (mobile || facingModeStrict || !camId) {
    if (facingModeStrict) {
      attempts.push({
        video: { facingMode: { exact: face }, ...videoHi },
        audio: audioBase,
      });
      attempts.push({
        video: { facingMode: { exact: face }, ...videoMid },
        audio: audioBase,
      });
      attempts.push({
        video: { facingMode: { exact: face } },
        audio: true,
      });
    }
    // Prefer ideal (not exact) — iOS often rejects exact facingMode on cold start
    attempts.push({
      video: { facingMode: { ideal: face }, ...videoHi },
      audio: audioBase,
    });
    attempts.push({
      video: { facingMode: face, ...videoHi },
      audio: audioBase,
    });
    attempts.push({
      video: { facingMode: { ideal: face }, ...videoMid },
      audio: audioBase,
    });
    attempts.push({
      video: { facingMode: { ideal: face } },
      audio: true,
    });
    // Soft fallbacks only when not forcing front/back (would undo the switch)
    if (!facingModeStrict) {
      attempts.push({
        video: { facingMode: { ideal: faceAlt }, ...videoMid },
        audio: audioBase,
      });
      attempts.push({ video: true, audio: true });
      attempts.push({ video: { facingMode: face }, audio: false });
      attempts.push({ video: true, audio: false });
    } else {
      attempts.push({
        video: { facingMode: { ideal: face } },
        audio: false,
      });
    }
    attempts.push({ video: false, audio: audioBase });
    if (mobile) return attempts;
  }

  if (camId || micId) {
    attempts.push({
      video: camId
        ? { deviceId: { exact: camId }, ...videoHi }
        : { ...videoHi },
      audio: micId
        ? { deviceId: { exact: micId }, ...audioBase }
        : audioBase,
    });
    attempts.push({
      video: camId
        ? { deviceId: { ideal: camId }, ...videoHi }
        : { ...videoHi },
      audio: micId
        ? { deviceId: { ideal: micId }, ...audioBase }
        : audioBase,
    });
    attempts.push({
      video: camId
        ? { deviceId: { ideal: camId }, ...videoMid }
        : { ...videoMid },
      audio: micId
        ? { deviceId: { ideal: micId }, ...audioBase }
        : audioBase,
    });
    if (camId) {
      attempts.push({
        video: { deviceId: { ideal: camId }, ...videoMid },
        audio: false,
      });
    }
    if (micId) {
      attempts.push({
        video: false,
        audio: { deviceId: { ideal: micId }, ...audioBase },
      });
    }
  }
  // Cold start / fallback ladder
  attempts.push({ video: { ...videoHi }, audio: audioBase });
  attempts.push({ video: { ...videoMid }, audio: audioBase });
  attempts.push({ video: true, audio: audioBase });
  attempts.push({ video: true, audio: true });
  attempts.push({ video: true, audio: false });
  attempts.push({ video: false, audio: audioBase });
  return attempts;
}

function renderResolutionChoiceList() {
  const list = $("settings-resolution-list");
  if (!list) return;
  const cur = getVideoResolutionPref();
  const opts = [
    { id: "auto", sub: _t("settings.resAutoSub") || "Device default · recommended" },
    { id: "360", sub: _t("settings.res360Sub") || "640×360 · weakest uplink" },
    { id: "480", sub: _t("settings.res480Sub") || "854×480 · mobile-friendly" },
    { id: "720", sub: _t("settings.res720Sub") || "1280×720 · sharp HD" },
    { id: "1080", sub: _t("settings.res1080Sub") || "1920×1080 · heavy on CPU/upload" },
  ];
  list.innerHTML = opts
    .map((o) => {
      const selected = o.id === cur;
      return `<button type="button" class="settings-row settings-choice ${
        selected ? "is-selected" : ""
      }" data-res-pick="${escapeAttr(o.id)}">
        <span class="row-left" style="flex-direction:column;align-items:flex-start;gap:0.1rem">
          <span>${escapeHtml(videoResLabel(o.id))}</span>
          <span class="theme-pick-sub" style="font-size:0.72rem;color:#8b9bb0;font-weight:500">${escapeHtml(
            o.sub
          )}</span>
        </span>
        <span class="choice-check">✓</span>
      </button>`;
    })
    .join("");
  list.querySelectorAll("[data-res-pick]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = normalizeVideoResolution(btn.getAttribute("data-res-pick"));
      savePrefs({ videoResolution: id });
      syncSettingsSummary();
      setStatus(
        (_t("settings.resApplied") || "Camera resolution") + ": " + videoResLabel(id)
      );
      try {
        stopPreview();
        await startPreview();
        // Push new tracks into active peer connections
        for (const pc of peerPcs?.values?.() || []) {
          try {
            if (previewStream && pc.setLocalStream) pc.setLocalStream(previewStream);
            if (pc.syncLocalTracksToPc) await pc.syncLocalTracksToPc();
          } catch (_) {}
        }
      } catch (e) {
        console.warn("[resolution]", e);
        setStatus(_t("local.camConstraints") || "Could not apply that resolution");
      }
      showSettingsView("devices");
    });
  });
}

/** After permission denied, stop auto-retry spam (Android locks up). */
let mediaPermissionDenied = false;
let mediaPreviewBusy = false;

function showEnableCamButton(show, message) {
  const btn = $("btn-enable-cam");
  const sub = $("local-empty-sub");
  const help = $("local-cam-help");
  if (btn) btn.hidden = !show;
  if (sub && message) sub.textContent = message;
  if (help) {
    help.hidden = !show;
    if (show) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      let tip =
        _t("local.permHelpGeneric") ||
        "Allow camera & microphone for this site in your browser settings, then tap Enable again.";
      if (isIOS || isSafari) {
        tip =
          _t("local.permHelpIos") ||
          "iPhone/iPad: Settings → Safari → Camera & Microphone → Allow, then reload and tap Enable.";
      } else if (isAndroid) {
        tip =
          _t("local.permHelpAndroid") ||
          "Android: tap the lock icon in the address bar → Permissions → Camera & Mic → Allow, then Enable.";
      } else {
        tip =
          _t("local.permHelpDesktop") ||
          "Desktop: click the camera/lock icon in the address bar → Allow camera & mic, then Enable.";
      }
      help.textContent = tip;
    }
  }
  if (show) setLocalEmpty(true);
}

function friendlyMediaError(e) {
  const name = e?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return (
      _t("local.permDenied") ||
      "Camera blocked — allow in browser settings, then tap Enable"
    );
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return _t("local.noDevice") || "No camera or microphone found";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return _t("local.camBusy") || "Camera is in use by another app";
  }
  if (name === "OverconstrainedError") {
    return _t("local.camConstraints") || "Could not apply that resolution";
  }
  return _t("local.enableHint") || "Allow camera & mic when prompted";
}

async function startPreview() {
  if (mediaPreviewBusy) return;
  if (mediaPermissionDenied) {
    showEnableCamButton(true, _t("local.permDenied"));
    return;
  }
  mediaPreviewBusy = true;
  try {
    if (!window.isSecureContext) {
      throw new Error("need HTTPS for camera");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("getUserMedia not available (need https or localhost)");
    }

    let { videoDeviceId, audioDeviceId } = selectedDevices();
    const prefs = loadPrefs();
    const mobile = isLikelyMobile();
    // Warm device list so saved id/label restore works before Settings was opened
    try {
      if (!lastDeviceEnum.at || Date.now() - lastDeviceEnum.at > 15000) {
        const { cameras, mics, speakers } = await listMediaDevices();
        rememberDeviceEnum(cameras, mics, speakers);
      }
    } catch (_) {}
    // Explicit force (user just picked) wins; else restore last session devices
    if (forceCameraDeviceId) {
      videoDeviceId = forceCameraDeviceId;
    } else if (!videoDeviceId) {
      const savedCam = resolveSavedDeviceId(
        "videoinput",
        "cameraId",
        "cameraLabel"
      );
      if (savedCam) videoDeviceId = savedCam;
    }
    if (!audioDeviceId) {
      const savedMic = resolveSavedDeviceId("audioinput", "micId", "micLabel");
      if (savedMic) audioDeviceId = savedMic;
    }
    // Drop ids that are not in the live enum (stale after OS reinstall / other machine)
    if (
      videoDeviceId &&
      lastDeviceEnum.videoinput.length &&
      !isKnownCameraId(videoDeviceId)
    ) {
      // Keep trying via GUM ideal if we only have a label-less empty enum
      if (lastDeviceEnum.videoinput.some((d) => d.label)) {
        videoDeviceId = null;
      }
    }
    if (
      audioDeviceId &&
      lastDeviceEnum.audioinput.length &&
      !isKnownMicId(audioDeviceId) &&
      lastDeviceEnum.audioinput.some((d) => d.label)
    ) {
      audioDeviceId = null;
    }
    if (mobile && videoDeviceId && !isKnownCameraId(videoDeviceId)) {
      videoDeviceId = null;
    }
    // Desktop Linux: prefer USB over black Kiyo ONLY when user has no saved cam
    // (do not steal the camera they used last time)
    if (
      !mobile &&
      /Linux/i.test(navigator.userAgent || "") &&
      !forceCameraDeviceId &&
      !prefs.cameraId &&
      !prefs.cameraLabel
    ) {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        const usb = all.find(
          (d) =>
            d.kind === "videoinput" &&
            d.deviceId &&
            d.label &&
            !/kiyo/i.test(d.label) &&
            /usb|webcam|vitade|microdia|c9\d\d|hd /i.test(d.label)
        );
        if (usb && !videoDeviceId) {
          videoDeviceId = usb.deviceId;
          try {
            if ($("sel-camera")) $("sel-camera").value = usb.deviceId;
          } catch (_) {}
        }
      } catch (_) {}
    }

    // Restore last facing preference (rear cam) when prefs have it
    try {
      const savedFace = prefs.cameraFacing;
      if (savedFace === "environment" || savedFace === "user") {
        if (!inferFacingFromLabel(cameraOptionLabel(videoDeviceId))) {
          cameraFacing = savedFace;
        }
      }
    } catch (_) {}
    // If select has a camera with a known front/back label, prefer that facing
    if (videoDeviceId) {
      const face = inferFacingFromLabel(cameraOptionLabel(videoDeviceId));
      if (face) {
        cameraFacing = face;
        facingModeStrict = true;
      }
    }

    // Release current tracks so the new device can open (exclusive cam/mic locks)
    if (previewStream) {
      stopMeter();
      previewStream.getTracks().forEach((tr) => {
        try {
          tr.stop();
        } catch (_) {}
      });
      previewStream = null;
    }

    let stream = null;
    const attempts = buildMediaAttempts(videoDeviceId, audioDeviceId);
    let lastErr = null;
    for (const c of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(c);
        break;
      } catch (e) {
        lastErr = e;
        // Permission denied: don't keep hammering
        if (e && (e.name === "NotAllowedError" || e.name === "PermissionDeniedError")) {
          break;
        }
      }
    }
    if (!stream) throw lastErr || new Error("getUserMedia failed");

    // Linux: if stream is Kiyo and USB exists, reopen USB
    if (!mobile && /Linux/i.test(navigator.userAgent || "") && !forceCameraDeviceId) {
      try {
        const lab = stream.getVideoTracks()?.[0]?.label || "";
        if (/kiyo/i.test(lab)) {
          const all = await navigator.mediaDevices.enumerateDevices();
          const usb = all.find(
            (d) =>
              d.kind === "videoinput" &&
              d.deviceId &&
              d.label &&
              !/kiyo/i.test(d.label) &&
              /usb|webcam|vitade|microdia|c9\d\d|hd /i.test(d.label)
          );
          if (usb) {
            stream.getTracks().forEach((t) => {
              try { t.stop(); } catch (_) {}
            });
            await new Promise((r) => setTimeout(r, 300));
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: usb.deviceId },
                width: { ideal: 640 },
                height: { ideal: 480 },
              },
              audio: true,
            });
            try {
              savePrefs({ cameraId: usb.deviceId });
              if ($("sel-camera")) $("sel-camera").value = usb.deviceId;
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    // If we only got one kind, try to add the other
    if (!stream.getVideoTracks().length) {
      try {
        const face =
          cameraFacing === "environment" ? "environment" : "user";
        const vConstraints =
          videoDeviceId && isKnownCameraId(videoDeviceId)
            ? { video: { deviceId: { ideal: videoDeviceId } }, audio: false }
            : mobile
              ? { video: { facingMode: { ideal: face } }, audio: false }
              : {
                  video: videoDeviceId
                    ? { deviceId: { ideal: videoDeviceId } }
                    : true,
                  audio: false,
                };
        const v = await navigator.mediaDevices.getUserMedia(vConstraints);
        v.getVideoTracks().forEach((t) => stream.addTrack(t));
      } catch (_) {}
    }
    if (!stream.getAudioTracks().length) {
      try {
        const a = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: audioDeviceId
            ? {
                deviceId: { ideal: audioDeviceId },
                echoCancellation: true,
                noiseSuppression: true,
              }
            : true,
        });
        a.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch (_) {}
    }

    if (!stream.getVideoTracks().length && !stream.getAudioTracks().length) {
      throw lastErr || new Error("no media tracks");
    }

    mediaPermissionDenied = false;
    showEnableCamButton(false, _t("local.emptySub"));
    await attachLocalStream(stream);
    applyLocalMirrorClass();
    // Verify we got the requested facing / device; log soft fallbacks
    {
      const gotTrack = stream.getVideoTracks()[0];
      const gotV = gotTrack?.getSettings?.().deviceId;
      const gotFace = gotTrack?.getSettings?.()?.facingMode || "";
      const gotA = stream.getAudioTracks()[0]?.getSettings?.().deviceId;
      if (gotFace === "environment" || gotFace === "user") {
        cameraFacing = gotFace;
      }
      if (videoDeviceId && gotV && gotV !== videoDeviceId) {
        log(_t("device.camFallback") || "camera fell back to another device");
      }
      if (
        facingModeStrict &&
        cameraFacing === "environment" &&
        gotFace &&
        gotFace !== "environment"
      ) {
        log(_t("device.camFallback") || "camera fell back to another device");
        setStatus(
          _t("device.rearCamFail") ||
            "Could not open rear camera — try again or check permissions"
        );
      } else if (facingModeStrict) {
        // Successful strict switch — clear strict so later cold starts can soft-fallback
        // Keep cameraFacing so next startPreview prefers the same lens
      }
      if (audioDeviceId && gotA && gotA !== audioDeviceId) {
        log(_t("device.micFallback") || "mic fell back to another device");
      }
      // Persist what we actually opened (id + label for next visit)
      try {
        savePrefs({
          cameraFacing:
            cameraFacing === "environment" ? "environment" : "user",
        });
        persistLastMediaDevices(stream);
        if (gotV && $("sel-camera")) {
          const sel = $("sel-camera");
          if ([...sel.options].some((o) => o.value === gotV)) sel.value = gotV;
        }
        if (gotA && $("sel-mic")) {
          const sel = $("sel-mic");
          if ([...sel.options].some((o) => o.value === gotA)) sel.value = gotA;
        }
      } catch (_) {}
    }
  } catch (e) {
    const name = e?.name || "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      mediaPermissionDenied = true;
    }
    // Only clear cameraId if it is no longer a known device (stale cross-device pref)
    if (name === "OverconstrainedError" && isLikelyMobile()) {
      try {
        const prefs = loadPrefs();
        if (prefs.cameraId && !isKnownCameraId(prefs.cameraId)) {
          savePrefs({ cameraId: "" });
        }
      } catch (_) {}
    }
    log(_t("log.previewFail", { e: (e && (e.message || e.name)) || e }));
    setStatus(_t("status.previewFailed"));
    showEnableCamButton(true, friendlyMediaError(e));
  } finally {
    mediaPreviewBusy = false;
    facingModeStrict = false; // one-shot for the switch attempt
  }
}



function stopPreview() {
  stopMeter();
  try {
    stopLocalCanvasPreview();
  } catch (_) {}
  if (previewStream) {
    previewStream.getTracks().forEach((tr) => tr.stop());
    previewStream = null;
  }
  if ($("local")) $("local").srcObject = null;
  setLocalEmpty(true);
  updateSideIcons();
  log(_t("log.previewStop"));
  setStatus(matched ? _t("status.matchedPreviewOff") : _t("status.previewOff"));
}

function toggleMicMute() {
  // During debate, non-speakers cannot unmute
  if (debate.active && debate.speakerId && !debateUidEq(debate.speakerId, myUserId)) {
    if (!micMuted) {
      // Allow intentional mute preference while locked, but keep track off
      micMuted = true;
      applyMicTracks();
      updateMicPill(0);
      log(_t("log.micMuted"));
      return;
    }
    setStatus(
      _t("debate.waitTurn") || "Muted until your debate turn"
    );
    return;
  }
  micMuted = !micMuted;
  applyMicTracks();
  updateMicPill(0);
  log(micMuted ? _t("log.micMuted") : _t("log.micUnmuted"));
}

/** Apply mic track enable state (user mute + debate lock). */
function applyMicTracks() {
  const debateLocked =
    !!(debate.active && debate.speakerId && !debateUidEq(debate.speakerId, myUserId));
  const enabled = !micMuted && !debateLocked;
  const tracks = previewStream?.getAudioTracks() || [];
  tracks.forEach((tr) => {
    tr.enabled = enabled;
  });
  for (const pc of peerPcs.values()) {
    pc.setMicEnabled?.(enabled);
  }
  updateSideIcons();
  try {
    document.body.classList.toggle("debate-active", !!debate.active);
    document.body.classList.toggle("debate-muted-turn", debateLocked);
  } catch (_) {}
}

/** Camera on/off UI removed — always keep preview on; use Hide for privacy. */
function toggleCam() {
  // no-op (legacy callers / old shortcuts)
  if (camOff) {
    camOff = false;
    previewStream?.getVideoTracks().forEach((tr) => {
      tr.enabled = true;
    });
    pushOutboundVideoTracks().catch(() => {});
    updateSideIcons();
  }
}

async function applySpeaker() {
  const remote = $("remote");
  let id = $("sel-speaker")?.value || "";
  if (!id) {
    id =
      resolveSavedDeviceId("audiooutput", "speakerId", "speakerLabel") || "";
    if (id && $("sel-speaker") && isKnownDeviceId(id, "audiooutput")) {
      $("sel-speaker").value = id;
    }
  }
  persistLastMediaDevices(null, { speakerId: id || "" });
  const targets = ["remote", "remote2", "remote-third", "local"]
    .map((elId) => $(elId))
    .filter(Boolean);
  if (id) {
    for (const el of targets) {
      if (typeof el.setSinkId !== "function") continue;
      try {
        await el.setSinkId(id);
      } catch (e) {
        if (el === remote) {
          log(_t("log.speakerFail", { e: e.message || e }));
        }
      }
    }
  }
}

function applyRemoteVolume() {
  const el = $("remote-vol") || $("remote-vol-sheet");
  // Side-rail slider drives main remote volume (and legacy prefs)
  const railVol = Number(el?.value ?? peerVolByEl.remote ?? 100);
  if (el) {
    peerVolByEl.remote = railVol;
    syncVolumeSliders(railVol);
    savePrefs({ volume: railVol });
  }
  for (const id of ["remote", "remote2", "remote-third"]) {
    const remote = $(id);
    if (!remote) continue;
    const tileMuted =
      !!peerMutedByEl[id] || (id === "remote" && partnerMuted);
    const vol = peerVolByEl[id] ?? 100;
    remote.volume = tileMuted ? 0 : vol / 100;
    remote.muted = tileMuted;
  }
  // Keep per-peer volume inputs painted
  try {
    setPeerVolUi("remote", peerVolByEl.remote);
    setPeerVolUi("remote2", peerVolByEl.remote2);
    setPeerVolUi("remote-third", peerVolByEl["remote-third"]);
  } catch (_) {}
}

/** Last match session that already got a full-volume reset (avoid re-blast on party re-search Matched). */
let lastVolumeResetKey = "";

/**
 * New conversationalist → partner volume max (100) and unmuted, even if the previous
 * call had the slider lowered or mute on.
 */
function resetPartnerVolumeForNewMatch(msg) {
  const key =
    (msg && (msg.session_id || msg.session_key)) ||
    `${msg?.mode || ""}:${msg?.partner_short || ""}:${Date.now()}`;
  // Party re-search re-sends Matched with same party-search session — skip
  if (key && key === lastVolumeResetKey) return;
  // Only reset when a stranger/party opponent is present, or classic solo/friend start
  const peers = Array.isArray(msg?.peers) ? msg.peers : [];
  const hasOpponent = peers.some(
    (p) => p.role === "stranger" || p.role === "party"
  );
  const mode = msg?.mode || "solo";
  const onlyTeammateBrowse =
    mode === "party_browse" &&
    peers.length > 0 &&
    peers.every(
      (p) => p.role === "friend" || p.role === "teammate" || p.role === "party_mate"
    );
  if (onlyTeammateBrowse && !hasOpponent) {
    // Still with same co-search partner, hunting for 3rd — keep their volume
    return;
  }
  lastVolumeResetKey = key;
  partnerMuted = false;
  peerMutedByEl.remote = false;
  peerMutedByEl.remote2 = false;
  peerMutedByEl["remote-third"] = false;
  peerVolByEl.remote = 100;
  peerVolByEl.remote2 = 100;
  peerVolByEl["remote-third"] = 100;
  // Don't force-clear blur (intro blur may still apply)
  syncVolumeSliders(100);
  applyRemoteVolume();
  updateSideIcons();
  syncAllPeerMediaChrome();
}

function togglePartnerMute() {
  partnerMuted = !partnerMuted;
  peerMutedByEl.remote = partnerMuted;
  updateSideIcons();
  applyRemoteVolume();
  setPeerMuteUi("remote", partnerMuted);
  log(partnerMuted ? _t("log.partnerMuted") : _t("log.partnerUnmuted"));
}

function showSettingsView(name) {
  // keep facing + audio toggles painted when opening device/connection pages
  try {
    if (name === "camera" || name === "devices") {
      syncCamFacingButtons();
      syncLowLatencyAudioToggles();
    }
    if (name === "connection" || name === "devices") {
      syncLowLatencyAudioToggles();
      syncPreferDirectToggle();
    }
  } catch (_) {}
  // original body continues below — patch inserts at top of function
  const views = document.querySelectorAll("#settings-sheet .settings-view");
  const targetId = `settings-view-${name}`;
  views.forEach((v) => {
    const on = v.id === targetId;
    v.hidden = !on;
    v.setAttribute("aria-hidden", on ? "false" : "true");
    v.classList.toggle("is-active", on);
  });
  if (name === "main" || name === "devices") syncSettingsSummary();
  if (name === "lang") syncLangChoices();
  if (name === "theme") syncThemeChoices();
  if (name === "flag") {
    const search = $("flag-search");
    if (search) search.value = "";
    renderFlagPickerList("");
  }
  if (name === "camera" || name === "mic" || name === "speaker") {
    renderDeviceChoiceList(name);
  }
  if (name === "resolution") {
    renderResolutionChoiceList();
  }
  if (name === "connection") {
    maybeStartConnDetailsLive();
    refreshPathStatsUi();
    syncPreferDirectToggle();
  } else {
    stopConnDetailsLive();
  }
  if (name === "about") refreshAboutPanel();
}

/** About & legal hero: version + connected hub host */
function refreshAboutPanel() {
  const verEl = $("about-version");
  const hubEl = $("about-hub");
  if (verEl) {
    const ver =
      (typeof window !== "undefined" && window.RULETKA_BUILD) ||
      document.querySelector('script[src*="live.js"]')?.src?.match(/[?&]v=([^&]+)/)?.[1] ||
      "live";
    verEl.textContent = "v" + String(ver).replace(/^v/, "");
    verEl.title = _t("settings.aboutVersionTitle") || "Client cache version";
  }
  if (hubEl) {
    let base = location.origin;
    try {
      if (typeof RuletHub !== "undefined" && RuletHub.base) base = RuletHub.base();
    } catch (_) {}
    let host = "";
    try {
      host = new URL(base).host;
    } catch {
      host = String(base || "").replace(/^https?:\/\//, "");
    }
    if (host) {
      hubEl.hidden = false;
      hubEl.textContent = host;
      hubEl.title = (_t("hub.current") || "Match hub") + ": " + base;
    } else {
      hubEl.hidden = true;
    }
  }
}

function syncPreferDirectToggle() {
  const prefs = loadPrefs();
  const chk = $("chk-prefer-direct");
  if (chk) chk.checked = !!prefs.preferDirectOnly;
  const hide = $("chk-hide-ip");
  if (hide) hide.checked = !!prefs.hideIpRelayOnly;
}

function syncHideIpToggle() {
  syncPreferDirectToggle();
}

/** Low-latency audio (lipsync) — default off so NS/AGC stay on. */
function isLowLatencyAudioPref() {
  const p = loadPrefs();
  if (p.lowLatencyAudio === true || p.lowLatencyAudio === 1) return true;
  return false;
}

/**
 * Multi-remote audio (1v2 / 2v2 / trio): force full mic processing + headphones tip.
 * Two+ remotes into speakers without NS/AGC gets muddy and echos easily.
 */
let multiPeerAudioActive = false;

function countRemoteAudioPeers() {
  let n = 0;
  try {
    for (const pc of peerPcs.values()) {
      if (!pc) continue;
      // Count peers that are not pure local-only; any remote PC counts
      n += 1;
    }
  } catch (_) {}
  return n;
}

/** True for 1v2, 2v2, or friend+stranger trio (2+ audio paths). */
function isMultiPeerAudioFromMatch(peers) {
  if (!peers || !peers.length) return countRemoteAudioPeers() >= 2;
  const opponents = peers.filter(
    (p) => p && (p.role === "stranger" || p.role === "party")
  );
  const teammates = peers.filter((p) => p && isTeammateRole(p.role));
  // Solo sees 2 opponents → 1v2 or 2v2
  if (opponents.length >= 2) return true;
  // Party member / trio: teammate + stranger
  if (teammates.length >= 1 && opponents.length >= 1) return true;
  // Already connected to 2+ PCs
  if (countRemoteAudioPeers() >= 2) return true;
  // Trio layout with third slot live
  if (trioBrowse && opponents.length >= 1) return true;
  return false;
}

/**
 * Apply full NS+AGC to existing local tracks (and force next getUserMedia).
 */
async function applyFullAudioProcessingToLocal() {
  if (typeof setForceFullAudioProcessing === "function") {
    setForceFullAudioProcessing(true);
  }
  const cons =
    typeof fullProcessingAudioConstraints === "function"
      ? fullProcessingAudioConstraints()
      : {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };
  // Primary local stream on main rtc or any peer
  const streams = new Set();
  try {
    if (rtc && rtc.localStream) streams.add(rtc.localStream);
  } catch (_) {}
  try {
    for (const pc of peerPcs.values()) {
      if (pc && pc.localStream) streams.add(pc.localStream);
    }
  } catch (_) {}
  try {
    const v = $("local");
    if (v && v.srcObject) streams.add(v.srcObject);
  } catch (_) {}
  for (const stream of streams) {
    try {
      for (const track of stream.getAudioTracks?.() || []) {
        try {
          await track.applyConstraints(cons);
        } catch (_) {
          /* some browsers reject partial constraint sets */
        }
      }
    } catch (_) {}
  }
}

function maybeShowMultiPeerHeadphonesTip() {
  try {
    if (sessionStorage.getItem("rulet-multi-audio-tip-v1") === "1") return;
    sessionStorage.setItem("rulet-multi-audio-tip-v1", "1");
  } catch (_) {}
  try {
    if ($("multi-audio-tip")) return;
    const toast = document.createElement("div");
    toast.id = "multi-audio-tip";
    toast.className = "friend-soft-toast post-match-friend-nudge is-force";
    toast.setAttribute("role", "status");
    toast.style.pointerEvents = "auto";
    toast.innerHTML = `
      <strong>${escapeHtml(
        _t("audio.multiPeerTitle") || "Multi-person audio"
      )}</strong>
      <span>${escapeHtml(
        _t("audio.multiPeerBody") ||
          "Noise reduction is on for group calls. Headphones help a lot with echo."
      )}</span>
      <div class="export-nudge-actions" style="margin-top:0.5rem">
        <button type="button" class="pill tight accent" id="btn-multi-audio-ok">${escapeHtml(
          _t("audio.multiPeerOk") || "Got it"
        )}</button>
      </div>`;
    document.body.appendChild(toast);
    trackEvent("multi_audio_tip_show");
    const dismiss = () => {
      try {
        if (toast.parentNode) toast.remove();
      } catch (_) {}
    };
    $("btn-multi-audio-ok")?.addEventListener("click", dismiss);
    setTimeout(dismiss, 12000);
  } catch (_) {}
}

/**
 * Call when match layout has 2+ remotes (1v2, 2v2, trio).
 * @param {object[]} [peers] from matched message
 */
function enterMultiPeerAudioMode(peers) {
  if (!isMultiPeerAudioFromMatch(peers) && countRemoteAudioPeers() < 2) {
    return;
  }
  const was = multiPeerAudioActive;
  multiPeerAudioActive = true;
  // applyConstraints only — do NOT restart getUserMedia mid-call (that
  // stops tracks, glitches senders, and often "craps out" partner audio).
  applyFullAudioProcessingToLocal().catch(() => {});
  if (!was && isLowLatencyAudioPref()) {
    try {
      setStatus(
        _t("audio.multiPeerForced") ||
          "Group call — noise reduction on for clearer audio"
      );
    } catch (_) {}
  }
  // Slightly safer receive buffer when 2+ remotes share one device
  try {
    for (const pc of peerPcs.values()) {
      if (pc?.pc && typeof applyLowLatencyPlayout === "function") {
        applyLowLatencyPlayout(pc.pc, 70);
        pc._lastPlayoutTarget = 70;
      }
    }
  } catch (_) {}
  maybeShowMultiPeerHeadphonesTip();
  trackEvent("multi_audio_mode", { peers: countRemoteAudioPeers() });
}

function leaveMultiPeerAudioMode() {
  if (!multiPeerAudioActive) return;
  multiPeerAudioActive = false;
  if (typeof setForceFullAudioProcessing === "function") {
    setForceFullAudioProcessing(false);
  }
  // Leave capture alone mid-session — next Start / device change re-reads prefs.
}

/** Live “what mode am I in?” pills under the low-delay toggle. */
function syncAudioModePills(on) {
  const low = !!on;
  const label = low
    ? _t("settings.audioModeFast") || "Now: low delay · quieter room"
    : _t("settings.audioModeQuiet") || "Now: noise reduction · recommended";
  document.querySelectorAll("[data-audio-mode-pill]").forEach((el) => {
    el.textContent = label;
    el.classList.toggle("is-fast", low);
    el.classList.toggle("is-quiet", !low);
    el.title = low
      ? _t("settings.audioModeFastTip") ||
        "Mic processing reduced for less lag. Echo/noise may be worse."
      : _t("settings.audioModeQuietTip") ||
        "Noise reduction + echo control on. Best for most people.";
  });
  // Mark parent rows for theme styling
  document.querySelectorAll(".settings-audio-mode-row").forEach((row) => {
    row.classList.toggle("is-low-latency", low);
  });
}

function syncLowLatencyAudioToggles() {
  const on = isLowLatencyAudioPref();
  const a = $("chk-low-latency-audio");
  const b = $("chk-low-latency-audio-conn");
  if (a) a.checked = on;
  if (b) b.checked = on;
  syncAudioModePills(on);
}

function setLowLatencyAudio(on, { restart = true } = {}) {
  savePrefs({ lowLatencyAudio: !!on });
  syncLowLatencyAudioToggles();
  // Tighten/relax receive buffers on live PCs immediately
  for (const pc of peerPcs.values()) {
    try {
      if (pc?.pc && typeof applyLowLatencyPlayout === "function") {
        const tier = pc._qualityTier || "high";
        const ms =
          typeof playoutTargetForTier === "function"
            ? playoutTargetForTier(tier)
            : on
              ? 28
              : 50;
        applyLowLatencyPlayout(pc.pc, ms);
      }
    } catch (_) {}
  }
  setStatus(
    on
      ? _t("settings.lowLatencyAudioOn") ||
          "Low delay on — quieter room works best. Restarting mic…"
      : _t("settings.lowLatencyAudioOff") ||
          "Noise reduction on (recommended). Restarting mic…"
  );
  if (restart) {
    startPreview().catch(() => {});
  }
  trackEvent("low_latency_audio", { on: on ? 1 : 0 });
}

function syncCamFacingButtons() {
  const face = cameraFacing === "environment" ? "environment" : "user";
  $("btn-cam-front")?.classList.toggle("is-active", face === "user");
  $("btn-cam-rear")?.classList.toggle("is-active", face === "environment");
}

/**
 * Explicit Front / Rear switch (reliable on iPhone).
 * @param {"user"|"environment"} face
 */
async function switchCameraFacing(face) {
  const want = face === "environment" ? "environment" : "user";
  cameraFacing = want;
  facingModeStrict = true;
  // Prefer matching deviceId from the list when labels exist
  const id = findDeviceIdForFacing(want);
  if (id && $("sel-camera")) {
    $("sel-camera").value = id;
    applyCameraChoice(id);
  } else {
    try {
      savePrefs({
        cameraFacing: want,
        cameraId: id || loadPrefs().cameraId || "",
      });
    } catch (_) {}
  }
  syncCamFacingButtons();
  setStatus(
    want === "environment"
      ? _t("settings.camSwitchingRear") || "Switching to rear camera…"
      : _t("settings.camSwitchingFront") || "Switching to front camera…"
  );
  trackEvent("cam_facing", { face: want });
  await startPreview();
  applyLocalMirrorClass();
  syncSettingsSummary();
  syncCamFacingButtons();
  const got = currentTrackFacingMode();
  if (got && got !== want) {
    setStatus(
      _t("device.rearCamFail") ||
        "Could not open that camera — check permissions"
    );
  } else {
    setStatus(
      want === "environment"
        ? _t("settings.camRearOn") || "Rear camera"
        : _t("settings.camFrontOn") || "Front camera"
    );
  }
}

/** Update A/V lag chip from active peer stats. */
async function updateAvLagChip() {
  const chip = $("av-lag-chip");
  if (!chip) return;
  if (!matched && !inFriendCall) {
    chip.hidden = true;
    return;
  }
  const pc =
    rtc ||
    [...peerPcs.values()].find((p) => !isTeammateRole(p._role)) ||
    [...peerPcs.values()][0];
  if (!pc || typeof pc.estimateAvPlayoutLag !== "function") {
    chip.hidden = true;
    return;
  }
  try {
    const lag = await pc.estimateAvPlayoutLag();
    if (lag.lagMs == null && lag.audioMs == null) {
      chip.hidden = true;
      return;
    }
    const ms = Math.round(lag.lagMs != null ? lag.lagMs : lag.audioMs || 0);
    const prevAlert =
      chip.classList.contains("is-warn") || chip.classList.contains("is-bad");
    chip.classList.remove("is-ok", "is-warn", "is-bad");
    // +ms = audio behind video (the common lipsync complaint)
    if (Math.abs(ms) < 45) {
      chip.classList.add("is-ok");
      chip.textContent = _t("conn.avSyncOk") || "A/V ok";
      chip.title =
        _t("conn.avSyncOkTitle") ||
        "Audio and video playout are roughly aligned";
    } else if (Math.abs(ms) < 100) {
      chip.classList.add("is-warn");
      chip.textContent =
        (_t("conn.avLag") || "A/V") + " " + (ms > 0 ? "+" : "") + ms + "ms";
      chip.title =
        _t("conn.avLagTitle") ||
        "Audio may trail the picture. Enable Low-latency audio in Settings.";
    } else {
      chip.classList.add("is-bad");
      chip.textContent =
        (_t("conn.avLag") || "A/V") + " " + (ms > 0 ? "+" : "") + ms + "ms";
      chip.title =
        _t("conn.avLagBadTitle") ||
        "Noticeable A/V lag. Try Low-latency audio or a better network.";
    }
    const alert =
      chip.classList.contains("is-warn") || chip.classList.contains("is-bad");
    if (alert && !prevAlert) peekRemoteMeta(REMOTE_META_ALERT_MS);
    // Don't force-show here; applyRemoteMetaVisibility decides
  } catch (_) {
    chip.hidden = true;
  }
}

function syncLangChoices() {
  const lang = NextfaceI18n?.getLang?.() || "ru";
  document.querySelectorAll("[data-check-for]").forEach((el) => {
    const row = el.closest(".settings-choice");
    if (row) row.classList.toggle("is-selected", el.getAttribute("data-check-for") === lang);
  });
}

function selectedOptionLabel(sel) {
  if (!sel || !sel.options || !sel.options.length) return "";
  const opt = sel.options[sel.selectedIndex];
  return (opt && opt.textContent) || "";
}

/** Shorten long USB device labels for settings row values. */
function shortDeviceLabel(label, max = 22) {
  const s = String(label || "").trim();
  if (!s) return "";
  // Drop common prefixes
  let t = s
    .replace(/^Default\s*[-–—]\s*/i, "")
    .replace(/^Communications\s*[-–—]\s*/i, "")
    .replace(/\s*\([0-9a-f:.-]+\)$/i, "")
    .trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function shortHubLabel(base, max = 28) {
  try {
    const u = new URL(base);
    let h = u.host;
    if (h.length > max) h = h.slice(0, max - 1) + "…";
    return h;
  } catch {
    return String(base || "—").slice(0, max);
  }
}

function syncHubSettingsUi() {
  const b =
    typeof RuletHub !== "undefined" && RuletHub.base ? RuletHub.base() : location.origin;
  if ($("settings-hub-summary")) {
    const auto =
      typeof RuletHub === "undefined" || RuletHub.autoFailoverEnabled();
    const host = shortHubLabel(b, 14);
    $("settings-hub-summary").textContent = auto
      ? `${host} · ${_t("hub.autoShort") || "auto"}`
      : host;
  }
  if ($("hub-current-url")) {
    $("hub-current-url").textContent = b || "—";
  }
  if ($("chk-hub-auto")) {
    $("chk-hub-auto").checked =
      typeof RuletHub === "undefined" || RuletHub.autoFailoverEnabled();
  }
  refreshHubChip();
}

async function refreshHubDirectoryList() {
  const listEl = $("hub-directory-list");
  if (!listEl || typeof RuletHub === "undefined") return;
  listEl.innerHTML = `<p class="hint-inline">${_t("hub.loading")}</p>`;
  try {
    const hubs = await RuletHub.loadDirectory(true);
    if (!hubs.length) {
      listEl.innerHTML = `<p class="hint-inline">${_t("hub.empty")}</p>`;
      return;
    }
    const cur = RuletHub.base();
    // Probe live health for badges (parallel)
    const probes = await Promise.all(
      hubs.slice(0, 12).map(async (h) => {
        const p = await RuletHub.probeHealth(h.base);
        return { meta: h, probe: p };
      })
    );
    listEl.innerHTML = "";
    for (const { meta: h, probe: p } of probes) {
      const btn = document.createElement("button");
      btn.type = "button";
      const alive = !!p?.ok;
      btn.className =
        "settings-row settings-choice" +
        (h.base === cur ? " is-selected" : "") +
        (alive ? "" : " hub-dead");
      const rtt =
        p?.rttMs != null ? `${p.rttMs}ms` : alive ? "" : _t("hub.offline") || "offline";
      const online =
        p?.online != null
          ? ` · ${p.online} ${_t("pool.online") || "online"}`
          : "";
      const turn = p?.has_turn ? " · TURN" : "";
      const sub = [rtt, online, turn].filter(Boolean).join("") || (h.region || "");
      btn.innerHTML = `<span class="row-left"><span class="row-ico" aria-hidden="true"><svg class="icon icon-sm"><use href="#i-globe"/></svg></span><span class="hub-row-text"><strong>${escapeHtml(
        shortHubLabel(h.base, 36)
      )}</strong><span class="hub-row-sub">${escapeHtml(
        sub
      )}</span></span></span><span class="choice-check">${
        h.base === cur ? "✓" : alive ? "" : "—"
      }</span>`;
      btn.disabled = !alive && h.base !== cur;
      btn.addEventListener("click", async () => {
        if (!alive && h.base !== cur) return;
        RuletHub.setBase(h.base, { persist: true });
        syncHubSettingsUi();
        log(_t("hub.switched", { h: h.base }));
        intentionalClose = true;
        try {
          if (ws) ws.close();
        } catch (_) {}
        intentionalClose = false;
        reconnectAttempt = 0;
        if (typeof loadRtcConfig === "function") {
          await loadRtcConfig(h.base).catch(() => {});
        }
        connect(false);
        refreshHubDirectoryList();
      });
      listEl.appendChild(btn);
    }
  } catch (e) {
    listEl.innerHTML = `<p class="hint-inline">${_t("hub.empty")}</p>`;
  }
}

function wireHubSettings() {
  on("chk-hub-auto", "change", () => {
    if (typeof RuletHub === "undefined") return;
    RuletHub.setAutoFailover(!!$("chk-hub-auto")?.checked);
  });
  on("btn-hub-reset", "click", () => {
    if (typeof RuletHub === "undefined") return;
    RuletHub.clearPreference();
    syncHubSettingsUi();
    log(_t("hub.reset"));
    intentionalClose = true;
    try {
      if (ws) ws.close();
    } catch (_) {}
    intentionalClose = false;
    reconnectAttempt = 0;
    const b = RuletHub.base();
    if (typeof loadRtcConfig === "function") loadRtcConfig(b).catch(() => {});
    connect(false);
    refreshHubDirectoryList();
  });
  on("btn-hub-refresh", "click", () => refreshHubDirectoryList());
  // Load list when opening hub settings
  document.querySelectorAll('[data-settings-open="hub"]').forEach((el) => {
    el.addEventListener("click", () => {
      syncHubSettingsUi();
      refreshHubDirectoryList();
    });
  });
}

const PROFILE_EXPORT_TS_KEY = "rulet_profile_export_ts";
const UPDATES_SEEN_KEY = "rulet_updates_seen_v1";
/** Bump when shipping a new /updates.html generation users should notice */
const UPDATES_PAGE_STAMP = "2026-08-05";

function syncAccountSettingsSummary() {
  const idEl = $("settings-user-id");
  const codeEl = $("settings-friend-code");
  const starsEl = $("settings-stars-value");
  let uid = "";
  try {
    uid = loadIdentity()?.user_id || myUserId || "";
  } catch (_) {
    uid = myUserId || "";
  }
  if (idEl) {
    idEl.textContent = uid
      ? uid.length > 22
        ? uid.slice(0, 10) + "…" + uid.slice(-8)
        : uid
      : "—";
    idEl.title = uid || "";
  }
  if (codeEl) {
    codeEl.textContent = myFriendCode || "—";
    codeEl.title = myFriendCode || "";
  }
  const bal = Math.max(0, Number(myStars) || 0);
  const tr = Math.max(0, Number(myTrust) || 0);
  const eff = Math.max(
    0,
    Number(myTrustEffective) || clientEffectiveTrust(tr, myTrustGifters)
  );
  const dual =
    tr > 0 || eff > 0
      ? `★${bal} · ${_t("stars.trustShort") || "trust"} ${eff}${
          eff !== tr && tr > 0 ? ` (${tr})` : ""
        }`
      : `★${bal}`;
  if (starsEl) starsEl.textContent = dual;
  const starsRow = $("settings-stars-row-value");
  if (starsRow) starsRow.textContent = dual;
  // Main list: backup status summary + soft nudge when friends exist but never exported
  const idSum = $("settings-identity-summary");
  const backupStatus = $("settings-backup-status");
  const idBtn = $("btn-settings-open-identity");
  let lastTs = 0;
  try {
    lastTs = Math.max(0, Number(localStorage.getItem(PROFILE_EXPORT_TS_KEY)) || 0);
  } catch (_) {}
  const codeShort = (myFriendCode || "").trim();
  let friendN = 0;
  try {
    friendN = (typeof loadFriendsBackup === "function" ? loadFriendsBackup() : [])
      .length;
  } catch (_) {
    friendN = 0;
  }
  const needsBackup = lastTs <= 0 && friendN >= 1;
  if (idBtn) {
    idBtn.classList.toggle("needs-backup", needsBackup);
    idBtn.classList.toggle("settings-row-accent", needsBackup);
  }
  if (idSum) {
    if (lastTs > 0) {
      const days = Math.max(0, Math.floor((Date.now() - lastTs) / 86400000));
      idSum.textContent =
        days === 0
          ? _t("settings.backupToday", { code: codeShort || "—" }) ||
            `Backup today · code ${codeShort || "—"}`
          : _t("settings.backupDaysAgo", {
              n: days,
              code: codeShort || "—",
            }) || `Backup ${days}d ago · code ${codeShort || "—"}`;
    } else if (needsBackup) {
      idSum.textContent =
        _t("settings.needsBackup", { n: friendN, code: codeShort || "—" }) ||
        `Export a backup · ${friendN} friend(s) · code ${codeShort || "—"}`;
    } else {
      idSum.textContent =
        _t("settings.backupNeverShort", { code: codeShort || "—" }) ||
        (codeShort
          ? `No backup yet · code ${codeShort}`
          : _t("settings.backupIdentitySub") ||
            "Export / import · friend code · no signup");
    }
  }
  if (backupStatus) {
    if (lastTs > 0) {
      try {
        const d = new Date(lastTs);
        const when = d.toLocaleString?.(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }) || d.toISOString();
        backupStatus.textContent =
          _t("settings.backupLastAt", { when }) ||
          `Last export on this browser: ${when}`;
      } catch (_) {
        backupStatus.textContent =
          _t("settings.backupLastOk") || "Backup exported on this browser.";
      }
    } else if (needsBackup) {
      backupStatus.textContent =
        _t("settings.needsBackupBody", { n: friendN }) ||
        `You have ${friendN} friend(s) on this hub — export a password backup before switching devices.`;
    } else {
      backupStatus.textContent =
        _t("settings.backupNever") ||
        "No backup exported on this browser yet.";
    }
  }
  // Safety → Hide IP summary chip
  const hideIpSum = $("settings-hide-ip-summary");
  if (hideIpSum) {
    const on =
      !!loadPrefs().hideIpRelayOnly ||
      (typeof hideIpRelayOnlyEnabled === "function" &&
        hideIpRelayOnlyEnabled());
    hideIpSum.textContent = on
      ? _t("settings.hideIpOnShort") || "On · TURN only"
      : _t("settings.hideIpOpenSub") || "Force TURN · set in Connection";
  }
}

/** Gear badge when Updates page is newer than last visit. */
function syncSettingsUpdatesBadge() {
  const badge = $("settings-gear-badge");
  const row = $("btn-settings-updates");
  if (!badge && !row) return;
  let seen = "";
  try {
    seen = localStorage.getItem(UPDATES_SEEN_KEY) || "";
  } catch (_) {}
  const unread = seen !== UPDATES_PAGE_STAMP;
  if (badge) {
    badge.hidden = !unread;
    if (unread) badge.removeAttribute("hidden");
    else badge.setAttribute("hidden", "");
    badge.setAttribute("aria-hidden", unread ? "false" : "true");
  }
  row?.classList.toggle("has-unread", unread);
}

function markUpdatesSeen() {
  try {
    localStorage.setItem(UPDATES_SEEN_KEY, UPDATES_PAGE_STAMP);
  } catch (_) {}
  syncSettingsUpdatesBadge();
}

function markProfileExported() {
  try {
    localStorage.setItem(PROFILE_EXPORT_TS_KEY, String(Date.now()));
  } catch (_) {}
  try {
    syncAccountSettingsSummary();
  } catch (_) {}
}

function syncSettingsSummary() {
  const lang = NextfaceI18n?.getLang?.() || "ru";
  const langs = NextfaceI18n?.listLanguages?.() || [];
  const langMeta = langs.find((l) => l.code === lang);
  if ($("settings-lang-value")) {
    $("settings-lang-value").textContent =
      langMeta?.native || (lang === "en" ? "English" : lang === "ru" ? "Русский" : lang);
  }
  if ($("settings-lang-flag")) {
    $("settings-lang-flag").textContent =
      (typeof LANG_FLAGS !== "undefined" && LANG_FLAGS[lang]) || "🌐";
  }
  if ($("settings-theme-value")) {
    $("settings-theme-value").textContent = themeLabel(getTheme());
  }
  syncAccountSettingsSummary();
  syncFlagSettingsSummary();
  const cam = selectedOptionLabel($("sel-camera"));
  const mic = selectedOptionLabel($("sel-mic"));
  const spk = selectedOptionLabel($("sel-speaker"));
  const camShort =
    shortDeviceLabel(cam) || _t("settings.systemDefault");
  const micShort =
    shortDeviceLabel(mic) || _t("settings.systemDefault");
  const spkShort =
    shortDeviceLabel(spk) ||
    _t("device.defaultSpeaker") ||
    _t("settings.systemDefault");
  if ($("settings-camera-value")) {
    $("settings-camera-value").textContent = camShort;
  }
  if ($("settings-resolution-value")) {
    $("settings-resolution-value").textContent = videoResLabel(getVideoResolutionPref());
  }
  if ($("settings-mic-value")) {
    $("settings-mic-value").textContent = micShort;
  }
  if ($("settings-speaker-value")) {
    $("settings-speaker-value").textContent = spkShort;
  }
  if ($("settings-devices-summary")) {
    const res = getVideoResolutionPref();
    const camPart = shortDeviceLabel(cam, 12) || camShort;
    const micPart = shortDeviceLabel(mic, 10) || micShort;
    const bits = [camPart, micPart];
    if (res && res !== "auto") bits.push(`${res}p`);
    $("settings-devices-summary").textContent = bits.filter(Boolean).join(" · ");
  }
  // Safety summary — blur / NSFW / Hide IP only (sounds live under Devices)
  if ($("settings-safety-summary")) {
    const prefs = loadPrefs();
    const parts = [];
    if (prefs.blurFirst === true) {
      parts.push(_t("settings.sumBlur") || "Always blur");
    }
    if (prefs.nsfwAuto !== false) {
      parts.push(_t("settings.sumNsfw") || "NSFW");
    }
    const hideIp =
      prefs.hideIpRelayOnly === true ||
      prefs.forceRelay === true ||
      prefs.hideIp === true ||
      prefs.icePolicy === "relay" ||
      (typeof hideIpRelayOnlyEnabled === "function" &&
        hideIpRelayOnlyEnabled());
    if (hideIp) parts.push(_t("settings.sumHideIp") || "Hide IP");
    if (parts.length >= 3) {
      $("settings-safety-summary").textContent =
        _t("settings.sumAllOn") || "All on";
    } else if (parts.length) {
      $("settings-safety-summary").textContent = parts.join(" · ");
    } else {
      $("settings-safety-summary").textContent =
        _t("settings.sumOff") || "Off";
    }
  }
  syncMatchPrefsUi();
  syncHubSettingsUi();
  refreshSecurityPanel();
  refreshAvatarUi();
  syncSettingsUpdatesBadge();
}

function renderDeviceChoiceList(kind) {
  const map = {
    camera: { sel: $("sel-camera"), list: $("settings-camera-list"), pref: "cameraId" },
    mic: { sel: $("sel-mic"), list: $("settings-mic-list"), pref: "micId" },
    speaker: { sel: $("sel-speaker"), list: $("settings-speaker-list"), pref: "speakerId" },
  };
  const cfg = map[kind];
  if (!cfg?.list || !cfg.sel) return;
  const cur = cfg.sel.value;
  const opts = [...cfg.sel.options];
  if (!opts.length) {
    cfg.list.innerHTML = `<div class="settings-row settings-row-static"><span>${escapeHtml(
      _t("device.none", { kind: _t("device." + (kind === "camera" ? "camera" : kind === "mic" ? "mic" : "speaker")) })
    )}</span></div>`;
    return;
  }
  cfg.list.innerHTML = opts
    .map((o) => {
      const id = o.value;
      const label = o.textContent || id || _t("settings.systemDefault");
      const selected = id === cur || (!cur && !id);
      return `<button type="button" class="settings-row settings-choice ${
        selected ? "is-selected" : ""
      }" data-device-kind="${escapeAttr(kind)}" data-device-id="${escapeAttr(id)}">
        <span>${escapeHtml(label)}</span>
        <span class="choice-check">✓</span>
      </button>`;
    })
    .join("");
  cfg.list.querySelectorAll("[data-device-kind]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const k = btn.getAttribute("data-device-kind");
      const id = btn.getAttribute("data-device-id") || "";
      const target = map[k]?.sel;
      if (!target) return;
      target.value = id;
      if (k === "camera") {
        applyCameraChoice(id);
        setStatus(_t("device.switchingCam") || "switching camera…");
        mediaPreviewBusy = false;
        await hardReleaseLocalCamera(300);
        await startPreview();
        applyLocalMirrorClass();
        syncSettingsSummary();
        await ensureLocalPreviewVisible("settings-cam");
        if (localVideoTrackLive() && !localPreviewIsPainting()) {
          setStatus(
            _t("local.camBlackHint") ||
              "Camera on but black — pick USB Camera or tap Restart"
          );
          showLocalCamRestart(true);
        }
      } else if (k === "mic") {
        savePrefs({ micId: id });
        setStatus(_t("device.switchingMic") || "switching mic…");
        await startPreview();
        syncSettingsSummary();
      } else if (k === "speaker") {
        savePrefs({ speakerId: id });
        applySpeaker();
        syncSettingsSummary();
      }
      showSettingsView("devices");
    });
  });
}

function wireSettingsNav() {
  document.querySelectorAll("[data-settings-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-settings-open");
      // Stars is a separate flyout (not a nested settings-view)
      if (name === "stars") {
        try {
          closeSettings();
        } catch (_) {}
        setTimeout(() => openStarsSheet($("local-stars-badge")), 180);
        return;
      }
      if (name) showSettingsView(name);
    });
  });
  $("btn-settings-open-stars")?.addEventListener("click", () => {
    try {
      closeSettings();
    } catch (_) {}
    setTimeout(() => openStarsSheet($("local-stars-badge")), 180);
  });
  document.querySelectorAll("[data-settings-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const viewId = btn.closest(".settings-view")?.id || "";
      if (
        viewId === "settings-view-camera" ||
        viewId === "settings-view-mic" ||
        viewId === "settings-view-speaker" ||
        viewId === "settings-view-resolution"
      ) {
        showSettingsView("devices");
      } else {
        showSettingsView("main");
      }
    });
  });
  rebuildSettingsLangList();
  wireThemeSettings();
  wireFlagSettings();
  wireAvatarSettings();
  applyTheme(getTheme(), { persist: false });
  applyLocalMirrorClass();
  refreshLocalNameChip();
  $("btn-about-keys")?.addEventListener("click", () => {
    try {
      closeSettings();
    } catch (_) {}
    try {
      openKeysHelp();
    } catch (_) {}
  });
  // Empty-card alone invite buttons removed from Start UI (Friends sheet only)
  wireStarBadgeInteractions();
  setStarsBadge("local", myStars);
  $("btn-settings-done")?.addEventListener("click", () => closeSettings());
  $("btn-settings-open-friend-alerts")?.addEventListener("click", () => {
    try {
      closeSettings();
    } catch (_) {}
    setTimeout(() => {
      try {
        openFriends();
      } catch (_) {}
    }, 160);
  });
  $("btn-conn-refresh")?.addEventListener("click", () => {
    refreshConnectionDetails();
    refreshSecurityPanel();
    setStatus(_t("settings.connRefreshed") || "Connection details updated");
  });
  document.querySelectorAll(".btn-export-profile").forEach((btn) => {
    btn.addEventListener("click", () => exportProfileFile());
  });
  // Delegation: Import works from Settings, Friends banner, and dynamic empty CTAs
  document.addEventListener("click", (e) => {
    const imp = e.target?.closest?.(".btn-import-profile");
    if (!imp) return;
    e.preventDefault();
    // Prefer clipboard backup (QR / paste transfer) when present; else file picker
    tryImportFromClipboardOrFile();
  });
  $("import-profile-file")?.addEventListener("change", (e) => {
    const f = e.target?.files?.[0];
    if (f) importProfileFile(f);
    e.target.value = "";
  });
  // Updates row: mark seen when opened
  $("btn-settings-updates")?.addEventListener("click", () => {
    markUpdatesSeen();
  });
  document
    .querySelectorAll('a[href="/updates.html"], a[href*="updates.html"]')
    .forEach((a) => {
      a.addEventListener("click", () => markUpdatesSeen());
    });
  $("btn-copy-user-id")?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    let uid = "";
    try {
      uid = loadIdentity()?.user_id || myUserId || "";
    } catch (_) {
      uid = myUserId || "";
    }
    if (!uid) return;
    try {
      await navigator.clipboard.writeText(uid);
      setStatus(_t("settings.copiedId") || "User ID copied");
    } catch (_) {
      setStatus(uid);
    }
  });
  $("btn-copy-friend-code-settings")?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const code = (myFriendCode || "").trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setStatus(_t("friends.codeCopied") || "Friend code copied");
    } catch (_) {
      setStatus(code);
    }
  });
  $("btn-clear-local")?.addEventListener("click", async () => {
    // Strong warning: friends live under this identity on the hub
    if (
      !confirm(
        _t("settings.clearConfirmFriends") ||
          "This creates a NEW identity. Your friends list will look empty until you import a profile backup. Export first?"
      )
    ) {
      return;
    }
    if (!confirm(_t("settings.clearConfirm"))) return;
    try {
      // Keep friends backup + chat threads so user can still re-request by code
      localStorage.removeItem(ID_KEY);
      localStorage.removeItem(HISTORY_KEY);
      localStorage.removeItem(RULES_KEY);
      localStorage.removeItem(PREFS_KEY);
      localStorage.removeItem("nextface-lang-v1");
      localStorage.removeItem("rulet.reports.v1");
      if (typeof RuletIdentity !== "undefined" && RuletIdentity.clearDeviceKeys) {
        await RuletIdentity.clearDeviceKeys();
      }
    } catch (_) {}
    setStatus(_t("settings.clearDone"));
    location.reload();
  });
}

const PROFILE_FORMAT = "ruletka-profile/1";
/** Password-protected export envelope (AES-GCM + PBKDF2). */
const PROFILE_FORMAT_ENC = "ruletka-profile/2-enc";
/** PBKDF2 iterations — high enough for offline password protection in-browser. */
const PROFILE_KDF_ITERS = 310000;
const PROFILE_MIN_PASSWORD = 8;
/** One-shot: no-account backup education on first visit */
const NO_ACCOUNT_TIP_KEY = "ruletka-no-account-tip-v1";

/** Keys that must never be written to or read from a profile file (anti star double-spend). */
const PROFILE_STAR_DENY =
  /^(stars?|my_?stars?|star_count|star_counts|star_edges|star_effects|hour_star|reputation|coins?)$/i;

function b64FromBytes(u8) {
  let s = "";
  const bytes = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

function bytesFromB64(b64) {
  const bin = atob(String(b64 || ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function isEncryptedProfile(data) {
  if (!data || typeof data !== "object") return false;
  const fmt = String(data.format || "");
  return (
    fmt === PROFILE_FORMAT_ENC ||
    fmt === "ruletka-profile/2" ||
    (data.ciphertext && data.salt && data.iv && (data.cipher === "AES-GCM" || data.kdf))
  );
}

async function deriveProfileKey(password, saltBytes, iterations) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(String(password || "")),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const iters = Number(iterations);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: Math.max(100000, Number.isFinite(iters) && iters > 0 ? iters : PROFILE_KDF_ITERS),
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a profile object into a portable JSON envelope.
 * Password never leaves the device; only ciphertext is written to disk.
 */
async function encryptProfilePayload(profileObj, password) {
  if (!crypto?.subtle) {
    throw new Error("WebCrypto unavailable");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveProfileKey(password, salt, PROFILE_KDF_ITERS);
  const plain = new TextEncoder().encode(JSON.stringify(profileObj));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return {
    format: PROFILE_FORMAT_ENC,
    v: 2,
    software: "ruletka.vip",
    exported_at: new Date().toISOString(),
    kdf: "PBKDF2",
    hash: "SHA-256",
    iter: PROFILE_KDF_ITERS,
    cipher: "AES-GCM",
    salt: b64FromBytes(salt),
    iv: b64FromBytes(iv),
    ciphertext: b64FromBytes(new Uint8Array(ct)),
    note:
      "Encrypted profile backup. Open Settings → Import user and enter the same password to restore. Stars are hub-only and not inside this file.",
  };
}

/** Decrypt envelope → plain profile object. Throws on wrong password / corrupt data. */
async function decryptProfilePayload(envelope, password) {
  if (!crypto?.subtle) throw new Error("WebCrypto unavailable");
  const salt = bytesFromB64(envelope.salt);
  const iv = bytesFromB64(envelope.iv);
  const ct = bytesFromB64(envelope.ciphertext);
  if (!salt.length || !iv.length || !ct.length) {
    throw new Error("bad envelope");
  }
  const iters = Number(envelope.iter) || PROFILE_KDF_ITERS;
  const key = await deriveProfileKey(password, salt, iters);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ct
  );
  const text = new TextDecoder().decode(plainBuf);
  const data = JSON.parse(text);
  if (!data || typeof data !== "object") throw new Error("bad payload");
  return data;
}

/**
 * Password modal for export (password + confirm) or import (single password).
 * @param {{ mode: 'export'|'import' }} opts
 * @returns {Promise<string|null>} password or null if cancelled
 */
function openProfilePasswordModal(opts = {}) {
  const mode = opts.mode === "import" ? "import" : "export";
  return new Promise((resolve) => {
    let root = $("profile-pw-modal");
    if (!root) {
      root = document.createElement("div");
      root.id = "profile-pw-modal";
      root.className = "profile-pw-modal";
      root.hidden = true;
      root.innerHTML = `
        <div class="profile-pw-scrim" data-pw-dismiss></div>
        <div class="profile-pw-card" role="dialog" aria-modal="true" aria-labelledby="profile-pw-title">
          <header class="profile-pw-head">
            <h3 id="profile-pw-title"></h3>
            <button type="button" class="profile-pw-close" data-pw-dismiss aria-label="Close">✕</button>
          </header>
          <p class="profile-pw-hint" id="profile-pw-hint"></p>
          <p class="profile-pw-no-account" id="profile-pw-no-account" hidden></p>
          <label class="profile-pw-label" for="profile-pw-input">
            <span id="profile-pw-label-text"></span>
            <input type="password" id="profile-pw-input" class="profile-pw-input" autocomplete="new-password" spellcheck="false" />
          </label>
          <div class="profile-pw-strength" id="profile-pw-strength" hidden>
            <div class="profile-pw-strength-track" aria-hidden="true">
              <span class="profile-pw-strength-fill" id="profile-pw-strength-fill"></span>
            </div>
            <span class="profile-pw-strength-label" id="profile-pw-strength-label"></span>
          </div>
          <label class="profile-pw-label" id="profile-pw-confirm-wrap" for="profile-pw-confirm" hidden>
            <span id="profile-pw-confirm-label"></span>
            <input type="password" id="profile-pw-confirm" class="profile-pw-input" autocomplete="new-password" spellcheck="false" />
          </label>
          <p class="profile-pw-error" id="profile-pw-error" hidden></p>
          <div class="profile-pw-actions">
            <button type="button" class="pill tight ghost" data-pw-dismiss id="profile-pw-cancel"></button>
            <button type="button" class="pill tight accent" id="profile-pw-submit"></button>
          </div>
          <button type="button" class="profile-pw-plain-link" id="profile-pw-plain" hidden></button>
        </div>`;
      document.body.appendChild(root);
    }

    const title = $("profile-pw-title");
    const hint = $("profile-pw-hint");
    const labelText = $("profile-pw-label-text");
    const confirmWrap = $("profile-pw-confirm-wrap");
    const confirmLabel = $("profile-pw-confirm-label");
    const errEl = $("profile-pw-error");
    const input = $("profile-pw-input");
    const confirm = $("profile-pw-confirm");
    const submit = $("profile-pw-submit");
    const cancel = $("profile-pw-cancel");
    const plainBtn = $("profile-pw-plain");

    const showErr = (msg) => {
      if (!errEl) return;
      if (msg) {
        errEl.hidden = false;
        errEl.textContent = msg;
      } else {
        errEl.hidden = true;
        errEl.textContent = "";
      }
    };

    const noAcct = $("profile-pw-no-account");
    const strengthWrap = $("profile-pw-strength");
    const strengthFill = $("profile-pw-strength-fill");
    const strengthLabel = $("profile-pw-strength-label");

    const scorePassword = (pw) => {
      const s = String(pw || "");
      let score = 0;
      if (s.length >= 8) score++;
      if (s.length >= 12) score++;
      if (/[a-z]/.test(s) && /[A-Z]/.test(s)) score++;
      if (/\d/.test(s)) score++;
      if (/[^A-Za-z0-9]/.test(s)) score++;
      return Math.min(4, score);
    };
    const updateStrength = () => {
      if (!strengthWrap || mode !== "export") return;
      const s = String(input?.value || "");
      if (!s) {
        strengthWrap.hidden = true;
        return;
      }
      strengthWrap.hidden = false;
      const sc = scorePassword(s);
      const labels = [
        _t("settings.exportPwWeak") || "Too weak",
        _t("settings.exportPwFair") || "Fair",
        _t("settings.exportPwOk") || "OK",
        _t("settings.exportPwStrong") || "Strong",
        _t("settings.exportPwStrong") || "Strong",
      ];
      if (strengthFill) {
        strengthFill.style.width = `${(sc / 4) * 100}%`;
        strengthFill.dataset.score = String(sc);
      }
      if (strengthLabel) strengthLabel.textContent = labels[sc] || "";
    };

    if (mode === "export") {
      if (title)
        title.textContent =
          _t("settings.exportPwTitle") || "Protect export with a password";
      if (hint)
        hint.textContent =
          _t("settings.exportPwHint") ||
          "You’ll need this password to import on another phone or browser. We never store it.";
      if (noAcct) {
        noAcct.hidden = false;
        noAcct.textContent =
          _t("settings.exportNoAccountNote") ||
          "No signup — this file is your only way to keep friends on a new phone.";
      }
      if (labelText)
        labelText.textContent = _t("settings.exportPwLabel") || "Password";
      if (confirmLabel)
        confirmLabel.textContent =
          _t("settings.exportPwConfirm") || "Confirm password";
      if (confirmWrap) confirmWrap.hidden = false;
      if (submit)
        submit.textContent =
          _t("settings.exportPwSubmit") || "Encrypt & download";
      if (plainBtn) {
        plainBtn.hidden = false;
        plainBtn.textContent =
          _t("settings.exportPlainLink") ||
          "Export without password (not recommended)";
      }
      if (strengthWrap) strengthWrap.hidden = true;
      input?.addEventListener("input", updateStrength);
    } else {
      if (title)
        title.textContent =
          _t("settings.importPwTitle") || "Enter export password";
      if (hint)
        hint.textContent =
          _t("settings.importPwHint") ||
          "This file is encrypted. Type the password you set when exporting.";
      if (noAcct) {
        noAcct.hidden = false;
        noAcct.textContent =
          _t("settings.importNoAccountNote") ||
          "Import restores your identity + friends on this device. No password account on the server.";
      }
      if (labelText)
        labelText.textContent = _t("settings.importPwLabel") || "Password";
      if (confirmWrap) confirmWrap.hidden = true;
      if (submit)
        submit.textContent = _t("settings.importPwSubmit") || "Unlock & import";
      if (plainBtn) plainBtn.hidden = true;
      if (strengthWrap) strengthWrap.hidden = true;
    }
    if (cancel) cancel.textContent = _t("settings.exportPwCancel") || "Cancel";
    showErr("");
    if (input) input.value = "";
    if (confirm) confirm.value = "";

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      root.hidden = true;
      root.setAttribute("hidden", "");
      document.removeEventListener("keydown", onKey);
      root.removeEventListener("click", onClick);
      submit?.removeEventListener("click", onSubmit);
      plainBtn?.removeEventListener("click", onPlain);
      resolve(value);
    };

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(null);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onSubmit();
      }
    };
    const onClick = (e) => {
      if (e.target?.closest?.("[data-pw-dismiss]")) finish(null);
    };
    const onSubmit = () => {
      const pw = String(input?.value || "");
      if (mode === "export") {
        if (pw.length < PROFILE_MIN_PASSWORD) {
          showErr(
            _t("settings.exportPwShort", { n: PROFILE_MIN_PASSWORD }) ||
              `Password must be at least ${PROFILE_MIN_PASSWORD} characters`
          );
          input?.focus();
          return;
        }
        // Soft strength gate: require at least "fair" (score ≥ 2)
        const sc =
          (pw.length >= 8 ? 1 : 0) +
          (pw.length >= 12 ? 1 : 0) +
          (/[a-z]/.test(pw) && /[A-Z]/.test(pw) ? 1 : 0) +
          (/\d/.test(pw) ? 1 : 0) +
          (/[^A-Za-z0-9]/.test(pw) ? 1 : 0);
        if (sc < 2) {
          showErr(
            _t("settings.exportPwTooWeak") ||
              "Use a longer password or mix letters and numbers"
          );
          input?.focus();
          return;
        }
        const pw2 = String(confirm?.value || "");
        if (pw !== pw2) {
          showErr(
            _t("settings.exportPwMismatch") || "Passwords do not match"
          );
          confirm?.focus();
          return;
        }
        finish(pw);
      } else {
        if (!pw) {
          showErr(
            _t("settings.importPwEmpty") || "Enter the password"
          );
          input?.focus();
          return;
        }
        finish(pw);
      }
    };
    const onPlain = () => {
      // Sentinel for unencrypted export
      finish("");
    };

    document.addEventListener("keydown", onKey);
    root.addEventListener("click", onClick);
    submit?.addEventListener("click", onSubmit);
    plainBtn?.addEventListener("click", onPlain);

    root.hidden = false;
    root.removeAttribute("hidden");
    setTimeout(() => input?.focus?.(), 40);
  });
}

function loadHistorySafe() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(raw) ? raw.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

/**
 * Prefs for export: strip anything star/coin related so balances can't be forged offline.
 * Stars live only on the hub under user_id (server-authoritative).
 */
function prefsForProfileExport() {
  const p = loadPrefs() || {};
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (PROFILE_STAR_DENY.test(String(k))) continue;
    if (String(k).toLowerCase().includes("star")) continue;
    out[k] = v;
  }
  return out;
}

/** Friends backup rows without star badges (hub is source of truth). Includes local nicknames. */
function friendsForProfileExport() {
  const nicks = loadFriendNicks();
  return loadFriendsBackup().map((f) => {
    const uid = String(f.user_id || "");
    const nick = String(nicks[uid] || f.nick || "").trim().slice(0, 32);
    return {
      user_id: uid,
      name: String(f.name || f.short_id || "").slice(0, 32),
      friend_code: String(f.friend_code || "").toUpperCase(),
      short_id: String(f.short_id || "").slice(0, 16),
      nick: nick || undefined,
      saved_at: f.saved_at || Date.now(),
      // deliberately omit: stars, star_count, effects
    };
  });
}

/**
 * Strip star/coin fields from any imported JSON object (nested, shallow-safe).
 * Prevents crafted profile files from seeding fake balances into localStorage.
 */
function scrubStarsFromImportValue(val, depth = 0) {
  if (depth > 6 || val == null) return val;
  if (Array.isArray(val)) {
    return val.map((x) => scrubStarsFromImportValue(x, depth + 1));
  }
  if (typeof val !== "object") return val;
  const out = {};
  for (const [k, v] of Object.entries(val)) {
    const key = String(k);
    if (PROFILE_STAR_DENY.test(key) || key.toLowerCase().includes("star")) {
      continue;
    }
    out[k] = scrubStarsFromImportValue(v, depth + 1);
  }
  return out;
}

function buildProfileExport() {
  const id = loadIdentity();
  let hubBase = "";
  let hubAuto = true;
  try {
    if (typeof RuletHub !== "undefined") {
      hubBase = RuletHub.base?.() || "";
      hubAuto = RuletHub.autoFailoverEnabled?.() !== false;
    }
  } catch (_) {}
  let lang = "ru";
  try {
    lang = NextfaceI18n?.getLang?.() || localStorage.getItem("nextface-lang-v1") || "ru";
  } catch (_) {}
  // Never embed myStars / star balances — only identity. Stars are hub-side.
  return {
    format: PROFILE_FORMAT,
    exported_at: new Date().toISOString(),
    software: "ruletka.vip",
    note:
      "Import this file on another browser/device to keep the same identity. Friends are stored on the hub under user_id — same hub + same user_id restores them automatically. friend_codes help re-request if identity is lost. STARS are NOT in this file: reputation lives only on the hub for this user_id (cannot be forged or double-spent via export/import).",
    stars_note:
      "Stars are server-side only. Do not add stars/coins fields — they are ignored on import.",
    identity: {
      user_id: id.user_id || myUserId || "",
      name: (id.name || getDisplayName() || "").slice(0, 32),
      friend_code: myFriendCode || "",
      // no stars field
    },
    friends: friendsForProfileExport(),
    friend_nicks: loadFriendNicks(),
    prefs: prefsForProfileExport(),
    history: loadHistorySafe(),
    lang,
    rules_accepted: rulesAccepted(),
    hub: { base: hubBase, auto: hubAuto },
  };
}

/** @returns {Array<{user_id:string,name:string,friend_code:string,short_id?:string}>} */
function loadFriendsBackup() {
  try {
    const raw = JSON.parse(localStorage.getItem(FRIENDS_BACKUP_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveFriendsBackup(list) {
  try {
    const rows = (list || [])
      .filter((f) => f && f.user_id)
      .map((f) => ({
        user_id: String(f.user_id),
        name: String(f.name || f.short_id || "").slice(0, 32),
        friend_code: String(f.friend_code || "").toUpperCase(),
        short_id: String(f.short_id || "").slice(0, 16),
        saved_at: Date.now(),
      }));
    // Dedupe by user_id then by friend_code
    const byId = new Map();
    for (const r of rows) {
      if (!byId.has(r.user_id)) byId.set(r.user_id, r);
    }
    const byCode = new Map();
    for (const r of byId.values()) {
      const k = r.friend_code || r.user_id;
      if (!byCode.has(k)) byCode.set(k, r);
    }
    localStorage.setItem(
      FRIENDS_BACKUP_KEY,
      JSON.stringify(Array.from(byCode.values()).slice(0, 200))
    );
  } catch (_) {}
}

/** Dedupe friend-like objects by user_id (first wins). */
function dedupeByUserId(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const id = item?.user_id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

function loadFriendNicks() {
  try {
    const raw = JSON.parse(localStorage.getItem(FRIEND_NICKS_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function saveFriendNicks(map) {
  try {
    localStorage.setItem(FRIEND_NICKS_KEY, JSON.stringify(map || {}));
  } catch (_) {}
}

/** Display name for a friend: your nickname overrides their public name. */
function friendDisplayName(f) {
  if (!f) return "friend";
  const nicks = loadFriendNicks();
  const nick = (nicks[f.user_id] || "").trim();
  if (nick) return nick;
  return (f.name || f.short_id || "friend").toString();
}

function setFriendNick(userId, nick) {
  if (!userId) return;
  const map = loadFriendNicks();
  const n = String(nick || "").trim().slice(0, 32);
  if (!n) delete map[userId];
  else map[userId] = n;
  saveFriendNicks(map);
}

function friendAvatarHtml(f) {
  const url = (f?.avatar || "").trim();
  if (url && /^data:image\//i.test(url)) {
    return `<span class="friend-avatar has-img"><img src="${escapeAttr(
      url
    )}" alt="" loading="lazy" /></span>`;
  }
  const label = friendDisplayName(f);
  const letter = (label.replace(/[^a-zA-Z0-9\u0400-\u04FF]/g, "")[0] || "?").toUpperCase();
  return `<span class="friend-avatar letter" aria-hidden="true">${escapeHtml(letter)}</span>`;
}

function renameFriendPrompt(userId, currentName) {
  if (!userId) return;
  const cur = loadFriendNicks()[userId] || currentName || "";
  const next = prompt(
    _t("friends.renamePrompt") || "Name for this friend (only you see it). Leave empty to clear.",
    cur
  );
  if (next === null) return; // cancelled
  setFriendNick(userId, next);
  renderFriendsList();
  // Update open chat header if this friend is active
  if (activeChat.peerUserId === userId) {
    activeChat.peerName = friendDisplayName({
      user_id: userId,
      name: currentName,
    });
    updateChatHeader();
    updateInboxThreadHeader?.();
  }
  setStatus(_t("friends.renameOk") || "Friend name saved");
}

const EXPORT_NUDGE_KEY = "ruletka-export-nudge-done-v1";
/** Last time we showed the export nudge (ms) — allows a soft re-ask if never exported. */
const EXPORT_NUDGE_SHOWN_AT_KEY = "ruletka-export-nudge-shown-at-v1";
/** Soft re-ask after 1 day if they only dismissed (never exported). */
const EXPORT_NUDGE_RETRY_MS = 1 * 24 * 60 * 60 * 1000;
const IMPORT_BACKUP_NUDGE_KEY = "ruletka-import-backup-nudge-v1";

function exportNudgeDone() {
  try {
    // Permanent only after a successful export
    if (localStorage.getItem(EXPORT_NUDGE_KEY) === "1") return true;
    // Soft: re-show after retry window if they never exported
    const shown = Number(localStorage.getItem(EXPORT_NUDGE_SHOWN_AT_KEY) || 0);
    if (shown && Date.now() - shown < EXPORT_NUDGE_RETRY_MS) return true;
    return false;
  } catch {
    return true;
  }
}

function markExportNudgeDone() {
  try {
    localStorage.setItem(EXPORT_NUDGE_KEY, "1");
  } catch (_) {}
}

function markExportNudgeShown() {
  try {
    localStorage.setItem(EXPORT_NUDGE_SHOWN_AT_KEY, String(Date.now()));
  } catch (_) {}
}

function markImportBackupNudgePending() {
  try {
    localStorage.setItem(IMPORT_BACKUP_NUDGE_KEY, "1");
  } catch (_) {}
}

function clearImportBackupNudge() {
  try {
    localStorage.removeItem(IMPORT_BACKUP_NUDGE_KEY);
  } catch (_) {}
}

/** Max payload length for optional QR transfer (reliable phone camera scan). */
const BACKUP_QR_MAX_CHARS = 1800;

/** Keep last export in memory for toast Share / QR (not written to disk). */
let _lastBackupShare = null;

function canShareBackupFile(file) {
  try {
    if (!navigator.share || !navigator.canShare) return false;
    if (!file) return false;
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Share a profile backup file via Web Share Level 2 (Files).
 * Falls back to copying minified JSON when files are unsupported.
 * @returns {Promise<"share"|"copy"|"cancel"|"fail"|"unsupported">}
 */
async function shareBackupFile(file, opts = {}) {
  const title =
    opts.title ||
    _t("settings.exportShareTitle") ||
    siteBrandName() + " backup";
  const text =
    opts.text ||
    _t("settings.exportShareText") ||
    "Encrypted profile backup — Import user + password on the other device. Stars stay on the hub.";
  if (file && canShareBackupFile(file)) {
    try {
      await navigator.share({
        files: [file],
        title,
        text,
      });
      setStatus(_t("settings.exportShared") || "Backup shared");
      trackEvent("profile_export_share", { via: "files" });
      return "share";
    } catch (e) {
      if (e && (e.name === "AbortError" || e.name === "NotAllowedError")) {
        return "cancel";
      }
      // fall through to text share / copy
    }
  }
  // Text share (no file) — some browsers only share url/text
  if (opts.jsonText && navigator.share) {
    try {
      await navigator.share({ title, text: opts.jsonText });
      setStatus(_t("settings.exportShared") || "Backup shared");
      trackEvent("profile_export_share", { via: "text" });
      return "share";
    } catch (e) {
      if (e && (e.name === "AbortError" || e.name === "NotAllowedError")) {
        return "cancel";
      }
    }
  }
  if (opts.jsonText) {
    const r = await copyToClipboard(opts.jsonText, "settings.exportCopied");
    if (r === "copy") {
      setStatus(
        _t("settings.exportCopied") ||
          "Backup text copied — paste into Import on the other device"
      );
      trackEvent("profile_export_share", { via: "copy" });
    }
    return r === "copy" ? "copy" : "fail";
  }
  return "unsupported";
}

/**
 * QR modal for small backups — scan or copy on the other phone, then Import.
 */
function showBackupTransferQr(jsonText) {
  if (!jsonText || jsonText.length > BACKUP_QR_MAX_CHARS) return;
  let root = $("backup-qr-modal");
  if (!root) {
    root = document.createElement("div");
    root.id = "backup-qr-modal";
    root.className = "backup-qr-modal";
    root.hidden = true;
    root.innerHTML = `
      <div class="backup-qr-scrim" data-bq-dismiss></div>
      <div class="backup-qr-card" role="dialog" aria-modal="true" aria-labelledby="backup-qr-title">
        <header class="backup-qr-head">
          <h3 id="backup-qr-title"></h3>
          <button type="button" class="profile-pw-close" data-bq-dismiss aria-label="Close">✕</button>
        </header>
        <p class="backup-qr-hint" id="backup-qr-hint"></p>
        <div class="backup-qr-canvas" id="backup-qr-canvas"></div>
        <p class="backup-qr-size" id="backup-qr-size"></p>
        <div class="export-nudge-actions backup-qr-actions">
          <button type="button" class="pill tight ghost" id="btn-backup-qr-copy"></button>
          <button type="button" class="pill tight accent" data-bq-dismiss id="btn-backup-qr-done"></button>
        </div>
      </div>`;
    document.body.appendChild(root);
    root.addEventListener("click", (e) => {
      if (e.target?.closest?.("[data-bq-dismiss]")) {
        root.hidden = true;
      }
    });
  }
  const title = $("backup-qr-title");
  const hint = $("backup-qr-hint");
  const sizeEl = $("backup-qr-size");
  const canvas = $("backup-qr-canvas");
  const copyBtn = $("btn-backup-qr-copy");
  const doneBtn = $("btn-backup-qr-done");
  if (title) {
    title.textContent =
      _t("settings.exportQrTitle") || "Transfer backup via QR";
  }
  if (hint) {
    hint.textContent =
      _t("settings.exportQrHint") ||
      "Scan with the other phone’s camera, copy the text, then Import user (clipboard). Keep the password.";
  }
  if (sizeEl) {
    sizeEl.textContent =
      (_t("settings.exportQrSize") || "{n} characters").replace(
        "{n}",
        String(jsonText.length)
      );
  }
  if (copyBtn) {
    copyBtn.textContent = _t("settings.exportCopyText") || "Copy text";
    copyBtn.onclick = async () => {
      await copyToClipboard(jsonText, "settings.exportCopied");
      setStatus(
        _t("settings.exportCopied") ||
          "Backup text copied — paste into Import on the other device"
      );
      trackEvent("profile_export_qr_copy");
    };
  }
  if (doneBtn) {
    doneBtn.textContent = _t("friends.exportNudgeLater") || "OK";
  }
  if (canvas) {
    canvas.innerHTML = "";
    ensureRuletQr().then((ok) => {
      if (root.hidden) return;
      if (ok && typeof RuletQr !== "undefined" && RuletQr.render) {
        RuletQr.render(canvas, jsonText, {
          size: 220,
          margin: 2,
          alt: _t("settings.exportQrTitle") || "Backup QR",
        });
      } else {
        const src =
          "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&data=" +
          encodeURIComponent(jsonText);
        canvas.innerHTML = `<img src="${src}" width="220" height="220" alt="QR" loading="lazy" />`;
      }
    });
  }
  root.hidden = false;
  trackEvent("profile_export_qr_show", { n: jsonText.length });
}

/** Soft toast after successful export — Share / QR transfer for no-account migration. */
function showBackupExportSuccessToast(encrypted, shareCtx) {
  try {
    const existing = $("backup-export-ok-toast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.id = "backup-export-ok-toast";
    toast.className = "export-nudge-toast is-backup-ok";
    toast.setAttribute("role", "status");
    toast.style.pointerEvents = "auto";
    const canFile =
      shareCtx?.file && canShareBackupFile(shareCtx.file);
    const canQr =
      shareCtx?.jsonText &&
      shareCtx.jsonText.length > 0 &&
      shareCtx.jsonText.length <= BACKUP_QR_MAX_CHARS;
    const shareLabel =
      _t("settings.exportShare") || "Share backup";
    const qrLabel = _t("settings.exportShowQr") || "QR";
    toast.innerHTML = `
      <p class="export-nudge-title">${escapeHtml(
        encrypted
          ? _t("settings.exportDoneEnc") || "Encrypted backup saved"
          : _t("settings.exportDone") || "Backup saved"
      )}</p>
      <p class="export-nudge-body">${escapeHtml(
        _t("settings.exportDoneBody") ||
          "No account on the server. Store the file and password safely — Import user restores friends on a new device. Stars stay on the hub."
      )}</p>
      <div class="export-nudge-actions">
        ${
          canFile || shareCtx?.jsonText
            ? `<button type="button" class="pill tight accent" id="btn-backup-ok-share">${escapeHtml(
                shareLabel
              )}</button>`
            : ""
        }
        ${
          canQr
            ? `<button type="button" class="pill tight ghost" id="btn-backup-ok-qr">${escapeHtml(
                qrLabel
              )}</button>`
            : ""
        }
        <button type="button" class="pill tight ghost" id="btn-backup-ok-dismiss">${escapeHtml(
          _t("friends.exportNudgeLater") || "OK"
        )}</button>
      </div>`;
    document.body.appendChild(toast);
    const dismiss = () => {
      if (toast.parentNode) toast.remove();
    };
    $("btn-backup-ok-dismiss")?.addEventListener("click", dismiss);
    $("btn-backup-ok-share")?.addEventListener("click", async () => {
      trackEvent("profile_export_toast_share");
      const r = await shareBackupFile(shareCtx?.file, {
        jsonText: shareCtx?.jsonText,
      });
      if (r === "share" || r === "copy") dismiss();
    });
    $("btn-backup-ok-qr")?.addEventListener("click", () => {
      trackEvent("profile_export_toast_qr");
      dismiss();
      showBackupTransferQr(shareCtx.jsonText);
    });
    setTimeout(dismiss, 16000);
    trackEvent("profile_export_ok_toast", {
      enc: encrypted ? 1 : 0,
      share: canFile ? 1 : 0,
      qr: canQr ? 1 : 0,
    });
  } catch (_) {}
}

/**
 * First-session education: no registration — export is your account.
 * Once after rules accepted, not during a live call.
 */
function maybeShowNoAccountBackupTip() {
  try {
    if (localStorage.getItem(NO_ACCOUNT_TIP_KEY) === "1") return;
    if (exportNudgeDone() && localStorage.getItem(EXPORT_NUDGE_KEY) === "1") {
      localStorage.setItem(NO_ACCOUNT_TIP_KEY, "1");
      return;
    }
  } catch {
    return;
  }
  if (matched || inFriendCall) return;
  if ($("no-account-tip") || $("export-nudge-toast") || $("import-backup-nudge")) {
    return;
  }
  // Wait until user has engaged a bit (rules accepted)
  try {
    if (typeof rulesAccepted === "function" && !rulesAccepted()) return;
  } catch (_) {}
  const toast = document.createElement("div");
  toast.id = "no-account-tip";
  toast.className = "export-nudge-toast is-backup-nudge";
  toast.setAttribute("role", "status");
  toast.style.pointerEvents = "auto";
  toast.innerHTML = `
    <p class="export-nudge-title">${escapeHtml(
      _t("settings.noAccountTitle") || "No signup — backup your user"
    )}</p>
    <p class="export-nudge-body">${escapeHtml(
      _t("settings.noAccountBody") ||
        "Friends live under this browser identity. Export a password-protected backup so you keep them on a new phone. No email or password account on the server."
    )}</p>
    <div class="export-nudge-actions">
      <button type="button" class="pill tight ghost" id="btn-no-acct-later">${escapeHtml(
        _t("friends.exportNudgeLater") || "Later"
      )}</button>
      <button type="button" class="pill tight accent" id="btn-no-acct-export">${escapeHtml(
        _t("settings.exportUser") || "Export user"
      )}</button>
    </div>`;
  document.body.appendChild(toast);
  const dismiss = (permanent) => {
    try {
      if (permanent) localStorage.setItem(NO_ACCOUNT_TIP_KEY, "1");
    } catch (_) {}
    if (toast.parentNode) toast.remove();
  };
  $("btn-no-acct-later")?.addEventListener("click", () => {
    trackEvent("no_account_tip_later");
    dismiss(true);
  });
  $("btn-no-acct-export")?.addEventListener("click", async () => {
    trackEvent("no_account_tip_export");
    dismiss(true);
    await exportProfileFile();
  });
  setTimeout(() => dismiss(false), 22000);
  trackEvent("no_account_tip_show");
}

/** Soft one-shot after successful profile import (shown post-reload). */
function maybeShowImportBackupNudge() {
  try {
    // Retention-critical — always allowed even when soft marketing popups are off
    if (localStorage.getItem(IMPORT_BACKUP_NUDGE_KEY) !== "1") return;
  } catch {
    return;
  }
  if ($("export-nudge-toast") || $("import-backup-nudge")) return;
  clearImportBackupNudge();
  const toast = document.createElement("div");
  toast.id = "import-backup-nudge";
  toast.className = "export-nudge-toast is-backup-nudge";
  toast.setAttribute("role", "status");
  toast.style.pointerEvents = "auto";
  toast.innerHTML = `
    <p class="export-nudge-title">${escapeHtml(
      _t("friends.importBackupTitle") || "Backup this device"
    )}</p>
    <p class="export-nudge-body">${escapeHtml(
      _t("friends.importBackupNudge") ||
        "Profile imported. Save a password-protected backup so you don’t lose friends if this browser is cleared."
    )}</p>
    <div class="export-nudge-actions">
      <button type="button" class="pill tight ghost" id="btn-import-nudge-later">${escapeHtml(
        _t("friends.importBackupLater") || "Later"
      )}</button>
      <button type="button" class="pill tight accent" id="btn-import-nudge-now">${escapeHtml(
        _t("friends.exportNudgeBtn") || "Encrypt & export"
      )}</button>
    </div>`;
  document.body.appendChild(toast);
  const dismiss = () => {
    if (toast.parentNode) toast.remove();
  };
  $("btn-import-nudge-later")?.addEventListener("click", dismiss);
  $("btn-import-nudge-now")?.addEventListener("click", async () => {
    trackEvent("import_backup_nudge_export");
    const ok = await exportProfileFile();
    if (ok) dismiss();
  });
  setTimeout(dismiss, 28000);
  trackEvent("import_backup_nudge_show");
}

/**
 * Retention toast after first friend / star / mutual accept.
 * Always allowed (not a soft marketing popup). Permanent dismiss only after successful export.
 * Later / auto-hide can re-show after 1 day.
 */
function maybeShowFirstFriendExportNudge(reason) {
  if (exportNudgeDone()) return;
  if ($("export-nudge-toast") || $("import-backup-nudge")) return;
  // Don't cover live video with a modal-feeling toast mid-call
  if (matched || inFriendCall) {
    if (!maybeShowFirstFriendExportNudge._deferred) {
      maybeShowFirstFriendExportNudge._deferred = reason || "first_friend";
      setTimeout(() => {
        const r = maybeShowFirstFriendExportNudge._deferred;
        maybeShowFirstFriendExportNudge._deferred = null;
        if (!matched && !inFriendCall) maybeShowFirstFriendExportNudge(r);
      }, 12000);
    }
    return;
  }
  markExportNudgeShown();
  const toast = document.createElement("div");
  toast.id = "export-nudge-toast";
  toast.className = "export-nudge-toast is-backup-nudge";
  toast.setAttribute("role", "status");
  toast.style.pointerEvents = "auto";
  const title =
    reason === "first_star"
      ? _t("friends.exportNudgeStarTitle") || "You earned a star ★"
      : reason === "friend_accept"
        ? _t("friends.exportNudgeAcceptTitle") || "You’re friends now"
        : _t("friends.exportNudgeTitle") || "Friend saved";
  const body =
    reason === "first_star"
      ? _t("friends.exportNudgeStar") ||
        "Save a password-protected backup so friends & identity survive if this browser is cleared."
      : _t("friends.exportNudge") ||
        "Save a password-protected backup so you don’t lose them if this browser is cleared.";
  toast.innerHTML = `
    <p class="export-nudge-title">${escapeHtml(title)}</p>
    <p class="export-nudge-body">${escapeHtml(body)}</p>
    <div class="export-nudge-actions">
      <button type="button" class="pill tight ghost" id="btn-export-nudge-later">${escapeHtml(
        _t("friends.exportNudgeLater") || "Later"
      )}</button>
      <button type="button" class="pill tight accent" id="btn-export-nudge-now">${escapeHtml(
        _t("friends.exportNudgeBtn") || "Encrypt & export"
      )}</button>
    </div>`;
  document.body.appendChild(toast);
  trackEvent("export_nudge_show", { reason: reason || "first_friend" });
  const dismiss = (exported) => {
    if (exported) markExportNudgeDone();
    if (toast.parentNode) toast.remove();
  };
  $("btn-export-nudge-later")?.addEventListener("click", () => {
    trackEvent("export_nudge_later");
    dismiss(false);
  });
  $("btn-export-nudge-now")?.addEventListener("click", async () => {
    trackEvent("export_nudge_export");
    // Only permanent-dismiss if they finished export (password modal may cancel)
    const ok = await exportProfileFile();
    if (ok) dismiss(true);
  });
  setTimeout(() => dismiss(false), 28000);
}

function closeAllFriendMoreMenus() {
  document.querySelectorAll(".friend-more-menu").forEach((m) => {
    m.hidden = true;
  });
  document.querySelectorAll(".btn-friend-more").forEach((b) => {
    b.setAttribute("aria-expanded", "false");
  });
}

/** True if parsed JSON looks like a plain or encrypted ruletka profile backup. */
function looksLikeProfileBackup(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (isEncryptedProfile(obj)) return true;
  const fmt = String(obj.format || "");
  if (fmt.startsWith("ruletka-profile")) return true;
  const uid = obj.identity?.user_id || obj.user_id;
  return !!(uid && String(uid).length >= 8);
}

/**
 * Import from clipboard if it holds a backup; otherwise open file picker.
 * Enables QR → scan → copy → Import and Share-text → paste flows.
 */
async function tryImportFromClipboardOrFile() {
  try {
    if (navigator.clipboard?.readText) {
      const text = (await navigator.clipboard.readText()).trim();
      if (text && text.length > 40 && (text[0] === "{" || text[0] === "[")) {
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }
        if (parsed && looksLikeProfileBackup(parsed)) {
          const ok = confirm(
            _t("settings.importFromClipboard") ||
              "Clipboard has a profile backup. Import it now?"
          );
          if (ok) {
            trackEvent("profile_import_clipboard", { n: text.length });
            await importProfileParsed(parsed);
            return;
          }
        }
      }
    }
  } catch (_) {
    // permission denied / insecure context — fall through to file
  }
  $("import-profile-file")?.click();
}

/** @returns {Promise<boolean>} true if a file was downloaded */
async function exportProfileFile() {
  try {
    const data = buildProfileExport();
    if (!data.identity.user_id) {
      setStatus(_t("settings.exportNoId") || "No identity yet — open live once first");
      return false;
    }
    const password = await openProfilePasswordModal({ mode: "export" });
    if (password === null) return false; // cancelled

    let payload;
    let encrypted = false;
    if (password === "") {
      // Explicit “export without password” — legacy plain JSON
      payload = data;
      encrypted = false;
    } else {
      setStatus(_t("settings.exportEncrypting") || "Encrypting…");
      payload = await encryptProfilePayload(data, password);
      encrypted = true;
    }

    // Pretty for download; compact for share/QR size
    const pretty = JSON.stringify(payload, null, 2);
    const compact = JSON.stringify(payload);
    const blob = new Blob([pretty], { type: "application/json" });
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = encrypted
      ? `ruletka-profile-${stamp}.enc.json`
      : `ruletka-profile-${stamp}.json`;
    const file =
      typeof File !== "undefined"
        ? new File([blob], filename, { type: "application/json" })
        : null;

    // Always download a local copy first
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);

    _lastBackupShare = {
      file: file || blob,
      filename,
      jsonText: compact,
      encrypted,
      at: Date.now(),
    };

    markExportNudgeDone();
    markProfileExported();
    setStatus(
      (encrypted
        ? _t("settings.exportDoneEnc") || "Encrypted profile exported"
        : _t("settings.exportDone") || "Profile exported") +
        " · " +
        (_t("settings.exportDoneNext") ||
          "Keep the file + password to import on a new phone.") +
        " · " +
        (_t("settings.exportStarsNote") || "Stars are not in this file (hub-only).")
    );
    log(
      encrypted
        ? _t("settings.exportDoneEnc") || "Encrypted profile exported"
        : _t("settings.exportDone")
    );

    // Soft success toast with Share / optional QR (no signup pitch)
    try {
      showBackupExportSuccessToast(encrypted, _lastBackupShare);
    } catch (_) {}

    // Auto-open native share when the browser supports file sharing (mobile)
    try {
      if (file && canShareBackupFile(file)) {
        // Brief delay so download + toast paint first
        setTimeout(() => {
          shareBackupFile(file, { jsonText: compact }).catch(() => {});
        }, 400);
      }
    } catch (_) {}

    try {
      trackEvent("profile_export", {
        encrypted: encrypted ? 1 : 0,
        bytes: compact.length,
        qr_ok: compact.length <= BACKUP_QR_MAX_CHARS ? 1 : 0,
      });
    } catch (_) {}
    return true;
  } catch (e) {
    setStatus(_t("settings.exportFail") || "Export failed");
    console.warn("[export]", e);
    return false;
  }
}

async function importProfileFile(file) {
  if (!file) return;
  let raw;
  try {
    const text = await file.text();
    raw = JSON.parse(text);
  } catch {
    setStatus(_t("settings.importBad") || "Invalid profile file");
    return;
  }
  await importProfileParsed(raw);
}

/** Decrypt (if needed) and apply a parsed backup object. */
async function importProfileParsed(raw) {
  if (!raw || typeof raw !== "object") {
    setStatus(_t("settings.importBad") || "Invalid profile file");
    return;
  }
  let data = raw;
  if (isEncryptedProfile(raw)) {
    // Retry loop until unlock or cancel
    for (;;) {
      const password = await openProfilePasswordModal({ mode: "import" });
      if (password === null) return;
      try {
        setStatus(_t("settings.importDecrypting") || "Decrypting…");
        data = await decryptProfilePayload(raw, password);
        break;
      } catch (e) {
        console.warn("[import decrypt]", e);
        setStatus(
          _t("settings.importWrongPw") ||
            "Wrong password or damaged file — try again"
        );
        // loop: show modal again
      }
    }
  }

  await applyImportedProfile(data);
}

/** Apply a decrypted/plain profile object (shared by plain + encrypted import). */
async function applyImportedProfile(data) {
  if (!data || typeof data !== "object") {
    setStatus(_t("settings.importBad") || "Invalid profile file");
    return;
  }
  // Strip any star/coin fields before applying (crafted files cannot mint reputation)
  data = scrubStarsFromImportValue(data);
  if (data && typeof data === "object") {
    delete data.stars;
    delete data.myStars;
    delete data.star_counts;
    delete data.star_edges;
    delete data.star_effects;
    delete data.coins;
    if (data.identity && typeof data.identity === "object") {
      delete data.identity.stars;
      delete data.identity.star_count;
      delete data.identity.coins;
    }
  }
  const uid =
    data?.identity?.user_id ||
    data?.user_id ||
    (typeof data?.identity === "string" ? data.identity : "");
  if (!uid || String(uid).length < 8) {
    setStatus(_t("settings.importBad") || "Invalid profile file");
    return;
  }
  if (data.format && data.format !== PROFILE_FORMAT && !isEncryptedProfile(data)) {
    // allow older/simple files if user_id present
    if (!data.identity?.user_id && !data.user_id) {
      setStatus(_t("settings.importBad") || "Invalid profile file");
      return;
    }
  }
  const cur = loadIdentity().user_id;
  const msg = _t("settings.importConfirm", {
    id: String(uid).slice(0, 12) + "…",
    cur: cur ? String(cur).slice(0, 12) + "…" : "—",
  });
  if (!confirm(msg || `Replace this browser’s identity with ${uid}?`)) return;

  try {
    // Clear crypto keys so IndexedDB does not override imported user_id
    if (typeof RuletIdentity !== "undefined" && RuletIdentity.clearDeviceKeys) {
      await RuletIdentity.clearDeviceKeys();
    }
    const name = (data.identity?.name || data.name || "").toString().slice(0, 32);
    saveIdentity({
      user_id: String(uid),
      name,
      cryptoBound: false,
      imported: true,
      importedAt: Date.now(),
      // never import stars into identity
    });
    // Never trust client-side star balances — reset until hub hello
    myStars = 0;
    myTrust = 0;
    myTrustEffective = 0;
    myTrustGifters = 0;
    myTrustLastTs = 0;
    partnerStars = 0;
    try {
      setStarsBadge("local", 0);
      setStarsBadge("remote", 0);
    } catch (_) {}
    if (data.prefs && typeof data.prefs === "object") {
      try {
        const cleanPrefs = scrubStarsFromImportValue(data.prefs);
        localStorage.setItem(PREFS_KEY, JSON.stringify(cleanPrefs));
      } catch (_) {}
    }
    if (Array.isArray(data.history)) {
      try {
        const hist = scrubStarsFromImportValue(data.history.slice(0, MAX_HISTORY));
        localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
      } catch (_) {}
    }
    if (data.lang) {
      try {
        localStorage.setItem("nextface-lang-v1", String(data.lang));
        await NextfaceI18n?.setLang?.(String(data.lang));
      } catch (_) {}
    }
    if (data.rules_accepted) {
      try {
        localStorage.setItem(RULES_KEY, "1");
      } catch (_) {}
    }
    if (data.hub && typeof RuletHub !== "undefined") {
      try {
        if (data.hub.base) RuletHub.setBase?.(data.hub.base, { persist: true });
        if (typeof data.hub.auto === "boolean") {
          RuletHub.setAutoFailover?.(data.hub.auto);
        }
      } catch (_) {}
    }
    if (data.identity?.friend_code) {
      myFriendCode = String(data.identity.friend_code);
    }
    // Restore local friend-code backup for re-request UI (no stars on friends)
    if (Array.isArray(data.friends) && data.friends.length) {
      const cleaned = scrubStarsFromImportValue(data.friends);
      saveFriendsBackup(cleaned);
      // Restore per-friend nicknames embedded on rows
      try {
        const map = loadFriendNicks();
        for (const f of cleaned) {
          if (f?.user_id && f.nick) map[String(f.user_id)] = String(f.nick).slice(0, 32);
        }
        saveFriendNicks(map);
      } catch (_) {}
    }
    // Full nick map (preferred)
    if (data.friend_nicks && typeof data.friend_nicks === "object") {
      try {
        const cleaned = scrubStarsFromImportValue(data.friend_nicks);
        const map = loadFriendNicks();
        for (const [k, v] of Object.entries(cleaned || {})) {
          if (k && v) map[String(k)] = String(v).slice(0, 32);
        }
        saveFriendNicks(map);
      } catch (_) {}
    }
    markImportBackupNudgePending();
    setStatus(
      _t("settings.importDoneStarsHub") ||
        _t("settings.importDone") ||
        "Profile imported — stars load from the hub for this identity"
    );
    log(_t("settings.importDone") + " → " + String(uid).slice(0, 16));
    try {
      trackEvent("profile_import", { ok: 1 });
    } catch (_) {}
    setTimeout(() => location.reload(), 400);
  } catch (e) {
    console.warn("[import]", e);
    setStatus(_t("settings.importFail") || "Import failed");
  }
}

/** Focus trap for modal sheets (Friends / Settings). */
let sheetFocusRestoreEl = null;

function bindSheetFocusTrap(sheet) {
  if (!sheet) return;
  releaseSheetFocusTrap(sheet);
  sheetFocusRestoreEl = document.activeElement;
  const sel =
    'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const onKey = (e) => {
    if (e.key !== "Tab" || sheet.hidden) return;
    const list = [...sheet.querySelectorAll(sel)].filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  sheet._focusTrap = onKey;
  document.addEventListener("keydown", onKey);
  setTimeout(() => {
    try {
      const list = sheet.querySelectorAll(sel);
      const prefer =
        sheet.querySelector(".sheet-close") ||
        sheet.querySelector("input, button.pill, button");
      (prefer || list[0])?.focus?.();
    } catch (_) {}
  }, 60);
}

function releaseSheetFocusTrap(sheet) {
  if (sheet && sheet._focusTrap) {
    document.removeEventListener("keydown", sheet._focusTrap);
    sheet._focusTrap = null;
  }
  const prev = sheetFocusRestoreEl;
  sheetFocusRestoreEl = null;
  if (prev && typeof prev.focus === "function") {
    try {
      prev.focus({ preventScroll: true });
    } catch (_) {
      try {
        prev.focus();
      } catch (_) {}
    }
  }
}

/** Dock flyouts (Settings / Friends / Messages): open beside icon, no screen dim. */
const DOCK_FLYOUT_GAP = 8;
const DOCK_FLYOUT_MARGIN = 8;

function friendsFlyoutMaxHeight() {
  const vh = window.innerHeight || 640;
  // Tall sheet: most of the viewport so name → code → pending → friends fit without tiny scroll
  return Math.min(vh * 0.94, 900);
}

function settingsFlyoutMaxHeight() {
  const vh = window.innerHeight || 640;
  // Tall settings so account section at the bottom is reachable with less scroll
  return Math.min(vh * 0.9, 780);
}

function positionDockFlyout(sheet, anchor, opts = {}) {
  if (!sheet || !anchor) return;
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxW = Math.min(opts.maxWidth || 380, vw - DOCK_FLYOUT_MARGIN * 2);
  const isFriends = sheet.id === "friends-sheet";
  const isSettings = sheet.id === "settings-sheet" || sheet.classList.contains("settings-app");
  const preferH =
    opts.maxHeight ||
    (isFriends
      ? friendsFlyoutMaxHeight()
      : isSettings
        ? settingsFlyoutMaxHeight()
        : Math.min(vh * 0.72, 560));
  const spaceAbove = rect.top - DOCK_FLYOUT_MARGIN;
  const spaceBelow = vh - rect.bottom - DOCK_FLYOUT_MARGIN;
  // Friends: always open upward from dock when possible (taller + sits lower on screen)
  const placeAbove =
    isFriends
      ? spaceAbove >= 160 || spaceAbove >= spaceBelow
      : isSettings
        ? spaceAbove >= Math.min(preferH * 0.55, 280) || spaceAbove >= spaceBelow
        : spaceAbove >= Math.min(preferH, 240) || spaceAbove >= spaceBelow;
  // Friends: snug to dock icon (2–4px) so the sheet sits lower / taller into the stage
  const gap = isFriends ? 4 : DOCK_FLYOUT_GAP;
  const maxH = Math.max(
    isFriends ? 420 : isSettings ? 320 : 160,
    Math.min(preferH, placeAbove ? spaceAbove - gap : spaceBelow - gap)
  );

  // Horizontal: start = left-align to icon, end = right-align, center = mid
  let left;
  if (opts.align === "end") left = rect.right - maxW;
  else if (opts.align === "start") left = rect.left;
  else left = rect.left + rect.width / 2 - maxW / 2;
  left = Math.max(DOCK_FLYOUT_MARGIN, Math.min(left, vw - maxW - DOCK_FLYOUT_MARGIN));

  sheet.style.width = `${maxW}px`;
  sheet.style.maxHeight = `${maxH}px`;
  // Settings views are position:absolute inset:0 — parent needs a real height.
  // Friends needs a real height too so .sheet-body can scroll inside.
  if (
    opts.fixedHeight ||
    sheet.classList.contains("settings-app") ||
    isFriends
  ) {
    sheet.style.height = `${Math.round(maxH)}px`;
  } else {
    sheet.style.height = "auto";
  }
  sheet.style.left = `${Math.round(left)}px`;
  sheet.style.right = "auto";
  if (placeAbove) {
    sheet.style.top = "auto";
    // Friends sits snug above the dock icon (lower on the screen, taller body)
    sheet.style.bottom = `${Math.round(vh - rect.top + gap)}px`;
    sheet.style.transformOrigin = opts.align === "end" ? "bottom right" : opts.align === "start" ? "bottom left" : "bottom center";
  } else {
    sheet.style.bottom = "auto";
    sheet.style.top = `${Math.round(rect.bottom + gap)}px`;
    sheet.style.transformOrigin = opts.align === "end" ? "top right" : opts.align === "start" ? "top left" : "top center";
  }
}

function setDockFlyoutOpen(btn, open) {
  if (!btn) return;
  btn.classList.toggle("is-flyout-open", !!open);
  btn.setAttribute("aria-expanded", open ? "true" : "false");
}

function repositionOpenDockFlyouts() {
  if (settingsIsOpen()) {
    positionDockFlyout($("settings-sheet"), $("btn-settings"), {
      align: "end",
      maxWidth: 400,
      maxHeight: settingsFlyoutMaxHeight(),
      fixedHeight: true,
    });
  }
  if (friendsIsOpen()) {
    positionDockFlyout($("friends-sheet"), $("btn-friends"), {
      align: "start",
      maxWidth: 400,
      maxHeight: friendsFlyoutMaxHeight(),
      fixedHeight: true,
    });
  }
  if (messagesIsOpen()) {
    positionDockFlyout($("messages-sheet"), $("btn-messages"), { align: "start", maxWidth: 400 });
  }
  if (starsSheetIsOpen()) {
    positionStarsSheet($("stars-sheet"));
  }
}

function closeAllDockFlyouts(except) {
  if (except !== "settings" && settingsIsOpen()) closeSettings();
  if (except !== "friends" && friendsIsOpen()) closeFriends();
  if (except !== "messages" && messagesIsOpen()) closeMessages();
  if (except !== "stars" && starsSheetIsOpen()) closeStarsSheet();
}

function openSettings(opts = {}) {
  closeAllDockFlyouts("settings");
  const sheet = $("settings-sheet");
  const bd = $("sheet-backdrop");
  const btn = $("btn-settings");
  // Re-apply strings so labels never stick as raw keys
  try {
    NextfaceI18n?.applyI18n?.(sheet || document);
  } catch (_) {}
  // Show main view first so the sheet has content while measuring
  const openView =
    opts && typeof opts.view === "string" && opts.view
      ? opts.view
      : "main";
  showSettingsView(openView === "stars" ? "main" : openView);
  if (sheet) {
    sheet.hidden = false;
    sheet.removeAttribute("hidden");
    positionDockFlyout(sheet, btn, {
      align: "end",
      maxWidth: 400,
      maxHeight: settingsFlyoutMaxHeight(),
      fixedHeight: true,
    });
    // force reflow then animate in
    void sheet.offsetWidth;
    sheet.classList.add("is-open");
  }
  if (bd) {
    bd.hidden = false;
    bd.removeAttribute("hidden");
    bd.classList.add("is-open");
  }
  setDockFlyoutOpen(btn, true);
  syncNameInputs(getDisplayName());
  refreshSecurityPanel();
  refreshAvatarUi();
  syncSettingsSummary();
  bindSheetFocusTrap(sheet);
  (async () => {
    if (!previewStream?.active) await ensurePreview();
    await refreshDevices().catch(() => {});
    syncSettingsSummary();
    refreshSecurityPanel();
    // Reposition after content may have grown
    if (settingsIsOpen()) {
      positionDockFlyout(sheet, btn, {
        align: "end",
        maxWidth: 400,
        maxHeight: settingsFlyoutMaxHeight(),
        fixedHeight: true,
      });
    }
  })();
}
function closeSettings() {
  stopConnDetailsLive();
  const sheet = $("settings-sheet");
  const bd = $("sheet-backdrop");
  const btn = $("btn-settings");
  releaseSheetFocusTrap(sheet);
  sheet?.classList.remove("is-open");
  bd?.classList.remove("is-open");
  setDockFlyoutOpen(btn, false);
  // Allow fade/slide to finish before hiding
  setTimeout(() => {
    if (sheet) sheet.hidden = true;
    if (bd) bd.hidden = true;
    showSettingsView("main");
  }, 160);
}

function settingsIsOpen() {
  const sheet = $("settings-sheet");
  return !!(sheet && !sheet.hidden);
}

function friendsIsOpen() {
  const sheet = $("friends-sheet");
  return !!(sheet && !sheet.hidden);
}

function messagesIsOpen() {
  const sheet = $("messages-sheet");
  return !!(sheet && !sheet.hidden && messagesSheetOpen);
}

function toggleSettings() {
  if (settingsIsOpen()) closeSettings();
  else openSettings();
}
function toggleFriends() {
  if (friendsIsOpen()) closeFriends();
  else openFriends();
}
function toggleMessages(tab) {
  if (messagesIsOpen() && !tab) closeMessages();
  else openMessages(tab);
}

function startPing() {
  stopPing();
  pingTimer = setInterval(() => send({ type: "ping" }), 15000);
}
function stopPing() {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = 0;
}

const MAX_RECONNECT = 8;

/** Apply a hub switch (ICE config + UI) after RuletHub.ensureHealthyHub. */
async function applyHubSwitchResult(r) {
  if (!r?.switched || !r.base) return false;
  const short = shortHubLabel(r.base, 32);
  log(_t("hub.switched", { h: r.base }) || `hub → ${r.base}`);
  setStatus(_t("hub.switched", { h: short }) || `hub → ${short}`);
  showHubSwitchedToast(r.base);
  refreshHubChip();
  trackEvent("hub_switch", { host: short });
  syncHubSettingsUi();
  if (typeof loadRtcConfig === "function") {
    try {
      await loadRtcConfig(r.base);
    } catch (_) {}
  }
  return true;
}

/** Soft toast when auto-failover picks another hub (not a forced modal). */
function showHubSwitchedToast(base) {
  try {
    let host = shortHubLabel(base, 40);
    try {
      host = new URL(base).host;
    } catch (_) {}
    const id = "hub-switch-toast";
    const existing = $(id);
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.id = id;
    toast.className = "friend-soft-toast friend-soft-toast-ok hub-switch-toast";
    toast.setAttribute("role", "status");
    toast.style.pointerEvents = "auto";
    toast.innerHTML = `
      <strong>${escapeHtml(_t("hub.switchedTitle") || "Switched hub")}</strong>
      <span>${escapeHtml(
        _t("hub.switchedBody", { h: host }) ||
          `Matchmaking via ${host}. Video stays peer-to-peer when possible.`
      )}</span>
      <div class="export-nudge-actions" style="margin-top:0.4rem">
        <button type="button" class="pill tight ghost" id="btn-hub-toast-ok">${escapeHtml(
          _t("friends.exportNudgeLater") || "OK"
        )}</button>
        <button type="button" class="pill tight" id="btn-hub-toast-settings">${escapeHtml(
          _t("settings.secHub") || "Network hub"
        )}</button>
      </div>`;
    document.body.appendChild(toast);
    const dismiss = () => {
      if (toast.parentNode) toast.remove();
    };
    $("btn-hub-toast-ok")?.addEventListener("click", dismiss);
    $("btn-hub-toast-settings")?.addEventListener("click", () => {
      dismiss();
      try {
        openSettings();
        showSettingsView("hub");
      } catch (_) {}
    });
    setTimeout(dismiss, 8000);
  } catch (_) {}
}

/**
 * Try public directory for a live hub. forceSwitch prefers a different host.
 * @returns {Promise<boolean>} true if base changed
 */
async function tryHubFailover({ force = true } = {}) {
  if (typeof RuletHub === "undefined" || !RuletHub.ensureHealthyHub) return false;
  if (!RuletHub.autoFailoverEnabled()) return false;
  try {
    const r = await RuletHub.ensureHealthyHub({
      forceSwitch: !!force,
      preferDifferent: !!force,
    });
    return await applyHubSwitchResult(r);
  } catch (_) {
    return false;
  }
}

function manualReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = 0;
  }
  reconnectAttempt = 0;
  intentionalClose = false;
  setStatus(_t("conn.connecting"));
  setConnStrip("warn", _t("conn.connecting"), "", { reconnecting: true, showRetry: true });
  (async () => {
    // On manual retry, re-probe directory in case this hub is dead
    if (
      typeof RuletHub !== "undefined" &&
      RuletHub.autoFailoverEnabled?.()
    ) {
      try {
        await RuletHub.ensureHealthyHub({ forceSwitch: false });
        syncHubSettingsUi();
      } catch (_) {}
    }
    connect(false);
  })();
}

/** True after a drop so hello_ok can show a soft “back online” toast. */
let wasHubReconnecting = false;

function scheduleReconnect() {
  if (intentionalClose) return;
  wasHubReconnecting = true;
  if (reconnectAttempt >= MAX_RECONNECT) {
    setStatus(_t("status.disconnected"));
    setConnStrip("bad", _t("conn.gaveUp") || _t("conn.disconnected"), "", {
      showRetry: true,
      reconnecting: true,
    });
    log(_t("hub.gaveUp") || "gave up reconnecting — trying other hubs / reload");
    // Exhausted attempts → force directory failover, then reconnect
    reconnectTimer = setTimeout(async () => {
      reconnectAttempt = 0;
      await tryHubFailover({ force: true });
      connect(false);
    }, 2500);
    return;
  }
  const attempt = reconnectAttempt;
  const delay = Math.min(12000, 600 * Math.pow(1.7, reconnectAttempt++));
  const secs = Math.round(delay / 100) / 10;
  setStatus(_t("log.reconnectIn", { s: secs }));
  setConnStrip(
    "warn",
    _t("conn.retryIn", { s: secs }) || _t("log.reconnectIn", { s: secs }),
    "",
    { showRetry: true, reconnecting: true }
  );
  reconnectTimer = setTimeout(async () => {
    // After 2 failed attempts, walk the public hub directory
    if (attempt >= 2) {
      await tryHubFailover({ force: true });
    } else if (attempt >= 1) {
      // Soft check: keep current if healthy, else switch
      await tryHubFailover({ force: false });
    }
    connect(true);
  }, delay);
}

function connect(isRetry = false) {
  // Cancel any pending auto-reconnect and ignore close from the socket we replace
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = 0;
  }
  if (ws) {
    try {
      intentionalClose = true;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.close();
    } catch (_) {}
    ws = null;
  }
  intentionalClose = false;

  setStatus(isRetry ? _t("status.reconnecting") : _t("status.connecting"));
  let url;
  try {
    url = wsUrl();
  } catch (e) {
    setStatus(_t("status.socketError"));
    log("bad ws url: " + e);
    return;
  }

  let socket;
  try {
    socket = new WebSocket(url);
  } catch (e) {
    setStatus(_t("status.socketError"));
    log("WebSocket create failed: " + e);
    if (!isRetry) scheduleReconnect();
    return;
  }
  ws = socket;

  socket.onopen = () => {
    if (ws !== socket) return;
    reconnectAttempt = 0;
    const rejoining = wantSearch || inQueue;
    setStatus(rejoining ? _t("status.rejoinQueue") : _t("status.connected"));
    updateConnFromState();
    const idn = loadIdentity();
    myUserId = idn.user_id;
    sendHelloPayload(getDisplayName());
    const room = currentRoom();
    if (room) send({ type: "set_room", room });
    // Apply pending friend invite from URL / session (survives rules gate)
    stashPendingFriendFromUrl();
    captureInviteFunnelLanding();
    setTimeout(() => {
      if (ws === socket && ws.readyState === WebSocket.OPEN) {
        applyPendingFriendInvite({ forceOpen: true });
      }
    }, 450);
    startPing();
    // Re-enter match queue after blip (hello is already sent)
    if (wantSearch || inQueue) {
      setTimeout(() => {
        if (ws === socket && ws.readyState === WebSocket.OPEN && (wantSearch || inQueue) && !matched) {
          send(spinPayload());
          setPhase("waiting");
          setStatus(_t("status.searching"));
          updateConnFromState();
        }
      }, 250);
    } else {
      // Shared ?room= link: auto-join private lobby once connected
      setTimeout(() => maybeAutoJoinRoomInvite(), 300);
    }
  };
  socket.onclose = () => {
    if (ws !== socket) return; // superseded by a newer connect()
    stopPing();
    stopStats();
    clearCallTimeout();
    hideIncomingCall();
    ws = null;
    setStatus(_t("status.disconnected"));
    updateConnFromState();
    // Presence is hub-scoped — until re-hello, don't show stale Call buttons
    if (Array.isArray(friendsCache) && friendsCache.length) {
      for (const f of friendsCache) {
        if (f) f.online = false;
      }
      try {
        renderFriendsList();
        renderHistoryList();
        updateFriendsOnlineStrip();
      } catch (_) {}
    }
    if (!intentionalClose) {
      const wasInQueue = inQueue || wantSearch;
      const wasFriend = inFriendCall || matchMode === "friend";
      if (matched || wasInQueue) wantSearch = true;
      // Don't kill camera preview on brief disconnects
      if (wasFriend) {
        log(_t("status.friendCallLost"));
        setStatus(_t("status.friendCallLost"));
        inFriendCall = false;
        matchMode = "solo";
        yourRole = "solo";
        wantSearch = false;
        inQueue = false;
      }
      matched = false;
      primaryPartnerUserId = "";
      pendingSignals.length = 0;
      closeAllPeers({ keepFriend: false });
      setSplitRemote(false);
      setRemoteEmpty(true);
      // Keep "waiting" chrome if we were searching so reconnect feels continuous
      if (wasInQueue && !wasFriend) {
        setPhase("waiting");
        setStatus(_t("status.reconnecting"));
      } else {
        setPhase("idle");
      }
      setArchPill("default");
      showChatPanel(false);
      updateFriendActionButtons();
      scheduleReconnect();
    }
  };
  socket.onerror = () => {
    if (ws === socket) {
      setStatus(_t("status.socketError"));
      updateConnFromState();
    }
  };
  socket.onmessage = (ev) => {
    if (ws !== socket) return;
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    handleServer(msg);
  };
}

function handleServer(msg) {
  switch (msg.type) {
    case "hello_ok":
      myShortId = msg.short_id || "";
      myPeerId = msg.peer_id || "";
      myUserId = msg.user_id || myUserId;
      myFriendCode = msg.friend_code || "";
      if ($("my-friend-code")) $("my-friend-code").textContent = myFriendCode;
      myStars = Math.max(0, Number(msg.stars) || 0);
      myTrust = Math.max(0, Number(msg.trust) || 0);
      myTrustGifters = Math.max(0, Number(msg.trust_gifters) || 0);
      myTrustLastTs = Math.max(0, Number(msg.trust_last_ts) || 0);
      myTrustGivers = Array.isArray(msg.trust_givers)
        ? msg.trust_givers
            .map((c) => ({
              initial: String(c?.initial || "★").slice(0, 2),
              flag: String(c?.flag || "").trim(),
            }))
            .filter((c) => c.initial)
        : [];
      myTrustEffective =
        msg.trust_effective != null
          ? Math.max(0, Number(msg.trust_effective) || 0)
          : clientEffectiveTrust(myTrust, myTrustGifters);
      notePeakTrust(myTrust);
      applyStarRateWindowFromHub(msg);
      setStarsBadge("local", myStars, { trust: myTrustEffective });
      maybeStarsMilestones({ gifters: myTrustGifters, balance: myStars });
      try {
        maybeWelcomeBackOnHello();
      } catch (_) {}
      // Bars (etc.) persist across logout — re-apply on hello
      setFxOverlay(
        "local",
        msg.effect || "",
        Number(msg.effect_until) || 0,
        Number(msg.effect_level) || 1
      );
      syncAccountSettingsSummary();
      // Prefer local saved name; otherwise accept server echo
      {
        const local = (loadIdentity().name || "").trim();
        const shown = local || msg.name || "anon";
        if (local) saveIdentity({ name: local });
        else if (msg.name && msg.name !== "anon") saveIdentity({ name: msg.name });
        syncNameInputs(shown);
      }
      setStatus(_t("status.connected"));
      hideReconnectBanner();
      if (wasHubReconnecting) {
        wasHubReconnecting = false;
        showBackOnlineToast();
        trackEvent("hub_back_online");
      }
      updateConnFromState();
      log(
        _t("log.id", { id: msg.short_id }) +
          (myFriendCode ? ` · ${myFriendCode}` : "") +
          ` · ${getDisplayName()}`
      );
      if (msg.media === "webrtc-p2p" || msg.signaling === "bridge") {
        setArchPill("default");
      }
      if (msg.signaling === "freenet") setArchPill("freenet");
      break;
    case "friends":
      {
        const prevCount = (friendsCache || []).length;
        const prevFriendIds = new Set(
          (friendsCache || []).map((f) => f.user_id).filter(Boolean)
        );
        const prevOutgoingIds = new Set(
          (outgoingRequests || []).map((f) => f.user_id).filter(Boolean)
        );
        const prevOnline = new Map(
          (friendsCache || []).map((f) => [f.user_id, !!f.online])
        );
        friendsCache = dedupeByUserId(msg.friends || []);
        blockedCache = Array.isArray(msg.blocked)
          ? [...new Set(msg.blocked.map(String))]
          : [];
        incomingRequests = dedupeByUserId(
          Array.isArray(msg.incoming_requests) ? msg.incoming_requests : []
        );
        outgoingRequests = dedupeByUserId(
          Array.isArray(msg.outgoing_requests) ? msg.outgoing_requests : []
        );
        try {
          syncRemoteMutualChip();
        } catch (_) {}
        if (msg.friend_code) {
          myFriendCode = msg.friend_code;
          if ($("my-friend-code")) $("my-friend-code").textContent = myFriendCode;
        }
        // Deep-link invite may have been waiting for hello / friend_code
        try {
          if (getPendingFriendCode() && !pendingFriendInviteHandled) {
            applyPendingFriendInvite({ forceOpen: false });
          }
        } catch (_) {}
        // Local mirror so codes survive for re-request / profile export
        if (friendsCache.length) saveFriendsBackup(friendsCache);
        // Toast when a known friend comes online (not first empty→full load)
        if (prevOnline.size) {
          for (const f of friendsCache) {
            if (f.online && prevOnline.has(f.user_id) && !prevOnline.get(f.user_id)) {
              showFriendOnlineToast(f);
            }
          }
        }
        // Mutual accept completed: someone we requested (or any new friend) landed
        let acceptedNew = false;
        if (prevCount > 0 || prevOutgoingIds.size || prevFriendIds.size) {
          for (const f of friendsCache) {
            if (!f.user_id || prevFriendIds.has(f.user_id)) continue;
            // New friend row — celebrate Accept (skip first full list hydrate when prev was empty)
            if (prevFriendIds.size || prevOutgoingIds.has(f.user_id)) {
              showFriendAcceptedToast(f);
              acceptedNew = true;
              break; // one toast is enough
            }
          }
        }
        // Export nudge: first friend (0→1) or after a mutual accept
        if (prevCount === 0 && friendsCache.length > 0) {
          maybeShowFirstFriendExportNudge("first_friend");
        } else if (acceptedNew) {
          setTimeout(() => maybeShowFirstFriendExportNudge("friend_accept"), 2800);
        }
        renderFriendsList();
        renderRequestLists();
        renderHistoryList();
        updateFriendsOnlineStrip();
        updateEmptyAloneActions();
        updateEmptyIdleInvite();
        updateEmptyRecentStrip();
        // Keep open sheet in sync (code + lists) after add / accept
        if ($("friends-sheet") && !$("friends-sheet").hidden) {
          if ($("my-friend-code")) {
            $("my-friend-code").textContent = myFriendCode || "—";
          }
        }
      }
      break;
    case "friend_request":
      if (!msg.from_user_id) break;
      // Ensure request appears in Friends list immediately (deduped)
      if (!incomingRequests.some((r) => r.user_id === msg.from_user_id)) {
        incomingRequests = dedupeByUserId([
          {
            user_id: msg.from_user_id,
            name: msg.from_name || msg.from_code || "friend",
            friend_code: msg.from_code || "",
            short_id: "",
            online: true,
          },
          ...incomingRequests,
        ]);
      }
      updateFriendsBadge();
      showFriendRequestToast(msg);
      // Surface the Accept UI without forcing a full open if sheet already open
      if ($("friends-sheet") && !$("friends-sheet").hidden) {
        renderRequestLists();
      }
      break;
    case "call_incoming":
      if (!msg.from_user_id) break;
      clearCallTimeout();
      // Flyouts sit above older toast z-index — close them so Accept is visible
      try {
        closeAllDockFlyouts();
      } catch (_) {}
      showIncomingCall(msg);
      break;
    case "call_ended":
      hideIncomingCall();
      hideOutgoingCallToast();
      clearCallTimeout();
      {
        const reason = String(msg.reason || "");
        const wasOutgoing = !!lastOutgoingCallPeer?.user_id;
        if (
          wasOutgoing &&
          /declin|no answer|timeout|missed|cancel/i.test(reason)
        ) {
          if (/declin/i.test(reason) || /no answer|timeout|missed/i.test(reason)) {
            recordMissedCall(lastOutgoingCallPeer);
            if (/declin/i.test(reason)) {
              showNoAnswerToast({
                ...lastOutgoingCallPeer,
                // declined — still offer retry if online
              });
            }
          }
        }
        lastOutgoingCallPeer = null;
        inFriendCall = false;
        matchMode = "solo";
        endActiveMatchChat();
        updateFriendActionButtons();
        if (!matched) {
          closeAllPeers({ keepFriend: false });
          setSplitRemote(false);
          setRemoteEmpty(true);
          clearPartnerStarsBadge();
          clearRemoteMatchFx();
        }
        log(reason || "call ended");
        setStatus(
          /cancel/i.test(reason)
            ? _t("friends.callCancelled") || "Call cancelled"
            : /declin/i.test(reason)
              ? _t("friends.callDeclined") || "Call declined"
              : reason || "call ended"
        );
        // Free again → maybe show missed call-back
        setTimeout(() => {
          try {
            maybeShowMissedCallBackBanner();
          } catch (_) {}
        }, 800);
      }
      break;
    case "rate_prompt":
      showStarReviewPrompt(msg);
      break;
    case "rate_result":
      {
        const n = Math.max(0, Number(msg.stars) || 0);
        const amt = Math.max(0, Number(msg.amount) || (msg.star ? 1 : 0));
        const uid = String(msg.user_id || "");
        const msgText = String(msg.message || "");
        const hourBonus = /hour chat reward/i.test(msgText);
        const seniorTalk = /senior talk reward|talked to senior/i.test(msgText);
        const trustedSenior = /trusted with senior/i.test(msgText);
        const trustIn = msg.trust != null ? Math.max(0, Number(msg.trust) || 0) : null;
        if (msg.ok && msg.star && uid && uid === myUserId) {
          // Someone starred us OR auto hour / senior-talk bonus / admin grant push
          const prev = myStars;
          const prevTrust = myTrust;
          const adminGrant = /admin grant/i.test(msgText);
          const fromUid = String(msg.from_user_id || "").trim();
          const fromName = String(msg.from_name || "").trim();
          myStars = n;
          // Peer gifts raise trust; hour/senior bonuses only raise balance
          if (trustIn != null && !hourBonus && !seniorTalk && !adminGrant) {
            if (trustIn > prevTrust) {
              myTrustGifters = Math.max(0, myTrustGifters) + 1;
              myTrustLastTs = Math.floor(Date.now() / 1000);
            }
            myTrust = trustIn;
            myTrustEffective = clientEffectiveTrust(myTrust, myTrustGifters);
            notePeakTrust(myTrust);
            // Append privacy-light chip for new gifter if we know their name
            if (fromUid && fromName && trustIn > prevTrust) {
              const ini = fromName.trim().charAt(0).toUpperCase() || "★";
              if (!myTrustGivers.some((c) => c.initial === ini)) {
                myTrustGivers = [
                  { initial: ini, flag: "" },
                  ...myTrustGivers,
                ].slice(0, 8);
              }
            }
            maybeStarsMilestones({
              gifters: myTrustGifters,
              balance: myStars,
            });
            if (fromUid) {
              try {
                maybeGrantMutualStarFlair(fromUid);
              } catch (_) {}
            }
          }
          setStarsBadge("local", myStars, {
            trust: myTrustEffective || myTrust,
          });
          syncAccountSettingsSummary();
          if (adminGrant) {
            const title =
              _t("stars.adminGrantTitle") || `Balance updated · ★ ${myStars}`;
            setStatus(title);
            showStarFeedbackToast("gift", {
              title,
              body:
                _t("stars.earnedBody", { n: myStars }) ||
                `Balance: ★ ${myStars}. Tap ★ for the Stars guide.`,
            });
            pulseStarsBadge("local");
            trackEvent("star_admin_grant", { n: myStars, amount: amt });
            break;
          }
          if (hourBonus || seniorTalk) {
            let title =
              _t("stars.hourRewardTitle") || "1 hour reward ★";
            let body =
              _t("stars.hourRewardBody", { n: myStars }) ||
              `Long chat reward. Balance: ★ ${myStars}. You can still gift extra stars.`;
            let status =
              _t("stars.hourRewardStatus") ||
              "1 hour chat — you both earned a star ★";
            if (seniorTalk || (hourBonus && amt >= 3)) {
              title =
                _t("stars.seniorTalkTitle") || "Talked to a senior ★★★";
              body =
                _t("stars.seniorTalkBody", { n: amt, bal: myStars }) ||
                `You earned ★ ${amt} for chatting with a senior. Balance: ★ ${myStars}. They can still gift you more.`;
              status =
                _t("stars.seniorTalkStatus", { n: amt }) ||
                `Senior talk reward · ★ ${amt}`;
            } else if (trustedSenior || (hourBonus && amt >= 2)) {
              title =
                _t("stars.trustedSeniorTitle") || "Trusted × senior hour ★★";
              body =
                _t("stars.trustedSeniorBody", { n: amt, bal: myStars }) ||
                `You earned ★ ${amt} for a full hour with a senior. Balance: ★ ${myStars}. You can still gift more.`;
              status =
                _t("stars.trustedSeniorStatus", { n: amt }) ||
                `Hour with senior · ★ ${amt}`;
            } else if (amt > 1) {
              body =
                _t("stars.hourRewardBodyN", { n: amt, bal: myStars }) ||
                `You earned ★ ${amt} for a long chat. Balance: ★ ${myStars}.`;
              status =
                _t("stars.hourRewardStatusN", { n: amt }) ||
                `Long chat reward · ★ ${amt}`;
            }
            setStatus(status);
            showStarFeedbackToast("gift", { title, body });
            trackEvent("star_hour_bonus", {
              n: myStars,
              amount: amt,
              senior_talk: seniorTalk || amt >= 3 ? 1 : 0,
              trusted_senior: trustedSenior || amt === 2 ? 1 : 0,
            });
          } else {
            const got =
              amt > 1
                ? _t("stars.receivedN", { n: amt }) ||
                  `You received ★ ${amt}`
                : _t("stars.received") || "You received a star ★";
            setStatus(got);
            showStarFeedbackToast("gift", {
              title: got,
              body:
                _t("stars.earnedBody", { n: myStars }) ||
                `Balance: ★ ${myStars}. Tap ★ to open the Stars guide.`,
            });
            if (n > prev) trackEvent("star_earned", { n: myStars, amount: amt });
            // Reciprocity: remember who praised us
            if (fromUid && fromUid !== myUserId && !hourBonus && !seniorTalk) {
              notePraiseReceived(fromUid, fromName || "Partner", "star");
              maybeShowReciprocityNudge(fromUid, fromName || "Partner", "star");
            }
          }
          pulseStarsBadge("local");
          // Stronger export nudge after first reputation milestone
          if (prev === 0 && myStars > 0) {
            setTimeout(
              () => maybeShowFirstFriendExportNudge("first_star"),
              2200
            );
          }
        } else if (msg.ok && msg.star && uid) {
          // We gifted them (optional after 15+ min chat)
          const name =
            lastMatchMeta?.name ||
            lastMatchMeta?.short_id ||
            _t("remote.tag") ||
            "Partner";
          const forThisPartner =
            uid === primaryPartnerUserId || uid === lastMatchMeta?.user_id;
          if (forThisPartner) {
            if (matched || inFriendCall) {
              // Live call: update partner ★ on their video
              setStarsBadge("remote", n);
              pulseStarsBadge("remote");
            } else {
              // Call already ended: no lingering badge — award FX in their window
              playPostCallStarAwardFx({
                amount: amt,
                name,
                total: n,
              });
            }
          }
          if (uid !== myUserId) {
            const title =
              amt > 1
                ? _t("stars.givenN", { n: amt }) || `★ ${amt} given`
                : _t("stars.givenTitle") || "Star sent ★";
            showStarFeedbackToast("gift", {
              title,
              body:
                _t("stars.givenBody", { name }) ||
                `You gifted stars to ${name}.`,
            });
            setStatus(title);
            trackEvent("star_given", { amount: amt });
            // Close gift-back loop → mutual ★ bond flair
            try {
              maybeGrantMutualStarFlair(uid);
            } catch (_) {}
          }
        } else if (msg.ok && !msg.star) {
          if (/thanked you/i.test(msgText)) {
            const fromUid = String(msg.from_user_id || "").trim();
            const fromName = String(msg.from_name || "").trim() || "Partner";
            const title =
              _t("stars.thanksReceivedTitle") || "Someone thanked you";
            setStatus(title);
            showStarFeedbackToast("gift", {
              title,
              body:
                fromUid
                  ? _t("stars.thanksReceivedFrom", { name: fromName }) ||
                    `${fromName} said thanks after your chat.`
                  : _t("stars.thanksReceivedBody") ||
                    "A peer said thanks after your chat — no ★ minted.",
            });
            trackEvent("star_thanks_received", {});
            if (fromUid && fromUid !== myUserId) {
              notePraiseReceived(fromUid, fromName, "thanks");
              maybeShowReciprocityNudge(fromUid, fromName, "thanks");
            }
          } else if (/thanks sent/i.test(msgText)) {
            setStatus(_t("stars.thanksSent") || "Thanks sent");
          } else {
            setStatus(_t("stars.skipped") || "No star");
          }
        }
        if (msg.message && !msg.ok) {
          setStatus(_srv(msg.message) || msg.message);
        }
      }
      break;
    case "star_effect":
      {
        const uid = String(msg.user_id || "");
        const kind = String(msg.effect || "");
        const until = Math.max(0, Number(msg.until) || 0);
        const level = Math.max(1, Math.min(3, Number(msg.level) || 1));
        const cost = Math.max(0, Number(msg.cost) || 0);
        const meta = giftKindMeta(kind);
        const fromMe =
          String(msg.from_user_id || "") === String(myUserId || "");
        if (msg.ok) {
          if (fromMe) {
            myStars = Math.max(0, Number(msg.spender_stars) || 0);
            setStarsBadge("local", myStars, { trust: myTrustEffective || myTrust });
            syncAccountSettingsSummary();
            pulseStarsBadge("local");
            const giftTitle =
              kind === "flowers"
                ? _t("stars.giftFlowersName") || "Flowers"
                : kind === "balloons"
                  ? _t("stars.giftBalloonsName") || "Balloons"
                  : kind === "confetti"
                    ? _t("stars.giftConfettiName") || "Confetti"
                    : kind === "heart"
                      ? _t("stars.giftHeartName") || "Heart"
                      : kind === "fireworks"
                        ? _t("stars.giftFireworksName") || "Fireworks"
                        : kind === "please_stay"
                          ? _t("stars.giftPleaseStayName") || "Please stay"
                          : _t("stars.giftBarsName") || "Behind bars";
            const lvlBit =
              level >= 2
                ? _t("stars.giftStack", { n: level }) || ` · ×${level}`
                : "";
            const body =
              (_srv(msg.message) || msg.message || giftTitle) +
              lvlBit +
              (_t("stars.giftLeft", { n: myStars }) || ` · ★ ${myStars} left`);
            showStarFeedbackToast("gift", {
              title:
                kind === "please_stay"
                  ? _t("stars.pleaseStaySentTitle") || "Please stay sent"
                  : _t("stars.giftSentTitle") || "Gift sent",
              body,
              corner: level >= 2,
              level,
              ico: meta.ico,
              accent: meta.accent,
            });
            setStatus(body);
            try {
              playGiftSound(kind);
            } catch (_) {}
          }
          if (uid === myUserId) {
            setFxOverlay("local", kind, until, level);
            if (!fromMe && msg.from_user_id) {
              const name = msg.from_name || "Someone";
              let body;
              if (kind === "flowers") {
                body =
                  _t("stars.flowersOnYou", { name }) ||
                  `${name} sent you flowers`;
              } else if (kind === "balloons") {
                body =
                  _t("stars.balloonsOnYou", { name }) ||
                  `${name} sent you balloons`;
              } else if (kind === "confetti") {
                body =
                  _t("stars.confettiOnYou", { name }) ||
                  `${name} sent you confetti`;
              } else if (kind === "heart") {
                body =
                  _t("stars.heartOnYou", { name }) ||
                  `${name} sent you a heart`;
              } else if (kind === "fireworks") {
                body =
                  _t("stars.fireworksOnYou", { name }) ||
                  `${name} sent you fireworks`;
              } else if (kind === "please_stay") {
                body =
                  _t("stars.pleaseStayOnYou", { name }) ||
                  `${name} asked you to stay · Next locked briefly`;
              } else {
                body =
                  _t("stars.barsOnYou", { name }) ||
                  `${name} put you behind bars`;
              }
              if (level >= 2) {
                body +=
                  _t("stars.giftStack", { n: level }) || ` · ×${level}`;
              }
              if (cost > 0) {
                body +=
                  _t("stars.giftCost", { n: cost }) || ` · ★${cost}`;
              }
              setStatus(body);
              showStarFeedbackToast("gift", {
                title:
                  kind === "please_stay"
                    ? _t("stars.pleaseStayReceivedTitle") || "Please stay"
                    : _t("stars.giftReceivedTitle") || "Gift received",
                body,
                received: true,
                corner: true,
                level,
                ico: meta.ico,
                accent: meta.accent,
              });
              const c = Math.max(
                level,
                Number(
                  document.querySelector(`#local-fx-${kind}`)?.dataset
                    ?.giftCombo || giftComboState.count || 1
                )
              );
              playGiftCelebrate(kind, c);
            }
          }
          if (
            uid &&
            (uid === primaryPartnerUserId || uid === lastMatchMeta?.user_id)
          ) {
            setFxOverlay("remote", kind, until, level);
            if (msg.target_stars != null) {
              setStarsBadge(
                "remote",
                Math.max(0, Number(msg.target_stars) || 0)
              );
            }
          }
        } else {
          setStatus(
            _srv(msg.message) || msg.message || "Could not spend stars"
          );
          if (fromMe && msg.spender_stars != null) {
            myStars = Math.max(0, Number(msg.spender_stars) || myStars);
            setStarsBadge("local", myStars, {
              trust: myTrustEffective || myTrust,
            });
            syncAccountSettingsSummary();
          }
        }
      }
      break;
    case "report_result":
      {
        const ok = !!msg.ok;
        const banned = !!msg.auto_banned;
        const applied = Math.max(0, Number(msg.applied_weight) || 0);
        const score = Math.max(0, Number(msg.report_score) || 0);
        const thr = Math.max(0, Number(msg.threshold) || 0);
        const w = Math.max(0, Number(msg.reporter_weight) || 0);
        let title =
          _t("stars.reportResultTitle") || "Report received";
        let body = _srv(msg.message) || msg.message || "";
        if (banned) {
          title = _t("stars.reportBannedTitle") || "User restricted";
          body =
            _t("stars.reportBannedBody") ||
            "Your report helped restrict this account from matchmaking.";
        } else if (applied === 0) {
          body =
            _t("stars.reportPeerBlocked") ||
            "Seniors can’t auto-ban each other — needs broader consensus.";
        } else if (thr > 0) {
          body =
            _t("stars.reportProgressBody", {
              w: applied,
              score,
              thr,
              tier: w,
            }) ||
            `Your report counted as weight ${applied} (tier ×${w}). Progress ${score}/${thr} toward auto-ban.`;
        }
        showStarFeedbackToast("gift", { title, body });
        if (body) setStatus(body);
        trackEvent("report_result", {
          banned: banned ? 1 : 0,
          applied,
          score,
          thr,
          weight: w,
        });
      }
      break;
    case "lobby_info":
      setPool({
        online: msg.online,
        waiting:
          msg.room_waiting != null && (msg.room || currentRoom())
            ? msg.room_waiting
            : msg.waiting_peers,
        offers: msg.offers,
        room: msg.room,
      });
      break;
    case "status": {
      setPhase(msg.phase);
      setPool({
        online: msg.online,
        waiting: msg.waiting_peers,
        offers: msg.offers,
        room: msg.room,
      });
      const detailRaw = msg.detail || "";
      const detailRu = _srv(detailRaw);
      if (msg.phase === "friend_call") {
        dismissFriendRingUi();
        clearLastMissedCall();
        inFriendCall = true;
        matched = true;
        matchMode = "friend";
        yourRole = "friend";
        showFriendPip(false);
        reattachFriendToMainRemote();
        updateFriendActionButtons();
      }
      // Partner left / Next: tear down stranger WebRTC
      // Note: "still chatting" = trio collapsed to 1v1 — do NOT tear down (Matched follows)
      const stillChatting =
        /still chatting|still with match|still connected/i.test(detailRaw);
      if (
        matched &&
        !stillChatting &&
        (msg.phase === "waiting" ||
          msg.phase === "idle" ||
          /partner hit Next|partner disconnected|party moved|searching again|looking for a 3rd again/i.test(
            detailRaw
          ))
      ) {
        // Path summary before tear-down (while duration/ICE still known)
        const keepParty =
          yourRole === "party" || matchMode === "party_browse" || trioBrowse;
        const keepFriend = inFriendCall || keepParty || matchMode === "friend";
        if (!keepFriend) {
          maybeShowMatchPathSummary("partner_left");
          schedulePostMatchFriendNudge("partner_left");
        }
        matched = msg.phase === "friend_call" || keepFriend;
        wantSearch =
          msg.phase === "waiting" ||
          /searching again|looking for a 3rd again/i.test(detailRaw);
        pendingSignals.length = 0;
        closeAllPeers({ keepFriend });
        if (!keepFriend) {
          setSplitRemote(false);
          setRemoteEmpty(true);
          resetRemoteEmptyCopy();
          clearPartnerStarsBadge();
          clearRemoteMatchFx();
          matchMode = "solo";
          yourRole = "solo";
          trioBrowse = false;
          findThirdPending = null;
          setFedChip(false);
          showFriendPip(false);
          enableTrioLayout(false);
          endActiveMatchChat();
        } else if (keepParty) {
          // Party still together — hunting for (next) stranger
          matchMode = "party_browse";
          yourRole = "party";
          trioBrowse = true;
          enableTrioLayout(true, { searching: true });
          reattachFriendToMainRemote();
          setRemoteEmpty(false);
          forceThirdBrandLoop();
        } else {
          // Still with friend — back to 1:1 friend layout
          matchMode = "friend";
          yourRole = "friend";
          enableTrioLayout(false);
          reattachFriendToMainRemote();
        }
        setArchPill("default");
        if (detailRaw) log(detailRu);
        updateFriendActionButtons();
      } else if (stillChatting && matched) {
        // Trio collapsed server-side; Matched(solo) follows — keep media, prep 2-cam layout
        setStatus(
          detailRu || _t("trio.partnerLeftKeep") || "Partner left — still connected"
        );
        // Soft prep: hide empty third pane chrome; Matched handler does full collapse
        if (trioBrowse || peerPcs.size > 1) {
          document
            .querySelector("main.stage")
            ?.classList.remove("stage-trio-searching");
        }
        updateFriendActionButtons();
      }
      // Friend / block / call details should always surface (even while searching)
      const friendDetail =
        !!detailRaw &&
        /friend|block|request|already friends|unknown friend|cannot add|calling/i.test(
          detailRaw
        );
      if (msg.phase === "waiting" || msg.phase === "claiming") {
        inQueue = true;
        wantSearch = true;
        showStartButton(false);
        // Keep brand loop while searching (unless party trio shows teammate live)
        if (!(trioBrowse && yourRole === "party")) {
          showPartnerEmptyWithBrand({ searching: true });
        }
        updateEmptyShareVisibility();
        maybeStartLongWaitBoost();
        // Searching copy lives in footer center — do not fill header status
        if (friendDetail) {
          setStatus(detailRu);
        } else {
          setStatus("");
        }
        updatePoolHint();
      } else {
        if (msg.phase === "matched" || msg.phase === "friend_call") {
          inQueue = false;
          showStartButton(false);
        } else if (msg.phase === "idle") {
          inQueue = false;
          wantSearch = false;
          updateStartButtonVisibility();
        }
        // Idle phase label alone is noise — only show real detail (errors, friend notes)
        if (msg.phase === "idle" && !detailRaw) {
          setStatus("");
        } else {
          setStatus(detailRu || (msg.phase === "idle" ? "" : _phase(msg.phase)));
        }
        updatePoolHint();
      }
      updateConnFromState();
      if (
        detailRaw &&
        msg.phase !== "waiting" &&
        !/partner hit Next|partner disconnected/i.test(detailRaw)
      ) {
        log(detailRu);
      }
      updateFriendActionButtons();
      break;
    }
    case "matched":
      handleMatched(msg);
      break;
    case "find_third_incoming":
      handleFindThirdIncoming(msg);
      break;
    case "find_third_result":
      handleFindThirdResult(msg);
      break;
    case "chat": {
      const myName = getDisplayName();
      const mine =
        msg.from_user_id === myUserId ||
        msg.author === myShortId ||
        (myName && msg.author === myName);
      // Prefer P2P path when open — ignore hub echo of our own optimistic send,
      // and skip remote hub chat if we already got the same body via datachannel
      // (rare dual-path). Hub still used as fallback before DC is up.
      recordChatMessage({
        author: msg.author || "",
        body: msg.body || "",
        mine,
        fromUserId: msg.from_user_id || "",
        via: "hub",
      });
      break;
    }
    case "friend_chat":
      handleIncomingFriendChat(msg);
      break;
    case "friend_chat_history":
      mergeFriendHistory(msg.with_user_id, msg.messages || []);
      break;
    case "signal":
      handleIncomingSignal(msg);
      break;
    case "error":
      {
        const em = String(msg.message || "");
        // Friend-call failures should cancel the "calling…" toast + timeout UI
        if (
          /friend offline|not friends|only friends can call|friend request|friend is busy|cannot call|caller offline|accept their friend|blocked|notification sent|ring notification|group call|busy in/i.test(
            em
          )
        ) {
          clearCallTimeout();
          hideOutgoingCallToast();
          lastOutgoingCallPeer = null;
          hideIncomingCall();
        }
        // Humanize common call failures (log/status already set below)
        if (/friend offline/i.test(em)) {
          try {
            showStarFeedbackToast?.("gift", {
              title: _t("friends.offlineTitle") || "Friend offline",
              body:
                _t("friends.offlineBody") ||
                "They need live.html open in one tab. Multi-tab kicks the old window.",
            });
          } catch (_) {}
        } else if (/busy/i.test(em)) {
          try {
            showStarFeedbackToast?.("gift", {
              title: _t("friends.busyTitle") || "Friend busy",
              body:
                _t("friends.busyBody") ||
                "They’re in another call or group. They must hang up first.",
            });
          } catch (_) {}
        }
        // Multi-tab / second browser with same identity
        if (/opened in another tab|opened elsewhere|another browser/i.test(em)) {
          setStatus(
            _t("status.sessionElsewhere") ||
              "This tab was disconnected — use only one live window"
          );
          try {
            showStarFeedbackToast?.("gift", {
              title:
                _t("status.sessionElsewhereTitle") ||
                "Opened in another window",
              body:
                _t("status.sessionElsewhereBody") ||
                "Close extra tabs of ruletka.vip/live.html. One identity = one live window, or each person sees different people.",
            });
          } catch (_) {}
        }
        // Server re-pushes friends list on "friend offline"; re-render if already cached
        if (/friend offline/i.test(em)) {
          try {
            renderFriendsList();
            updateFriendsOnlineStrip();
          } catch (_) {}
        }
        log(_t("log.error", { e: _srv(em) || em }));
        setStatus(_srv(em) || em);
      }
      break;
    default:
      break;
  }
}

function handleMatched(msg) {
  matched = true;
  inQueue = false;
  // Friend answered (or any match) — never leave "Calling…" toast stuck over the call
  dismissFriendRingUi();
  // Layout mode applies after peer tiles settle
  setTimeout(() => {
    try {
      applyStageLayoutMode();
    } catch (_) {}
  }, 80);
  setTimeout(() => {
    try {
      applyStageLayoutMode();
    } catch (_) {}
  }, 600);
  clearWaitTipsWatch();
  hideWaitTips();
  clearLongWaitBoost();
  clearWeakConnWatch();
  pathStatRecordedForMatch = false;
  wantSearch = msg.mode !== "friend";
  isOfferer = !!msg.is_offerer;
  matchMode = msg.mode || "solo";
  yourRole = msg.your_role || "solo";
  // Keep peer list for soft ICE reconnect (find-3rd)
  if (Array.isArray(msg.peers) && msg.peers.length) {
    lastMatchedPeers = msg.peers.slice();
  }
  // Pure friend 1:1 only — party/find-third uses trioBrowse + party_browse
  if (matchMode === "friend") inFriendCall = true;
  else if (matchMode === "solo") inFriendCall = false;
  // leave inFriendCall unchanged when entering party_browse from a friend call
  // New person → full partner volume again (even if previous call was quiet)
  resetPartnerVolumeForNewMatch(msg);
  setPhase(matchMode === "friend" ? "friend_call" : "matched");
  syncScreenWakeLock();
  updatePipButton();
  updateEmptyShareVisibility();
  maybeStartConnDetailsLive();
  // Switch / restore chat thread for this partner (history survives hangup)
  openMatchChatForPartner(
    Array.isArray(msg.peers) && msg.peers.length ? msg.peers : null
  );
  updateConnFromState();
  startWebrtcWatch();
  startMatchTimer();
  {
    const titleEl = $("remote-empty")?.querySelector(".empty-title");
    const subEl = $("remote-empty")?.querySelector(".empty-sub");
    if (titleEl) titleEl.textContent = _t("remote.connecting");
    if (subEl) {
      subEl.hidden = true;
      subEl.textContent = "";
    }
  }
  const peers = Array.isArray(msg.peers) && msg.peers.length
    ? msg.peers
    : [
        {
          peer_id: "legacy",
          short_id: msg.partner_short,
          is_offerer: !!msg.is_offerer,
          role: "stranger",
          name: msg.partner_short,
        },
      ];

  // Find-third / party member with only teammate listed → trio searching layout
  const onlyTeammate =
    matchMode === "party_browse" &&
    yourRole === "party" &&
    peers.length > 0 &&
    peers.every((p) => isTeammateRole(p.role));
  const hasStranger = peers.some(
    (p) => p.role === "stranger" || p.role === "party"
  );
  const partyMember =
    onlyTeammate || (matchMode === "party_browse" && yourRole === "party");

  if (partyMember) {
    // Do NOT force empty overlay — 1v1 stream must stay visible as first partner
    trioBrowse = true;
    // Only reclassify PCs that are not the new third stranger (avoids freezing mate stream)
    const strangerPeerIds = new Set(
      peers
        .filter((p) => p.role === "stranger" || p.role === "party")
        .map((p) => p.peer_id)
        .filter(Boolean)
    );
    for (const [pid, pc] of peerPcs.entries()) {
      if (strangerPeerIds.has(pid) || strangerPeerIds.has(pc.remotePeerId)) continue;
      if (pc._role === "stranger" || !pc._role) pc._role = "teammate";
    }
    const mateMeta =
      peers.find((p) => isTeammateRole(p.role)) || peers[0] || null;
    enableTrioLayout(true, { searching: !hasStranger || onlyTeammate });
    setRemoteEmpty(false);
    bindFirstPartnerToMain(mateMeta);
    wantSearch = !hasStranger || onlyTeammate;
    if (wantSearch) inQueue = true;
  } else {
    // Entering solo 1v1: new match OR collapse from trio / 1v2 after someone left
    const wasMultiLayout =
      trioBrowse ||
      !!document.querySelector("main.stage")?.classList.contains("stage-trio") ||
      peerPcs.size > 1 ||
      !!$("remote-stack")?.classList.contains("split") ||
      matchMode === "party_browse" ||
      yourRole === "party";
    if (matchMode === "party_browse" && yourRole === "solo" && hasStranger) {
      // Solo matched a party — classic split, not trio
      enableTrioLayout(false);
      setRemoteEmpty(true, { force: true });
    } else if (matchMode === "solo" && wasMultiLayout) {
      // Keep the remaining conversationalist (3rd or mate); drop the leaver's window
      collapseMultiPeerToSoloLayout(peers);
    } else if (matchMode === "solo") {
      enableTrioLayout(false);
      setSplitRemote(false);
      setRemoteEmpty(true, { force: true });
      trioBrowse = false;
      findThirdPending = null;
    } else {
      setRemoteEmpty(true, { force: true });
    }
  }

  // Federated match: remote peer_id is fed/{session}/{id} (nextface-fed/1)
  const isFedMatch = peers.some((p) =>
    String(p.peer_id || "").startsWith("fed/")
  );
  setFedChip(isFedMatch);
  if (isFedMatch) log(_t("log.fedMatch"));

  // Block target: stranger/party opponent first (not the friend you're browsing with)
  const primary =
    peers.find((p) => p.role === "stranger" && p.user_id) ||
    peers.find((p) => p.role === "party" && p.user_id) ||
    peers.find((p) => isTeammateRole(p.role) && p.user_id) ||
    peers.find((p) => p.user_id) ||
    null;
  primaryPartnerUserId = primary?.user_id || "";
  lastMatchMeta = primary
    ? {
        user_id: primary.user_id || "",
        name: primary.name || msg.partner_short || "",
        short_id: primary.short_id || msg.partner_short || "",
        friend_code: primary.friend_code || "",
        flag: normalizeFlagCode(primary.flag || ""),
        avatar: isValidAvatarDataUrl(primary.avatar) ? primary.avatar : "",
        // spendable balance (badge number)
        stars: Math.max(0, Number(primary.stars) || 0),
        // reputation for tier chrome
        trust: Math.max(
          0,
          Number(primary.trust != null ? primary.trust : primary.stars) || 0
        ),
        trust_gifters: Math.max(0, Number(primary.trust_gifters) || 0),
      }
    : {
        user_id: "",
        name: msg.partner_short || "",
        short_id: msg.partner_short || "",
        friend_code: "",
        flag: "",
        avatar: "",
        stars: 0,
        trust: 0,
        trust_gifters: 0,
      };
  partnerStars = lastMatchMeta.stars || 0;
  partnerTrust = lastMatchMeta.trust || 0;
  partnerTrustGifters = lastMatchMeta.trust_gifters || 0;
  try {
    refreshFlairUi();
  } catch (_) {}
  // Remote badge: number = spendable ★; tier = trust
  setStarsBadge("remote", partnerStars, {
    trust: lastMatchMeta.trust || 0,
  });
  setStarsBadge("local", myStars, { trust: myTrust }); // balance + trust tier
  try {
    syncPartnerPraiseChip();
  } catch (_) {}
  // Partner may already be behind bars from a prior gift
  {
    const p =
      peers.find((x) => x.role === "stranger" && x.user_id) ||
      peers.find((x) => x.user_id) ||
      primary;
    setFxOverlay(
      "remote",
      p?.effect || "",
      Number(p?.effect_until) || 0,
      Number(p?.effect_level) || 1
    );
  }
  // One-shot discoverability for Stars sheet
  setTimeout(() => {
    try {
      maybeShowStarsIntroTip();
    } catch (_) {}
  }, 2800);
  // Record every peer on this Matched (primary + multi-party strangers).
  try {
    recordMatchHistoryFromPeers(peers, {
      mode: matchMode,
      friendCall: !!inFriendCall || matchMode === "friend",
    });
  } catch (_) {
    pushHistory({
      kind: matchMode === "friend" ? "friend" : "stranger",
      ...lastMatchMeta,
    });
  }
  // Strangers: rep &lt; 39 stay blurred; 39+ get 3s intro; Settings always-blur overrides.
  // Friends / known teammates start clear.
  const isFriendMatch =
    matchMode === "friend" || inFriendCall || onlyTeammate;
  if (!isFriendMatch) {
    applyStrangerIntroBlur();
  } else {
    clearIntroBlurTimer();
    introBlurGen++;
    setPartnerBlur(false);
  }
  startNsfwWatch();
  updateFriendActionButtons();
  updatePartnerClickable();
  closePartnerMenu();
  clearIcePathBadge();

  // Opponents only (exclude friend/teammate).
  // Cap 3 remotes: 1v1 / 1v2 / 3v1 (solo sees up to 3 party members) / 2v2.
  const opponents = peers
    .filter((p) => p.role === "stranger" || p.role === "party")
    .slice(0, 3);
  const split = opponents.length >= 2 && !trioBrowse;
  setSplitRemote(split);
  // 1v2 / 2v2 / party+stranger: force full mic processing (NS+AGC)
  try {
    enterMultiPeerAudioMode(peers);
  } catch (_) {}
  {
    const tag = $("remote-tag");
    const wrap = $("remote-tile-tag");
    if (tag) {
      if (split) {
        tag.textContent =
          msg.partner_short ||
          _t("friends.partyTag") ||
          "2";
        setTileAvatar("remote", "");
      } else {
        // Name + optional self-chosen flag / avatar (never real location)
        const peer =
          opponents[0] ||
          peers.find((p) => isTeammateRole(p.role)) ||
          peers[0];
        const named =
          peer?.name ||
          lastMatchMeta?.name ||
          msg.partner_short ||
          "";
        const fl =
          normalizeFlagCode(peer?.flag) ||
          normalizeFlagCode(lastMatchMeta?.flag) ||
          "";
        setNameOnTile(tag, named, fl);
        const av =
          (isValidAvatarDataUrl(peer?.avatar) && peer.avatar) ||
          lastMatchMeta?.avatar ||
          "";
        setTileAvatar("remote", av);
      }
    }
    syncRemoteTileTagVisibility();
  }
  if (trioBrowse && opponents[0]) {
    const n = opponents[0].name || msg.partner_short || "";
    setThirdSlotStream(null); // filled after stream in joinPeers
    const ttag = $("third-tag");
    if (ttag) {
      setNameOnTile(ttag, n, opponents[0].flag);
    }
  }

  setStatus(
    _t("log.matchedStatus", {
      id: msg.partner_short,
      role: msg.is_offerer ? _t("log.roleOffer") : _t("log.roleAnswer"),
    })
  );
  log(_t("log.matched", { id: msg.partner_short }) + ` · ${matchMode}`);
  // No chime on match/connect — visual flash + toast only (less interruptive)
  flashPartnerTile();
  showMatchFoundToast({ connecting: true });
  updateFriendActionButtons();
  try {
    updatePartyRoleStrip(msg);
  } catch (_) {}
  trackEvent("match", {
    mode: matchMode || "solo",
    role: yourRole || "solo",
  });

  setTimeout(() => {
    joinPeers(peers)
      .then(() => {
        // Rebind path may not re-fire ontrack — force empty off + play
        ensurePartnerVideoVisible();
        try {
          updatePartyRoleStrip(msg);
        } catch (_) {}
      })
      .catch((e) => log(String(e)));
  }, 300);
  // Belt-and-suspenders: clear connecting overlay once streams attach
  setTimeout(() => ensurePartnerVideoVisible(), 1200);
  setTimeout(() => ensurePartnerVideoVisible(), 3000);
}

function handleIncomingSignal(msg) {
  const from = msg.from_peer || "";
  let pc = from ? findPcForPeer(from) : null;
  // Legacy 1v1 only: signals without from_peer when a single PC exists.
  // NEVER route a named peer’s signal to “the only PC” — when find-3rd’s third
  // connects, that applied their SDP onto the first partner and froze both sides.
  if (!pc && !from && peerPcs.size === 1) {
    pc = [...peerPcs.values()][0];
  }
  if (pc) {
    pc.handleRemoteSignal(msg.kind, msg.payload).catch((e) =>
      log(_t("log.signalErr", { e }))
    );
  } else {
    pendingSignals.push(msg);
  }
}

function closeAllPeers({ keepFriend = false } = {}) {
  stopMatchTimer();
  clearIntroBlurTimer();
  introBlurGen++;
  // Debate is per-match — tear down without notifying (peer is already leaving)
  try {
    endDebate({ notify: false, silent: true });
  } catch (_) {}
  try {
    stopLocalTyping();
    clearRemoteTyping();
  } catch (_) {}
  // Gift overlays belong to the current conversationalist window — drop on teardown
  // (covers Next / Stop / Spin / partner left / block / NSFW skip, etc.)
  clearRemoteMatchFx();
  // Leaving multi-remote layout — restore normal audio prefs
  try {
    if (!keepFriend) leaveMultiPeerAudioMode();
  } catch (_) {}
  for (const [pid, pc] of [...peerPcs.entries()]) {
    const keep =
      keepFriend &&
      (matchMode === "friend" ||
        matchMode === "party_browse" ||
        yourRole === "party" ||
        inFriendCall ||
        trioBrowse) &&
      isTeammateRole(pc._role);
    if (keep) continue;
    try {
      pc.closeCall({ keepLocal: true, sendBye: true });
    } catch (_) {}
    peerPcs.delete(pid);
  }
  rtc = peerPcs.size ? [...peerPcs.values()][0] : null;
  if (!keepFriend) {
    try {
      clearMultiPartyChrome();
    } catch (_) {}
    if ($("remote")) $("remote").srcObject = null;
    if ($("remote2")) $("remote2").srcObject = null;
    if ($("remote2-wrap")) $("remote2-wrap").hidden = true;
    if ($("remote-third")) {
      try {
        $("remote-third").srcObject = null;
      } catch (_) {}
      $("remote-third").hidden = true;
    }
    showFriendPip(false);
    enableTrioLayout(false);
  } else {
    // Stranger gone — teammate back on main remote (not PiP)
    reattachFriendToMainRemote();
    if (trioBrowse || yourRole === "party") {
      setThirdSlotStream(null);
      enableTrioLayout(true, { searching: true });
    }
  }
  stopStats();
  stopNsfwWatch();
  clearWebrtcWatch();
  hideCallCoach();
  webrtcConnectedOk = false;
}

/**
 * True when `pc` is already the WebRTC link for match peer `p` (exact id only).
 * Rejects teammate↔stranger mix-ups that used to rekey the first partner onto the 3rd.
 */
function pcBelongsToPeer(pc, p) {
  if (!pc || !p?.peer_id) return false;
  if (peerPcs.get(p.peer_id) === pc) return true;
  if (pc.remotePeerId && pc.remotePeerId === p.peer_id) return true;
  return false;
}

async function joinPeers(peers) {
  if (!previewStream?.active) await startPreview();
  if (!previewStream) {
    log(_t("log.noMedia"));
    return;
  }

  const list = Array.isArray(peers) ? peers : [];
  const opponents = list
    .filter((p) => p.role === "stranger" || p.role === "party")
    .sort((a, b) => String(a.peer_id).localeCompare(String(b.peer_id)))
    .slice(0, 2);
  const friendMeta = list.find((p) => isTeammateRole(p.role));
  const partyBrowsing =
    matchMode === "party_browse" &&
    (yourRole === "party" || opponents.length > 0);
  const useTrio =
    trioBrowse ||
    (partyBrowsing && yourRole === "party" && (friendMeta || opponents.length));

  // Drop PCs only when the peer is gone. Never close a peer still in `list`
  // (find-third reclassifies the same stranger peer_id as "teammate" — old code
  // treated that as "close stranger", killing the 1v1 video both ways).
  const listIds = new Set(list.map((p) => p.peer_id).filter(Boolean));
  for (const [pid, pc] of [...peerPcs.entries()]) {
    const still = list.find((p) => p.peer_id === pid || (pc.remotePeerId && p.peer_id === pc.remotePeerId));
    if (still) {
      // Keep connection; update role (stranger → teammate, etc.)
      if (still.role) pc._role = still.role;
      if (still.peer_id && still.peer_id !== pid) rekeyPeerPc(still.peer_id, pc);
      continue;
    }
    if (isTeammateRole(pc._role) && matchMode !== "solo" && list.some((p) => isTeammateRole(p.role))) {
      // Durable co-search / friend link while party-browsing — not after trio→solo collapse
      continue;
    }
    // Keep if map key is stale but this PC is still the listed teammate (live media)
    if (
      isTeammateRole(pc._role) &&
      matchMode !== "solo" &&
      (pc.remoteStream?.getVideoTracks?.() || []).some((t) => t.readyState === "live")
    ) {
      const mate = list.find((p) => isTeammateRole(p.role));
      if (mate && !findPcForPeer(mate.peer_id)) {
        rekeyPeerPc(mate.peer_id, pc);
        pc._role = mate.role || "teammate";
        continue;
      }
    }
    if (listIds.has(pid)) continue;
    try {
      pc.closeCall({ keepLocal: true, sendBye: false });
    } catch (_) {}
    peerPcs.delete(pid);
  }

  // Video layout
  if (useTrio && yourRole === "party") {
    enableTrioLayout(true, { searching: opponents.length === 0 });
    setSplitRemote(false);
    // Teammate → main remote (first conversationalist); stranger → third column
    const mate =
      friendMeta ||
      list.find((p) => isTeammateRole(p.role)) ||
      null;
    bindFirstPartnerToMain(mate);
    if (mate) registerPeerUi(mate, "remote");
    setRemoteEmpty(false);
    if (opponents[0]) {
      const opc = findPcForPeer(opponents[0].peer_id);
      videoSlotsTrioBind(opponents[0], opc);
      registerPeerUi(opponents[0], "remote-third");
      if (opc?.remoteStream) {
        setThirdSlotStream(opc.remoteStream, opponents[0].name || "");
      }
    } else {
      setThirdSlotStream(null);
    }
    startThirdSlotWatchdog();
  } else {
    // Solo vs party of 2 → split stack; solo vs party of 3 → stack + third tile
    setSplitRemote(opponents.length >= 2);
    if (opponents.length >= 3 && yourRole === "solo") {
      enableTrioLayout(true, { searching: false });
      setThirdSlotStream(null); // filled when stream arrives
    } else if (!useTrio) {
      stopThirdSlotWatchdog();
    }
  }

  const videoSlots = new Map();
  if (useTrio && yourRole === "party") {
    if (friendMeta) videoSlots.set(friendMeta.peer_id, $("remote"));
    if (opponents[0])
      videoSlots.set(opponents[0].peer_id, $("remote-third") || $("remote2"));
  } else if (opponents.length >= 3 && yourRole === "solo") {
    // 3v1: three party members on remote / remote2 / remote-third
    videoSlots.set(opponents[0].peer_id, $("remote"));
    videoSlots.set(opponents[1].peer_id, $("remote2"));
    videoSlots.set(opponents[2].peer_id, $("remote-third") || $("remote2"));
    const wrap = $("remote2-wrap");
    if (wrap) {
      wrap.hidden = false;
      wrap.removeAttribute("hidden");
    }
    if ($("remote2")) $("remote2").hidden = false;
    registerPeerUi(opponents[0], "remote");
    registerPeerUi(opponents[1], "remote2");
    registerPeerUi(opponents[2], "remote-third");
    enableTrioLayout(true, { searching: false });
  } else if (opponents.length >= 2) {
    videoSlots.set(opponents[0].peer_id, $("remote"));
    videoSlots.set(opponents[1].peer_id, $("remote2"));
    const wrap = $("remote2-wrap");
    if (wrap) {
      wrap.hidden = false;
      wrap.removeAttribute("hidden");
    }
    if ($("remote2")) $("remote2").hidden = false;
    registerPeerUi(opponents[0], "remote");
    registerPeerUi(opponents[1], "remote2");
  } else if (opponents.length === 1) {
    videoSlots.set(opponents[0].peer_id, $("remote"));
    registerPeerUi(opponents[0], "remote");
  }
  if (friendMeta && !(useTrio && yourRole === "party")) {
    registerPeerUi(friendMeta, "remote");
  }
  try {
    updatePartyRoleStrip({ peers: list, mode: matchMode });
  } catch (_) {}

  if (!useTrio && partyBrowsing && yourRole === "party" && friendMeta) {
    // Classic friend party: stranger on main, friend PiP
    const fpc = findPcForPeer(friendMeta.peer_id);
    const pip = $("friend-pip");
    if (fpc) {
      if ($("remote")?.srcObject && fpc.remoteStream && $("remote").srcObject === fpc.remoteStream) {
        $("remote").srcObject = null;
      }
      bindPcVideo(fpc, pip);
      showFriendPip(true);
    } else {
      showFriendPip(false);
    }
  } else if (matchMode === "friend" || (inFriendCall && opponents.length === 0 && !useTrio)) {
    showFriendPip(false);
    if (friendMeta) {
      const fpc = findPcForPeer(friendMeta.peer_id);
      if (fpc) bindPcVideo(fpc, $("remote"));
    }
  } else if (!useTrio) {
    showFriendPip(false);
  }

  /** New PCs to connect — start in parallel so 1v2 doesn’t serialize ICE. */
  const connectJobs = [];

  for (const p of list) {
    // Teammate / friend: always reuse existing media — never tear down & renegotiate
    if (isTeammateRole(p.role)) {
      const existing = findPcForPeer(p.peer_id);
      if (existing && pcBelongsToPeer(existing, p)) {
        rekeyPeerPc(p.peer_id, existing);
        existing._role = p.role || "teammate";
        if (useTrio && yourRole === "party") {
          bindFirstPartnerToMain(p);
        } else {
          const el =
            partyBrowsing && yourRole === "party" && !useTrio
              ? $("friend-pip")
              : $("remote");
          bindPcVideo(existing, el);
          if (existing.remoteStream) paintRemoteFromPc(existing, existing.remoteStream);
        }
        continue;
      }
      // Prefer any live teammate-marked PC (map key may lag after find-third)
      const liveMate = [...peerPcs.values()].find(
        (pc) =>
          isTeammateRole(pc._role) &&
          (pc.remoteStream?.getVideoTracks?.() || []).some((t) => t.readyState === "live")
      );
      if (liveMate) {
        rekeyPeerPc(p.peer_id, liveMate);
        liveMate._role = p.role || "teammate";
        if (useTrio && yourRole === "party") bindFirstPartnerToMain(p);
        else {
          bindPcVideo(liveMate, $("remote"));
          if (liveMate.remoteStream) paintRemoteFromPc(liveMate, liveMate.remoteStream);
        }
        continue;
      }
      // No PC yet (shouldn't happen mid find-third) — fall through to create
    }

    {
      const existing = findPcForPeer(p.peer_id);
      // Only reuse if this PC is really for this peer — never steal teammate for stranger
      if (
        existing &&
        pcBelongsToPeer(existing, p) &&
        !(isTeammateRole(existing._role) && (p.role === "stranger" || p.role === "party"))
      ) {
        if (p.role === "stranger" || p.role === "party") {
          rekeyPeerPc(p.peer_id, existing);
          existing._role = p.role;
          const el = videoSlots.get(p.peer_id) || $("remote");
          bindPcVideo(existing, el);
          if (useTrio && yourRole === "party" && (el === $("remote-third") || el?.id === "remote-third")) {
            setThirdSlotStream(existing.remoteStream || null, p.name || "");
          }
        }
        continue;
      }
    }

    // Never open a second PC for a teammate if we already have live media to them
    if (isTeammateRole(p.role) && partnerHasLiveVideo()) {
      bindFirstPartnerToMain(p);
      continue;
    }

    const strangerCount = [...peerPcs.values()].filter(
      (pc) => pc._role === "stranger" || pc._role === "party"
    ).length;
    if (
      (p.role === "stranger" || p.role === "party") &&
      strangerCount >= 2
    ) {
      log(_t("log.partyCap") || "max 2 opponents — skipping extra peer");
      continue;
    }

    let videoEl = null;
    if (isTeammateRole(p.role)) {
      videoEl =
        useTrio && yourRole === "party"
          ? $("remote")
          : partyBrowsing && yourRole === "party"
            ? $("friend-pip")
            : $("remote");
    } else {
      videoEl = videoSlots.get(p.peer_id) || $("remote");
    }

    const pc = new RouletteWebRtc(
      {
        onSignal: (kind, payload, toPeer) => {
          const body = { type: "signal", kind, payload };
          if (toPeer) body.to = toPeer;
          else if (p.peer_id && p.peer_id !== "legacy") body.to = p.peer_id;
          send(body);
        },
        onRemoteStream: (stream) => {
          // Live video = call connected — drop "Calling…" / ring toast
          dismissFriendRingUi();
          paintRemoteFromPc(pc, stream);
          if (
            useTrio &&
            yourRole === "party" &&
            (p.role === "stranger" || p.role === "party")
          ) {
            // Always paint third column + kill “Looking for a 3rd…” overlay
            setThirdSlotStream(stream, p.name || "");
            videoSlotsTrioBind(p, pc);
          }
          // Solo matched a party (1v2): keep both party feeds painted
          if (
            yourRole === "solo" &&
            matchMode === "party_browse" &&
            (p.role === "party" || p.role === "stranger")
          ) {
            ensurePartnerVideoVisible();
          }
        },
        onConnectionState: (s) => {
          const slotEl = videoSlots.get(p.peer_id);
          const slot =
            slotEl?.id === "remote-third"
              ? "remote-third"
              : slotEl?.id === "remote2"
                ? "remote2"
                : "remote";
          setPeerConnChip(slot, s);
          if (s === "connected") {
            dismissFriendRingUi();
            // ICE connected but ontrack may lag — re-paint third if we have stream
            if (
              useTrio &&
              yourRole === "party" &&
              (p.role === "stranger" || p.role === "party") &&
              pc.remoteStream
            ) {
              setThirdSlotStream(pc.remoteStream, p.name || "");
              registerPeerUi(p, "remote-third");
            }
          }
          handleWebrtcConnectionState(s, pc);
        },
        onIceConnectionState: (ice) => {
          const slotEl = videoSlots.get(p.peer_id);
          const slot =
            slotEl?.id === "remote-third"
              ? "remote-third"
              : slotEl?.id === "remote2"
                ? "remote2"
                : "remote";
          setPeerConnChip(slot, ice);
          if (ice === "failed") handleWebrtcConnectionState("failed", pc);
          else if (ice === "connected" || ice === "completed") {
            dismissFriendRingUi();
            if (
              useTrio &&
              yourRole === "party" &&
              (p.role === "stranger" || p.role === "party") &&
              pc.remoteStream
            ) {
              setThirdSlotStream(pc.remoteStream, p.name || "");
              registerPeerUi(p, "remote-third");
            }
            // Stranger in find-3rd connected — clear soft-retry flags
            try {
              pc._softIceTried = false;
              pc._softReconnectScheduled = false;
            } catch (_) {}
          }
        },
        onQualityTier: (tier) => {
          if (pc === rtc || !isTeammateRole(p.role)) setQualityTierHint(tier);
        },
        onDataChannel: (open) => {
          updateChatHeader();
          if (open && (pc === rtc || !isTeammateRole(p.role))) {
            setStatus(_t("chat.p2pReady") || "Chat is peer-to-peer");
          }
        },
        onDataMessage: (msg) => {
          handleP2pDataMessage(msg, pc);
        },
      },
      !!p.is_offerer,
      p.peer_id === "legacy" ? "" : p.peer_id
    );
    pc._role = p.role || "stranger";
    pc._videoEl = videoEl;
    pc._softIceTried = false;
    pc._softReconnectScheduled = false;
    pc.setLocalStream(previewStream);
    peerPcs.set(p.peer_id, pc);
    if (!isTeammateRole(p.role) || !rtc) rtc = pc;
    if (isTeammateRole(p.role) && videoEl === $("friend-pip")) {
      showFriendPip(true);
    }
    connectJobs.push(
      (async () => {
        try {
          await pc.connect();
          // Drain pending signals for this peer only (not teammate leftovers)
          const left = [];
          const mine = [];
          for (const s of pendingSignals.splice(0)) {
            if (!s.from_peer || s.from_peer === p.peer_id || p.peer_id === "legacy") {
              mine.push(s);
            } else {
              left.push(s);
            }
          }
          pendingSignals.push(...left);
          for (const s of mine) {
            try {
              await pc.handleRemoteSignal(s.kind, s.payload);
            } catch (e) {
              log(_t("log.signalErr", { e: e?.message || e }));
            }
          }
        } catch (e) {
          log(_t("log.callFail", { e: e.message || e }));
        }
      })()
    );
  }

  if (connectJobs.length) {
    await Promise.allSettled(connectJobs);
  }

  // After PCs are up: force full mic processing for multi-remote audio
  try {
    enterMultiPeerAudioMode(list);
  } catch (_) {}

  // Find-3rd: if stranger still has no media after connect jobs, soft-retry once
  if (useTrio && yourRole === "party" && opponents[0]) {
    const oid = opponents[0].peer_id;
    const opc = findPcForPeer(oid);
    const hasVid =
      opc?.remoteStream &&
      (opc.remoteStream.getVideoTracks?.() || []).some((t) => t.readyState === "live");
    if (opc && !hasVid && !opc._softTrioWatch) {
      opc._softTrioWatch = true;
      setTimeout(() => {
        try {
          if (!matched || !trioBrowse) return;
          const cur = findPcForPeer(oid);
          if (!cur) return;
          const live =
            cur.remoteStream &&
            (cur.remoteStream.getVideoTracks?.() || []).some(
              (t) => t.readyState === "live"
            );
          const ice = cur.pc?.iceConnectionState || "";
          if (!live && (ice === "failed" || ice === "disconnected" || ice === "checking" || ice === "new" || !ice)) {
            trySoftRecoverPeer(cur);
          }
        } catch (_) {}
      }, 10000);
    }
  }

  if (useTrio && yourRole === "party" && friendMeta) {
    const fpc = findPcForPeer(friendMeta.peer_id);
    if (fpc) {
      bindPcVideo(fpc, $("remote"));
      showFriendPip(false);
    }
    // Paint third if already connected
    if (opponents[0]) {
      const opc = findPcForPeer(opponents[0].peer_id);
      if (opc?.remoteStream) {
        setThirdSlotStream(opc.remoteStream, opponents[0].name || "");
        videoSlotsTrioBind(opponents[0], opc);
      }
    }
    syncLocalPipMirror();
  } else if (partyBrowsing && yourRole === "party" && friendMeta && !useTrio) {
    const fpc = findPcForPeer(friendMeta.peer_id);
    if (fpc?.remoteStream && $("friend-pip")) {
      bindPcVideo(fpc, $("friend-pip"));
      showFriendPip(true);
    }
  }
  await pushOutboundVideoTracks();
  ensurePartnerVideoVisible();
}

function videoSlotsTrioBind(peerMeta, pc) {
  if (!peerMeta) return;
  const el = $("remote-third") || $("remote2");
  if (pc && el) {
    bindPcVideo(pc, el);
    if (pc.remoteStream) setThirdSlotStream(pc.remoteStream, peerMeta.name || "");
  }
}

/** @type {"good"|"ok"|"weak"|""} */
let lastConnGrade = "";
/** @type {"direct"|"relay"|"unknown"|""} */
let lastIceKind = "";

/**
 * Partner meta chrome (timer · Good/Direct · ms · A/V): show briefly, then autohide.
 * Stays visible while connection is weak or A/V is lagging.
 */
const REMOTE_META_PEEK_MS = 4200;
const REMOTE_META_ALERT_MS = 10000;
let remoteMetaHideAt = 0;
let remoteMetaHideTimer = 0;

function peekRemoteMeta(ms = REMOTE_META_PEEK_MS) {
  const until = Date.now() + ms;
  if (until > remoteMetaHideAt) remoteMetaHideAt = until;
  applyRemoteMetaVisibility();
  if (remoteMetaHideTimer) clearTimeout(remoteMetaHideTimer);
  remoteMetaHideTimer = setTimeout(() => {
    remoteMetaHideTimer = 0;
    applyRemoteMetaVisibility();
  }, Math.max(50, remoteMetaHideAt - Date.now() + 40));
}

function clearRemoteMetaAutohide() {
  remoteMetaHideAt = 0;
  if (remoteMetaHideTimer) {
    clearTimeout(remoteMetaHideTimer);
    remoteMetaHideTimer = 0;
  }
}

function remoteMetaAvIsAlert() {
  const av = $("av-lag-chip");
  if (!av || av.hidden) return false;
  return av.classList.contains("is-warn") || av.classList.contains("is-bad");
}

function remoteMetaShouldShow() {
  if (!matched && !inFriendCall) return false;
  if (Date.now() < remoteMetaHideAt) return true;
  if (lastConnGrade === "weak") return true;
  if (remoteMetaAvIsAlert()) return true;
  return false;
}

/** Apply show/hide for timer + quality chips on the partner tile. */
function applyRemoteMetaVisibility() {
  const live = !!(matched || inFriendCall);
  const show = remoteMetaShouldShow();
  const timer = $("match-timer");
  const chip = $("conn-chip");
  const quality = $("call-quality");
  const av = $("av-lag-chip");

  if (timer) {
    // Keep text updating; only toggle visibility while in a call
    if (!live) timer.hidden = true;
    else timer.hidden = !show;
  }
  if (chip) {
    if (!live || !(chip.textContent || "").trim()) chip.hidden = true;
    else chip.hidden = !show;
  }
  if (quality) {
    if (!live || !(quality.textContent || "").trim()) quality.hidden = true;
    else quality.hidden = !show;
  }
  if (av) {
    if (!live) {
      av.hidden = true;
    } else if (remoteMetaAvIsAlert()) {
      av.hidden = false; // keep lag warnings visible
    } else if (!(av.textContent || "").trim() || av.textContent === "A/V") {
      // leave as updateAvLagChip left it when empty
      if (!show) av.hidden = true;
    } else {
      av.hidden = !show;
    }
  }
  const wrap = document.querySelector(".tile-remote-meta");
  if (wrap) wrap.classList.toggle("is-meta-hidden", live && !show);
}

function stopStats() {
  if (statsTimer) clearInterval(statsTimer);
  statsTimer = 0;
  clearRemoteMetaAutohide();
  const el = $("call-quality");
  if (el) {
    el.textContent = "";
    el.className = "quality";
    el.hidden = true;
  }
  const lag = $("av-lag-chip");
  if (lag) {
    lag.hidden = true;
    lag.textContent = "A/V";
    lag.className = "av-lag-chip";
  }
  clearConnChip();
  clearIcePathBadge();
  lastConnGrade = "";
  lastIceKind = "";
  applyRemoteMetaVisibility();
}

function clearConnChip() {
  const chip = $("conn-chip");
  if (!chip) return;
  chip.hidden = true;
  chip.textContent = "";
  chip.className = "conn-chip";
  chip.removeAttribute("title");
  $("tile-remote")?.classList.remove(
    "conn-grade-good",
    "conn-grade-ok",
    "conn-grade-weak"
  );
}

/**
 * Human-readable connection chip on partner tile (Good/OK/Weak · Direct/Relay).
 * Detail numbers stay on #call-quality for power users.
 */
let weakConnSince = 0;
let weakConnTipShownForMatch = false;

function clearWeakConnWatch() {
  weakConnSince = 0;
  weakConnTipShownForMatch = false;
  const t = $("weak-conn-tip");
  if (t) t.remove();
}

function maybeShowWeakConnTip(grade, iceKind) {
  if (!matched && !inFriendCall) {
    weakConnSince = 0;
    return;
  }
  if (grade !== "weak") {
    weakConnSince = 0;
    return;
  }
  if (!weakConnSince) weakConnSince = Date.now();
  if (weakConnTipShownForMatch) return;
  if (Date.now() - weakConnSince < 8000) return;
  weakConnTipShownForMatch = true;
  const preferOn =
    typeof preferDirectOnlyEnabled === "function" && preferDirectOnlyEnabled();
  const body =
    preferOn || iceKind === "relay"
      ? _t("conn.weakTipDirect") ||
        "Connection is weak — try Wi‑Fi, or turn off Prefer Direct in Settings → Connection."
      : _t("conn.weakTip") ||
        "Connection is weak — try Wi‑Fi or move closer to your router.";
  setStatus(body);
  trackEvent("conn_weak_tip", { ice: iceKind || "", prefer: preferOn ? 1 : 0 });
}

function updateConnChip(rtt, loss, iceKind) {
  const chip = $("conn-chip");
  if (!chip) return;
  if (!matched && !inFriendCall) {
    clearConnChip();
    clearWeakConnWatch();
    return;
  }
  const pathReady = iceKind === "direct" || iceKind === "relay";
  let grade = "ok";
  // Don't claim "Good" while ICE path is still unknown — that reads as "Good · Connecting…"
  if (!pathReady) {
    grade = "ok";
  } else if (
    (rtt != null && rtt > 450) ||
    (loss != null && loss > 4) ||
    lastQualityTier === "low" ||
    lastQualityTier === "min"
  ) {
    grade = "weak";
  } else if (
    (rtt == null || rtt < 180) &&
    (loss == null || loss < 1.5) &&
    iceKind !== "relay" &&
    lastQualityTier !== "mid"
  ) {
    grade = "good";
  } else if (rtt != null && rtt > 280) {
    grade = "ok";
  }

  const path =
    iceKind === "direct"
      ? _t("conn.chipDirect") || "Direct"
      : iceKind === "relay"
        ? _t("conn.chipRelay") || "Relay"
        : _t("conn.chipConnecting") || "Connecting…";
  const label = !pathReady
    ? _t("conn.chipLinking") || "Linking"
    : grade === "good"
      ? _t("conn.chipGood") || "Good"
      : grade === "weak"
        ? _t("conn.chipWeak") || "Weak"
        : _t("conn.chipOk") || "OK";

  const prevGrade = lastConnGrade;
  lastConnGrade = grade;
  chip.className =
    "conn-chip grade-" +
    (pathReady ? grade : "ok") +
    (iceKind === "relay" ? " path-relay" : "") +
    (!pathReady ? " path-unknown" : "");
  chip.textContent = label + " · " + path;
  // Partner tile live frame grade (visual border)
  const remoteTile = $("tile-remote");
  if (remoteTile) {
    remoteTile.classList.remove("conn-grade-good", "conn-grade-ok", "conn-grade-weak");
    remoteTile.classList.add("conn-grade-" + grade);
  }
  const detail = [];
  if (rtt != null) detail.push(Math.round(rtt) + " ms");
  if (loss != null) detail.push(loss.toFixed(1) + "% loss");
  chip.title =
    (_t("conn.chipTitle", { label, path }) || `Connection: ${label} · ${path}`) +
    (detail.length ? " (" + detail.join(", ") + ")" : "");
  maybeShowWeakConnTip(grade, iceKind);
  // Peek on first paint / grade change / weak; otherwise stay autohidden
  if (!prevGrade || prevGrade !== grade || grade === "weak") {
    peekRemoteMeta(grade === "weak" ? REMOTE_META_ALERT_MS : REMOTE_META_PEEK_MS);
  } else {
    applyRemoteMetaVisibility();
  }
}

function startStats() {
  stopStats();
  statsTimer = setInterval(async () => {
    if (!rtc?.pc) return;
    // Watchdog: never leave brand empty overlay over a live partner stream
    try {
      if (matched && partnerHasLiveVideo()) {
        if (isRemoteEmptyVisible()) ensurePartnerVideoVisible();
        for (const id of ["remote", "remote2", "remote-third"]) {
          const el = $(id);
          if (el?.srcObject && el.paused) playVideoEl(el);
        }
      }
    } catch (_) {}
    try {
      const report = await rtc.pc.getStats();
      let rtt = null;
      let loss = null;
      let bitrate = null;
      let lastBytes = startStats._bytes || 0;
      let lastTs = startStats._ts || 0;
      report.forEach((r) => {
        if (r.type === "candidate-pair" && r.state === "succeeded") {
          if (r.currentRoundTripTime != null) rtt = r.currentRoundTripTime * 1000;
        }
        if (r.type === "inbound-rtp" && r.kind === "video") {
          if (r.packetsLost != null && r.packetsReceived != null) {
            const total = r.packetsLost + r.packetsReceived;
            if (total > 0) loss = (r.packetsLost / total) * 100;
          }
          if (r.bytesReceived != null && r.timestamp) {
            if (lastTs && r.timestamp > lastTs) {
              bitrate =
                ((r.bytesReceived - lastBytes) * 8) / (r.timestamp - lastTs);
            }
            startStats._bytes = r.bytesReceived;
            startStats._ts = r.timestamp;
          }
        }
      });
      const parts = [];
      if (rtt != null) parts.push(`${Math.round(rtt)}ms`);
      if (bitrate != null && bitrate > 0) parts.push(`${Math.round(bitrate)}k`);
      if (loss != null) parts.push(`${loss.toFixed(1)}%`);
      const el = $("call-quality");
      if (el) {
        el.textContent = parts.join(" · ") || "";
        el.className = "quality";
        // Visibility handled by applyRemoteMetaVisibility (autohide)
        if (parts.length) el.removeAttribute("hidden");
        if (rtt != null && rtt > 250) el.classList.add("warn");
        if ((rtt != null && rtt > 500) || (loss != null && loss > 5))
          el.classList.add("bad");
      }

      // Media path: Direct P2P vs TURN relay
      let iceKind = lastIceKind || "unknown";
      if (typeof getIcePathKind === "function") {
        const kind = await getIcePathKind(rtc.pc);
        if (kind !== "unknown" || matched) {
          setIcePathBadge(kind);
          iceKind = kind || "unknown";
          lastIceKind = iceKind;
        }
      }
      updateConnChip(rtt, loss, iceKind);
      // A/V lag chip (lipsync) — independent of RTT “Good”
      try {
        await updateAvLagChip();
      } catch (_) {}
      applyRemoteMetaVisibility();
    } catch (_) {}
  }, 2000);
}

async function joinCall() {
  // Legacy button path — no longer shown; kept for safety
  if (!matched) {
    log(_t("log.notMatched"));
    return;
  }
  await ensurePreview();
}

function endCallKeepPreview() {
  closeAllPeers({ keepFriend: false });
  setSplitRemote(false);
  $("remote").srcObject = null;
  if ($("remote2")) $("remote2").srcObject = null;
  if (!matched) setRemoteEmpty(true);
}

function renderFriendsList() {
  const el = $("friends-list");
  if (!el) return;
  friendsCache = dedupeByUserId(friendsCache);
  const backup = loadFriendsBackup();
  const knownIds = new Set(friendsCache.map((f) => f.user_id));
  const knownCodes = new Set(
    friendsCache.map((f) => String(f.friend_code || "").toUpperCase()).filter(Boolean)
  );
  // Codes we know about but are not currently friends on hub (lost identity / removed)
  const recoverable = backup.filter((b) => {
    if (!b.friend_code) return false;
    const code = String(b.friend_code).toUpperCase();
    if (knownCodes.has(code)) return false;
    if (b.user_id && knownIds.has(b.user_id)) return false;
    return true;
  });

  // Identity recovery banner when list empty (or only recoverable codes)
  syncFriendsIdentityBanner(!!friendsCache.length, recoverable.length);

  // Toolbar: bonded filter
  const toolbar = $("friends-list-toolbar");
  const bondedBtn = $("btn-friends-filter-bonded");
  const bondedCountEl = $("friends-bonded-count");
  const bondedN = friendsCache.filter(
    (f) => f && (f.mutual_star || f.mutual_thanks)
  ).length;
  if (toolbar) {
    if (friendsCache.length && bondedN > 0) {
      toolbar.hidden = false;
      toolbar.removeAttribute("hidden");
    } else {
      toolbar.hidden = true;
      toolbar.setAttribute("hidden", "");
      if (friendsBondedOnly && bondedN === 0) {
        friendsBondedOnly = false;
        try {
          localStorage.removeItem(FRIENDS_BONDED_FILTER_KEY);
        } catch (_) {}
      }
    }
  }
  if (bondedBtn) {
    bondedBtn.classList.toggle("is-active", friendsBondedOnly);
    bondedBtn.setAttribute("aria-pressed", friendsBondedOnly ? "true" : "false");
  }
  if (bondedCountEl) {
    if (bondedN > 0) {
      bondedCountEl.hidden = false;
      bondedCountEl.removeAttribute("hidden");
      bondedCountEl.textContent = String(bondedN);
    } else {
      bondedCountEl.hidden = true;
      bondedCountEl.setAttribute("hidden", "");
    }
  }

  if (!friendsCache.length) {
    const hasBackup = recoverable.length > 0 || (backup && backup.length > 0);
    el.innerHTML = `<div class="sheet-empty friends-empty">
      <div class="sheet-empty-icon" aria-hidden="true">◎</div>
      <div class="sheet-empty-title">${escapeHtml(
        hasBackup
          ? _t("friends.emptyLostTitle") || "Friends not on this identity"
          : _t("friends.emptyTitle") || "No friends yet"
      )}</div>
      <p class="sheet-empty-body">${escapeHtml(
        hasBackup
          ? _t("friends.emptyLost") ||
              "This browser has a new user id. Import your profile backup to restore the same identity and friends on this hub."
          : _t("friends.empty") || "Share your code so others can Request you"
      )}</p>
      <div class="friends-empty-actions">
        ${
          hasBackup
            ? `<button type="button" class="pill accent tight sheet-empty-cta btn-import-profile" id="friends-empty-import">${escapeHtml(
                _t("settings.importUser") || "Import user"
              )}</button>`
            : ""
        }
        <button type="button" class="pill ${
          hasBackup ? "tight ghost" : "accent tight"
        } sheet-empty-cta" id="friends-empty-cta">${escapeHtml(
          _t("friends.emptyCta") || "Copy my code"
        )}</button>
      </div>
    </div>`;
    $("friends-empty-cta")?.addEventListener("click", () => {
      $("btn-copy-code")?.click();
      $("add-friend-code")?.focus();
    });
    // Import buttons use .btn-import-profile (wired globally)
  } else {
    const read = loadChatRead();
    const nicks = loadFriendNicks();
    // Bonded first (mutual ★, then mutual thanks), then online, then name
    let sortedFriends = [...friendsCache].sort((a, b) => {
      const ba = (a.mutual_star ? 2 : 0) + (a.mutual_thanks ? 1 : 0);
      const bb = (b.mutual_star ? 2 : 0) + (b.mutual_thanks ? 1 : 0);
      if (bb !== ba) return bb - ba;
      if (!!b.online !== !!a.online) return (b.online ? 1 : 0) - (a.online ? 1 : 0);
      const na = friendDisplayName(a).toLowerCase();
      const nb = friendDisplayName(b).toLowerCase();
      return na.localeCompare(nb);
    });
    if (friendsBondedOnly) {
      sortedFriends = sortedFriends.filter(
        (f) => f && (f.mutual_star || f.mutual_thanks)
      );
    }
    if (friendsBondedOnly && !sortedFriends.length) {
      el.innerHTML = `<div class="sheet-empty friends-empty">
        <div class="sheet-empty-icon" aria-hidden="true">★</div>
        <div class="sheet-empty-title">${escapeHtml(
          _t("friends.bondedEmptyTitle") || "No bonded friends yet"
        )}</div>
        <p class="sheet-empty-body">${escapeHtml(
          _t("friends.bondedEmpty") ||
            "Gift ★ each other after long chats — then ★↔ or 🙏↔ shows here."
        )}</p>
        <button type="button" class="pill tight accent" id="btn-friends-clear-bonded-filter">${escapeHtml(
          _t("friends.filterShowAll") || "Show all friends"
        )}</button>
      </div>`;
      $("btn-friends-clear-bonded-filter")?.addEventListener("click", () => {
        friendsBondedOnly = false;
        try {
          localStorage.removeItem(FRIENDS_BONDED_FILTER_KEY);
        } catch (_) {}
        renderFriendsList();
      });
      return;
    }
    el.innerHTML = sortedFriends
      .map((f) => {
        const online = f.online ? "online" : "";
        const st = f.online ? _t("friends.online") : _t("friends.offline");
        const display = friendDisplayName(f);
        const hasNick = !!(nicks[f.user_id] || "").trim();
        const realName = (f.name || f.short_id || "").toString();
        // Always offer Call — offline still tries ring (hub may push / clear stale online)
        // While in a 1v1, Call = invite to join (won't drop current conversationalist)
        const joinMode = canInviteJoinToCall();
        const callLbl = joinMode
          ? _t("friends.inviteJoin") ||
            _t("friends.addToCall") ||
            "Add to call"
          : f.online
            ? _t("friends.call") || "Call"
            : _t("friends.ringAnyway") || "Ring";
        const callTitle = joinMode
          ? _t("friends.inviteJoinHint") ||
            "Add them to this call — current partner stays"
          : f.online
            ? _t("friends.call") || "Call"
            : _t("friends.callOfflineHint") ||
              "They look offline — try ringing anyway";
        const callBtn = `<button type="button" class="pill tight ${
          joinMode ? "accent " : f.online ? "" : "ghost "
        }btn-call-friend" data-uid="${escapeAttr(
          f.user_id
        )}" title="${escapeAttr(callTitle)}">${escapeHtml(callLbl)}</button>`;
        const flairE = partnerFlairEmoji(f.user_id);
        const flairChip = flairE
          ? `<span class="friend-flair" title="${escapeAttr(
              _t("friends.duoFlairTitle") || "Duo flair"
            )}">${flairE}</span>`
          : "";
        const key = friendThreadKey(f.user_id);
        const thr = loadChatThreads()[key];
        const lastLocal = thr?.msgs?.length ? thr.msgs[thr.msgs.length - 1] : null;
        const lastTs = lastLocal?.ts || (f.last_msg_ts ? f.last_msg_ts * 1000 : 0);
        const unread =
          lastTs > (read[key] || 0) && lastLocal && !lastLocal.mine
            ? " unread"
            : f.last_msg_ts * 1000 > (read[key] || 0) && !lastLocal
              ? " unread"
              : "";
        const preview = lastLocal?.body || f.last_msg || "";
        const previewLine = preview
          ? `<span class="friend-preview${unread}">${escapeHtml(preview.slice(0, 60))}</span>`
          : "";
        const nickHint =
          hasNick && realName && realName !== display
            ? `<span class="friend-realname">${escapeHtml(realName)}</span>`
            : "";
        const renameLbl = escapeHtml(_t("friends.rename") || "Rename");
        const removeLbl = escapeHtml(_t("friends.remove"));
        const blockLbl = escapeHtml(_t("friends.block"));
        const moreLbl = escapeHtml(_t("friends.more") || "More");
        const secondary = `
          <button type="button" class="pill tight ghost btn-rename-friend" data-uid="${escapeAttr(
            f.user_id
          )}" data-name="${escapeAttr(realName)}" title="${escapeAttr(
          _t("friends.rename") || "Rename"
        )}">${renameLbl}</button>
          <button type="button" class="pill tight ghost btn-remove-friend" data-uid="${escapeAttr(
            f.user_id
          )}">${removeLbl}</button>
          <button type="button" class="pill tight danger btn-block-friend" data-uid="${escapeAttr(
            f.user_id
          )}">${blockLbl}</button>`;
        const starsN = Math.max(0, Number(f.stars) || 0);
        const starsChip =
          starsN > 0
            ? `<span class="friend-stars-chip" title="${escapeAttr(
                _t("stars.badgeTitle") || "Stars from long chats"
              )}">★ ${starsN}</span>`
            : "";
        const bondChip = f.mutual_star
          ? `<span class="friend-bond-chip is-star" title="${escapeAttr(
              _t("stars.mutualStarTip") || "You both gifted each other ★"
            )}">${escapeHtml(_t("stars.mutualStarChip") || "★↔")}</span>`
          : f.mutual_thanks
            ? `<span class="friend-bond-chip is-thanks" title="${escapeAttr(
                _t("stars.mutualThanksTip") || "You both said thanks"
              )}">${escapeHtml(_t("stars.mutualThanksChip") || "🙏↔")}</span>`
            : "";
        return `<div class="friend-row ${online}${unread}">
        ${friendAvatarHtml(f)}
        <span class="dot"></span>
        <div class="meta">
          <strong>${escapeHtml(display)}</strong>${flairChip}${starsChip}${bondChip}
          ${nickHint}
          <span>${escapeHtml(st)} · ${escapeHtml(f.friend_code || "")}</span>
          ${previewLine}
        </div>
        <div class="friend-actions">
          <div class="friend-actions-primary">
            <button type="button" class="pill tight accent btn-msg-friend" data-uid="${escapeAttr(
              f.user_id
            )}" data-name="${escapeAttr(display)}">${escapeHtml(
          _t("friends.message") || "Message"
        )}</button>
            ${callBtn}
          </div>
          <div class="friend-actions-overflow-inline">${secondary}</div>
          <div class="friend-more-wrap">
            <button type="button" class="pill tight ghost btn-friend-more" data-uid="${escapeAttr(
              f.user_id
            )}" aria-haspopup="true" aria-expanded="false" title="${moreLbl}" aria-label="${moreLbl}">⋮</button>
            <div class="friend-more-menu" hidden role="menu">${secondary}</div>
          </div>
        </div>
      </div>`;
      })
      .join("");
  }
  const wireFriendSecondary = (root) => {
    root.querySelectorAll(".btn-rename-friend").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAllFriendMoreMenus();
        renameFriendPrompt(
          btn.getAttribute("data-uid"),
          btn.getAttribute("data-name") || ""
        );
      });
    });
    root.querySelectorAll(".btn-remove-friend").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAllFriendMoreMenus();
        send({ type: "remove_friend", user_id: btn.getAttribute("data-uid") });
      });
    });
    root.querySelectorAll(".btn-block-friend").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAllFriendMoreMenus();
        blockUserId(btn.getAttribute("data-uid"));
      });
    });
  };
  wireFriendSecondary(el);
  el.querySelectorAll(".btn-msg-friend").forEach((btn) => {
    btn.addEventListener("click", () => {
      openFriendChat(btn.getAttribute("data-uid"), {
        name: btn.getAttribute("data-name") || "",
      });
    });
  });
  el.querySelectorAll(".btn-call-friend").forEach((btn) => {
    btn.addEventListener("click", () => {
      placeFriendCall(btn.getAttribute("data-uid"));
    });
  });
  el.querySelectorAll(".btn-friend-more").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wrap = btn.closest(".friend-more-wrap");
      const menu = wrap?.querySelector(".friend-more-menu");
      if (!menu) return;
      const open = menu.hidden;
      closeAllFriendMoreMenus();
      if (open) {
        menu.hidden = false;
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  // Recover / re-request section (local backup codes not on current friends list)
  const rec = $("friends-recover");
  if (rec) {
    if (!recoverable.length) {
      rec.hidden = true;
      rec.innerHTML = "";
    } else {
      rec.hidden = false;
      rec.innerHTML =
        `<div class="hint-inline req-title"><strong>${escapeHtml(
          _t("friends.recoverTitle") || "Re-add from backup"
        )}</strong><br/><span class="muted">${escapeHtml(
          _t("friends.recoverHint") ||
            "These friend codes were saved on this device. Tap Re-request if they are not in your list."
        )}</span></div>` +
        recoverable
          .slice(0, 24)
          .map(
            (b) => `<div class="friend-row">
          <span class="dot"></span>
          <div class="meta">
            <strong>${escapeHtml(b.name || b.friend_code)}</strong>
            <span>${escapeHtml(b.friend_code || "")}</span>
          </div>
          <div class="friend-actions">
            <button type="button" class="pill tight accent btn-recover-friend" data-code="${escapeAttr(
              b.friend_code
            )}">${escapeHtml(_t("friends.reRequest") || "Re-request")}</button>
          </div>
        </div>`
          )
          .join("");
      rec.querySelectorAll(".btn-recover-friend").forEach((btn) => {
        btn.addEventListener("click", () => {
          const code = btn.getAttribute("data-code");
          if (!code) return;
          requestAddFriend(code);
        });
      });
    }
  }
  updateFriendsUnreadBadge();

  const bl = $("blocked-list");
  if (bl) {
    if (!blockedCache.length) {
      bl.innerHTML = `<p class="hint-inline muted">${escapeHtml(
        _t("friends.blockedEmpty") || "No blocked users"
      )}</p>`;
    } else {
      bl.innerHTML =
        `<div class="hint-inline"><strong>${escapeHtml(_t("friends.blockedTitle"))}</strong></div>` +
        blockedCache
          .map(
            (uid) => `<div class="friend-row">
          <span class="dot"></span>
          <div class="meta"><strong>${escapeHtml(uid.slice(0, 12))}…</strong>
            <span>${escapeHtml(_t("friends.blocked"))}</span></div>
          <button type="button" class="pill tight btn-unblock" data-uid="${escapeAttr(
            uid
          )}">${escapeHtml(_t("friends.unblock"))}</button>
        </div>`
          )
          .join("");
      bl.querySelectorAll(".btn-unblock").forEach((btn) => {
        btn.addEventListener("click", () => {
          send({ type: "unblock_user", user_id: btn.getAttribute("data-uid") });
        });
      });
    }
  }
  syncFriendsTabCounts();
}

/** Strong certainty toast: block = permanent skip until unblock. */
function showBlockCertaintyToast(opts = {}) {
  const id = "block-certainty-toast";
  const existing = $(id);
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = id;
  toast.className = "report-toast block-certainty-toast";
  toast.setAttribute("role", "status");
  const title =
    opts.title ||
    _t("friends.blockOkTitle") ||
    _t("friends.blockOk") ||
    "Blocked";
  const body =
    opts.body ||
    _t("friends.blockNeverAgain") ||
    "You will not match them again. Unblock anytime in Friends.";
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(
    body
  )}</span>`;
  document.body.appendChild(toast);
  const ms = window.matchMedia("(max-width: 720px)").matches ? 6500 : 5000;
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, ms);
}

/** @returns {boolean} true if block was applied */
function blockUserId(uid, opts = {}) {
  uid = String(uid || "").trim();
  if (!uid) {
    setStatus(
      _t("friends.blockNeedId") ||
        "Cannot block — no user id on this history entry"
    );
    return false;
  }
  const silent = !!opts.silent;
  const keepFriends = !!opts.keepFriends;
  if (!silent && !confirm(_t("friends.blockConfirm"))) return false;
  // Must reach hub so block is stored server-side (prevents rematch forever)
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    setStatus(
      _t("friends.blockNeedConn") ||
        "Not connected to hub — wait for reconnect, then Block again"
    );
    log("block failed: ws not open");
    return false;
  }
  const sent = send({ type: "block_user", user_id: uid });
  if (!sent) {
    setStatus(
      _t("friends.blockNeedConn") ||
        "Not connected to hub — wait for reconnect, then Block again"
    );
    return false;
  }
  // Optimistic local cache so History / Blocked tab update immediately
  try {
    if (!blockedCache.includes(uid)) {
      blockedCache = [...blockedCache, uid];
    }
  } catch (_) {}
  // Drop from local history so they disappear from the list
  if (opts.fromHistory || opts.removeFromHistory) {
    try {
      saveHistory(loadHistory().filter((h) => h && h.user_id !== uid));
    } catch (_) {}
  }
  setStatus(_t("friends.blockNeverAgain") || _t("friends.blockOk"));
  log(_t("friends.blockOk") + " " + uid.slice(0, 10));
  if (!opts.skipToast) {
    showBlockCertaintyToast({
      title: _t("friends.blockOkTitle") || "Blocked",
      body:
        _t("friends.blockNeverAgain") ||
        "You will not match them again. Unblock anytime in Friends.",
    });
  }
  trackEvent("block", {
    silent: silent ? 1 : 0,
    from_history: opts.fromHistory ? 1 : 0,
  });
  if (primaryPartnerUserId === uid) {
    primaryPartnerUserId = "";
    matched = false;
    inFriendCall = false;
    matchMode = "solo";
    closeAllPeers({ keepFriend: false });
    setSplitRemote(false);
    setRemoteEmpty(true);
    updateFriendActionButtons();
    stopNsfwWatch();
  }
  if (!silent && !keepFriends) closeFriends();
  closePartnerMenu();
  try {
    syncFriendsTabCounts();
    // Refresh friends + blocked panels (blocked list lives inside renderFriendsList)
    try {
      renderFriendsList();
    } catch (_) {}
    if (opts.fromHistory) {
      // Jump to Blocked tab so the user can see the person is blocked
      try {
        setFriendsSheetTab("blocked");
      } catch (_) {
        if (friendsSheetTab === "history") renderHistoryList();
      }
    } else if (friendsSheetTab === "history") {
      renderHistoryList();
    }
  } catch (_) {}
  return true;
}

function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    const list = Array.isArray(raw) ? raw : [];
    // One-shot scrub of near-duplicate rows (double Matched / reconnect noise)
    return scrubHistoryDuplicates(list);
  } catch {
    return [];
  }
}

/**
 * Report + permanently block the last stranger conversationalist in history.
 * @param {number} [n=1] only last N strangers (default 1)
 * @returns {number} how many were actioned
 */
function banLastStrangersFromHistory(n = 1) {
  const want = Math.max(1, Math.min(5, Number(n) || 1));
  const friendIds = new Set(
    (friendsCache || []).map((f) => f.user_id).filter(Boolean)
  );
  const seen = new Set();
  const targets = [];
  // Use full encounter list (newest first), not collapsed-by-person
  const raw = [...loadHistory()].sort(
    (a, b) => (Number(b.t) || 0) - (Number(a.t) || 0)
  );
  for (const h of raw) {
    if (!h || !h.user_id) continue;
    if (friendIds.has(h.user_id)) continue;
    if (h.kind === "friend" || h.kind === "missed") continue;
    if (seen.has(h.user_id)) continue;
    if ((blockedCache || []).includes(h.user_id)) continue;
    seen.add(h.user_id);
    targets.push(h);
    if (targets.length >= want) break;
  }
  if (!targets.length) {
    setStatus(
      _t("friends.blockLastEmpty") ||
        "No recent stranger in Call history to block (need All filter + a match with id)."
    );
    return 0;
  }
  const h0 = targets[0];
  const ok = confirm(
    (_t("friends.blockLastConfirm", {
      n: targets.length,
      name: (h0.name || "stranger").slice(0, 32),
    }) ||
      `Report and permanently block last conversationalist${
        targets.length > 1 ? `s (${targets.length})` : ""
      }?\n\n${(h0.name || "anon").slice(0, 32)}`) +
      (targets.length > 1
        ? "\n" +
          targets
            .slice(1)
            .map((h) => (h.name || "anon").slice(0, 24))
            .join("\n")
        : "")
  );
  if (!ok) return 0;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    setStatus(
      _t("friends.blockNeedConn") ||
        "Not connected to hub — wait for reconnect, then try again"
    );
    return 0;
  }
  let done = 0;
  for (const h of targets) {
    const uid = String(h.user_id).trim();
    if (!uid) continue;
    try {
      saveLocalReport({
        t: Date.now(),
        user_id: uid,
        name: h.name || "",
        short_id: h.short_id || "",
        friend_code: h.friend_code || "",
        reason: "explicit",
      });
      send({ type: "report_user", user_id: uid, reason: "explicit" });
      blockUserId(uid, {
        silent: true,
        skipToast: true,
        fromHistory: true,
        removeFromHistory: false,
      });
      done++;
    } catch (_) {}
  }
  setStatus(
    _t("friends.blockLastOk", { n: done }) ||
      `Reported & blocked last conversationalist. You will not match them again.`
  );
  showBlockCertaintyToast({
    title: _t("friends.blockOkTitle") || "Blocked",
    body:
      _t("friends.blockLastOk", { n: done }) ||
      "Reported & blocked. Not again.",
  });
  try {
    setFriendsSheetTab("blocked");
  } catch (_) {
    renderHistoryList();
  }
  trackEvent("block_last_stranger", { n: done });
  return done;
}

// Emergency console: ruletkaBanLast() → last 1
try {
  window.ruletkaBanLast = banLastStrangersFromHistory;
} catch (_) {}

function saveHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
  } catch (_) {}
}

/** Stable key for “same person” in history (user_id > friend_code > short_id+name). */
function historyPersonKey(h) {
  if (!h) return "";
  const uid = String(h.user_id || "").trim();
  if (uid) return "u:" + uid;
  const code = String(h.friend_code || "")
    .trim()
    .toUpperCase();
  if (code) return "c:" + code;
  const sid = String(h.short_id || "")
    .trim()
    .toUpperCase();
  if (sid) return "s:" + sid;
  const name = String(h.name || "")
    .trim()
    .toLowerCase();
  if (name && name !== "anon") return "n:" + name + "|" + (h.kind || "");
  return "";
}

/**
 * Drop near-duplicate rows (same person, same kind, within window).
 * Keeps the richer/newer row (duration, ice_path, grade).
 * @param {Array} list
 * @param {number} [windowMs]
 */
function scrubHistoryDuplicates(list, windowMs = 90_000) {
  if (!Array.isArray(list) || list.length < 2) return list || [];
  const out = [];
  let changed = false;
  for (const h of list) {
    if (!h) {
      changed = true;
      continue;
    }
    const key = historyPersonKey(h);
    if (!key) {
      out.push(h);
      continue;
    }
    const prevIdx = out.findIndex(
      (x) =>
        historyPersonKey(x) === key &&
        (x.kind || "stranger") === (h.kind || "stranger") &&
        Math.abs((x.t || 0) - (h.t || 0)) < windowMs
    );
    if (prevIdx < 0) {
      out.push(h);
      continue;
    }
    changed = true;
    // Merge into the existing row — prefer higher duration / newer timestamp
    const prev = out[prevIdx];
    out[prevIdx] = mergeHistoryRows(prev, h, { addCount: false });
  }
  if (changed) {
    try {
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(out.slice(0, MAX_HISTORY))
      );
    } catch (_) {}
  }
  return out;
}

/**
 * Prefer non-empty fields; max duration; latest t.
 * @param {object} a
 * @param {object} b
 * @param {{ addCount?: boolean }} [opts] addCount=true when collapsing distinct calls
 */
function mergeHistoryRows(a, b, opts = {}) {
  const addCount = opts.addCount === true;
  const newer = (b.t || 0) >= (a.t || 0) ? b : a;
  const older = newer === b ? a : b;
  return {
    ...older,
    ...newer,
    t: Math.max(a.t || 0, b.t || 0),
    name: newer.name || older.name || "anon",
    user_id: newer.user_id || older.user_id || "",
    friend_code: newer.friend_code || older.friend_code || "",
    short_id: newer.short_id || older.short_id || "",
    kind: newer.kind || older.kind || "stranger",
    duration_secs: Math.max(a.duration_secs || 0, b.duration_secs || 0),
    ice_path: newer.ice_path || older.ice_path || "",
    conn_grade: newer.conn_grade || older.conn_grade || "",
    // Same-session merge: keep count; distinct calls: sum
    call_count: addCount
      ? (a.call_count || 1) + (b.call_count || 1)
      : Math.max(a.call_count || 1, b.call_count || 1),
  };
}

/**
 * Collapse history for display: one row per person (latest call), with call_count.
 * @param {Array} list
 * @returns {Array}
 */
function collapseHistoryByPerson(list) {
  if (!Array.isArray(list) || !list.length) return [];
  /** @type {Map<string, object>} */
  const byKey = new Map();
  const order = [];
  for (const h of list) {
    if (!h) continue;
    const key = historyPersonKey(h) || `solo:${h.t || 0}:${Math.random()}`;
    const prev = byKey.get(key);
    if (!prev) {
      const row = { ...h, call_count: h.call_count || 1 };
      byKey.set(key, row);
      order.push(key);
    } else {
      // Distinct stored rows for same person → one display row + summed count
      byKey.set(key, mergeHistoryRows(prev, h, { addCount: true }));
    }
  }
  // Return newest-first by last call time (order array alone is first-seen, not time).
  return order
    .map((k) => byKey.get(k))
    .filter(Boolean)
    .sort((a, b) => (Number(b.t) || 0) - (Number(a.t) || 0));
}

/**
 * Log every Matched peer into call history (one row per encounter).
 * @param {Array} peers
 * @param {{ mode?: string, friendCall?: boolean }} [opts]
 */
function recordMatchHistoryFromPeers(peers, opts = {}) {
  const list = Array.isArray(peers) ? peers : [];
  const friendCall = !!opts.friendCall;
  const mode = opts.mode || matchMode || "solo";
  let wrote = 0;
  const seen = new Set();
  for (const p of list) {
    if (!p) continue;
    const uid = String(p.user_id || "").trim();
    const code = String(p.friend_code || "").trim();
    const sid = String(p.short_id || "").trim();
    if (!uid && !code && !sid && !p.name) continue;
    // Skip pure teammates when logging strangers (friend is still logged as friend)
    const role = String(p.role || "");
    const isTeammate = role === "teammate" || role === "friend";
    if (isTeammate && !friendCall && mode !== "friend") continue;
    const dedupe = uid || code || sid || String(p.name || "");
    if (dedupe && seen.has(dedupe)) continue;
    if (dedupe) seen.add(dedupe);
    const kind =
      friendCall || mode === "friend" || isTeammate ? "friend" : "stranger";
    pushHistory({
      kind,
      name: p.name || lastMatchMeta?.name || "",
      user_id: uid,
      friend_code: code || lastMatchMeta?.friend_code || "",
      short_id: sid || lastMatchMeta?.short_id || "",
    });
    wrote++;
  }
  // Fallback: primary meta if peers empty / no ids yet
  if (!wrote && lastMatchMeta) {
    pushHistory({
      kind: friendCall || mode === "friend" ? "friend" : "stranger",
      ...lastMatchMeta,
    });
  }
}

/**
 * @param {{ kind: string, name?: string, user_id?: string, friend_code?: string, short_id?: string, t?: number, duration_secs?: number }} entry
 */
function pushHistory(entry) {
  if (!entry) return;
  const list = loadHistory();
  const row = {
    t: Number(entry.t) || Date.now(),
    kind: entry.kind || "stranger",
    name: (entry.name || entry.short_id || "anon").slice(0, 32),
    user_id: entry.user_id || "",
    friend_code: entry.friend_code || "",
    short_id: entry.short_id || "",
    call_count: 1,
    duration_secs: Number(entry.duration_secs) || 0,
  };
  const key = historyPersonKey(row);
  // Only merge true double-Matched noise (~12s). Every real encounter stays a row.
  const DEDUPE_MS = 12_000;
  let merged = false;
  if (key) {
    for (let i = 0; i < Math.min(list.length, 8); i++) {
      const prev = list[i];
      if (!prev) continue;
      if (historyPersonKey(prev) !== key) continue;
      if ((prev.kind || "stranger") !== row.kind) continue;
      if (Math.abs((prev.t || 0) - row.t) > DEDUPE_MS) continue;
      list.splice(i, 1);
      list.unshift(mergeHistoryRows(prev, row, { addCount: false }));
      merged = true;
      break;
    }
  }
  if (!merged) {
    list.unshift(row);
  }
  saveHistory(list);
  try {
    syncFriendsTabCounts();
    if (friendsSheetTab === "history") renderHistoryList();
    updateEmptyRecentStrip();
  } catch (_) {}
}

function formatHistoryTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function kindLabel(kind) {
  if (kind === "friend") return _t("friends.kindFriend");
  if (kind === "missed") return _t("friends.kindMissed");
  return _t("friends.kindStranger");
}

function formatDurationShort(secs) {
  if (!secs || secs < 1) return "";
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

/** @type {"all" | "friends"} */
let historyFilterMode = "all";
/** @type {"list" | "history" | "blocked"} */
let friendsSheetTab = "list";

function setFriendsSheetTab(tab) {
  const next =
    tab === "history" || tab === "blocked" || tab === "list" ? tab : "list";
  // Blocked tab only when there are blocks
  if (next === "blocked" && !(blockedCache && blockedCache.length)) {
    friendsSheetTab = "list";
  } else {
    friendsSheetTab = next;
  }
  const tabs = document.querySelectorAll("[data-friends-tab]");
  tabs.forEach((btn) => {
    const on = btn.getAttribute("data-friends-tab") === friendsSheetTab;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  const panels = {
    list: $("friends-panel-list"),
    history: $("friends-panel-history"),
    blocked: $("friends-panel-blocked"),
  };
  for (const [key, el] of Object.entries(panels)) {
    if (!el) continue;
    el.hidden = key !== friendsSheetTab;
  }
  if (friendsSheetTab === "history") {
    syncHistoryFilterUi();
    renderHistoryList();
  }
  syncFriendsTabCounts();
}

function syncFriendsTabCounts() {
  const nFriends = (friendsCache || []).length;
  // Badge = encounter rows (every match)
  const nHist = loadHistory().length;
  const nBlock = (blockedCache || []).length;
  const setCount = (id, n) => {
    const el = $(id);
    if (!el) return;
    if (n > 0) {
      el.hidden = false;
      el.textContent = n > 99 ? "99+" : String(n);
    } else {
      el.hidden = true;
      el.textContent = "0";
    }
  };
  setCount("friends-tab-count-list", nFriends);
  setCount("friends-tab-count-history", nHist);
  setCount("friends-tab-count-blocked", nBlock);
  const blockedTab = $("friends-tab-blocked");
  if (blockedTab) blockedTab.hidden = nBlock === 0;
}

function wireFriendsTabsOnce() {
  const root = $("friends-sheet");
  if (!root || root.dataset.tabsWired === "1") return;
  root.dataset.tabsWired = "1";
  root.querySelectorAll("[data-friends-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setFriendsSheetTab(btn.getAttribute("data-friends-tab") || "list");
    });
  });
  $("btn-friends-open-history")?.addEventListener("click", () => {
    setFriendsSheetTab("history");
  });
  $("history-filter-all")?.addEventListener("click", () => {
    historyFilterMode = "all";
    syncHistoryFilterUi();
    renderHistoryList();
  });
  $("history-filter-friends")?.addEventListener("click", () => {
    historyFilterMode = "friends";
    syncHistoryFilterUi();
    renderHistoryList();
  });
  $("btn-friends-filter-bonded")?.addEventListener("click", () => {
    friendsBondedOnly = !friendsBondedOnly;
    try {
      if (friendsBondedOnly) {
        localStorage.setItem(FRIENDS_BONDED_FILTER_KEY, "1");
      } else {
        localStorage.removeItem(FRIENDS_BONDED_FILTER_KEY);
      }
    } catch (_) {}
    trackEvent("friends_filter_bonded", { on: friendsBondedOnly ? 1 : 0 });
    renderFriendsList();
  });
}

function syncHistoryFilterUi() {
  const all = $("history-filter-all");
  const fr = $("history-filter-friends");
  if (all) {
    all.classList.toggle("is-active", historyFilterMode === "all");
    all.classList.toggle("accent", historyFilterMode === "all");
    all.classList.toggle("ghost", historyFilterMode !== "all");
  }
  if (fr) {
    fr.classList.toggle("is-active", historyFilterMode === "friends");
    fr.classList.toggle("accent", historyFilterMode === "friends");
    fr.classList.toggle("ghost", historyFilterMode !== "friends");
  }
}

function renderHistoryList() {
  const el = $("history-list");
  if (!el) return;
  const friendIds = new Set(
    (friendsCache || []).map((f) => f.user_id).filter(Boolean)
  );
  let list = loadHistory();
  if (historyFilterMode === "friends") {
    list = list.filter(
      (h) =>
        (h.user_id && friendIds.has(h.user_id)) ||
        h.kind === "friend" ||
        h.kind === "missed"
    );
  }
  // One row per encounter (newest first). Do not collapse — every match is listed.
  list = [...list].sort((a, b) => (Number(b.t) || 0) - (Number(a.t) || 0));
  el.hidden = false;
  const head = `<div class="hint-inline history-head"><strong>${escapeHtml(
    _t("friends.historyTitle") || "Call history"
  )}</strong>
      <button type="button" class="pill tight danger" id="btn-block-last-strangers" data-i18n="friends.blockLastStrangers" data-i18n-title="friends.blockLastStrangersTitle" title="${escapeAttr(
        _t("friends.blockLastStrangersTitle") ||
          "Report + permanently block the last stranger"
      )}">${escapeHtml(
        (_t("friends.blockLastStrangers") &&
          _t("friends.blockLastStrangers") !== "friends.blockLastStrangers"
          ? _t("friends.blockLastStrangers")
          : "Block last stranger")
      )}</button>
      <button type="button" class="pill tight ghost" id="btn-clear-history">${escapeHtml(
        _t("friends.historyClear")
      )}</button>
    </div>`;
  if (!list.length) {
    el.innerHTML =
      head +
      `<p class="hint-inline muted">${escapeHtml(
        historyFilterMode === "friends"
          ? _t("friends.historyEmptyFriends") || "No friend calls yet"
          : _t("friends.historyEmpty")
      )}</p>`;
    $("btn-clear-history")?.addEventListener("click", () => {
      saveHistory([]);
      renderHistoryList();
      syncFriendsTabCounts();
    });
    $("btn-block-last-strangers")?.addEventListener("click", () => {
      banLastStrangersFromHistory(1);
    });
    syncFriendsTabCounts();
    return;
  }
  el.innerHTML =
    head +
    list
      .slice(0, 32)
      .map((h) => {
        const isFriend = !!(h.user_id && friendIds.has(h.user_id));
        const fr = isFriend
          ? friendsCache.find((f) => f.user_id === h.user_id)
          : null;
        const onlineFriend = !!(fr && fr.online);
        const display =
          (fr && friendDisplayName(fr)) || h.name || h.short_id || "anon";
        const dur = formatDurationShort(h.duration_secs);
        const pathBit =
          h.ice_path === "direct"
            ? _t("conn.chipDirect") || "Direct"
            : h.ice_path === "relay"
              ? _t("conn.chipRelay") || "Relay"
              : "";
        const gradeBit =
          h.conn_grade === "good"
            ? _t("conn.chipGood") || "Good"
          : h.conn_grade === "weak"
              ? _t("conn.chipWeak") || "Weak"
              : h.conn_grade === "ok"
                ? _t("conn.chipOk") || "OK"
                : "";
        const count = Math.max(1, Number(h.call_count) || 1);
        const countBit =
          count > 1
            ? _t("friends.historyCallCount", { n: count }) || `${count} calls`
            : "";
        const metaBits = [
          isFriend ? _t("friends.kindFriend") || "Friend" : kindLabel(h.kind),
          formatHistoryTime(h.t),
          dur ? dur : "",
          pathBit,
          gradeBit,
          countBit,
          isFriend && !onlineFriend ? _t("friends.offline") : "",
          onlineFriend ? _t("friends.online") || "Online" : "",
        ]
          .filter(Boolean)
          .join(" · ");
        const isBlocked =
          !!(h.user_id && (blockedCache || []).includes(h.user_id));
        // Call / Message only for mutual friends. Past strangers: Add friend or Block — never ring.
        let actions = "";
        if (isFriend && onlineFriend) {
          actions = `<button type="button" class="pill tight accent btn-hist-call hist-call-primary" data-uid="${escapeAttr(
            h.user_id
          )}">${escapeHtml(
            _t("friends.call") || "Call"
          )}</button>`;
        } else if (isFriend && h.user_id) {
          // Offline friend: Message + muted wait hint (ring when they come online)
          actions = `<button type="button" class="pill tight ghost btn-hist-msg" data-uid="${escapeAttr(
            h.user_id
          )}" data-name="${escapeAttr(display)}">${escapeHtml(
            _t("friends.message") || "Message"
          )}</button><button type="button" class="pill tight ghost btn-hist-wait" data-uid="${escapeAttr(
            h.user_id
          )}" title="${escapeAttr(
            _t("friends.callWhenOnline") || "Call when they come online"
          )}">${escapeHtml(
            _t("friends.offline") || "Offline"
          )}</button>`;
        } else if (h.friend_code && !isFriend && !isBlocked) {
          actions = `<button type="button" class="pill tight accent btn-hist-add" data-code="${escapeAttr(
            h.friend_code
          )}">${escapeHtml(
            _t("friends.addFromHistory") || "Add friend"
          )}</button>`;
        }
        // Block past partners (hub stores block; matchmaking will never pair you again)
        if (h.user_id && !isBlocked) {
          actions += `<button type="button" class="pill tight danger btn-hist-block" data-uid="${escapeAttr(
            h.user_id
          )}" title="${escapeAttr(
            _t("friends.blockNeverAgain") ||
              "You will not match them again"
          )}">${escapeHtml(_t("friends.block") || "Block")}</button>`;
        } else if (h.user_id && isBlocked) {
          actions += `<span class="pill tight ghost hist-blocked-label">${escapeHtml(
            _t("friends.alreadyBlocked") || "Blocked"
          )}</span>`;
        }
        return `<div class="friend-row${onlineFriend ? " online is-call-ready" : ""}${
          isFriend ? " is-friend" : ""
        }${isBlocked ? " is-blocked" : ""}">
          <span class="dot ${onlineFriend ? "online" : ""}"></span>
          <div class="meta">
            <strong>${escapeHtml(display)}</strong>
            <span>${escapeHtml(metaBits)}</span>
          </div>
          <div class="friend-actions">${actions}</div>
        </div>`;
      })
      .join("");
  $("btn-clear-history")?.addEventListener("click", () => {
    saveHistory([]);
    renderHistoryList();
    syncFriendsTabCounts();
  });
  $("btn-block-last-strangers")?.addEventListener("click", () => {
    banLastStrangersFromHistory(1);
  });
  // Re-apply i18n so pack strings replace any stale fallback
  try {
    if (typeof applyI18n === "function") applyI18n(el);
    else if (typeof NextfaceI18n?.applyI18n === "function")
      NextfaceI18n.applyI18n(el);
  } catch (_) {}
  el.querySelectorAll(".btn-hist-call").forEach((btn) => {
    btn.addEventListener("click", () => {
      const uid = btn.getAttribute("data-uid");
      if (!uid || !isMutualFriend(uid)) {
        setStatus(
          _t("friends.callOnlyFriends") ||
            "Only friends can call — add them by code first"
        );
        return;
      }
      trackEvent("history_call_back");
      placeFriendCall(uid);
    });
  });
  el.querySelectorAll(".btn-hist-msg").forEach((btn) => {
    btn.addEventListener("click", () => {
      trackEvent("history_message");
      openFriendChat(btn.getAttribute("data-uid"), {
        name: btn.getAttribute("data-name") || "",
      });
    });
  });
  el.querySelectorAll(".btn-hist-wait").forEach((btn) => {
    btn.addEventListener("click", () => {
      trackEvent("history_wait_offline");
      setStatus(
        _t("friends.callWhenOnline") ||
          "You’ll get Call back when they come online"
      );
    });
  });
  el.querySelectorAll(".btn-hist-add").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-code");
      if (!code) return;
      trackEvent("history_add_friend");
      requestAddFriend(code);
    });
  });
  el.querySelectorAll(".btn-hist-block").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const uid = (btn.getAttribute("data-uid") || "").trim();
      if (!uid) {
        setStatus(
          _t("friends.blockNeedId") ||
            "Cannot block — no user id for this chat"
        );
        return;
      }
      trackEvent("history_block");
      blockUserId(uid, {
        keepFriends: true,
        fromHistory: true,
        removeFromHistory: true,
      });
    });
  });
  syncFriendsTabCounts();
}

function updateFriendsBadge() {
  // Requests + unread friend DMs share the same badge on the Friends button
  updateFriendsUnreadBadge();
}

function renderRequestLists() {
  updateFriendsBadge();
  const banner = $("friends-pending-banner");
  if (banner) {
    banner.hidden = !(outgoingRequests && outgoingRequests.length);
  }
  const inc = $("incoming-requests");
  const out = $("outgoing-requests");
  if (inc) {
    if (!incomingRequests.length) {
      inc.hidden = true;
      inc.innerHTML = "";
    } else {
      inc.hidden = false;
      inc.innerHTML =
        `<div class="hint-inline req-title"><strong>${escapeHtml(
          _t("friends.incomingTitle")
        )}</strong> — ${escapeHtml(_t("friends.mutualHint"))}</div>` +
        incomingRequests
          .map(
            (f) => `<div class="friend-row online req-row">
          <span class="dot"></span>
          <div class="meta">
            <strong>${escapeHtml(f.name || f.short_id)}</strong>
            <span>${escapeHtml(f.friend_code || "")}</span>
          </div>
          <div class="friend-actions">
            <button type="button" class="pill primary btn-accept-req" data-uid="${escapeAttr(
              f.user_id
            )}">${escapeHtml(_t("friends.acceptReq"))}</button>
            <button type="button" class="pill danger btn-decline-req" data-uid="${escapeAttr(
              f.user_id
            )}">${escapeHtml(_t("friends.declineReq"))}</button>
          </div>
        </div>`
          )
          .join("");
      inc.querySelectorAll(".btn-accept-req").forEach((btn) => {
        btn.addEventListener("click", () => {
          send({ type: "accept_friend", user_id: btn.getAttribute("data-uid") });
          setStatus(_t("friends.requestAccepted"));
        });
      });
      inc.querySelectorAll(".btn-decline-req").forEach((btn) => {
        btn.addEventListener("click", () => {
          send({ type: "decline_friend", user_id: btn.getAttribute("data-uid") });
        });
      });
    }
  }
  if (out) {
    if (!outgoingRequests.length) {
      out.hidden = true;
      out.innerHTML = "";
    } else {
      out.hidden = false;
      const waitLbl = escapeHtml(
        _t("friends.waitingAccept") || "Waiting for Accept"
      );
      const waitSub = escapeHtml(
        _t("friends.waitingAcceptSub") ||
          "They must open Friends and Accept before you can Call"
      );
      out.innerHTML =
        `<div class="hint-inline req-title"><strong>${escapeHtml(
          _t("friends.outgoingTitle")
        )}</strong></div>` +
        outgoingRequests
          .map(
            (f) => `<div class="friend-row friend-row-pending">
          <span class="dot pending"></span>
          <div class="meta">
            <strong>${escapeHtml(f.name || f.short_id || f.friend_code || "friend")}</strong>
            <span class="friend-wait-badge" title="${waitSub}">${waitLbl}</span>
            <span class="friend-code-muted">${escapeHtml(f.friend_code || "")}</span>
          </div>
          <div class="friend-actions">
            <button type="button" class="pill tight ghost btn-cancel-req" data-uid="${escapeAttr(
              f.user_id
            )}">${escapeHtml(_t("friends.cancelReq"))}</button>
          </div>
        </div>`
          )
          .join("");
      out.querySelectorAll(".btn-cancel-req").forEach((btn) => {
        btn.addEventListener("click", () => {
          send({ type: "decline_friend", user_id: btn.getAttribute("data-uid") });
        });
      });
    }
  }
}

/** Match duration timer (partner tile) */
let matchTimerStartedAt = 0;
let matchTimerInterval = 0;

function formatMatchDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}:${String(mm).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  return `${m}:${String(r).padStart(2, "0")}`;
}

function startMatchTimer() {
  stopMatchTimer();
  lastMatchDurationSec = 0;
  matchTimerStartedAt = Date.now();
  starProgressHalfShown = false;
  starProgressNearShown = false;
  starProgressReadyShown = false;
  try {
    hideStarUnlockBar();
  } catch (_) {}
  const el = $("match-timer");
  if (el) {
    el.textContent = "0:00";
    el.title = _t("stars.timerTitle") || "Time with partner";
  }
  // Brief peek of timer + quality row, then autohide
  peekRemoteMeta(REMOTE_META_PEEK_MS);
  matchTimerInterval = setInterval(() => {
    const el2 = $("match-timer");
    // Friend calls set inFriendCall; matched may stay false — still tick progress
    if (!el2 || (!matched && !inFriendCall)) return;
    const elapsedMs = Date.now() - matchTimerStartedAt;
    el2.textContent = formatMatchDuration(elapsedMs);
    try {
      maybeStarChatProgress(Math.floor(elapsedMs / 1000));
    } catch (_) {}
  }, 1000);
}

function stopMatchTimer() {
  if (matchTimerInterval) {
    clearInterval(matchTimerInterval);
    matchTimerInterval = 0;
  }
  if (matchTimerStartedAt) {
    lastMatchDurationSec = Math.max(
      0,
      Math.round((Date.now() - matchTimerStartedAt) / 1000)
    );
    if (lastMatchMeta?.user_id) {
      patchHistoryDuration(lastMatchMeta.user_id, lastMatchDurationSec);
    }
    try {
      noteLongChatForFlair(lastMatchMeta, lastMatchDurationSec);
    } catch (_) {}
  }
  matchTimerStartedAt = 0;
  clearRemoteMetaAutohide();
  const el = $("match-timer");
  if (el) {
    el.hidden = true;
    el.textContent = "0:00";
  }
}

function patchHistoryDuration(userId, secs) {
  if (!userId || secs < 1) return;
  const list = loadHistory();
  // Newest encounter for this person (list is newest-first)
  const row = list.find((h) => h && h.user_id === userId);
  if (!row) {
    // Still record a stub so the encounter is never missing
    try {
      pushHistory({
        kind: "stranger",
        user_id: userId,
        name: lastMatchMeta?.name || "",
        friend_code: lastMatchMeta?.friend_code || "",
        short_id: lastMatchMeta?.short_id || "",
        duration_secs: secs,
      });
    } catch (_) {}
    return;
  }
  row.duration_secs = Math.max(row.duration_secs || 0, secs);
  // Best-effort path quality for this match (local only)
  if (lastIceKind === "direct" || lastIceKind === "relay") {
    row.ice_path = lastIceKind;
  }
  if (lastConnGrade === "good" || lastConnGrade === "ok" || lastConnGrade === "weak") {
    row.conn_grade = lastConnGrade;
  }
  saveHistory(list);
}

/** Long-wait tips while searching with no match */
let waitTipsTimer = 0;
let waitTipsShown = false;

function clearWaitTipsWatch() {
  if (waitTipsTimer) {
    clearTimeout(waitTipsTimer);
    waitTipsTimer = 0;
  }
}

function hideWaitTips() {
  const el = $("wait-tips");
  if (el) el.hidden = true;
  waitTipsShown = false;
}

function showWaitTips() {
  if (!inQueue || matched) return;
  const el = $("wait-tips");
  if (!el) return;
  const body = $("wait-tips-body");
  if (body) {
    const online = Number($("stat-online")?.textContent || 0);
    const waiting = Number($("stat-waiting")?.textContent || 0);
    if (online <= 1) body.textContent = _t("wait.alone");
    else if (waiting <= 1) body.textContent = _t("wait.few");
    else body.textContent = _t("wait.body");
  }
  el.hidden = false;
  waitTipsShown = true;
}

function startWaitTipsWatch() {
  // No auto “still looking / keep this tab open” popups — user stays or leaves freely.
  clearWaitTipsWatch();
  hideWaitTips();
}

function wireWaitTips() {
  on("btn-wait-dismiss", "click", () => hideWaitTips());
  on("btn-wait-spin", "click", () => {
    hideWaitTips();
    $("btn-spin")?.click();
  });
}

/**
 * Friend came online — Call-first toast (Week-2).
 * Only when we can actually place a call (mutual friend + user_id + online).
 * During a live match: quiet status only (no toast steal focus).
 */
function showFriendOnlineToast(f) {
  const name = friendDisplayName(f) || f?.name || f?.friend_code || "Friend";
  const uid = (f?.user_id || "").trim();
  const canCall = !!(uid && f?.online && isMutualFriend(uid));

  // No actionable call → no toast (avoid empty “is online” noise)
  if (!canCall) {
    if (uid && f?.online) {
      setStatus(
        _t("friends.onlineNotifBody", { n: name }) || `${name} is online`
      );
    }
    return;
  }

  // Week-5: if this is the last missed-call peer, prioritize Call back copy
  let missedPriority = false;
  try {
    const m = loadLastMissedCall();
    missedPriority = !!(m && m.user_id === uid);
  } catch (_) {}

  if (matched || inFriendCall || trioBrowse) {
    setStatus(
      missedPriority
        ? _t("friends.onlineMissedDuringCall", { n: name }) ||
            `${name} (missed call) is online — Call after this chat`
        : _t("friends.onlineNotifBody", { n: name }) ||
            `${name} is online — Call after this chat`
    );
    trackEvent("friend_online_during_call", {
      has_uid: 1,
      missed: missedPriority ? 1 : 0,
    });
    return;
  }

  setStatus(
    missedPriority
      ? _t("friends.onlineMissedBody", { n: name }) ||
          `${name} is back — you missed their call. Call back?`
      : _t("friends.onlineNotifBody", { n: name }) ||
          `${name} is online — Call back`
  );
  const id = "presence-toast";
  const existing = $(id);
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = id;
  toast.className =
    "presence-toast presence-toast-call corner-toast is-call-first" +
    (missedPriority ? " is-missed-priority" : "");
  toast.setAttribute("role", "status");
  toast.style.pointerEvents = "auto";
  const sub = missedPriority
    ? _t("friends.onlineMissedSub") || "missed your call — Call back now"
    : _t("friends.onlineCallBack") || "is online — Call back";
  const btnLabel = missedPriority
    ? _t("friends.redialMissed") || "Call back now"
    : _t("friends.redial") || "Call back";
  toast.innerHTML = `
    <div class="presence-toast-text">
      <strong>${escapeHtml(name)}</strong>
      <span>${escapeHtml(sub)}</span>
    </div>
    <button type="button" class="pill tight accent presence-call-btn" id="btn-presence-call">${escapeHtml(
      btnLabel
    )}</button>`;
  document.body.appendChild(toast);
  trackEvent("friend_online_toast_show", {
    can_call: 1,
    missed: missedPriority ? 1 : 0,
  });
  const doCall = () => {
    toast.remove();
    trackEvent(
      missedPriority
        ? "friend_online_missed_call"
        : "friend_online_toast_call"
    );
    if (missedPriority) {
      try {
        clearLastMissedCall();
      } catch (_) {}
    }
    placeFriendCall(uid, { closePanel: false });
  };
  $("btn-presence-call")?.addEventListener("click", (e) => {
    e.stopPropagation();
    doCall();
  });
  // Whole toast = call (not open Friends) — drive rings
  toast.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    trackEvent("friend_online_toast_click_call");
    doCall();
  });
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, missedPriority ? 22000 : 16000);
  tryShowFriendOnlineNotification(name, uid, { missed: missedPriority });
  // Refresh empty strips so Call chips appear immediately
  try {
    updateFriendsOnlineStrip();
    updateEmptyAloneActions();
    updateEmptyRecentStrip();
    renderHistoryList();
    // Also surface missed banner if they just came online
    if (missedPriority) maybeShowMissedCallBackBanner();
  } catch (_) {}
}

function tryShowFriendOnlineNotification(name, uid, opts = {}) {
  if (!friendOnlineNotifEnabled()) return;
  if (typeof Notification === "undefined") return;
  // Toast handles foreground; OS notif when tab hidden (or always if user prefers alerts)
  if (document.visibilityState === "visible") return;
  if (Notification.permission !== "granted") return;
  try {
    const missed = !!opts.missed;
    const n = new Notification(
      missed
        ? _t("friends.onlineMissedNotifTitle") || "Missed call — they’re online"
        : _t("friends.onlineNotifTitle") || "Friend online",
      {
        body: missed
          ? _t("friends.onlineMissedNotifBody", { n: name || "Friend" }) ||
            `${name || "Friend"} is online — tap to Call back`
          : _t("friends.onlineNotifBody", { n: name || "Friend" }) ||
            `${name || "Friend"} is online — open to Call`,
        tag: "ruletka-friend-online-" + (uid || "x"),
        renotify: true,
        requireInteraction: missed,
      }
    );
    n.onclick = () => {
      window.focus();
      n.close();
      if (uid) {
        if (missed) {
          try {
            clearLastMissedCall();
          } catch (_) {}
        }
        placeFriendCall(uid, { closePanel: false });
      } else openFriends();
    };
  } catch (_) {}
}



function recordMissedCall(entry) {
  pushHistory({
    kind: "missed",
    name: entry?.name || entry?.short_id || "Friend",
    user_id: entry?.user_id || "",
    short_id: entry?.short_id || "",
    friend_code: entry?.friend_code || "",
  });
  updateFriendsUnreadBadge();
  saveLastMissedCall(entry);
  tryShowMissedCallNotification(entry?.name || "Friend");
  // In-app banner when free (or shortly after)
  try {
    if (!matched && !inFriendCall) {
      setTimeout(() => maybeShowMissedCallBackBanner(), 600);
    }
  } catch (_) {}
}

function tryShowMissedCallNotification(name) {
  if (typeof Notification === "undefined") return;
  if (document.visibilityState === "visible") return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(
      _t("friends.missedNotifTitle") || "Missed friend call",
      {
        body:
          _t("friends.missedNotifBody", { n: name || "Friend" }) ||
          `${name || "Friend"} — open Call history`,
        tag: "ruletka-missed-call",
        renotify: true,
      }
    );
    n.onclick = () => {
      window.focus();
      n.close();
      openFriends();
      try {
        setFriendsSheetTab("history");
      } catch (_) {}
    };
  } catch (_) {}
}

/** Keyboard shortcuts help */
function keysHelpOpen() {
  return $("keys-help") && !$("keys-help").hidden;
}
function openKeysHelp() {
  const el = $("keys-help");
  if (el) el.hidden = false;
}
function closeKeysHelp() {
  const el = $("keys-help");
  if (el) el.hidden = true;
}
function wireKeysHelp() {
  on("keys-help-close", "click", () => closeKeysHelp());
  $("keys-help")?.addEventListener("click", (e) => {
    if (e.target === $("keys-help")) closeKeysHelp();
  });
}

/**
 * Tile chrome: show on move/enter, always autohide after 3s idle.
 * JS-driven (not pure CSS :hover) so chrome doesn't stick while the mouse sits still.
 * Touch / coarse pointers: CSS keeps controls always visible.
 */
const CHROME_AUTOHIDE_MS = 3000;

function wireTileChromeAutohide() {
  const remote = $("tile-remote");
  const local = $("tile-local");
  if (!remote && !local) return;

  // Always show tile chrome (Flip/Mic/Hide/Blur/Settings/name/stars) fixed in-tile.
  // Autohide made controls vanish over black local preview.
  document.documentElement.classList.add("chrome-always");
  document.documentElement.classList.remove("chrome-autohide");
  document.documentElement.classList.remove("chrome-touch-autohide");
  try {
    remote?.classList.add("is-chrome-open");
    local?.classList.add("is-chrome-open");
  } catch (_) {}
  // Keep both tiles' chrome permanently open (no 3s hide timer)
  const pin = () => {
    try {
      remote?.classList.add("is-chrome-open");
      local?.classList.add("is-chrome-open");
      document.documentElement.classList.add("chrome-always");
      document.documentElement.classList.remove("chrome-autohide");
    } catch (_) {}
  };
  pin();
  setInterval(pin, 2000);
}

function showFriendRequestToast(msg) {
  const existing = $("friend-req-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "friend-req-toast";
  toast.className = "call-toast friend-req-toast";
  toast.setAttribute("role", "dialog");
  toast.innerHTML = `
    <div class="call-toast-body">
      <strong>${escapeHtml(msg.from_name || msg.from_code || "Friend")}</strong>
      <span>${escapeHtml(_t("friends.reqToast"))}</span>
      <span class="toast-sub">${escapeHtml(_t("friends.mutualHint"))}</span>
    </div>
    <div class="call-toast-actions">
      <button type="button" class="pill primary" id="btn-fr-accept">${escapeHtml(
        _t("friends.acceptReq") || "Accept"
      )}</button>
      <button type="button" class="pill danger" id="btn-fr-decline">${escapeHtml(
        _t("friends.declineReq") || "Reject"
      )}</button>
    </div>`;
  document.body.appendChild(toast);
  const uid = msg.from_user_id;
  $("btn-fr-accept")?.addEventListener("click", () => {
    send({ type: "accept_friend", user_id: uid });
    toast.remove();
    setStatus(_t("friends.requestAccepted"));
    playMatchChime();
  });
  $("btn-fr-decline")?.addEventListener("click", () => {
    send({ type: "decline_friend", user_id: uid });
    toast.remove();
  });
  playMatchChime();
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 60000);
}

/** Normalize pasted friend codes / invite URLs → 8-char hex when possible. */
function normalizeFriendCodeInput(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  // Invite link: …?friend=ABC123 or &friend=
  try {
    if (/^https?:\/\//i.test(s) || s.includes("friend=")) {
      const u = new URL(s, location.origin);
      const f = u.searchParams.get("friend");
      if (f) s = f;
    }
  } catch (_) {
    const m = s.match(/[?&]friend=([^&#\s]+)/i);
    if (m) s = decodeURIComponent(m[1]);
  }
  // Strip spaces, dashes, #, etc. Keep alnum only
  s = s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return s.slice(0, 16);
}

function requestAddFriend(rawCode) {
  const code = normalizeFriendCodeInput(rawCode);
  if (!code) {
    setStatus(_t("friends.needCode") || "Enter a friend code first");
    return false;
  }
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    setStatus(_t("friends.needConn") || "Not connected — wait for green status, then try again");
    log(_t("friends.needConn") || "add friend: not connected");
    // Kick reconnect so the next attempt can succeed
    try {
      if (!qHasNoconnect()) connect(false);
    } catch (_) {}
    return false;
  }
  if (myFriendCode && code === String(myFriendCode).toUpperCase().replace(/[^A-Z0-9]/g, "")) {
    setStatus(_t("friends.cannotSelf") || "That’s your own code");
    return false;
  }
  send({ type: "add_friend", code });
  // Optimistic UI — server confirms via status / friends push
  setStatus(_t("friends.sentToast") || _t("friends.requestSent") || "Request sent — waiting for Accept");
  log((_t("friends.requestSent") || "friend request sent") + " · " + code);
  showFriendSentToast(code);
  trackEvent("friend_request_sent");
  return true;
}

/** Soft toast: request sent → waiting for Accept (not a forced nag). */
function showFriendSentToast(code) {
  setStatus(
    (_t("friends.sentToast") || "Request sent — waiting for Accept") +
      (code ? ` · ${code}` : "")
  );
}

/** Toast when mutual friendship completes — Call if online (Week-2 funnel). */
function showFriendAcceptedToast(f) {
  const name = friendDisplayName(f) || f?.name || f?.friend_code || "Friend";
  const uid = (f?.user_id || "").trim();
  const online = !!(f?.online && uid);
  // Long-chat → friend: unlock duo flair (cosmetic, 7 days)
  let duo = false;
  try {
    duo = maybeGrantDuoFlair(f?.user_id);
  } catch (_) {}
  setStatus(
    online
      ? `${name} · ` +
          (_t("friends.acceptedOnline") || "You’re friends — Call now")
      : duo
        ? `${name} · ` +
          (_t("friends.duoFlairToast") ||
            "You’re friends · duo flair unlocked ✨")
        : `${name} · ` +
          (_t("friends.acceptedToast") ||
            "You’re friends now — Call when they’re online")
  );
  try {
    playMatchChime();
  } catch (_) {}
  trackEvent("friend_accepted", {
    duo: duo ? 1 : 0,
    online: online ? 1 : 0,
  });
  try {
    refreshFlairUi();
  } catch (_) {}

  // Visual toast with Call when they are already online
  try {
    if (matched || inFriendCall || trioBrowse) return;
    const id = "friend-accepted-toast";
    $(id)?.remove?.();
    const toast = document.createElement("div");
    toast.id = id;
    toast.className =
      "friend-soft-toast post-match-friend-nudge is-force is-accepted";
    toast.setAttribute("role", "status");
    toast.style.pointerEvents = "auto";
    toast.innerHTML = `
      <strong>${escapeHtml(
        _t("friends.acceptedToastTitle") || "You’re friends"
      )}</strong>
      <span>${escapeHtml(
        online
          ? _t("friends.acceptedOnlineBody", { name }) ||
              `${name} is online — Call them now.`
          : _t("friends.acceptedOfflineBody", { name }) ||
              `${name} · Call back when you both see Online.`
      )}</span>
      <div class="export-nudge-actions post-match-actions" style="margin-top:0.5rem">
        ${
          online
            ? `<button type="button" class="pill tight accent post-match-primary" id="btn-accepted-call">${escapeHtml(
                _t("friends.redial") || "Call back"
              )}</button>`
            : ""
        }
        <button type="button" class="pill tight ghost" id="btn-accepted-ok">${escapeHtml(
          _t("friends.postMatchDone") || "Got it"
        )}</button>
      </div>`;
    document.body.appendChild(toast);
    const dismiss = () => {
      if (toast.parentNode) toast.remove();
    };
    $("btn-accepted-ok")?.addEventListener("click", dismiss);
    $("btn-accepted-call")?.addEventListener("click", () => {
      trackEvent("friend_accepted_call");
      dismiss();
      if (uid) placeFriendCall(uid, { closePanel: false });
    });
    setTimeout(dismiss, online ? 20000 : 14000);
    // Week-3: after first Accept, soft opt-in for call alerts (background rings)
    maybeShowNotifOptInAfterAccept();
  } catch (_) {
    try {
      maybeShowNotifOptInAfterAccept();
    } catch (_) {}
  }
}

/* ── Cosmetic chat flair (local, no stars) ──
 * Long chat (≥15m) → temporary spark on you.
 * Later mutual friend accept with that partner → duo flair 7d.
 */
const FLAIR_KEY = "ruletka-chat-flair-v1";
const FLAIR_LONG_SECS = 15 * 60;
const FLAIR_SPARK_MS = 24 * 60 * 60 * 1000;
const FLAIR_DUO_MS = 7 * 24 * 60 * 60 * 1000;

function loadFlairState() {
  try {
    const raw = JSON.parse(localStorage.getItem(FLAIR_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function saveFlairState(st) {
  try {
    localStorage.setItem(FLAIR_KEY, JSON.stringify(st || {}));
  } catch (_) {}
}

function pruneFlairState(st) {
  const now = Date.now();
  if (st.selfUntil && st.selfUntil < now) delete st.selfUntil;
  if (st.selfKind && !st.selfUntil) delete st.selfKind;
  if (st.longPartners && typeof st.longPartners === "object") {
    for (const [k, v] of Object.entries(st.longPartners)) {
      if (!v || v < now) delete st.longPartners[k];
    }
  }
  if (st.duo && typeof st.duo === "object") {
    for (const [k, v] of Object.entries(st.duo)) {
      if (!v || v < now) delete st.duo[k];
    }
  }
  if (st.starBond && typeof st.starBond === "object") {
    for (const [k, v] of Object.entries(st.starBond)) {
      if (!v || v < now) delete st.starBond[k];
    }
  }
  return st;
}

/** After a long stranger/friend chat, remember partner + give yourself a 24h spark. */
function noteLongChatForFlair(meta, secs) {
  if (!meta || secs < FLAIR_LONG_SECS) return;
  const uid = String(meta.user_id || "").trim();
  const st = pruneFlairState(loadFlairState());
  const now = Date.now();
  st.selfUntil = Math.max(st.selfUntil || 0, now + FLAIR_SPARK_MS);
  st.selfKind =
    st.selfKind === "duo" || st.selfKind === "bond" ? st.selfKind : "spark";
  if (uid) {
    if (!st.longPartners) st.longPartners = {};
    st.longPartners[uid] = now + FLAIR_DUO_MS; // eligible for duo if they become friends
  }
  saveFlairState(st);
  try {
    maybeCompleteWelcomeBack();
  } catch (_) {}
  refreshFlairUi();
  trackEvent("flair_spark", { secs: Math.floor(secs) });
}

/** If accepted friend was a long-chat partner → duo flair. */
function maybeGrantDuoFlair(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return false;
  const st = pruneFlairState(loadFlairState());
  const now = Date.now();
  const eligible = st.longPartners && st.longPartners[uid] > now;
  if (!eligible) {
    saveFlairState(st);
    return false;
  }
  if (!st.duo) st.duo = {};
  st.duo[uid] = now + FLAIR_DUO_MS;
  st.selfUntil = Math.max(st.selfUntil || 0, now + FLAIR_DUO_MS);
  st.selfKind = "duo";
  delete st.longPartners[uid];
  saveFlairState(st);
  trackEvent("flair_duo", {});
  return true;
}

function selfFlairEmoji() {
  const st = pruneFlairState(loadFlairState());
  saveFlairState(st);
  if (!st.selfUntil || st.selfUntil < Date.now()) return "";
  if (st.selfKind === "duo") return "✨";
  if (st.selfKind === "bond") return "⭐";
  return "🔥";
}

function partnerFlairEmoji(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return "";
  const st = pruneFlairState(loadFlairState());
  if (st.duo && st.duo[uid] > Date.now()) return "✨";
  if (st.starBond && st.starBond[uid] > Date.now()) return "⭐";
  return "";
}

/** Mutual ★ gift bond flair (7d) — closes the gift-back loop. */
function maybeGrantMutualStarFlair(userId, opts = {}) {
  const uid = String(userId || "").trim();
  if (!uid) return false;
  let mutual = !!opts.force;
  if (!mutual) {
    try {
      const fr = (friendsCache || []).find((f) => f && f.user_id === uid);
      mutual = !!(fr && fr.mutual_star);
    } catch (_) {}
  }
  // They praised us this session and we just gifted → bond forming
  if (!mutual && recentPraiseBy && recentPraiseBy[uid]) {
    mutual = true;
  }
  if (!mutual) return false;
  const st = pruneFlairState(loadFlairState());
  const now = Date.now();
  if (!st.starBond) st.starBond = {};
  st.starBond[uid] = now + FLAIR_STAR_BOND_MS;
  st.selfUntil = Math.max(st.selfUntil || 0, now + FLAIR_STAR_BOND_MS);
  st.selfKind = "bond";
  saveFlairState(st);
  try {
    refreshFlairUi();
  } catch (_) {}
  trackEvent("flair_star_bond", {});
  try {
    showStarFeedbackToast("gift", {
      title: _t("stars.bondFlairTitle") || "Mutual ★ bond",
      body:
        _t("stars.bondFlairBody") ||
        "You both gifted ★ — duo bond flair for a week.",
    });
  } catch (_) {}
  return true;
}

function refreshFlairUi() {
  const me = selfFlairEmoji();
  document.documentElement.classList.toggle("has-self-flair", !!me);
  document.documentElement.classList.toggle(
    "has-duo-flair",
    me === "✨"
  );
  const chip = $("local-flair-chip");
  if (chip) {
    if (me) {
      chip.hidden = false;
      chip.removeAttribute("hidden");
      chip.textContent = me;
      chip.title =
        me === "✨"
          ? _t("friends.duoFlairTitle") || "Duo flair — long chat + friends"
          : me === "⭐"
            ? _t("stars.bondFlairTitle") || "Mutual ★ bond"
            : _t("friends.sparkFlairTitle") || "Spark flair — long chat (24h)";
    } else {
      chip.hidden = true;
      chip.setAttribute("hidden", "");
    }
  }
  // Partner tile flair
  const pChip = $("remote-flair-chip");
  if (pChip) {
    const uid = primaryPartnerUserId || lastMatchMeta?.user_id || "";
    const pe = partnerFlairEmoji(uid);
    if (pe && (matched || inFriendCall)) {
      pChip.hidden = false;
      pChip.removeAttribute("hidden");
      pChip.textContent = pe;
      pChip.title =
        pe === "⭐"
          ? _t("stars.bondFlairTitle") || "Mutual ★ bond"
          : _t("friends.duoFlairTitle") || "Duo flair — long chat + friends";
    } else {
      pChip.hidden = true;
      pChip.setAttribute("hidden", "");
    }
  }
}

const FRIENDS_FIRST_HINT_KEY = "ruletka-friends-first-hint-v1";

function friendsFirstHintDone() {
  try {
    return localStorage.getItem(FRIENDS_FIRST_HINT_KEY) === "1";
  } catch {
    return true;
  }
}

function markFriendsFirstHintDone() {
  try {
    localStorage.setItem(FRIENDS_FIRST_HINT_KEY, "1");
  } catch (_) {}
}

/** First-run Friends sheet: highlight code + short how-to (not a site-wide nag). */
function maybeShowFriendsFirstRun() {
  const hero = $("friends-code-hero");
  const first = $("friends-first-hint");
  const codeEl = $("my-friend-code");
  const copyBtn = $("btn-copy-code");
  const noFriends = !(friendsCache && friendsCache.length);
  const showFirst = noFriends && !friendsFirstHintDone();
  if (hero) hero.classList.toggle("is-first-run", showFirst);
  if (first) first.hidden = !showFirst;
  if (showFirst) {
    // Expand how-codes once so Request/Accept path is obvious
    const how = document.querySelector(".friends-how-codes");
    if (how) how.open = true;
    if (codeEl && myFriendCode) {
      try {
        const range = document.createRange();
        range.selectNodeContents(codeEl);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch (_) {}
    }
    copyBtn?.classList.add("pulse-once");
    setTimeout(() => copyBtn?.classList.remove("pulse-once"), 2400);
    // After focus trap settles, prefer Copy / code field for first-run
    setTimeout(() => {
      try {
        if (myFriendCode) copyBtn?.focus?.();
        else $("add-friend-code")?.focus?.();
      } catch (_) {}
    }, 140);
  }
}

function openFriends() {
  closeAllDockFlyouts("friends");
  syncFriendOnlineNotifUi();
  ensureNotifPermissionSoft();
  const sheet = $("friends-sheet");
  const bd = $("friends-backdrop");
  const btn = $("btn-friends");
  if (sheet) {
    sheet.hidden = false;
    sheet.removeAttribute("hidden");
    positionDockFlyout(sheet, btn, {
      align: "start",
      maxWidth: 400,
      maxHeight: friendsFlyoutMaxHeight(),
      fixedHeight: true,
    });
    void sheet.offsetWidth;
    sheet.classList.add("is-open");
    // Land on Display name → code → pending → friends (not mid-scroll leftovers)
    try {
      const body = sheet.querySelector(".sheet-body");
      if (body) body.scrollTop = 0;
    } catch (_) {}
  }
  if (bd) {
    bd.hidden = false;
    bd.removeAttribute("hidden");
    bd.classList.add("is-open");
  }
  setDockFlyoutOpen(btn, true);
  syncNameInputs(getDisplayName());
  if ($("my-friend-code")) {
    $("my-friend-code").textContent = myFriendCode || "—";
  }
  // No code yet → re-hello so the hub assigns / re-sends friend_code
  if (!myFriendCode && ws && ws.readyState === WebSocket.OPEN) {
    try {
      sendHelloPayload(getDisplayName());
    } catch (_) {}
  } else if (!ws || ws.readyState !== WebSocket.OPEN) {
    setStatus(_t("friends.needConn") || "Connecting… open Friends again in a moment");
    try {
      if (!qHasNoconnect()) connect(false);
    } catch (_) {}
  }
  wireFriendsTabsOnce();
  markMissedCallsRead();
  renderFriendsList();
  renderRequestLists();
  renderHistoryList();
  syncFriendsTabCounts();
  setFriendsSheetTab(friendsSheetTab || "list");
  bindSheetFocusTrap(sheet);
  // After trap attaches, first-run may re-focus Copy (slightly later)
  maybeShowFriendsFirstRun();
  // Soft: empty list + local backup → import reminder
  setTimeout(() => maybeShowIdentityRecoveryToast(), 600);
  // One-shot wire for export from friends sheet
  const exp = $("btn-friends-export");
  if (exp && !exp.dataset.wired) {
    exp.dataset.wired = "1";
    exp.addEventListener("click", () => exportProfileFile());
  }
}
function closeFriends() {
  const sheet = $("friends-sheet");
  const bd = $("friends-backdrop");
  const btn = $("btn-friends");
  releaseSheetFocusTrap(sheet);
  sheet?.classList.remove("is-open");
  bd?.classList.remove("is-open");
  setDockFlyoutOpen(btn, false);
  if (sheet) sheet.hidden = true;
  if (bd) bd.hidden = true;
  closeAllFriendMoreMenus();
}

function hideIncomingCall() {
  incomingCallFrom = null;
  stopIncomingRing();
  const toast = $("call-toast");
  if (toast) toast.remove();
}

function showIncomingCall(msg) {
  if (!msg?.from_user_id) return;
  hideIncomingCall();
  incomingCallFrom = msg.from_user_id;
  const name = msg.from_name || msg.from_short || "Friend";
  const isJoin = !!msg.join;
  const withName = msg.with_name || "";
  // join:true from hub means either (a) they invite you into *their* call, or
  // (b) they are ringing you while *you* are already in a 1v1 — accept adds them
  // without dropping your current conversationalist.
  const iAmInLive1v1 =
    !!matched &&
    (matchMode === "solo" || matchMode === "friend" || inFriendCall) &&
    peerPcs.size <= 1 &&
    !trioBrowse;
  const addToMyCall = isJoin && iAmInLive1v1 && !!withName;
  const body = addToMyCall
    ? _t("friends.incomingAddToCall", { n: name }) ||
      `${name} wants to join your call — accept to add them (keep current partner)`
    : isJoin
      ? withName
        ? _t("friends.incomingJoinWith", { n: name, w: withName }) ||
          `${name} invites you to join their call with ${withName}`
        : _t("friends.incomingJoin", { n: name }) ||
          `${name} invites you to join their call`
      : _t("friends.incoming") || "is calling…";
  const acceptLbl = addToMyCall
    ? _t("friends.addToCall") || "Add to call"
    : isJoin
      ? _t("friends.joinCall") || "Join"
      : _t("friends.accept") || "Accept";

  const toast = document.createElement("div");
  toast.id = "call-toast";
  toast.className = "call-toast" + (isJoin ? " is-join-invite" : "");
  toast.setAttribute("role", "dialog");
  toast.setAttribute("aria-live", "assertive");
  toast.innerHTML = `
    <div class="call-toast-body">
      <strong id="call-toast-name">${escapeHtml(name)}</strong>
      <span>${escapeHtml(body)}</span>
    </div>
    <div class="call-toast-actions">
      <button type="button" class="pill primary" id="btn-accept-call">${escapeHtml(acceptLbl)}</button>
      <button type="button" class="pill danger" id="btn-decline-call">${escapeHtml(_t("friends.decline"))}</button>
    </div>`;
  document.body.appendChild(toast);

  $("btn-accept-call")?.addEventListener("click", () => {
    if (!incomingCallFrom) {
      hideIncomingCall();
      return;
    }
    send({ type: "call_respond", user_id: incomingCallFrom, accept: true });
    hideIncomingCall();
  });
  $("btn-decline-call")?.addEventListener("click", () => {
    if (!incomingCallFrom) {
      hideIncomingCall();
      return;
    }
    if (!isJoin) {
      recordMissedCall({
        name,
        user_id: incomingCallFrom,
        short_id: msg.from_short || "",
        friend_code: msg.from_code || "",
      });
    }
    send({ type: "call_respond", user_id: incomingCallFrom, accept: false });
    hideIncomingCall();
  });

  startIncomingRing(name);
  log(isJoin ? `${name} · join invite` : `${name} calling…`);
  setStatus(body);
}

function toggleFullscreenPartner() {
  const v = $("remote");
  if (!document.fullscreenElement) v.requestFullscreen?.().catch(() => {});
  else document.exitFullscreen?.();
}

function pipSupported() {
  try {
    const v = $("remote");
    return !!(
      document.pictureInPictureEnabled &&
      v &&
      typeof v.requestPictureInPicture === "function"
    );
  } catch (_) {
    return false;
  }
}

/** PiP control removed from the UI — keep no-ops for any remaining callers. */
function updatePipButton() {}
async function togglePartnerPip() {}
function maybeAutoPipOnHide() {}

const REPORTS_KEY = "rulet.reports.v1";

/* ─── Formal debate (30s alternating turns, P2P-synced) ─── */

function debatePartnerName() {
  return (
    lastMatchMeta?.name ||
    friendDisplayName(
      friendsCache.find((f) => f.user_id === primaryPartnerUserId)
    ) ||
    _t("remote.tag") ||
    "Partner"
  );
}

/** Send a debate_* control message over the primary P2P data channel. */
function sendDebateP2p(obj) {
  if (!obj || typeof obj !== "object") return false;
  const payload = {
    v: 1,
    ...obj,
    user_id: myUserId || "",
    name: getDisplayName() || "anon",
    ts: typeof obj.ts === "number" ? obj.ts : Date.now(),
  };
  let ok = false;
  // Prefer primary peer; fall back to any open chat channel
  const pcs = [];
  if (rtc) pcs.push(rtc);
  for (const pc of chatPeerPcs()) {
    if (pc && !pcs.includes(pc)) pcs.push(pc);
  }
  for (const pc of pcs) {
    if (pc?.sendChatMessage?.(payload)) {
      ok = true;
      break;
    }
  }
  return ok;
}

function canStartDebate() {
  return !!(
    matched &&
    primaryPartnerUserId &&
    primaryPartnerUserId !== myUserId &&
    !debate.active &&
    !debate.pending
  );
}

function normalizeDebateTurnMs(ms) {
  const n = Number(ms) || DEBATE_TURN_MS;
  // Snap to known choices when close; clamp otherwise
  const secs = Math.round(n / 1000);
  if (DEBATE_TURN_CHOICES_S.includes(secs)) return secs * 1000;
  return Math.min(120_000, Math.max(10_000, Math.round(n / 1000) * 1000));
}

function normalizeDebateTopic(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * A round = both people get one turn each.
 * turnIndex 0–1 → Round 1, 2–3 → Round 2, …
 * @param {number} [turnIndex]
 * @returns {number}
 */
function debateRoundNumber(turnIndex = debate.turnIndex) {
  const idx = Math.max(0, Number(turnIndex) || 0);
  return Math.floor(idx / 2) + 1;
}

/** 1 = first half of round (inviter side of the pair), 2 = second half */
function debateHalfInRound(turnIndex = debate.turnIndex) {
  return (Math.max(0, Number(turnIndex) || 0) % 2) + 1;
}

function debateRoundLabel(turnIndex = debate.turnIndex) {
  const r = debateRoundNumber(turnIndex);
  return _t("debate.round", { n: r }) || `Round ${r}`;
}

/** Soft tones for turn change / 5s warning (respects reduced motion). */
function debateSoundsAllowed() {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }
  } catch (_) {}
  return true;
}

function ensureDebateAudioCtx() {
  if (debateAudioCtx) return debateAudioCtx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    debateAudioCtx = new AC();
  } catch (_) {
    return null;
  }
  return debateAudioCtx;
}

/**
 * @param {number} freq
 * @param {number} durMs
 * @param {number} [gain]
 * @param {number} [delayMs]
 */
function playDebateTone(freq, durMs, gain = 0.05, delayMs = 0) {
  if (!debateSoundsAllowed()) return;
  try {
    const ctx = ensureDebateAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume?.().catch?.(() => {});
    const t0 = ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.02);
  } catch (_) {}
}

function playDebateTurnChime() {
  // Two soft notes — new speaker
  playDebateTone(660, 90, 0.045, 0);
  playDebateTone(880, 110, 0.04, 90);
}

function playDebateRoundChime() {
  // Three rising notes — new round
  playDebateTone(523, 80, 0.04, 0);
  playDebateTone(659, 90, 0.045, 90);
  playDebateTone(784, 120, 0.05, 190);
}

function playDebateUrgentBeep() {
  // Short low tick — 5s remaining
  playDebateTone(520, 70, 0.05, 0);
  playDebateTone(520, 70, 0.04, 120);
}

/**
 * Partner menu → open compose (length + topic) or end/cancel.
 */
function invitePartnerDebate() {
  if (debate.active) {
    endDebate({ notify: true, reason: "user" });
    closePartnerMenu();
    return;
  }
  if (debate.pending === "out") {
    sendDebateP2p({
      type: "debate_cancel",
      invite_id: debate.inviteId,
    });
    clearDebatePending();
    setStatus(_t("debate.inviteCancelled") || "Debate invite cancelled");
    closePartnerMenu();
    return;
  }
  if (!canStartDebate()) {
    setStatus(
      _t("debate.needLive") || "Debate only works during a live 1:1 call"
    );
    closePartnerMenu();
    return;
  }
  const dcOpen =
    rtc?.isChatDcOpen?.() ||
    [...peerPcs.values()].some((pc) => pc?.isChatDcOpen?.());
  if (!dcOpen) {
    setStatus(
      _t("debate.needP2p") ||
        "Wait until the connection is ready, then invite again"
    );
    closePartnerMenu();
    return;
  }
  showPartnerDebateCompose();
}

function showPartnerDebateCompose() {
  const main = $("partner-menu-main");
  const rep = $("partner-menu-report");
  const deb = $("partner-menu-debate");
  if (main) {
    main.hidden = true;
    main.setAttribute("hidden", "");
  }
  if (rep) {
    rep.hidden = true;
    rep.setAttribute("hidden", "");
  }
  if (deb) {
    deb.hidden = false;
    deb.removeAttribute("hidden");
  }
  const title = $("partner-menu-title");
  if (title) title.textContent = _t("debate.composeTitle") || "Formal debate";
  // Restore last length selection
  const secs = debate.composeTurnSecs || 30;
  $("debate-turn-picks")
    ?.querySelectorAll("[data-turn-secs]")
    .forEach((btn) => {
      const s = Number(btn.getAttribute("data-turn-secs"));
      btn.classList.toggle("is-selected", s === secs);
    });
  const topicIn = $("debate-topic-input");
  if (topicIn && !topicIn.value) topicIn.value = "";
  setTimeout(() => topicIn?.focus?.(), 40);
}

function hidePartnerDebateCompose() {
  const deb = $("partner-menu-debate");
  if (deb) {
    deb.hidden = true;
    deb.setAttribute("hidden", "");
  }
}

function sendDebateInviteFromCompose() {
  if (!canStartDebate()) {
    setStatus(
      _t("debate.needLive") || "Debate only works during a live 1:1 call"
    );
    closePartnerMenu();
    return;
  }
  const dcOpen =
    rtc?.isChatDcOpen?.() ||
    [...peerPcs.values()].some((pc) => pc?.isChatDcOpen?.());
  if (!dcOpen) {
    setStatus(
      _t("debate.needP2p") ||
        "Wait until the connection is ready, then invite again"
    );
    closePartnerMenu();
    return;
  }
  const pick =
    $("debate-turn-picks")?.querySelector(".debate-turn-pick.is-selected") ||
    $("debate-turn-picks")?.querySelector('[data-turn-secs="30"]');
  const secs = Number(pick?.getAttribute("data-turn-secs")) || 30;
  const turnMs = normalizeDebateTurnMs(secs * 1000);
  const topic = normalizeDebateTopic($("debate-topic-input")?.value);
  debate.composeTurnSecs = Math.round(turnMs / 1000);
  debate.turnMs = turnMs;
  debate.topic = topic;

  const inviteId = `d-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  debate.pending = "out";
  debate.inviteId = inviteId;
  debate.partnerId = primaryPartnerUserId;
  debate.hostId = myUserId || "";
  const sent = sendDebateP2p({
    type: "debate_invite",
    invite_id: inviteId,
    turn_ms: turnMs,
    topic,
    from_name: getDisplayName() || "anon",
  });
  if (!sent) {
    clearDebatePending();
    setStatus(
      _t("debate.needP2p") ||
        "Wait until the connection is ready, then invite again"
    );
    closePartnerMenu();
    return;
  }
  setStatus(
    _t("debate.inviteSent", { n: debatePartnerName() }) ||
      `Debate invite sent to ${debatePartnerName()}…`
  );
  log(_t("debate.inviteSentLog") || "debate invite sent");
  trackEvent("debate_invite", {
    turn_s: Math.round(turnMs / 1000),
    has_topic: topic ? 1 : 0,
  });
  if (debate.inviteTimer) clearTimeout(debate.inviteTimer);
  debate.inviteTimer = setTimeout(() => {
    if (debate.pending === "out" && debate.inviteId === inviteId) {
      sendDebateP2p({ type: "debate_cancel", invite_id: inviteId });
      clearDebatePending();
      setStatus(_t("debate.inviteExpired") || "Debate invite expired");
    }
  }, 35_000);
  closePartnerMenu();
}

function clearDebatePending() {
  debate.pending = null;
  debate.inviteId = "";
  // Keep topic/turnMs for accepted start; only clear if fully idle
  if (!debate.active) {
    /* topic retained until start or cancel — cleared on endDebate */
  }
  if (debate.inviteTimer) {
    clearTimeout(debate.inviteTimer);
    debate.inviteTimer = 0;
  }
  dismissDebateInviteToast();
}

function dismissDebateInviteToast() {
  const t = $("debate-invite-toast");
  if (t?.parentNode) t.remove();
}

function handleDebateP2pMessage(msg, _fromPc) {
  if (!msg || !msg.type) return;
  const fromUid = String(msg.user_id || "").slice(0, 64);
  switch (msg.type) {
    case "debate_invite":
      handleDebateInviteIncoming(msg, fromUid);
      break;
    case "debate_accept":
      handleDebateAccept(msg, fromUid);
      break;
    case "debate_decline":
      handleDebateDecline(msg, fromUid);
      break;
    case "debate_cancel":
      if (debate.pending === "in" && msg.invite_id === debate.inviteId) {
        clearDebatePending();
        setStatus(
          _t("debate.inviteCancelled") || "Debate invite cancelled"
        );
      }
      break;
    case "debate_start":
      applyDebateStart(msg, fromUid);
      break;
    case "debate_turn":
      applyDebateTurn(msg);
      break;
    case "debate_end":
      if (debate.active || debate.pending) {
        endDebate({ notify: false, reason: msg.reason || "peer", silent: false });
      }
      break;
    default:
      break;
  }
}

function handleDebateInviteIncoming(msg, fromUid) {
  if (debate.active) {
    sendDebateP2p({
      type: "debate_decline",
      invite_id: msg.invite_id,
      reason: "busy",
    });
    return;
  }
  if (debate.pending) {
    // Already waiting on another invite
    sendDebateP2p({
      type: "debate_decline",
      invite_id: msg.invite_id,
      reason: "busy",
    });
    return;
  }
  if (!matched || !primaryPartnerUserId) return;
  // Only accept from current primary partner
  if (fromUid && primaryPartnerUserId && fromUid !== primaryPartnerUserId) {
    return;
  }
  debate.pending = "in";
  debate.inviteId = String(msg.invite_id || "");
  debate.partnerId = fromUid || primaryPartnerUserId;
  debate.hostId = fromUid || primaryPartnerUserId;
  debate.turnMs = normalizeDebateTurnMs(msg.turn_ms || DEBATE_TURN_MS);
  debate.topic = normalizeDebateTopic(msg.topic);
  dismissDebateInviteToast();
  const toast = document.createElement("div");
  toast.id = "debate-invite-toast";
  toast.className = "friend-soft-toast debate-invite-toast";
  toast.setAttribute("role", "dialog");
  toast.style.pointerEvents = "auto";
  const name =
    String(msg.from_name || msg.name || "").slice(0, 32) || debatePartnerName();
  const secs = Math.round(debate.turnMs / 1000);
  const topicHtml = debate.topic
    ? `<div class="debate-invite-topic">${escapeHtml(debate.topic)}</div>`
    : "";
  toast.innerHTML = `
    <strong>${escapeHtml(_t("debate.incomingTitle") || "Formal debate?")}</strong>
    <span>${escapeHtml(
      _t("debate.incomingBody", { n: name, s: secs }) ||
        `${name} invites you to a formal debate — ${secs}s turns, one speaker at a time.`
    )}</span>
    <div class="debate-invite-meta">${escapeHtml(
      _t("debate.incomingMeta", { s: secs }) || `${secs}s turns · you go second`
    )}</div>
    ${topicHtml}
    <div class="export-nudge-actions" style="margin-top:0.45rem">
      <button type="button" class="pill tight ghost" id="btn-debate-no">${escapeHtml(
        _t("debate.decline") || "Decline"
      )}</button>
      <button type="button" class="pill tight accent" id="btn-debate-yes">${escapeHtml(
        _t("debate.accept") || "Accept"
      )}</button>
    </div>`;
  document.body.appendChild(toast);
  $("btn-debate-no")?.addEventListener("click", () => {
    sendDebateP2p({
      type: "debate_decline",
      invite_id: debate.inviteId,
    });
    clearDebatePending();
    setStatus(_t("debate.youDeclined") || "Debate declined");
    trackEvent("debate_decline");
  });
  $("btn-debate-yes")?.addEventListener("click", () => {
    const inviteId = debate.inviteId;
    sendDebateP2p({
      type: "debate_accept",
      invite_id: inviteId,
    });
    // Host (inviter) will send debate_start; stay pending until then
    dismissDebateInviteToast();
    setStatus(_t("debate.acceptedWait") || "Accepted — starting debate…");
    trackEvent("debate_accept");
    // Safety: if start never arrives, clear pending
    if (debate.inviteTimer) clearTimeout(debate.inviteTimer);
    debate.inviteTimer = setTimeout(() => {
      if (!debate.active && debate.pending === "in") {
        clearDebatePending();
        setStatus(
          _t("debate.startTimeout") || "Debate did not start — try again"
        );
      }
    }, 12_000);
  });
  if (debate.inviteTimer) clearTimeout(debate.inviteTimer);
  debate.inviteTimer = setTimeout(() => {
    if (debate.pending === "in") {
      sendDebateP2p({
        type: "debate_decline",
        invite_id: debate.inviteId,
        reason: "timeout",
      });
      clearDebatePending();
    }
  }, 35_000);
  setStatus(
    _t("debate.incomingStatus", { n: name }) ||
      `${name} invited you to a debate`
  );
}

function handleDebateAccept(msg, fromUid) {
  if (debate.pending !== "out") return;
  if (msg.invite_id && debate.inviteId && msg.invite_id !== debate.inviteId) {
    return;
  }
  // Host starts the clock with length/topic from invite
  const turnMs = normalizeDebateTurnMs(debate.turnMs || DEBATE_TURN_MS);
  const topic = normalizeDebateTopic(debate.topic);
  const now = Date.now();
  const firstSpeaker = myUserId || "";
  const turnEndsAt = now + turnMs;
  const startMsg = {
    type: "debate_start",
    invite_id: debate.inviteId,
    host_id: myUserId || "",
    first_speaker_id: firstSpeaker,
    partner_id: fromUid || primaryPartnerUserId,
    turn_ms: turnMs,
    topic,
    turn_index: 0,
    turn_ends_at: turnEndsAt,
    started_at: now,
  };
  sendDebateP2p(startMsg);
  applyDebateStart(startMsg, myUserId);
  trackEvent("debate_start", {
    host: 1,
    turn_s: Math.round(turnMs / 1000),
    has_topic: topic ? 1 : 0,
  });
}

function handleDebateDecline(msg, _fromUid) {
  if (debate.pending !== "out") return;
  if (msg.invite_id && debate.inviteId && msg.invite_id !== debate.inviteId) {
    return;
  }
  clearDebatePending();
  setStatus(_t("debate.theyDeclined") || "They declined the debate");
  log(_t("debate.theyDeclined") || "debate declined");
  trackEvent("debate_declined");
}

function applyDebateStart(msg, _fromUid) {
  clearDebatePending();
  const turnMs = normalizeDebateTurnMs(msg.turn_ms || debate.turnMs || DEBATE_TURN_MS);
  const topic = normalizeDebateTopic(
    msg.topic != null ? msg.topic : debate.topic
  );
  const first =
    String(msg.first_speaker_id || msg.host_id || "").slice(0, 64) ||
    primaryPartnerUserId;
  const partner =
    String(msg.partner_id || "").slice(0, 64) ||
    (first === myUserId ? primaryPartnerUserId : first);
  debate.active = true;
  debate.pending = null;
  debate.hostId = String(msg.host_id || first).slice(0, 64);
  debate.partnerId = partner || primaryPartnerUserId;
  debate.speakerId = first;
  debate.inviteId = String(msg.invite_id || debate.inviteId || "");
  debate.turnMs = turnMs;
  debate.topic = topic;
  debate.turnIndex = Number(msg.turn_index) || 0;
  debate.turnEndsAt = Number(msg.turn_ends_at) || Date.now() + turnMs;
  debate.urgentBeeped = false;
  debate.lastUrgentHapticSec = -1;
  debate.lastChimeSpeaker = "";
  showDebateOverlay(true);
  startDebateTick();
  applyMicTracks();
  updateDebateUi({ chime: true, newRound: true });
  const iSpeak = iAmDebateSpeaker();
  const secs = Math.round(turnMs / 1000);
  const r = debateRoundNumber(0);
  setStatus(
    iSpeak
      ? _t("debate.yourTurnRound", { n: r, s: secs }) ||
          `Round ${r} — your turn (${secs}s)`
      : _t("debate.theirTurnRound", { n: r }) ||
          `Round ${r} — their turn (you're muted)`
  );
  log((_t("debate.startedLog") || "debate started") + ` · ${debateRoundLabel(0)}`);
  try {
    document.body.classList.add("debate-active");
  } catch (_) {}
}

function applyDebateTurn(msg) {
  if (!debate.active) return;
  const speaker = String(msg.speaker_id || "").slice(0, 64);
  if (!speaker) return;
  const idx = Number(msg.turn_index);
  // Ignore stale turn packets (e.g. after local fallback already advanced further)
  if (Number.isFinite(idx) && idx < debate.turnIndex) return;
  const speakerChanged = speaker !== debate.speakerId;
  debate.speakerId = speaker;
  debate.turnIndex = Number.isFinite(idx) ? idx : debate.turnIndex + 1;
  debate.turnEndsAt =
    Number(msg.turn_ends_at) || Date.now() + (debate.turnMs || DEBATE_TURN_MS);
  if (msg.turn_ms) {
    debate.turnMs = normalizeDebateTurnMs(msg.turn_ms);
  }
  if (speakerChanged) {
    debate.urgentBeeped = false;
    debate.lastUrgentHapticSec = -1;
  }
  // Even turnIndex (0, 2, 4…) starts a new round after both have spoken
  const startsNewRound =
    speakerChanged && debate.turnIndex % 2 === 0;
  applyMicTracks();
  updateDebateUi({
    chime: speakerChanged,
    newRound: startsNewRound,
  });
  const iSpeak = iAmDebateSpeaker();
  const r = debateRoundNumber();
  setStatus(
    iSpeak
      ? _t("debate.yourTurnRound", { n: r }) || `Round ${r} — your turn`
      : _t("debate.theirTurnRound", { n: r }) ||
          `Round ${r} — their turn (you're muted)`
  );
}

function otherDebateSpeaker() {
  if (iAmDebateSpeaker()) {
    return (
      String(debate.partnerId || primaryPartnerUserId || "").trim() ||
      myUserId
    );
  }
  return String(myUserId || "").trim();
}

/** Host advances the turn and broadcasts; guest uses local-only fallback if host lags. */
function advanceDebateTurn({ force = false, yieldTurn = false } = {}) {
  if (!debate.active) return;
  const now = Date.now();
  if (!force && !yieldTurn && now < debate.turnEndsAt - 40) return;
  const isHost = debateUidEq(debate.hostId, myUserId);
  const iAmSpeaker = iAmDebateSpeaker();
  // Guest may only flip locally after a grace period (or when yielding their own turn)
  if (!isHost && !(yieldTurn && iAmSpeaker)) {
    if (!force || now < debate.turnEndsAt + 900) return;
  }
  const nextSpeaker = otherDebateSpeaker();
  if (!nextSpeaker) {
    setStatus(_t("debate.noPartner") || "No partner for next turn");
    return;
  }
  const turnMs = debate.turnMs || DEBATE_TURN_MS;
  const turnEndsAt = now + turnMs;
  const turnIndex = (debate.turnIndex || 0) + 1;
  const startsNewRound = turnIndex % 2 === 0; // 0,2,4… start rounds 1,2,3
  debate.speakerId = nextSpeaker;
  debate.turnIndex = turnIndex;
  debate.turnEndsAt = turnEndsAt;
  debate.urgentBeeped = false;
  debate.lastUrgentHapticSec = -1;
  // Broadcast: host clock, or speaker yielding early (always try; hub not required)
  if (isHost || (yieldTurn && iAmSpeaker)) {
    const sent = sendDebateP2p({
      type: "debate_turn",
      speaker_id: nextSpeaker,
      turn_index: turnIndex,
      turn_ends_at: turnEndsAt,
      turn_ms: turnMs,
      round: debateRoundNumber(turnIndex),
      invite_id: debate.inviteId,
    });
    if (!sent && yieldTurn) {
      // Still flip local UI; partner timer may catch up via host tick
      try {
        log(_t("debate.passLocalOnly") || "Pass sent locally — waiting for peer path");
      } catch (_) {}
    }
  }
  applyMicTracks();
  updateDebateUi({ chime: true, newRound: startsNewRound });
  const iSpeak = iAmDebateSpeaker();
  const r = debateRoundNumber(turnIndex);
  setStatus(
    iSpeak
      ? _t("debate.yourTurnRound", { n: r }) || `Round ${r} — your turn`
      : _t("debate.theirTurnRound", { n: r }) ||
          `Round ${r} — their turn (you're muted)`
  );
}

/** Normalize user ids for debate speaker checks (mobile often has casing/trim drift). */
function debateUidEq(a, b) {
  const x = String(a || "").trim().toLowerCase();
  const y = String(b || "").trim().toLowerCase();
  if (!x || !y) return false;
  return x === y;
}

function iAmDebateSpeaker() {
  return debateUidEq(debate.speakerId, myUserId);
}

function passDebateTurn(ev) {
  try {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
  } catch (_) {}
  if (!debate.active) {
    setStatus(_t("debate.needLive") || "Debate only works during a live 1:1 call");
    return;
  }
  const me = String(myUserId || "").trim();
  const speaker = String(debate.speakerId || "").trim();
  if (!me) {
    setStatus(_t("debate.needId") || "Still connecting — try Pass again in a moment");
    return;
  }
  if (!speaker || !debateUidEq(speaker, me)) {
    setStatus(_t("debate.notYourTurn") || "Not your turn");
    try {
      softHaptic?.(20);
    } catch (_) {}
    return;
  }
  trackEvent("debate_pass");
  // Unlock audio context for chime on mobile (gesture)
  try {
    ensureDebateAudioCtx()?.resume?.();
  } catch (_) {}
  // Immediate press feedback on mobile (before P2P / UI tick)
  try {
    ["btn-debate-pass", "btn-debate-pass-mobile"].forEach((id) => {
      const b = $(id);
      if (b && !b.hidden) {
        b.disabled = true;
        b.classList.add("is-pressed");
      }
    });
  } catch (_) {}
  try {
    softHaptic?.([12, 24, 18]);
  } catch (_) {}
  advanceDebateTurn({ yieldTurn: true });
  // Re-enable after turn flip (updateDebateUi will hide Pass when not speaker)
  setTimeout(() => {
    try {
      ["btn-debate-pass", "btn-debate-pass-mobile"].forEach((id) => {
        const b = $(id);
        if (b) {
          b.disabled = false;
          b.classList.remove("is-pressed");
        }
      });
      // Keep Pass wired if DOM was re-rendered
      wireDebateControl("btn-debate-pass", passDebateTurn);
      wireDebateControl("btn-debate-pass-mobile", passDebateTurn);
    } catch (_) {}
  }, 280);
}

function endDebateFromUi(ev) {
  try {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
  } catch (_) {}
  endDebate({ notify: true, reason: "user" });
}

/** True for phones / touch UIs that need the fixed Pass bar. */
function isDebateMobileUi() {
  try {
    if (typeof window.matchMedia === "function") {
      if (window.matchMedia("(max-width: 900px)").matches) return true;
      if (window.matchMedia("(pointer: coarse)").matches) return true;
      if (window.matchMedia("(hover: none)").matches) return true;
    }
  } catch (_) {}
  return (
    typeof navigator !== "undefined" &&
    (navigator.maxTouchPoints > 0 || "ontouchstart" in window)
  );
}

/**
 * Mobile debate chrome:
 * - Pass lives only on the timer chip (#btn-debate-pass) — no big bottom Pass.
 * - Fixed bar is End-only so it stays small and clear of the floor tray.
 */
function syncDebateMobileBar(iSpeak) {
  const bar = $("debate-mobile-bar");
  if (!bar) return;
  const mobile = isDebateMobileUi();
  // Pass is chip-only on mobile — always keep the duplicate bar button hidden
  const passM = $("btn-debate-pass-mobile");
  if (passM) {
    passM.hidden = true;
    passM.setAttribute("hidden", "");
  }
  if (!debate.active || !mobile) {
    bar.hidden = true;
    bar.setAttribute("hidden", "");
    try {
      document.body.classList.remove("debate-mobile-bar-on");
    } catch (_) {}
    return;
  }
  // Park under body so position:fixed is viewport-stable (stage transform / stack)
  try {
    if (bar.parentElement !== document.body) {
      document.body.appendChild(bar);
    }
  } catch (_) {}
  bar.hidden = false;
  bar.removeAttribute("hidden");
  try {
    document.body.classList.add("debate-mobile-bar-on");
  } catch (_) {}
  // Force visible — CSS display:none base must not win
  bar.hidden = false;
  bar.style.display = "flex";
  bar.style.pointerEvents = "auto";
  bar.style.zIndex = "12050";
  bar.classList.add("debate-mobile-bar-end-only");
  // Chip Pass must stay tappable when it's your turn (primary control)
  const passChip = $("btn-debate-pass");
  if (passChip) {
    if (iSpeak) {
      passChip.hidden = false;
      passChip.removeAttribute("hidden");
      passChip.disabled = false;
      passChip.style.pointerEvents = "auto";
      passChip.style.touchAction = "manipulation";
    }
  }
  // Ensure handlers exist (defensive after reparent)
  try {
    wireDebateControl("btn-debate-pass", passDebateTurn);
    wireDebateControl("btn-debate-end-mobile", endDebateFromUi);
  } catch (_) {}
}

function startDebateTick() {
  if (debate.tickIv) clearInterval(debate.tickIv);
  debate.tickIv = setInterval(() => {
    if (!debate.active) {
      clearInterval(debate.tickIv);
      debate.tickIv = 0;
      return;
    }
    if (!matched && !inFriendCall) {
      endDebate({ notify: false, silent: true });
      return;
    }
    updateDebateUi();
    const now = Date.now();
    if (now >= debate.turnEndsAt) {
      // Same id normalize as advanceDebateTurn (trim/case) — raw === stalled Pass on mobile
      const isHost = debateUidEq(debate.hostId, myUserId);
      if (isHost) {
        advanceDebateTurn({ force: true });
      } else {
        // Guest: wait briefly for host message, then local fallback
        if (now >= debate.turnEndsAt + 900) {
          advanceDebateTurn({ force: true });
        }
      }
    }
  }, 100);
}

function showDebateOverlay(show) {
  const el = $("debate-overlay");
  if (!el) return;
  if (show) {
    el.hidden = false;
    el.removeAttribute("hidden");
    // Park on current speaker tile immediately
    placeDebateOverlayOnSpeaker(debate.speakerId === myUserId);
  } else {
    el.hidden = true;
    el.setAttribute("hidden", "");
    // Return to remote tile as default home when idle
    placeDebateOverlayOnSpeaker(false, { force: true });
  }
}

/**
 * Move the timer card onto the speaking person's video tile (desktop).
 * On phones, keep a fixed right-side chip (same idea as browser side placement)
 * so it never sits on the face or tiny local PiP.
 * @param {boolean} iSpeak — true → local tile (you), false → remote tile (partner)
 * @param {{ force?: boolean }} [opts]
 */
function placeDebateOverlayOnSpeaker(iSpeak, opts = {}) {
  const overlay = $("debate-overlay");
  if (!overlay) return;
  const mobile =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 720px)").matches;
  const wasLocal = overlay.classList.contains("on-local");
  const wasRemote = overlay.classList.contains("on-remote");
  const speakerChanged =
    debate.active &&
    ((iSpeak && !wasLocal) || (!iSpeak && !wasRemote));

  if (mobile) {
    // Fixed side chip — parent under body so position:fixed is viewport-stable
    try {
      if (overlay.parentElement !== document.body) {
        document.body.appendChild(overlay);
      }
    } catch (_) {}
    overlay.classList.toggle("on-local", !!iSpeak);
    overlay.classList.toggle("on-remote", !iSpeak);
    if (speakerChanged && !opts.force) {
      overlay.classList.remove("debate-hop");
      void overlay.offsetWidth;
      overlay.classList.add("debate-hop");
      setTimeout(() => overlay.classList.remove("debate-hop"), 380);
    }
    return;
  }

  const target = iSpeak ? $("tile-local") : $("tile-remote");
  if (!target) return;
  if (!opts.force && overlay.parentElement === target) {
    overlay.classList.toggle("on-local", !!iSpeak);
    overlay.classList.toggle("on-remote", !iSpeak);
    return;
  }
  // Animate hop: brief scale when reparenting
  const hop =
    !opts.force &&
    debate.active &&
    overlay.parentElement &&
    overlay.parentElement !== target;
  try {
    target.appendChild(overlay);
  } catch (_) {
    return;
  }
  overlay.classList.toggle("on-local", !!iSpeak);
  overlay.classList.toggle("on-remote", !iSpeak);
  if (hop) {
    overlay.classList.remove("debate-hop");
    // Force reflow so animation restarts
    void overlay.offsetWidth;
    overlay.classList.add("debate-hop");
    setTimeout(() => overlay.classList.remove("debate-hop"), 380);
  }
}

/**
 * @param {{ chime?: boolean, newRound?: boolean }} [opts]
 */
function updateDebateUi(opts = {}) {
  const overlay = $("debate-overlay");
  if (!overlay || !debate.active) return;
  const now = Date.now();
  const remMs = Math.max(0, debate.turnEndsAt - now);
  const secs = Math.ceil(remMs / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const timerEl = $("debate-timer");
  if (timerEl) {
    timerEl.textContent =
      m > 0
        ? `${m}:${String(s).padStart(2, "0")}`
        : `0:${String(s).padStart(2, "0")}`;
  }
  const iSpeak = iAmDebateSpeaker();
  // Timer lives on the person who is speaking
  placeDebateOverlayOnSpeaker(iSpeak);
  const roundEl = $("debate-round-label");
  if (roundEl) {
    roundEl.textContent = debateRoundLabel();
    roundEl.setAttribute("aria-label", debateRoundLabel());
  }
  if (opts.newRound) {
    overlay.classList.remove("is-new-round");
    void overlay.offsetWidth;
    overlay.classList.add("is-new-round");
    setTimeout(() => overlay.classList.remove("is-new-round"), 500);
    // Slightly stronger cue when a full new round begins
    if (opts.chime !== false) playDebateRoundChime();
  }
  const turnEl = $("debate-turn-label");
  if (turnEl) {
    const r = debateRoundNumber();
    turnEl.textContent = iSpeak
      ? _t("debate.yourTurnRoundShort", { n: r }) || `Round ${r} · your turn`
      : _t("debate.theirTurnRoundShort", {
          n: r,
          name: debatePartnerName(),
        }) ||
        _t("debate.theirTurnRoundShortAlt", {
          n: r,
          name: debatePartnerName(),
        }) ||
        `Round ${r} · ${debatePartnerName()}`;
  }
  const topicEl = $("debate-topic");
  if (topicEl) {
    if (debate.topic) {
      topicEl.textContent = debate.topic;
      topicEl.hidden = false;
      topicEl.removeAttribute("hidden");
      topicEl.title = debate.topic;
    } else {
      topicEl.textContent = "";
      topicEl.hidden = true;
      topicEl.setAttribute("hidden", "");
    }
  }
  const bar = $("debate-progress-bar");
  if (bar) {
    const pct = Math.max(
      0,
      Math.min(1, remMs / (debate.turnMs || DEBATE_TURN_MS))
    );
    bar.style.transform = `scaleX(${pct})`;
  }
  overlay.classList.toggle("is-my-turn", iSpeak);
  overlay.classList.toggle("is-their-turn", !iSpeak);
  const urgent = remMs > 0 && remMs <= 5000;
  overlay.classList.toggle("is-urgent", urgent);
  // Speaker video highlight + mute badges on non-speaker
  try {
    document.body.classList.toggle("debate-i-speak", iSpeak);
    document.body.classList.toggle("debate-they-speak", !iSpeak);
  } catch (_) {}
  updateDebateMuteBadges(iSpeak);
  // Sounds + haptics: turn change (skip if new-round chime already fired)
  if (
    opts.chime &&
    !opts.newRound &&
    debate.speakerId !== debate.lastChimeSpeaker
  ) {
    debate.lastChimeSpeaker = debate.speakerId;
    try {
      softHaptic([16, 36, 22]);
    } catch (_) {}
    playDebateTurnChime();
  } else if (opts.newRound) {
    debate.lastChimeSpeaker = debate.speakerId;
    try {
      softHaptic([14, 30, 14, 30, 28]);
    } catch (_) {}
  }
  if (urgent && !debate.urgentBeeped) {
    debate.urgentBeeped = true;
    try {
      softHaptic([40, 50, 40, 50, 60]);
    } catch (_) {}
    playDebateUrgentBeep();
  }
  // Pulse each whole second in the last 5s (once per second)
  if (urgent && secs > 0 && secs <= 5 && debate.lastUrgentHapticSec !== secs) {
    debate.lastUrgentHapticSec = secs;
    try {
      softHaptic(secs <= 2 ? [28, 40, 28] : 22);
    } catch (_) {}
  }
  if (!urgent) {
    debate.lastUrgentHapticSec = -1;
  }
  // Only flip Pass visibility when it actually changes (avoids thrashing on mobile taps)
  const passBtn = $("btn-debate-pass");
  if (passBtn) {
    const wantShow = !!iSpeak;
    const isHidden = passBtn.hidden || passBtn.hasAttribute("hidden");
    if (wantShow && isHidden) {
      passBtn.hidden = false;
      passBtn.removeAttribute("hidden");
      passBtn.disabled = false;
    } else if (!wantShow && !isHidden) {
      passBtn.hidden = true;
      passBtn.setAttribute("hidden", "");
    }
  }
  syncDebateMobileBar(iSpeak);
}

/**
 * Show who can / cannot be heard: muted badge on non-speaker, speaking on speaker.
 * @param {boolean} iSpeak
 */
function updateDebateMuteBadges(iSpeak) {
  const setVis = (id, show) => {
    const el = $(id);
    if (!el) return;
    if (show) {
      el.hidden = false;
      el.removeAttribute("hidden");
    } else {
      el.hidden = true;
      el.setAttribute("hidden", "");
    }
  };
  if (!debate.active) {
    setVis("debate-badge-local-muted", false);
    setVis("debate-badge-local-speaking", false);
    setVis("debate-badge-remote-muted", false);
    setVis("debate-badge-remote-speaking", false);
    return;
  }
  // You
  setVis("debate-badge-local-muted", !iSpeak);
  setVis("debate-badge-local-speaking", iSpeak);
  // Partner
  setVis("debate-badge-remote-muted", iSpeak); // they muted when you speak
  setVis("debate-badge-remote-speaking", !iSpeak);
}

function clearDebateMuteBadges() {
  updateDebateMuteBadges(false);
  // Force hide all (updateDebateMuteBadges only works when active)
  for (const id of [
    "debate-badge-local-muted",
    "debate-badge-local-speaking",
    "debate-badge-remote-muted",
    "debate-badge-remote-speaking",
  ]) {
    const el = $(id);
    if (!el) continue;
    el.hidden = true;
    el.setAttribute("hidden", "");
  }
}

/**
 * End debate mode and restore mic freedom.
 * @param {{ notify?: boolean, reason?: string, silent?: boolean }} [opts]
 */
function endDebate(opts = {}) {
  const notify = opts.notify !== false;
  const wasActive = debate.active || debate.pending;
  if (debate.tickIv) {
    clearInterval(debate.tickIv);
    debate.tickIv = 0;
  }
  if (debate.inviteTimer) {
    clearTimeout(debate.inviteTimer);
    debate.inviteTimer = 0;
  }
  if (notify && debate.active) {
    sendDebateP2p({
      type: "debate_end",
      reason: opts.reason || "user",
      invite_id: debate.inviteId,
    });
  }
  debate.active = false;
  debate.pending = null;
  debate.speakerId = "";
  debate.hostId = "";
  debate.partnerId = "";
  debate.inviteId = "";
  debate.turnEndsAt = 0;
  debate.turnIndex = 0;
  debate.topic = "";
  debate.urgentBeeped = false;
  debate.lastUrgentHapticSec = -1;
  debate.lastChimeSpeaker = "";
  dismissDebateInviteToast();
  showDebateOverlay(false);
  clearDebateMuteBadges();
  syncDebateMobileBar(false);
  try {
    document.body.classList.remove(
      "debate-active",
      "debate-muted-turn",
      "debate-i-speak",
      "debate-they-speak"
    );
  } catch (_) {}
  applyMicTracks();
  if (wasActive && !opts.silent) {
    setStatus(_t("debate.ended") || "Debate ended — free talk");
    log(_t("debate.ended") || "debate ended");
    trackEvent("debate_end", { reason: opts.reason || "user" });
  }
}

function partnerMenuOpen() {
  const menu = $("partner-menu");
  return menu && !menu.hidden;
}

function showPartnerMenuMain() {
  const main = $("partner-menu-main");
  const rep = $("partner-menu-report");
  const deb = $("partner-menu-debate");
  if (main) {
    main.hidden = false;
    main.removeAttribute("hidden");
  }
  if (rep) {
    rep.hidden = true;
    rep.setAttribute("hidden", "");
  }
  if (deb) {
    deb.hidden = true;
    deb.setAttribute("hidden", "");
  }
  const title = $("partner-menu-title");
  if (title) title.textContent = _t("partnerMenu.title") || "Partner";
}

function showPartnerReportReasons() {
  const main = $("partner-menu-main");
  const rep = $("partner-menu-report");
  const deb = $("partner-menu-debate");
  if (main) {
    main.hidden = true;
    main.setAttribute("hidden", "");
  }
  if (deb) {
    deb.hidden = true;
    deb.setAttribute("hidden", "");
  }
  if (rep) {
    rep.hidden = false;
    rep.removeAttribute("hidden");
  }
  const title = $("partner-menu-title");
  if (title) title.textContent = _t("partnerMenu.reportNext") || _t("partnerMenu.report") || "Report";
  // 100+ → ×2, 250+ → ×3 (server report_weight_for)
  const trustedHint = $("partner-menu-trusted-hint");
  if (trustedHint) {
    const w = reportWeightForStars(myStars);
    if (w >= 3) {
      trustedHint.hidden = false;
      trustedHint.removeAttribute("hidden");
      trustedHint.textContent =
        _t("stars.seniorReporterHint") ||
        "You have 250+★ — senior reporter. Your report counts as 3.";
    } else if (w >= 2) {
      trustedHint.hidden = false;
      trustedHint.removeAttribute("hidden");
      trustedHint.textContent =
        _t("stars.trustedReporterHint") ||
        "You have 100+★ — your report carries stronger weight (counts as 2).";
    } else {
      trustedHint.hidden = true;
      trustedHint.setAttribute("hidden", "");
    }
  }
}

function closePartnerMenu() {
  const menu = $("partner-menu");
  const bd = $("partner-menu-backdrop");
  releaseSheetFocusTrap(menu);
  if (menu) {
    menu.hidden = true;
    menu.setAttribute("hidden", "");
  }
  if (bd) {
    bd.hidden = true;
    bd.setAttribute("hidden", "");
  }
  // Always reset to main actions for next open
  showPartnerMenuMain();
}

function normalizeFriendCode(c) {
  return String(c || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/** True if this partner is already on our friends list (live cache or local backup). */
function isPartnerAlreadyFriend(uid, code) {
  const u = String(uid || "").trim();
  const c = normalizeFriendCode(code || lastMatchMeta?.friend_code || "");
  if (!u && !c) return false;
  const pools = [];
  try {
    pools.push(...(friendsCache || []));
  } catch (_) {}
  try {
    pools.push(...loadFriendsBackup());
  } catch (_) {}
  for (const f of pools) {
    if (!f) continue;
    if (u && f.user_id && String(f.user_id).trim() === u) return true;
    if (c && normalizeFriendCode(f.friend_code) === c) return true;
  }
  return false;
}

function isPartnerRequestPending(uid, code) {
  const u = String(uid || "").trim();
  const c = normalizeFriendCode(code || lastMatchMeta?.friend_code || "");
  if (!u && !c) return false;
  const lists = [
    ...(outgoingRequests || []),
    ...(incomingRequests || []),
  ];
  for (const r of lists) {
    if (!r) continue;
    if (u && r.user_id && String(r.user_id).trim() === u) return true;
    if (c && normalizeFriendCode(r.friend_code) === c) return true;
  }
  return false;
}

function openPartnerMenu() {
  if (!matched || !primaryPartnerUserId || primaryPartnerUserId === myUserId) {
    return;
  }
  const menu = $("partner-menu");
  const bd = $("partner-menu-backdrop");
  if (!menu) return;

  const nameEl = $("partner-menu-name");
  if (nameEl) {
    setNameOnTile(
      nameEl,
      lastMatchMeta?.name || _t("remote.tag"),
      lastMatchMeta?.flag
    );
  }

  const friendBtn = $("btn-partner-friend");
  if (friendBtn) {
    const already = isPartnerAlreadyFriend(
      primaryPartnerUserId,
      lastMatchMeta?.friend_code
    );
    const pending = isPartnerRequestPending(
      primaryPartnerUserId,
      lastMatchMeta?.friend_code
    );
    const isFriendCall = matchMode === "friend" || inFriendCall;
    friendBtn.disabled = already || pending || isFriendCall;
    const lbl = friendBtn.querySelector("[data-i18n], span:not(.pm-ico)") || friendBtn;
    // Keep icon; set label via last text span
    const textSpan = [...friendBtn.querySelectorAll("span")].find(
      (s) => !s.classList.contains("pm-ico")
    );
    if (textSpan) {
      if (already || isFriendCall) textSpan.textContent = _t("partnerMenu.alreadyFriend");
      else if (pending) textSpan.textContent = _t("partnerMenu.pendingFriend");
      else textSpan.textContent = _t("partnerMenu.addFriend");
    }
  }

  // Find 3rd: stranger 1v1 or friend call (same as dock)
  const findBtn = $("btn-partner-find-third");
  if (findBtn) {
    const friend1v1 =
      !!inFriendCall &&
      (matchMode === "friend" || matchMode === "solo") &&
      !trioBrowse;
    const stranger1v1 =
      !!matched &&
      !inFriendCall &&
      matchMode === "solo" &&
      yourRole === "solo" &&
      !trioBrowse;
    const canFind =
      TRIO_FIND_ENABLED &&
      (stranger1v1 || friend1v1) &&
      !findThirdPending;
    findBtn.hidden = !canFind;
    findBtn.disabled = !canFind;
  }

  // Formal debate invite / end
  const debateBtn = $("btn-partner-debate");
  if (debateBtn) {
    const live1v1 =
      !!matched &&
      !!primaryPartnerUserId &&
      !trioBrowse &&
      (matchMode === "solo" ||
        matchMode === "friend" ||
        inFriendCall);
    debateBtn.hidden = !live1v1;
    debateBtn.disabled = !live1v1;
    debateBtn.classList.toggle("is-active", !!debate.active);
    const label = $("btn-partner-debate-label");
    if (label) {
      if (debate.active) {
        label.textContent = _t("debate.end") || "End debate";
      } else if (debate.pending === "out") {
        label.textContent =
          _t("debate.cancelInvite") || "Cancel debate invite";
      } else {
        label.textContent = _t("debate.invite") || "Invite to debate";
      }
    }
  }

  // Star gifts (5★ / 15s, extendable)
  const liveGift = !!(matched || inFriendCall);
  const canGift =
    liveGift && !!primaryPartnerUserId && myStars >= STAR_EFFECT_COST;
  const needTitle =
    myStars < STAR_EFFECT_COST
      ? _t("stars.needStars", { n: STAR_EFFECT_COST, have: myStars }) ||
        `Need ${STAR_EFFECT_COST} stars (you have ${myStars})`
      : "";
  const wireGiftBtn = (id, labelId, kind, baseKey, extendKey, baseFb, extFb) => {
    const btn = $(id);
    if (!btn) return;
    btn.disabled = !canGift;
    btn.hidden = !liveGift;
    const lbl = $(labelId);
    const extending =
      partnerFx &&
      partnerFx.kind === kind &&
      partnerFx.until > unixNowSec();
    if (lbl) {
      lbl.textContent = extending
        ? _t(extendKey, { n: STAR_EFFECT_COST, s: STAR_EFFECT_SECS }) ||
          extFb
        : _t(baseKey) || baseFb;
    }
    btn.title = needTitle || lbl?.textContent || "";
  };
  wireGiftBtn(
    "btn-partner-bars",
    "btn-partner-bars-label",
    "bars",
    "stars.barsBtn",
    "stars.barsExtend",
    `Behind bars · ${STAR_EFFECT_COST}★ · ${STAR_EFFECT_SECS}s`,
    `Extend bars +${STAR_EFFECT_SECS}s · ${STAR_EFFECT_COST}★`
  );
  wireGiftBtn(
    "btn-partner-flowers",
    "btn-partner-flowers-label",
    "flowers",
    "stars.flowersBtn",
    "stars.flowersExtend",
    `Flowers · ${STAR_EFFECT_COST}★ · ${STAR_EFFECT_SECS}s`,
    `More flowers +${STAR_EFFECT_SECS}s · ${STAR_EFFECT_COST}★`
  );
  wireGiftBtn(
    "btn-partner-balloons",
    "btn-partner-balloons-label",
    "balloons",
    "stars.balloonsBtn",
    "stars.balloonsExtend",
    `Balloons · ${STAR_EFFECT_COST}★ · ${STAR_EFFECT_SECS}s`,
    `More balloons +${STAR_EFFECT_SECS}s · ${STAR_EFFECT_COST}★`
  );
  wireGiftBtn(
    "btn-partner-confetti",
    "btn-partner-confetti-label",
    "confetti",
    "stars.confettiBtn",
    "stars.confettiExtend",
    `Confetti · ${STAR_EFFECT_COST}★ · ${STAR_EFFECT_SECS}s`,
    `More confetti +${STAR_EFFECT_SECS}s · ${STAR_EFFECT_COST}★`
  );

  showPartnerMenuMain();

  menu.hidden = false;
  menu.removeAttribute("hidden");
  if (bd) {
    bd.hidden = false;
    bd.removeAttribute("hidden");
  }
  bindSheetFocusTrap(menu);
  // Focus close for accessibility
  setTimeout(() => $("btn-partner-menu-close")?.focus?.(), 30);
}

function invitePartnerFriend() {
  const code = lastMatchMeta?.friend_code || "";
  if (!code) {
    setStatus(
      _t("partnerMenu.noCode") ||
        "No friend code for this partner yet — try again in a second"
    );
    log(_t("partnerMenu.noCode") || "partner has no friend_code");
    closePartnerMenu();
    return;
  }
  if (
    isPartnerAlreadyFriend(
      primaryPartnerUserId,
      lastMatchMeta?.friend_code || code
    )
  ) {
    setStatus(_t("partnerMenu.alreadyFriend"));
    closePartnerMenu();
    return;
  }
  if (requestAddFriend(code)) {
    log(
      (_t("friends.requestSent") || "request sent") +
        (lastMatchMeta?.name ? ` · ${lastMatchMeta.name}` : "")
    );
  }
  closePartnerMenu();
}

function blockPartnerFromMenu() {
  const uid = primaryPartnerUserId;
  if (!uid) {
    closePartnerMenu();
    return;
  }
  closePartnerMenu();
  // Block · Next — permanent skip until unblock
  if (!blockUserId(uid)) return;
  wantSearch = true;
  matched = false;
  showStartButton(false);
  closeAllPeers({ keepFriend: false });
  setSplitRemote(false);
  setRemoteEmpty(true);
  resetRemoteEmptyCopy();
  updateFriendActionButtons();
  send({ type: "next", room: currentRoom() });
  setPhase("waiting");
  updateConnFromState();
  updateFriendsOnlineStrip();
  trackEvent("block_next");
}

function saveLocalReport(entry) {
  try {
    const raw = JSON.parse(localStorage.getItem(REPORTS_KEY) || "[]");
    const list = Array.isArray(raw) ? raw : [];
    list.unshift(entry);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(list.slice(0, 100)));
  } catch (_) {}
}

function showReportToast(message) {
  const id = "report-toast";
  const existing = $(id);
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = id;
  toast.className = "report-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `<strong>${escapeHtml(
    _t("partnerMenu.report") || "Report"
  )}</strong><span>${escapeHtml(message)}</span>`;
  document.body.appendChild(toast);
  // Longer on mobile so the success state is readable after skip animation
  const ms = window.matchMedia("(max-width: 720px)").matches ? 6500 : 4800;
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, ms);
}

function reportPartner(reason) {
  const uid = primaryPartnerUserId;
  if (!uid) {
    closePartnerMenu();
    return;
  }
  const entry = {
    t: Date.now(),
    user_id: uid,
    name: lastMatchMeta?.name || "",
    short_id: lastMatchMeta?.short_id || "",
    friend_code: lastMatchMeta?.friend_code || "",
    reason: reason || "other",
  };
  saveLocalReport(entry);
  send({
    type: "report_user",
    user_id: uid,
    reason: entry.reason,
  });
  // Report · Next: block + requeue + never rematch certainty
  const msg =
    reason === "underage"
      ? _t("partnerMenu.reportOkUnderage") ||
        _t("partnerMenu.reportOk")
      : _t("partnerMenu.reportOkFull") || _t("partnerMenu.reportOk");
  setStatus(msg);
  showReportToast(
    _t("partnerMenu.reportToastFull") ||
      _t("partnerMenu.reportToast") ||
      "Reported · blocked · Next. You will not match them again."
  );
  // Extra certainty strip (trust UX) — same language as block
  try {
    showBlockCertaintyToast({
      title: _t("partnerMenu.reportOkTitle") || "Reported & blocked",
      body:
        _t("partnerMenu.reportNeverAgain") ||
        "You will not match them again. They were skipped.",
    });
  } catch (_) {}
  log((_t("partnerMenu.reportOk") || "reported") + ` · ${entry.reason}`);
  trackEvent("report_next", { reason: entry.reason || "other" });
  closePartnerMenu();
  // Block + skip so they don't reappear (toast already shown as report)
  blockUserId(uid, { silent: true, skipToast: true });
  wantSearch = true;
  matched = false;
  showStartButton(false);
  closeAllPeers({ keepFriend: false });
  setSplitRemote(false);
  setRemoteEmpty(true);
  resetRemoteEmptyCopy();
  setFedChip(false);
  updateFriendActionButtons();
  send({ type: "next", room: currentRoom() });
  setPhase("waiting");
  updateConnFromState();
  updateFriendsOnlineStrip();
}

function updatePartnerClickable() {
  const tile = $("tile-remote");
  if (!tile) return;
  const can =
    !!matched &&
    !!primaryPartnerUserId &&
    primaryPartnerUserId !== myUserId;
  tile.classList.toggle("partner-clickable", can);
  if (!can && partnerMenuOpen()) closePartnerMenu();
}

// --- wire UI (null-safe) ---
function on(id, event, handler) {
  const el = $(id);
  if (el) el.addEventListener(event, handler);
}

// Connect is automatic on load; no Connect button in the UI.
// (restart-cam handler is wired once below with clearFailedCameras + hard release)
on("btn-mute-mic", "click", () => toggleMicMute());
// btn-mute-cam removed from DOM — cam on/off feature retired
on("btn-mute-remote", "click", () => togglePartnerMute());
on("btn-mute-remote-main", "click", (e) => {
  e?.stopPropagation?.();
  togglePeerElMute("remote");
});
on("btn-mute-remote2", "click", (e) => {
  e?.stopPropagation?.();
  togglePeerElMute("remote2");
});
on("btn-mute-remote-third", "click", (e) => {
  e?.stopPropagation?.();
  togglePeerElMute("remote-third");
});
on("btn-blur-remote-main", "click", (e) => {
  e?.stopPropagation?.();
  togglePeerElBlur("remote");
});
on("btn-blur-remote2", "click", (e) => {
  e?.stopPropagation?.();
  togglePeerElBlur("remote2");
});
on("btn-blur-remote-third", "click", (e) => {
  e?.stopPropagation?.();
  togglePeerElBlur("remote-third");
});
$("vol-remote")?.addEventListener("input", () => {
  setPeerElVolume("remote", $("vol-remote")?.value);
});
$("vol-remote2")?.addEventListener("input", () => {
  setPeerElVolume("remote2", $("vol-remote2")?.value);
});
$("vol-remote-third")?.addEventListener("input", () => {
  setPeerElVolume("remote-third", $("vol-remote-third")?.value);
});
on("btn-blur-remote", "click", () => togglePartnerBlur());
on("btn-blur-self", "click", () => toggleSelfBlur());
on("btn-fs-remote", "click", () => toggleFullscreenPartner());
on("btn-stage-layout", "click", (e) => {
  e?.preventDefault?.();
  e?.stopPropagation?.();
  toggleStageLayoutMode();
});
document.addEventListener("enterpictureinpicture", () => updatePipButton());
document.addEventListener("leavepictureinpicture", () => updatePipButton());
on("btn-partner-friend", "click", () => invitePartnerFriend());
on("btn-partner-bars", "click", () => spendBarsOnPartner());
on("btn-partner-flowers", "click", () => spendFlowersOnPartner());
on("btn-partner-balloons", "click", () => spendBalloonsOnPartner());
on("btn-partner-confetti", "click", () => spendConfettiOnPartner());
on("btn-partner-find-third", "click", () => {
  closePartnerMenu();
  if (!TRIO_FIND_ENABLED || findThirdPending) return;
  if (!matched && !inFriendCall) return;
  findThirdPending = "out";
  send({ type: "find_third_invite" });
  setStatus(_t("trio.inviteSent") || "Invite sent — waiting for them…");
  trackEvent("find_third_invite", {
    via: "partner_menu",
    friend: inFriendCall || matchMode === "friend" ? 1 : 0,
  });
  updateFriendActionButtons();
});
on("btn-partner-block", "click", () => blockPartnerFromMenu());
on("btn-partner-report", "click", () => showPartnerReportReasons());
on("btn-partner-debate", "click", () => invitePartnerDebate());
on("btn-debate-send-invite", "click", () => sendDebateInviteFromCompose());
on("btn-debate-compose-back", "click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  showPartnerMenuMain();
});
$("debate-turn-picks")?.addEventListener("click", (e) => {
  const btn = e.target?.closest?.("[data-turn-secs]");
  if (!btn) return;
  const secs = Number(btn.getAttribute("data-turn-secs"));
  if (!DEBATE_TURN_CHOICES_S.includes(secs)) return;
  debate.composeTurnSecs = secs;
  $("debate-turn-picks")
    ?.querySelectorAll("[data-turn-secs]")
    .forEach((el) => {
      el.classList.toggle(
        "is-selected",
        Number(el.getAttribute("data-turn-secs")) === secs
      );
    });
});
function wireDebateControl(id, handler) {
  const el = $(id);
  if (!el) return;
  // Allow re-bind after reparent (mobile bar → body)
  if (el.dataset.debateWired === "1" && el.dataset.debateWireGen === "2") return;
  el.dataset.debateWired = "1";
  el.dataset.debateWireGen = "2";
  // Mobile Safari / WebView: fire on pointerup + touchend (more reliable than
  // pointerdown alone when parent swipe/stack handlers run). Debounce duplicates.
  let lastFire = 0;
  const fire = (e) => {
    const now = Date.now();
    if (now - lastFire < 380) {
      try {
        e.preventDefault?.();
        e.stopPropagation?.();
      } catch (_) {}
      return;
    }
    lastFire = now;
    try {
      e.preventDefault?.();
      e.stopPropagation?.();
    } catch (_) {}
    try {
      e.stopImmediatePropagation?.();
    } catch (_) {}
    try {
      handler(e);
    } catch (err) {
      try {
        console.warn("[debate] control error", id, err);
      } catch (_) {}
    }
  };
  // Capture phase so stage/tile swipe never sees the gesture first
  el.addEventListener("pointerdown", fire, { passive: false, capture: true });
  el.addEventListener("pointerup", fire, { passive: false, capture: true });
  el.addEventListener(
    "touchend",
    (e) => {
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (_) {}
      fire(e);
    },
    { passive: false, capture: true }
  );
  el.addEventListener(
    "touchstart",
    (e) => {
      try {
        e.stopPropagation();
      } catch (_) {}
    },
    { passive: true, capture: true }
  );
  el.addEventListener("click", fire, { capture: true });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") fire(e);
  });
}
wireDebateControl("btn-debate-pass", passDebateTurn);
wireDebateControl("btn-debate-end", endDebateFromUi);
wireDebateControl("btn-debate-pass-mobile", passDebateTurn);
wireDebateControl("btn-debate-end-mobile", endDebateFromUi);
// Re-wire if nodes were replaced (defensive)
try {
  window.addEventListener(
    "orientationchange",
    () => {
      try {
        if (debate.active) syncDebateMobileBar(debate.speakerId === myUserId);
      } catch (_) {}
    },
    { passive: true }
  );
} catch (_) {}
try {
  wireTypingInputs();
} catch (_) {}
try {
  wireEmojiPicker();
} catch (_) {}
on("btn-report-dock", "click", () => {
  // One-tap Report · Next (default reason); open menu for other reasons via partner video
  closeMatchMoreMenu();
  if (!primaryPartnerUserId || !matched) return;
  reportPartner("other");
});
on("btn-match-more", "click", (e) => {
  e.stopPropagation();
  toggleMatchMoreMenu();
});
// Close ⋯ when picking an action or tapping outside
[
  "btn-browse-together",
  "btn-hangup-friend",
  "btn-block",
  "btn-find-third",
  "btn-find-third-cancel",
  "btn-spin",
].forEach((id) => {
  $(id)?.addEventListener("click", () => closeMatchMoreMenu());
});
document.addEventListener(
  "click",
  (e) => {
    const wrap = $("match-more-wrap");
    if (!wrap || wrap.hidden) return;
    if (wrap.contains(e.target)) return;
    closeMatchMoreMenu();
  },
  true
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMatchMoreMenu();
});
on("btn-partner-menu-cancel", "click", () => closePartnerMenu());
on("btn-partner-menu-close", "click", () => closePartnerMenu());
// Back from report reasons → main actions (not a no-op when CSS hid both panels)
on("btn-partner-report-back", "click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  showPartnerMenuMain();
});
on("partner-menu-backdrop", "click", () => closePartnerMenu());
// Stop clicks inside the sheet from bubbling to backdrop / video
$("partner-menu")?.addEventListener("click", (e) => e.stopPropagation());
$("partner-menu-report")?.querySelectorAll("[data-report-reason]").forEach((btn) => {
  btn.addEventListener("click", () => {
    reportPartner(btn.getAttribute("data-report-reason") || "other");
  });
});
on("btn-settings", "click", (e) => {
  e.stopPropagation();
  toggleSettings();
});
// Header Settings / Full / Cam / ★ removed — use tile rails + badges
on("btn-conn-retry", "click", () => manualReconnect());
on("sheet-close", "click", () => closeSettings());
// Backdrop is transparent — click outside flyout closes it (no dim)
on("sheet-backdrop", "click", () => {
  if (starsSheetIsOpen()) closeStarsSheet();
  else closeSettings();
});
on("btn-refresh-devices", "click", () => refreshDevices());
on("btn-friends", "click", (e) => {
  e.stopPropagation();
  toggleFriends();
});
on("friends-close", "click", () => closeFriends());
on("btn-messages", "click", (e) => {
  e.stopPropagation();
  toggleMessages();
});
on("messages-close", "click", () => closeMessages());
on("messages-backdrop", "click", () => closeMessages());
// Keep flyouts next to their icons on resize / orientation change
window.addEventListener("resize", () => {
  try {
    repositionOpenDockFlyouts();
  } catch (_) {}
});
window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    try {
      repositionOpenDockFlyouts();
    } catch (_) {}
  }, 80);
});
on("msg-tab-friends", "click", () => {
  showMsgListView();
  setMessagesTab("friends");
});
on("msg-tab-matches", "click", () => {
  showMsgListView();
  setMessagesTab("matches");
});
on("msg-back", "click", () => showMsgListView());
on("btn-chat-inbox", "click", () => {
  const tab =
    activeChat.mode === "friend"
      ? "friends"
      : activeChat.mode === "match" || activeChat.mode === "history"
        ? "matches"
        : messagesTab;
  openMessages(tab);
  if (activeChat.threadKey) {
    openInboxThread(activeChat.threadKey, {
      mode: activeChat.mode,
      peerUserId: activeChat.peerUserId,
      peerName: activeChat.peerName,
      live: activeChat.live,
    });
  }
});
on("msg-thread-clear", "click", () => {
  if (!activeChat.threadKey) return;
  if (!confirm(_t("msg.clearConfirm") || "Clear this conversation?")) return;
  clearChat();
  renderInboxThreadBody();
  showMsgListView();
});
{
  const form = $("msg-compose");
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const input = $("msg-compose-input");
      const body = (input?.value || "").trim();
      if (!body || input?.disabled) return;
      // Reuse main compose routing
      if (activeChat.mode === "friend" && activeChat.peerUserId) {
        // Live friend call + open DC → E2E (+ hub store). Else hub only.
        const liveFriend =
          (inFriendCall || matchMode === "friend") && anyChatDcOpen();
        if (liveFriend) {
          if (
            !sendLiveChat(body, {
              asFriend: true,
              peerUserId: activeChat.peerUserId,
            })
          ) {
            setStatus(_t("chat.sendFail") || "Could not send");
            return;
          }
        } else {
          send({
            type: "friend_chat",
            to_user_id: activeChat.peerUserId,
            body,
          });
        }
      } else if ((matched || inFriendCall) && activeChat.live) {
        if (!sendLiveChat(body)) {
          setStatus(_t("chat.sendFail") || "Could not send — reconnecting…");
          return;
        }
      } else if (
        activeChat.peerUserId &&
        friendsCache.some((f) => f.user_id === activeChat.peerUserId)
      ) {
        activeChat.mode = "friend";
        activeChat.live = true;
        activeChat.threadKey = friendThreadKey(activeChat.peerUserId);
        updateChatHeader();
        updateInboxThreadHeader();
        send({
          type: "friend_chat",
          to_user_id: activeChat.peerUserId,
          body,
        });
      } else {
        setStatus(_t("chat.needMatch") || "Match or open a friend chat to send");
        return;
      }
      if (input) input.value = "";
    };
  }
}
on("friends-backdrop", "click", () => closeFriends());
on("btn-add-friend", "click", () => {
  const input = $("add-friend-code");
  const raw = input?.value || "";
  if (requestAddFriend(raw)) {
    if (input) input.value = "";
  }
});
$("add-friend-code")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    $("btn-add-friend")?.click();
  }
});
on("btn-copy-code", "click", async () => {
  if (!myFriendCode) {
    setStatus(_t("friends.noCode") || "Friend code not ready yet — wait for connection");
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        sendHelloPayload(getDisplayName());
      } catch (_) {}
    }
    return;
  }
  markFriendsFirstHintDone();
  const first = $("friends-first-hint");
  if (first) first.hidden = true;
  $("friends-code-hero")?.classList.remove("is-first-run");
  await copyToClipboard(myFriendCode, "friends.codeCopied");
  trackEvent("friend_code_copy");
});
on("btn-browse-together", "click", () => {
  send({ type: "browse_together", room: currentRoom() });
  wantSearch = true;
  const nPeers = peerPcs.size;
  log(
    nPeers >= 2
      ? _t("log.browseParty3") || "party of 3 — searching for a stranger (3v1)…"
      : _t("log.browseTogether") || "browse together…"
  );
  setStatus(
    nPeers >= 2
      ? _t("trio.searchingFourth") || "Searching for a stranger as a group of 3…"
      : _t("trio.searchingTogether") || "Searching for a stranger together…"
  );
});
on("btn-find-third", "click", () => {
  if (!TRIO_FIND_ENABLED || findThirdPending) return;
  // Friend call or stranger match both allowed (server checks 1v1)
  if (!matched && !inFriendCall) return;
  findThirdPending = "out";
  send({ type: "find_third_invite" });
  setStatus(_t("trio.inviteSent") || "Invite sent — waiting for them…");
  trackEvent("find_third_invite", {
    friend: inFriendCall || matchMode === "friend" ? 1 : 0,
  });
  updateFriendActionButtons();
});
on("btn-find-third-cancel", "click", () => {
  if (findThirdPending !== "out") return;
  send({ type: "find_third_cancel" });
  findThirdPending = null;
  setStatus(_t("trio.cancelled") || "Invite cancelled");
  updateFriendActionButtons();
});
on("btn-hangup-friend", "click", () => {
  try {
    maybeAlmostGiftUnlockOnLeave("hangup_friend");
  } catch (_) {}
  send({ type: "hangup_friend" });
  inFriendCall = false;
  matchMode = "solo";
  trioBrowse = false;
  findThirdPending = null;
  enableTrioLayout(false);
  // Keep chat; if they were a friend, compose can continue as DM
  endActiveMatchChat();
  primaryPartnerUserId = "";
  closeAllPeers({ keepFriend: false });
  setSplitRemote(false);
  setRemoteEmpty(true);
  updateFriendActionButtons();
});

function dismissFindThirdToast() {
  const t = $("find-third-toast");
  if (t?.parentNode) t.remove();
}

function handleFindThirdIncoming(msg) {
  if (!TRIO_FIND_ENABLED) return;
  findThirdPending = "in";
  dismissFindThirdToast();
  const toast = document.createElement("div");
  toast.id = "find-third-toast";
  toast.className = "friend-soft-toast find-third-toast";
  toast.setAttribute("role", "dialog");
  toast.style.pointerEvents = "auto";
  const name = msg.from_name || _t("trio.partner") || "Partner";
  toast.innerHTML = `
    <strong>${escapeHtml(_t("trio.incomingTitle") || "Find a third together?")}</strong>
    <span>${escapeHtml(
      _t("trio.incomingBody", { n: name }) ||
        `${name} wants to search for a 3rd person with you.`
    )}</span>
    <div class="export-nudge-actions" style="margin-top:0.45rem">
      <button type="button" class="pill tight ghost" id="btn-find-third-no">${escapeHtml(
        _t("trio.decline") || "No"
      )}</button>
      <button type="button" class="pill tight accent" id="btn-find-third-yes">${escapeHtml(
        _t("trio.accept") || "Yes, let's find one"
      )}</button>
    </div>`;
  document.body.appendChild(toast);
  $("btn-find-third-no")?.addEventListener("click", () => {
    send({ type: "find_third_respond", accept: false });
    findThirdPending = null;
    dismissFindThirdToast();
    trackEvent("find_third_decline");
    updateFriendActionButtons();
  });
  $("btn-find-third-yes")?.addEventListener("click", () => {
    send({ type: "find_third_respond", accept: true });
    findThirdPending = null;
    dismissFindThirdToast();
    trackEvent("find_third_accept");
    setStatus(_t("trio.searching") || "Looking for a 3rd together…");
    updateFriendActionButtons();
  });
  // Auto-dismiss UI after 30s (server also expires)
  setTimeout(() => {
    if (findThirdPending === "in") {
      findThirdPending = null;
      dismissFindThirdToast();
      updateFriendActionButtons();
    }
  }, 30_000);
  updateFriendActionButtons();
}

function handleFindThirdResult(msg) {
  dismissFindThirdToast();
  const reason = msg.reason || "";
  if (msg.ok && reason === "accepted") {
    findThirdPending = null;
    trioBrowse = true;
    matchMode = "party_browse";
    yourRole = "party";
    // Promote existing 1v1 stranger PC → teammate *before* layout (keep media)
    for (const pc of peerPcs.values()) {
      if (pc._role === "stranger" || !pc._role) pc._role = "teammate";
    }
    enableTrioLayout(true, { searching: true });
    setRemoteEmpty(false);
    bindFirstPartnerToMain(null);
    setThirdSlotStream(null); // middle: brand loop while hunting
    forceThirdBrandLoop();
    ensurePartnerVideoVisible();
    // Keep rebinding for a moment — Matched/status handlers can race
    setTimeout(() => bindFirstPartnerToMain(null), 200);
    setTimeout(() => forceThirdBrandLoop(), 200);
    setTimeout(() => bindFirstPartnerToMain(null), 800);
    setTimeout(() => forceThirdBrandLoop(), 800);
    setStatus(_t("trio.searching") || "Looking for a 3rd together…");
    trackEvent("find_third_accepted");
  } else {
    findThirdPending = null;
    const key =
      reason === "declined"
        ? "trio.declined"
        : reason === "expired"
          ? "trio.expired"
          : reason === "cancelled"
            ? "trio.cancelled"
            : "trio.failed";
    setStatus(
      _t(key) ||
        (reason === "declined"
          ? "They declined"
          : reason === "expired"
            ? "Invite expired"
            : "Find-third cancelled")
    );
  }
  updateFriendActionButtons();
}
on("btn-block", "click", () => {
  if (!primaryPartnerUserId) return;
  const uid = primaryPartnerUserId;
  if (!blockUserId(uid)) return;
  // Block · Next
  wantSearch = true;
  matched = false;
  showStartButton(false);
  closeAllPeers({ keepFriend: false });
  setSplitRemote(false);
  setRemoteEmpty(true);
  resetRemoteEmptyCopy();
  updateFriendActionButtons();
  send({ type: "next", room: currentRoom() });
  setPhase("waiting");
  updateConnFromState();
  updateFriendsOnlineStrip();
  trackEvent("block_next", { via: "dock" });
});

function onVolInput(e) {
  syncVolumeSliders(e.target.value);
  applyRemoteVolume();
}
on("remote-vol", "input", onVolInput);
on("remote-vol", "change", onVolInput);
on("remote-vol-sheet", "input", onVolInput);
on("remote-vol-sheet", "change", onVolInput);

on("sel-camera", "change", async () => {
  const id = $("sel-camera")?.value || "";
  if (!id) return;
  applyCameraChoice(id);
  setStatus(_t("device.switchingCam") || "switching camera…");
  mediaPreviewBusy = false;
  await hardReleaseLocalCamera(300);
  await startPreview();
  applyLocalMirrorClass();
  syncSettingsSummary();
  // Force paint after switch (Chrome often leaves black until re-bind)
  await ensureLocalPreviewVisible("sel-camera");
  if (localVideoTrackLive() && !localPreviewIsPainting()) {
    setStatus(
      _t("local.camBlackHint") ||
        "Camera on but black — pick USB Camera or tap Restart"
    );
    showLocalCamRestart(true);
  }
});

/**
 * Reverse / flip local webcam left↔right (mirror toggle).
 * Does NOT switch cameras or re-open getUserMedia — CSS only on the same stream.
 */
function flipCamera() {
  const next = !getLocalMirrored();
  try {
    savePrefs({ localMirrored: next });
  } catch (_) {}
  applyLocalMirrorClass();
  setStatus(
    next
      ? _t("btn.flipCamMirrored") || "Mirrored preview"
      : _t("btn.flipCamNatural") || "Natural preview"
  );
  trackEvent("flip_cam", { mirrored: next ? 1 : 0, via: "mirror_toggle" });
}
on("btn-flip-cam", "click", () => flipCamera());
on("sel-mic", "change", async () => {
  const id = $("sel-mic")?.value || "";
  if (!id) return;
  const label =
    [...($("sel-mic")?.options || [])].find((o) => o.value === id)
      ?.textContent || "";
  savePrefs({ micId: id, micLabel: label || undefined });
  setStatus(_t("device.switchingMic") || "switching mic…");
  await startPreview();
});
on("sel-speaker", "change", () => {
  const id = $("sel-speaker")?.value || "";
  const label =
    [...($("sel-speaker")?.options || [])].find((o) => o.value === id)
      ?.textContent || "";
  savePrefs({ speakerId: id || "", speakerLabel: label || "" });
  applySpeaker();
});
// Partner video click → friend / block / report (fullscreen stays on Full button / F)
// Long-press opens gift strip; swipe L/R skips (Next).
wireGiftStrip();
wirePartnerSwipe();
// Tap partner chrome → briefly show timer / quality / A/V again
$("remote-tile-tag")?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (matched || inFriendCall) peekRemoteMeta(REMOTE_META_PEEK_MS);
});
$("tile-remote")?.addEventListener("click", (e) => {
  if (e.target.closest(
    ".side-rail, .tile-dock, .tile-floor, .chat-panel, .partner-menu, .gift-strip, .debate-overlay, .debate-mobile-bar, .star-award-fx, button, a, input, select, textarea, label"
  )) {
    return;
  }
  if (matched || inFriendCall) peekRemoteMeta(REMOTE_META_PEEK_MS);
  if (swipeSkipSuppressClick) {
    swipeSkipSuppressClick = false;
    return;
  }
  if (giftStripSuppressClick) {
    giftStripSuppressClick = false;
    return;
  }
  if (!matched || !primaryPartnerUserId || primaryPartnerUserId === myUserId) return;
  if (partnerMenuOpen()) {
    closePartnerMenu();
    return;
  }
  // If gift strip is open, close it rather than open partner menu
  const gs = $("gift-strip");
  if (gs && !gs.hidden && gs.classList.contains("is-open")) {
    giftStripClose();
    return;
  }
  // First tap on a blurred partner = Unblur only (always-blur / intro blur).
  // Second tap opens partner menu (Find 3rd, debate, report, …).
  if (partnerBlurred) {
    clearIntroBlurTimer();
    introBlurGen++;
    setPartnerBlur(false);
    try {
      syncPartnerBlurButtonLabels();
    } catch (_) {}
    log(_t("log.blurOff") || "partner video unblurred");
    setStatus(_t("log.blurOffTap") || "Partner revealed — tap again for more options");
    trackEvent("partner_tap_unblur", {
      always: blurFirstPrefEnabled() ? 1 : 0,
    });
    return;
  }
  openPartnerMenu();
});

on("btn-spin", "click", () => {
  maybeShowCellularDataTip();
  pendingSignals.length = 0;
  matched = false;
  wantSearch = true;
  showStartButton(false);
  closeAllPeers({ keepFriend: false });
  inFriendCall = false;
  matchMode = "solo";
  yourRole = "solo";
  primaryPartnerUserId = "";
  clearPartnerStarsBadge();
  clearPartnerFx();
  try {
    closeStarGiftPop();
  } catch (_) {}
  setStarsBadge("local", myStars, { trust: myTrust });
  trioBrowse = false;
  setSplitRemote(false);
  enableTrioLayout(false);
  resetRemoteEmptyCopy();
  // Loop brand video behind searching empty (Start/Spin is a user gesture)
  showPartnerEmptyWithBrand({ searching: true });
  setArchPill("default");
  endActiveMatchChat(); // keep chat history after leaving
  updateFriendActionButtons();
  trackEvent("spin");
  send(spinPayload());
  updateConnFromState();
  log(
    _t("log.spinning") +
      (currentRoom()
        ? ` (${_t("room.set", { room: currentRoom() })})`
        : ` (${_t("room.public")})`)
  );
});

on("btn-next", "click", () => {
  if (isSelfNoSkipLocked()) {
    // Click registers, button presses — skip does nothing for the lock duration.
    const left = Math.max(0, selfNoSkipUntil - unixNowSec());
    const next = $("btn-next");
    next?.classList.add("is-no-skip-pressed");
    setTimeout(() => next?.classList.remove("is-no-skip-pressed"), 180);
    setStatus(
      _t("stars.pleaseStayLocked", { s: left }) ||
        `Please stay · ${left}s`
    );
    try {
      navigator.vibrate?.(12);
    } catch (_) {}
    return;
  }
  // ≥80% of unlock window but not yet there — tip before teardown
  try {
    maybeAlmostGiftUnlockOnLeave("next");
  } catch (_) {}
  // Capture path/quality before tearing down the match
  maybeShowMatchPathSummary("next");
  pendingSignals.length = 0;
  const keepFriend = inFriendCall || yourRole === "party" || matchMode === "friend";
  matched = keepFriend;
  wantSearch = true;
  showStartButton(false);
  closeAllPeers({ keepFriend });
  if (!keepFriend) {
    setSplitRemote(false);
    resetRemoteEmptyCopy();
    matchMode = "solo";
    yourRole = "solo";
    trioBrowse = false;
    enableTrioLayout(false);
    showPartnerEmptyWithBrand({ searching: true });
    endActiveMatchChat(); // keep previous partner chat until new match
  } else {
    // Party next: stranger thread ends but friend chat can continue as DM if needed
    endActiveMatchChat();
    if (trioBrowse || yourRole === "party") {
      setThirdSlotStream(null);
      bindFirstPartnerToMain(null);
    }
  }
  setArchPill("default");
  setFedChip(false);
  updateFriendActionButtons();
  schedulePostMatchFriendNudge("next");
  trackEvent("next");
  send(nextPayload());
  updateConnFromState();
  log(_t("log.next"));
});

/** Stop: leave queue / end stranger match; do not auto-search again. */
function doStopMatchmaking() {
  try {
    maybeAlmostGiftUnlockOnLeave("stop");
  } catch (_) {}
  maybeShowMatchPathSummary("stop");
  schedulePostMatchFriendNudge("stop");
  aloneInviteToastShown = false;
  try {
    $("alone-invite-toast")?.remove?.();
  } catch (_) {}
  clearLongWaitBoost();
  pendingSignals.length = 0;
  wantSearch = false;
  matched = false;
  inQueue = false;
  inFriendCall = false;
  matchMode = "solo";
  yourRole = "solo";
  trioBrowse = false;
  findThirdPending = null;
  dismissFindThirdToast();
  enableTrioLayout(false);
  primaryPartnerUserId = "";
  clearPartnerStarsBadge();
  clearPartnerFx();
  releaseScreenWakeLock();
  clearWeakConnWatch();
  closeAllPeers({ keepFriend: false });
  setSplitRemote(false);
  setRemoteEmpty(true);
  const titleEl = $("remote-empty")?.querySelector(".empty-title");
  const subEl = $("remote-empty")?.querySelector(".empty-sub");
  // No "Stopped" banner — idle is just brand loop + Start
  if (titleEl) titleEl.textContent = _t("remote.emptyTitle") || "";
  if (subEl) {
    subEl.hidden = true;
    subEl.textContent = "";
  }
  // Big Start returns to center of partner tile
  showStartButton(true);
  setArchPill("default");
  setFedChip(false);
  endActiveMatchChat(); // chat stays so links / history remain
  updateFriendActionButtons();
  send({ type: "stop" });
  setPhase("idle");
  setStatus(""); // no "stopped — idle" status pill
  updateConnFromState();
  updatePipButton();
  updateEmptyShareVisibility();
  trackEvent("stop");
  log(_t("log.stopped") || "stopped");
  // Soft one-shot invite when alone (after friend-nudge timeout window)
  setTimeout(() => {
    try {
      maybeShowStopInviteNudge();
    } catch (_) {}
  }, 1600);
}
on("btn-stop", "click", () => doStopMatchmaking());
on("btn-start-match", "click", () => startMatchFromIdle());

function onRoomInput(e) {
  const raw = (e?.target?.value != null ? e.target.value : currentRoom()).trim();
  syncRoomInputs(raw);
  savePrefs({ room: raw });
  syncRoomUrl();
  if (ws && ws.readyState === WebSocket.OPEN) {
    send({ type: "set_room", room: raw });
  }
}
$("room")?.addEventListener("change", onRoomInput);
$("room-settings")?.addEventListener("change", onRoomInput);
$("room")?.addEventListener("input", (e) => {
  if ($("room-settings")) $("room-settings").value = e.target.value;
  clearTimeout(onRoomInput._t);
  onRoomInput._t = setTimeout(syncRoomUrl, 300);
});
$("room-settings")?.addEventListener("input", (e) => {
  if ($("room")) $("room").value = e.target.value;
  clearTimeout(onRoomInput._t);
  onRoomInput._t = setTimeout(syncRoomUrl, 300);
});
$("btn-share-room")?.addEventListener("click", () => copyRoomLink());
$("btn-share-room-settings")?.addEventListener("click", () => copyRoomLink());
// Empty-pool share (idle / searching invite) — room actions no-op when ROOMS_ENABLED is false
$("btn-empty-share")?.addEventListener("click", () => {
  if (!ROOMS_ENABLED) return;
  shareOrCopy(
    roomShareUrl({ mintIfEmpty: true }),
    siteBrandName() + " room",
    "room.shared",
    "room.copied",
    { preferShare: true }
  );
});
$("btn-empty-copy")?.addEventListener("click", () => {
  if (!ROOMS_ENABLED) return;
  shareOrCopy(
    roomShareUrl({ mintIfEmpty: true }),
    siteBrandName() + " room",
    "room.shared",
    "room.copied",
    { preferShare: false }
  );
});
$("btn-empty-qr")?.addEventListener("click", () => {
  if (!ROOMS_ENABLED) return;
  ensureShareableRoom();
  toggleEmptyShareQr();
});
// Mobile alone-pool room share (friend invite button removed)
$("btn-mobile-share")?.addEventListener("click", () => {
  if (!ROOMS_ENABLED) return;
  trackEvent("mobile_invite_share");
  shareOrCopy(
    roomShareUrl({ mintIfEmpty: true }),
    siteBrandName() + " room",
    "room.shared",
    "room.copied",
    { preferShare: true }
  );
});
document.addEventListener("click", (e) => {
  if (e.target?.closest?.(".friend-more-wrap")) return;
  closeAllFriendMoreMenus();
});
on("btn-clear-chat", "click", () => clearChat());
async function shareFriendInvite({ preferShare = true, liveNow = false } = {}) {
  if (!myFriendCode) {
    setStatus(_t("friends.noCode") || "Friend code not ready yet");
    return;
  }
  const url = friendInviteUrl();
  const brand = siteBrandName();
  const code = myFriendCode;
  const isLive = !!(liveNow || inQueue || wantSearch || matched);
  let title =
    _t("friends.inviteLiveTitle", { code, brand }) ||
    `${brand} · my code ${code}`;
  if (isLive) {
    title =
      _t("friends.inviteLiveNow", { code, brand }) ||
      `I'm on ${brand} live now — add me with code ${code} then Call when Online`;
  }
  // Full paste pack (Telegram-friendly) — load helper on first share
  let packText = title;
  let shareLine = title;
  try {
    await ensureInviteCopy();
    if (typeof RuletInviteCopy !== "undefined" && RuletInviteCopy.buildPack) {
      const t = (k, fb) => {
        const v = _t(k);
        return v && v !== k ? v : fb;
      };
      const pack = RuletInviteCopy.buildPack({
        brand,
        url,
        code,
        liveNow: isLive,
        t,
      });
      packText = pack.full || pack.body || title;
      shareLine =
        RuletInviteCopy.buildShareLine({
          brand,
          url,
          code,
          liveNow: isLive,
          t,
        }) || title;
      title = pack.title || title;
    }
  } catch (_) {}
  trackEvent("friend_invite_share", {
    preferShare: preferShare ? 1 : 0,
    liveNow: isLive ? 1 : 0,
    pack: 1,
  });
  markInviteFunnelShare(preferShare ? "native_or_copy" : "copy");
  await shareOrCopy(url, title, "friends.inviteShared", "friends.inviteCopied", {
    preferShare,
    text: shareLine,
    copyText: packText,
  });
}

/** Toggle friend-invite QR under alone-search panel. */
function toggleEmptyAloneQr() {
  const qr = $("empty-alone-qr");
  if (!qr) return;
  if (!myFriendCode) {
    setStatus(_t("friends.noCode") || "Friend code not ready yet");
    return;
  }
  if (!qr.hidden && qr.innerHTML) {
    qr.hidden = true;
    qr.setAttribute("hidden", "");
    qr.innerHTML = "";
    return;
  }
  const url = friendInviteUrl();
  qr.hidden = false;
  qr.removeAttribute("hidden");
  qr.innerHTML = `<p class="hint-inline muted">${escapeHtml(
    _t("friends.qrLoading") || "Loading QR…"
  )}</p>`;
  ensureRuletQr().then((ok) => {
    if (qr.hidden) return;
    qr.innerHTML = "";
    try {
      if (ok && typeof RuletQr !== "undefined" && RuletQr.render) {
        RuletQr.render(qr, url, {
          size: 148,
          margin: 2,
          alt: _t("friends.inviteQrAlt") || "Friend invite QR",
        });
      } else {
        const src =
          "https://api.qrserver.com/v1/create-qr-code/?size=148x148&margin=6&data=" +
          encodeURIComponent(url);
        qr.innerHTML = `<img src="${src}" width="148" height="148" alt="${escapeAttr(
          _t("friends.inviteQrAlt") || "Friend invite QR"
        )}" loading="lazy" />`;
      }
    } catch (_) {
      qr.innerHTML = `<p class="hint-inline mono" style="word-break:break-all">${escapeHtml(
        url
      )}</p>`;
    }
  });
}

function syncFriendsIdentityBanner(hasFriends, recoverableN) {
  const ban = $("friends-identity-banner");
  if (!ban) return;
  // Show when no friends OR we have recoverable codes (likely identity split)
  const show = !hasFriends || recoverableN > 0;
  ban.hidden = !show;
  // Banner lives under More options — expand so Import is visible when needed
  if (show) {
    const more = $("friends-more-opts");
    if (more) more.open = true;
  }
}

/** One-shot soft toast: empty friends + local backup codes → suggest Import */
function maybeShowIdentityRecoveryToast() {
  try {
    const key = "ruletka-identity-recover-toast-v1";
    if (sessionStorage.getItem(key) === "1") return;
    if (friendsCache && friendsCache.length) return;
    const backup = loadFriendsBackup();
    if (!backup || !backup.length) return;
    if ($("identity-recover-toast") || $("alone-invite-toast")) return;
    sessionStorage.setItem(key, "1");
    const toast = document.createElement("div");
    toast.id = "identity-recover-toast";
    toast.className = "export-nudge-toast";
    toast.setAttribute("role", "status");
    toast.innerHTML = `
      <p><strong>${escapeHtml(
        _t("friends.identityToastTitle") || "Restore your friends?"
      )}</strong></p>
      <p>${escapeHtml(
        _t("friends.identityToastBody") ||
          "This device may be a new identity. Import a profile backup to Call the same friends."
      )}</p>
      <div class="export-nudge-actions">
        <button type="button" class="pill tight ghost" id="btn-id-recover-later">${escapeHtml(
          _t("friends.exportNudgeLater") || "Later"
        )}</button>
        <button type="button" class="pill tight accent" id="btn-id-recover-import">${escapeHtml(
          _t("settings.importUser") || "Import user"
        )}</button>
      </div>`;
    document.body.appendChild(toast);
    const dismiss = () => {
      if (toast.parentNode) toast.remove();
    };
    $("btn-id-recover-later")?.addEventListener("click", dismiss);
    $("btn-id-recover-import")?.addEventListener("click", () => {
      dismiss();
      trackEvent("identity_recover_import");
      $("import-profile-file")?.click();
    });
    setTimeout(dismiss, 18000);
    trackEvent("identity_recover_toast_show", { backup: backup.length });
  } catch (_) {}
}
on("btn-copy-invite", "click", () => shareFriendInvite({ preferShare: false }));
on("btn-share-invite", "click", () => shareFriendInvite({ preferShare: true }));

$("chk-match-sound")?.addEventListener("change", (e) => {
  savePrefs({ matchSound: !!e.target.checked });
  syncSettingsSummary();
});
$("chk-chat-sound")?.addEventListener("change", (e) => {
  savePrefs({ chatSound: !!e.target.checked });
});
$("chk-friend-online-notif")?.addEventListener("change", (e) => {
  setFriendOnlineNotif(!!e.target.checked);
});
$("chk-nsfw-auto")?.addEventListener("change", (e) => {
  const on = !!e.target.checked;
  savePrefs({ nsfwAuto: on });
  if (on && matched && matchMode !== "friend") startNsfwWatch();
  else if (!on) stopNsfwWatch();
  syncSettingsSummary();
});
$("chk-blur-first")?.addEventListener("change", (e) => {
  const on = !!e.target.checked;
  savePrefs({ blurFirst: on });
  // On: force always-blur for everyone. Off: reputation auto (under 39 keep · 39+ 3s).
  try {
    trackEvent("blur_first_pref", {
      on: on ? 1 : 0,
      starter: blurStarterLeft(),
      thr: BLUR_REP_THRESHOLD,
    });
    syncBlurFirstUi();
    syncPartnerBlurButtonLabels();
  } catch (_) {}
  try {
    if (matched && matchMode !== "friend" && !inFriendCall) {
      if (on) {
        clearIntroBlurTimer();
        introBlurGen++;
        setPartnerBlur(true);
        setStatus(
          _t("settings.blurFirstOnNow") ||
            "Always blur on — this partner is blurred. Tap Unblur when ready."
        );
      } else {
        const score = partnerRepScoreForBlur();
        setStatus(
          _t("settings.blurFirstOffNow", {
            thr: BLUR_REP_THRESHOLD,
            n: score,
          }) ||
            `Always blur off — next matches: under ${BLUR_REP_THRESHOLD}★ keep blur · ${BLUR_REP_THRESHOLD}+ get 3s.`
        );
      }
    } else {
      setStatus(
        on
          ? _t("settings.blurFirstOn") ||
              "Always blur everyone until you Unblur (ignores their ★)"
          : _t("settings.blurFirstOff", { thr: BLUR_REP_THRESHOLD }) ||
              `Auto blur: under ${BLUR_REP_THRESHOLD}★ until Unblur · ${BLUR_REP_THRESHOLD}+ only 3s`
      );
    }
  } catch (_) {}
  syncSettingsSummary();
});
$("chk-prefer-direct")?.addEventListener("change", (e) => {
  const on = !!e.target.checked;
  // User explicitly re-enabled — allow future auto-off again after another fail
  if (on) preferDirectAutoOffDone = false;
  setPreferDirectOnly(on, { silent: false });
  syncPreferDirectToggle();
  log(
    on
      ? "prefer direct P2P (no TURN)"
      : "prefer direct off (TURN allowed)"
  );
});
$("chk-hide-ip")?.addEventListener("change", (e) => {
  const on = !!e.target.checked;
  setHideIpRelayOnly(on, { silent: false });
  syncPreferDirectToggle();
  trackEvent("hide_ip_pref", { on: on ? 1 : 0 });
  log(
    on
      ? "hide IP (TURN relay only)"
      : "hide IP off (direct allowed)"
  );
  if (on) {
    setStatus(
      _t("settings.hideIpAvHint") ||
        "Hide IP on — next call uses TURN. A/V sync is tuned for relay (slightly higher buffer, matched audio+video)."
    );
  }
});
function wireLowLatencyAudioToggle(id) {
  $(id)?.addEventListener("change", (e) => {
    setLowLatencyAudio(!!e.target.checked, { restart: true });
    syncSettingsSummary();
  });
}
wireLowLatencyAudioToggle("chk-low-latency-audio");
wireLowLatencyAudioToggle("chk-low-latency-audio-conn");
$("btn-cam-front")?.addEventListener("click", () => switchCameraFacing("user"));
$("btn-cam-rear")?.addEventListener("click", () =>
  switchCameraFacing("environment")
);
// Keep dual toggles in sync on boot
try {
  syncLowLatencyAudioToggles();
  syncCamFacingButtons();
} catch (_) {}
$("btn-reset-path-stats")?.addEventListener("click", () => {
  savePathStats({ direct: 0, relay: 0, unknown: 0 });
  pathStatRecordedForMatch = false;
  refreshPathStatsUi();
  setStatus(_t("settings.connDirectResetOk") || "Direct/Relay stats cleared");
});

function resetRemoteEmptyCopy() {
  const titleEl = $("remote-empty")?.querySelector(".empty-title");
  const subEl = $("remote-empty")?.querySelector(".empty-sub");
  if (wantSearch || inQueue) {
    setSearchingEmptyCopy();
    showStartButton(false);
    $("remote-empty")?.classList.add("is-searching");
  } else {
    if (pendingRoomInvite || (roomInviteAutoStarted && currentRoom() && !matched)) {
      applyRoomInviteCopy();
      if (titleEl && !titleEl.textContent) {
        titleEl.textContent = _t("remote.emptyTitle");
      }
    } else if (titleEl) {
      titleEl.textContent = _t("remote.emptyTitle");
    }
    if (subEl) {
      subEl.hidden = true;
      subEl.textContent = "";
    }
    updateStartButtonVisibility();
    applyRoomInviteCopy();
  }
}

function syncChatInputLang() {
  const msg = $("msg");
  if (!msg) return;
  const lang = NextfaceI18n?.getLang?.() || "ru";
  msg.lang = lang === "en" ? "en" : "ru";
  msg.spellcheck = true;
}

function onLangChange() {
  NextfaceI18n?.applyI18n?.();
  setPhase(
    matched ? "matched" : $("phase")?.className?.includes("waiting") ? "waiting" : "idle"
  );
  // Re-read phase from class
  const phaseEl = $("phase");
  const phaseClass = [...(phaseEl?.classList || [])].find((c) =>
    ["idle", "waiting", "matched", "claiming"].includes(c)
  );
  if (phaseClass) setPhase(phaseClass);
  resetRemoteEmptyCopy();
  updateMicPill(0);
  syncChatInputLang();
  // Keep status pill coherent if still disconnected-looking
  const st = $("status")?.textContent || "";
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    if (/disconn|нет связи|connecting|подключ/i.test(st) || !st) {
      setStatus(
        !ws || ws.readyState === WebSocket.CONNECTING
          ? _t("status.connecting")
          : _t("status.disconnected")
      );
    }
  }
}

{
  const __el = $("btn-call");
  if (__el) __el.onclick = () => joinCall();
}

{
  const __form = $("compose");
  if (__form) {
    __form.onsubmit = (e) => {
      e.preventDefault();
      const input = $("msg");
      const body = (input?.value || "").trim();
      if (!body || input?.disabled) return;
      if (activeChat.mode === "friend" && activeChat.peerUserId) {
        const liveFriend =
          (inFriendCall || matchMode === "friend") && anyChatDcOpen();
        if (liveFriend) {
          if (
            !sendLiveChat(body, {
              asFriend: true,
              peerUserId: activeChat.peerUserId,
            })
          ) {
            setStatus(_t("chat.sendFail") || "Could not send");
            return;
          }
        } else {
          send({
            type: "friend_chat",
            to_user_id: activeChat.peerUserId,
            body,
          });
        }
      } else if ((matched || inFriendCall) && activeChat.live) {
        if (!sendLiveChat(body)) {
          setStatus(_t("chat.sendFail") || "Could not send — reconnecting…");
          return;
        }
      } else if (
        activeChat.peerUserId &&
        friendsCache.some((f) => f.user_id === activeChat.peerUserId)
      ) {
        // Was match with a friend — upgrade to DM
        activeChat.mode = "friend";
        activeChat.live = true;
        activeChat.threadKey = friendThreadKey(activeChat.peerUserId);
        updateChatHeader();
        send({
          type: "friend_chat",
          to_user_id: activeChat.peerUserId,
          body,
        });
      } else {
        setStatus(_t("chat.needMatch") || "Match or open a friend chat to send");
        return;
      }
      if (input) input.value = "";
    };
  }
}

document.addEventListener("keydown", (e) => {
  const tag = (e.target && e.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (e.key === "?" || (e.shiftKey && e.key === "/")) {
    e.preventDefault();
    if (keysHelpOpen()) closeKeysHelp();
    else openKeysHelp();
    return;
  }
  if (e.key === "m" || e.key === "M") {
    e.preventDefault();
    toggleMicMute();
  } else if (e.key === "c" || e.key === "C") {
    e.preventDefault();
    flipCamera();
  } else if (e.key === "p" || e.key === "P") {
    e.preventDefault();
    togglePartnerMute();
  } else if (e.key === "b" || e.key === "B") {
    e.preventDefault();
    if (e.shiftKey) toggleSelfBlur();
    else togglePartnerBlur();
  } else if (e.key === "h" || e.key === "H") {
    e.preventDefault();
    toggleSelfBlur();
  } else if (e.key === "f" || e.key === "F") {
    e.preventDefault();
    toggleFullscreenPartner();
  } else if (e.key === "s" || e.key === "S") {
    e.preventDefault();
    doStopMatchmaking();
  } else if (e.key === "Escape") {
    if (keysHelpOpen()) {
      e.preventDefault();
      closeKeysHelp();
    } else if (settingsIsOpen()) {
      e.preventDefault();
      closeSettings();
    } else if (friendsIsOpen()) {
      e.preventDefault();
      closeFriends();
    } else if (messagesIsOpen()) {
      e.preventDefault();
      closeMessages();
    } else if (partnerMenuOpen()) {
      e.preventDefault();
      closePartnerMenu();
    } else if ($("wait-tips") && !$("wait-tips").hidden) {
      e.preventDefault();
      hideWaitTips();
    }
  } else if (e.code === "Space") {
    e.preventDefault();
    $("btn-next").click();
  }
});

if (navigator.mediaDevices?.addEventListener) {
  let deviceChangeTimer = 0;
  navigator.mediaDevices.addEventListener("devicechange", () => {
    // Debounce unplug/replug storms
    if (deviceChangeTimer) clearTimeout(deviceChangeTimer);
    deviceChangeTimer = setTimeout(() => {
      deviceChangeTimer = 0;
      refreshDevices()
        .then(async () => {
          // After unplug/replug: if no live preview, clear fail list and reopen
          if (!localVideoTrackLive() && rulesAccepted?.()) {
            clearFailedCameras();
            localCameraCycleTried.clear();
            mediaPreviewBusy = false;
            mediaPermissionDenied = false;
            try {
              await hardReleaseLocalCamera(200);
            } catch (_) {}
            startPreview().catch(() => {});
          }
        })
        .catch(() => {});
    }, 400);
  });
}

const LANG_FLAGS = {
  en: "🇬🇧",
  ru: "🇷🇺",
  uk: "🇺🇦",
  es: "🇪🇸",
  de: "🇩🇪",
  fr: "🇫🇷",
  pt: "🇧🇷",
  tr: "🇹🇷",
  pl: "🇵🇱",
  zh: "🇨🇳",
};

function rebuildSettingsLangList() {
  const list = $("settings-lang-list");
  if (!list) return;
  const langs =
    NextfaceI18n?.listLanguages?.() || [
      { code: "ru", native: "Русский" },
      { code: "en", native: "English" },
    ];
  const cur = NextfaceI18n?.getLang?.() || "ru";
  list.innerHTML = langs
    .map((l) => {
      const flag = LANG_FLAGS[l.code] || "🌐";
      const sel = l.code === cur ? " is-selected" : "";
      return `<button type="button" class="settings-row settings-choice${sel}" data-lang="${l.code}">
        <span class="row-left"><span class="row-flag">${flag}</span> ${escapeHtml(
          l.native
        )}</span>
        <span class="choice-check" data-check-for="${l.code}">${
        l.code === cur ? "✓" : ""
      }</span>
      </button>`;
    })
    .join("");
  list.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-lang");
      if (!code) return;
      Promise.resolve(NextfaceI18n?.setLang?.(code)).then(() => {
        if ($("sel-lang")) $("sel-lang").value = code;
        if ($("sel-lang-sheet")) $("sel-lang-sheet").value = code;
        rebuildSettingsLangList();
        showSettingsView("main");
        syncSettingsSummary();
      });
    });
  });
}

// Language switchers
function bindLangSelect(el) {
  if (!el) return;
  el.value = NextfaceI18n?.getLang?.() || "ru";
  el.addEventListener("change", () => {
    Promise.resolve(NextfaceI18n?.setLang?.(el.value)).then(() => {
      const other = el.id === "sel-lang" ? $("sel-lang-sheet") : $("sel-lang");
      if (other) other.value = el.value;
      rebuildSettingsLangList();
      syncSettingsSummary();
    });
  });
}
bindLangSelect($("sel-lang"));
bindLangSelect($("sel-lang-sheet"));
window.addEventListener("nextface:lang", () => {
  onLangChange();
  rebuildSettingsLangList();
  syncSettingsSummary();
});
wireSettingsNav();

// Boot (wait for optional external lang packs)
const _i18nReady = NextfaceI18n?.ready || Promise.resolve();
_i18nReady.then(() => {
  NextfaceI18n?.applyI18n?.();
  rebuildSettingsLangList();
}).catch(() => {
  NextfaceI18n?.applyI18n?.();
});
NextfaceI18n?.applyI18n?.();
syncChatInputLang();
setArchPill("default");
hideIncomingCall();
hideCallCoach();
wireCallCoach();
wireWaitTips();
wireKeysHelp();
wireTileChromeAutohide();
wireHubSettings();
wireMatchPrefs();
wireNameInputs();
syncMatchPrefsUi();
// iOS Safari: unlock video/audio after the first real gesture
document.addEventListener(
  "pointerdown",
  () => {
    ensureMediaUnlocked();
    // User gesture: if partner stream is attached but overlay stuck, clear it
    if (matched) ensurePartnerVideoVisible();
    // Restart empty brand loop after autoplay block
    else kickEmptyBrandMedia();
  },
  { passive: true }
);
document.addEventListener(
  "touchend",
  () => {
    ensureMediaUnlocked();
    if (!matched) kickEmptyBrandMedia();
  },
  { passive: true }
);
{
  applyRoomsFeatureFlag();
  const prefs = loadPrefs();
  const idn = loadIdentity();
  const q = new URLSearchParams(location.search);
  // Stash ?friend= early (before rules / socket) so invite survives first paint
  try {
    stashPendingFriendFromUrl();
  } catch (_) {}
  // Week-1 funnel: attribute share → land → request → connected
  try {
    captureInviteFunnelLanding();
  } catch (_) {}
  // Homepage “Invite friends” → open Friends to share real code
  try {
    maybeOpenInviteShareLanding();
  } catch (_) {}
  if (ROOMS_ENABLED) {
    // Priority: ?room= → saved pref
    const fromUrl = q.get("room");
    if (fromUrl != null) {
      const room = String(fromUrl).trim();
      syncRoomInputs(room);
      if (room) {
        // Shared link: remember room + auto-join after rules/socket
        pendingRoomInvite = true;
        savePrefs({ room });
        trackEvent("room_invite_open", { rlen: room.length });
      }
    } else if (prefs.room) syncRoomInputs(prefs.room);
    else syncRoomInputs("");
  } else {
    // Rooms hidden: always public lobby; drop ?room= from address bar
    syncRoomInputs("");
    pendingRoomInvite = false;
    try {
      if (prefs.room) savePrefs({ room: "" });
    } catch (_) {}
    try {
      const u = new URL(location.href);
      if (u.searchParams.has("room")) {
        u.searchParams.delete("room");
        history.replaceState(null, "", u.pathname + u.search + u.hash);
      }
    } catch (_) {}
  }
  if ($("chk-match-sound")) {
    $("chk-match-sound").checked =
      typeof prefs.matchSound === "boolean" ? prefs.matchSound : true;
  }
  if ($("chk-chat-sound")) {
    $("chk-chat-sound").checked =
      typeof prefs.chatSound === "boolean"
        ? prefs.chatSound
        : typeof prefs.matchSound === "boolean"
          ? prefs.matchSound
          : true;
  }
  syncFriendOnlineNotifUi();
  try {
    refreshFlairUi();
  } catch (_) {}
  if ($("chk-nsfw-auto")) {
    $("chk-nsfw-auto").checked = prefs.nsfwAuto !== false;
  }
  if ($("chk-blur-first")) {
    $("chk-blur-first").checked = prefs.blurFirst === true;
    try {
      syncBlurFirstUi();
    } catch (_) {}
  }
  // Name from URL ?name= or saved identity
  const nameQ = q.get("name");
  if (nameQ) saveIdentity({ name: nameQ.trim().slice(0, 32) });
  syncNameInputs((loadIdentity().name || nameQ || "").trim() || "anon");
  // No auto-focus / "set a name" nags — user chooses when to edit their name
  syncRoomUrl();
  if (ROOMS_ENABLED) applyRoomInviteCopy();
}
setLocalEmpty(true);
setRemoteEmpty(true);
resetRemoteEmptyCopy();
// Try brand loop early (may need kick after rules / first click)
kickEmptyBrandMedia();
updateSideIcons();
updateMicPill(0);
updateFriendActionButtons();

/** Open cam/mic as soon as possible (restores last cam/mic/speaker prefs). */
async function ensurePreview() {
  if (previewStream?.active) return true;
  try {
    await refreshDevices();
  } catch (_) {}
  await startPreview();
  try {
    await applySpeaker();
  } catch (_) {}
  return !!(previewStream && previewStream.active);
}

function qHasNoconnect() {
  return new URLSearchParams(location.search).has("noconnect");
}

function isWsOpen() {
  return !!(ws && ws.readyState === WebSocket.OPEN);
}

/**
 * Single entry for "start everything" — safe to call multiple times.
 * Used on script load, window.load, and first user gesture.
 */
function startSession({ forceMedia = false } = {}) {
  if (!qHasNoconnect() && !isWsOpen()) {
    reconnectAttempt = 0;
    try {
      connect(false);
    } catch (e) {
      log("connect: " + e);
    }
  }
  // Don't prompt for camera until user accepts 18+ rules
  if (!rulesAccepted()) return;
  if (forceMedia || !previewStream?.active) {
    ensurePreview().catch((e) => log("preview: " + (e && e.message ? e.message : e)));
  }
}

// Export for live.html load handler
window.__ruletBooted = function () {
  if (rulesAccepted()) startSession({ forceMedia: false });
};
// Back-compat alias
window.__nextfaceBooted = window.__ruletBooted;

// Retry media after user gesture (required on many Android browsers)
document.addEventListener(
  "pointerdown",
  () => {
    // Always try to revive brand loop behind Start (autoplay often blocked until click)
    try {
      kickEmptyBrandMedia();
    } catch (_) {}
    if (!rulesAccepted()) return;
    // Stream exists but local tile still black → heal on tap (LED on, no picture)
    if (previewStream?.active || localVideoTrackLive()) {
      if (!localPreviewIsPainting()) {
        ensureLocalPreviewVisible("gesture").catch(() => {});
      }
      return;
    }
    // User tap can clear a soft denial; hard denial needs the Enable button
    if (mediaPermissionDenied) return;
    startSession({ forceMedia: true });
  },
  { capture: true, passive: true }
);

// Black camera: restart / cycle devices
on("btn-restart-cam", "click", async (e) => {
  e?.preventDefault?.();
  e?.stopPropagation?.();
  try {
    endCallKeepPreview?.();
  } catch (_) {}
  clearFailedCameras();
  mediaPermissionDenied = false;
  setStatus(_t("status.previewStarting") || "starting camera…");
  try {
    // Prefer ranked non-Kiyo when restarting after black
    forceCameraDeviceId = null;
    mediaPreviewBusy = false;
    await hardReleaseLocalCamera(350);
    // Point select at best-ranked camera (USB over black Kiyo on Linux)
    try {
      const ranked = await listVideoCameras();
      const best = ranked[0];
      if (best?.id && $("sel-camera")) {
        const sel = $("sel-camera");
        if (![...sel.options].some((o) => o.value === best.id)) {
          const opt = document.createElement("option");
          opt.value = best.id;
          opt.textContent = best.label || best.id.slice(0, 12);
          sel.appendChild(opt);
        }
        sel.value = best.id;
        savePrefs({ cameraId: best.id });
      }
    } catch (_) {}
    await startPreview();
    await ensureLocalPreviewVisible("manual-restart");
    if (!localPreviewIsPainting()) {
      await recoverBlackLocalCamera("manual-restart");
    }
  } catch (err) {
    log("restart-cam: " + (err?.message || err));
    showLocalCamRestart(true);
  }
});

// Ensure local ★ painted on boot (even if hub stars arrive later)
try {
  setStarsBadge("local", myStars || 0, { trust: myTrust || 0 });
} catch (_) {}

on("btn-enable-cam", "click", async (e) => {
  e?.preventDefault?.();
  e?.stopPropagation?.();
  mediaPermissionDenied = false;
  showEnableCamButton(false, _t("local.emptySub"));
  setStatus(_t("status.previewStarting") || "starting camera…");
  try {
    // Fresh cycle — don't stick on a black Linux /dev/video node
    clearFailedCameras();
    stopLocalCanvasPreview();
    stopPreview();
    mediaPreviewBusy = false;
    await startPreview();
    await ensureLocalPreviewVisible("enable-btn");
    // If still black, jump to another camera immediately
    if (localVideoTrackLive() && !localPreviewIsPainting()) {
      await recoverBlackLocalCamera("enable-btn");
    }
  } catch (err) {
    log("enable-cam: " + (err?.message || err));
  }
  if (!previewStream?.active) {
    showEnableCamButton(true, _t("local.enableHint"));
  } else if (!localPreviewIsPainting()) {
    showEnableCamButton(
      true,
      _t("local.camBlackHint") ||
        "Camera on but blank — tap Enable / Restart to try another camera"
    );
    showLocalCamRestart(true);
  } else {
    showLocalCamRestart(false);
  }
});

// Rules gate first (does not block WS forever — session starts after accept or if already ok)
wireRulesGate();
const gateBlocks = showRulesGate();

// Paint last volume / mirror / audio toggles + identity chrome immediately
try {
  const earlyPrefs = loadPrefs();
  if (typeof earlyPrefs.volume === "number") {
    syncVolumeSliders(earlyPrefs.volume);
    peerVolByEl.remote = Math.max(0, Math.min(100, earlyPrefs.volume));
  }
  applyLocalMirrorClass();
  syncLowLatencyAudioToggles();
  refreshLocalNameChip();
  refreshAvatarUi();
} catch (_) {}

// Immediate boot — media waits for rules accept if first visit
startSession({ forceMedia: !gateBlocks });
updateEmptyShareVisibility();
updateStartButtonVisibility();
// Returning users who never saw the quick guide (once)
if (!gateBlocks) {
  setTimeout(() => {
    try {
      maybeShowFirstSessionGuide();
    } catch (_) {}
  }, 1400);
}
// Soft post-import backup reminder (one shot, not a nag loop)
setTimeout(() => {
  try {
    maybeShowImportBackupNudge();
  } catch (_) {}
}, 900);
// No-signup education: export is your account (once, after rules)
setTimeout(() => {
  try {
    if (typeof rulesAccepted === "function" && rulesAccepted()) {
      maybeShowNoAccountBackupTip();
    }
  } catch (_) {}
}, 4500);
// Background: warm hub directory so failover is ready if this seed dies
if (typeof RuletHub !== "undefined" && RuletHub.loadDirectory) {
  RuletHub.loadDirectory(false).catch(() => {});
}
try {
  refreshHubChip();
} catch (_) {}
// Listen for programmatic hub changes (other tabs / future UI)
window.addEventListener("ruletka:hub", () => {
  try {
    syncHubSettingsUi();
  } catch (_) {}
});

// Keep trying for a few seconds (covers slow bridge / late permissions).
// Do NOT spam getUserMedia after permission denied — Android gets stuck.
let bootTries = 0;
const bootTimer = setInterval(() => {
  bootTries += 1;
  if (!rulesAccepted()) return;
  if (!isWsOpen() && !qHasNoconnect()) {
    startSession({ forceMedia: false });
  }
  if (!previewStream?.active && !mediaPermissionDenied && !mediaPreviewBusy) {
    startSession({ forceMedia: true });
  }
  // Shared room link: join once hub + rules are ready
  maybeAutoJoinRoomInvite();
  if (
    bootTries >= 8 ||
    (isWsOpen() && (previewStream?.active || mediaPermissionDenied))
  ) {
    clearInterval(bootTimer);
    if (!previewStream?.active && rulesAccepted()) {
      showEnableCamButton(true, _t("local.enableHint"));
    }
    // Last chance for room invite after media settle
    setTimeout(() => maybeAutoJoinRoomInvite(), 400);
  }
}, 700);

// Reconnect when network comes back or tab becomes visible with a dead socket
window.addEventListener("online", () => {
  log(_t("log.onlineAgain"));
  if (!isWsOpen() && !qHasNoconnect() && rulesAccepted()) {
    reconnectAttempt = 0;
    connect(true);
  }
});
window.addEventListener("offline", () => {
  log(_t("log.offline"));
  setStatus(_t("status.disconnected"));
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    maybeAutoPipOnHide();
    // Stop looping brand video while tab is backgrounded
    syncEmptyBrandMedia(false);
    // If still "empty" UI, show poster only until return
    if (isRemoteEmptyVisible()) {
      const poster = $("remote-empty-poster");
      if (poster) poster.hidden = false;
    }
    return;
  }
  // OS releases wake lock while backgrounded — re-acquire in a live call
  syncScreenWakeLock();
  updatePipButton();
  // Resume partner feed or empty brand after tab focus
  if (matched) {
    ensureMediaUnlocked();
    ensurePartnerVideoVisible();
  } else {
    kickEmptyBrandMedia();
  }
  if (!rulesAccepted() || qHasNoconnect()) return;
  if (!isWsOpen()) {
    reconnectAttempt = 0;
    connect(true);
  } else {
    send({ type: "ping" });
  }
});
window.addEventListener("pagehide", () => {
  releaseScreenWakeLock();
  try {
    $("remote-empty-video")?.pause?.();
  } catch (_) {}
});

// PWA service worker is registered by pwa-install.js (home + live)

// Device crypto identity + ICE config (must not block connect/media long)
(async function secureBootBackground() {
  if (!window.isSecureContext) {
    log(_t("log.secure"));
  }
  try {
    if (typeof RuletIdentity !== "undefined" && RuletIdentity.ensureDeviceIdentity) {
      const id = await RuletIdentity.ensureDeviceIdentity();
      if (id?.user_id) {
        // Keep name; ensure user_id is the crypto-bound one for new installs
        const cur = loadIdentity();
        if (cur.user_id !== id.user_id) {
          saveIdentity({ user_id: id.user_id });
        } else if (id.crypto) {
          saveIdentity({ cryptoBound: true });
        }
      }
    }
  } catch (e) {
    console.warn("[identity]", e);
  }
  // Multi-hub: prefer healthy bridge (same origin first, then directory)
  if (typeof RuletHub !== "undefined" && RuletHub.ensureHealthyHub) {
    try {
      const r = await RuletHub.ensureHealthyHub({ forceSwitch: false });
      if (r?.base) {
        syncHubSettingsUi();
        if (r.switched) log(_t("hub.switched", { h: r.base }));
      }
    } catch (_) {}
  }
  if (typeof loadRtcConfig !== "function") return;
  try {
    const { meta, error } = await loadRtcConfig(hubBase());
    if (error) log(_t("log.iceDefault", { e: error }));
    else if (meta) {
      window.__hasTurn = !!meta.has_turn;
      window.__iceMeta = meta;
      log(
        _t("log.iceOk", {
          n: meta.ice_servers?.length || 0,
          turn: meta.has_turn ? _t("log.turnOn") : _t("log.turnOff"),
        })
      );
      if (meta.turn_ephemeral) log(_t("log.turnEphemeral"));
      updateConnFromState();
      refreshSecurityPanel();
    }
  } catch (e) {
    log("ICE load: " + (e.message || e));
  }
})();

// Trio layout: reflow on rotate (mobile portrait PiP ↔ landscape 3-col)
window.addEventListener("orientationchange", () => {
  setTimeout(() => syncTrioLayout(), 120);
});
window.addEventListener("resize", () => {
  if (trioBrowse) syncTrioLayout();
});
