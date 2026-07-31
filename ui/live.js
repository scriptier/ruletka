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

/** @typedef {"dark"|"light"|"saloon"|"matrix"|"pink"} UiTheme */
const THEME_IDS = ["dark", "light", "saloon", "matrix", "pink"];
const THEME_META = {
  dark: { color: "#0a0b0e", labelKey: "settings.themeDark", fallback: "Dark" },
  light: { color: "#faf7f5", labelKey: "settings.themeLight", fallback: "Light" },
  saloon: { color: "#1a1008", labelKey: "settings.themeSaloon", fallback: "Saloon" },
  matrix: { color: "#020402", labelKey: "settings.themeMatrix", fallback: "Matrix" },
  pink: { color: "#fff0f5", labelKey: "settings.themePink", fallback: "Pink" },
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

function applyTheme(theme, { persist = true } = {}) {
  const id = normalizeTheme(theme);
  document.documentElement.setAttribute("data-theme", id);
  document.documentElement.style.colorScheme = LIGHT_THEMES.has(id) ? "light" : "dark";
  const meta = document.getElementById("meta-theme-color");
  if (meta) meta.setAttribute("content", THEME_META[id].color);
  applyThemeIcons(id);
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
/** Your public star count (from hub). */
let myStars = 0;
/** Partner star count during current match. */
let partnerStars = 0;
/** Min chat length for star review (must match bridge STAR_MIN_SECS). */
const STAR_MIN_SECS = 16 * 60;
/** Star-gift costs (must match bridge EFFECT_COST / DURATION). */
const STAR_EFFECT_COST = 5;
const STAR_EFFECT_SECS = 30;
/** @type {{ kind: string, until: number } | null} effect on partner */
let partnerFx = null;
/** @type {{ kind: string, until: number } | null} effect on self (e.g. bars after logout) */
let selfFx = null;
let fxTickTimer = 0;
/** Last lobby waiting count for pool hint */
let lastWaitingCount = 0;
const RULES_KEY = "nextface-rules-v1";
const HISTORY_KEY = "nextface-history-v1";
const MAX_HISTORY = 40;
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

/** Keep strangers blurred until the user taps Blur (opt-in). Default off. */
function blurFirstEnabled() {
  const prefs = loadPrefs();
  return prefs.blurFirst === true;
}

/** Timed safety blur on new stranger matches (then auto-clear unless blur-first). */
const INTRO_BLUR_MS = 2000;
let introBlurTimer = 0;
let introBlurGen = 0;

function clearIntroBlurTimer() {
  if (introBlurTimer) {
    clearTimeout(introBlurTimer);
    introBlurTimer = 0;
  }
}

/**
 * Blur a new stranger for INTRO_BLUR_MS so the user can Next/Stop if needed,
 * then unblur automatically — unless Settings → "keep blurred" is on.
 */
function applyStrangerIntroBlur() {
  clearIntroBlurTimer();
  setPartnerBlur(true);
  if (blurFirstEnabled()) {
    log(_t("log.blurFirst"));
    return;
  }
  log(_t("log.blurIntro") || "partner blurred 2s — Next if needed");
  const gen = ++introBlurGen;
  introBlurTimer = setTimeout(() => {
    introBlurTimer = 0;
    if (gen !== introBlurGen) return;
    if (!matched) return;
    // Friends / hangup may have cleared match
    if (blurFirstEnabled()) return;
    if (!partnerBlurred) return; // user already unblurred
    setPartnerBlur(false);
    log(_t("log.blurIntroDone") || "partner unblurred");
  }, INTRO_BLUR_MS);
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

/** Auto-hide the on-tile chat panel after idle (new messages re-open + reset). */
let chatPanelHideTimer = 0;
let chatPanelSticky = false;
const CHAT_PANEL_AUTO_HIDE_MS = 5000;

function showChatPanel(show, opts = {}) {
  const panel = $("chat-panel");
  if (!panel) return;
  if (chatPanelHideTimer) {
    clearTimeout(chatPanelHideTimer);
    chatPanelHideTimer = 0;
  }
  if (!show) {
    chatPanelSticky = false;
    panel.classList.remove("is-pinned");
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  // Sticky = stay open until user closes (tap panel / pin)
  if (opts.sticky) {
    chatPanelSticky = true;
    panel.classList.add("is-pinned");
  }
  if (chatPanelSticky || opts.sticky) return;

  const armHide = () => {
    if (chatPanelSticky) return;
    if (chatPanelHideTimer) clearTimeout(chatPanelHideTimer);
    chatPanelHideTimer = setTimeout(() => {
      chatPanelHideTimer = 0;
      if (chatPanelSticky) return;
      try {
        if (panel.matches(":hover")) {
          armHide();
          return;
        }
      } catch (_) {}
      panel.hidden = true;
    }, CHAT_PANEL_AUTO_HIDE_MS);
  };
  armHide();
  // One-shot: hover pauses hide; click/tap pins open for reading
  if (!panel.dataset.autoHideBound) {
    panel.dataset.autoHideBound = "1";
    panel.addEventListener("mouseenter", () => {
      if (chatPanelHideTimer) {
        clearTimeout(chatPanelHideTimer);
        chatPanelHideTimer = 0;
      }
    });
    panel.addEventListener("mouseleave", () => {
      if (!panel.hidden && !chatPanelSticky) armHide();
    });
    panel.addEventListener("pointerdown", (e) => {
      // Close button should still close
      if (e.target?.closest?.("#btn-clear-chat, .chat-clear, .sheet-close")) {
        return;
      }
      // Any interaction pins the panel so messages stay readable
      if (!panel.hidden) {
        chatPanelSticky = true;
        panel.classList.add("is-pinned");
        if (chatPanelHideTimer) {
          clearTimeout(chatPanelHideTimer);
          chatPanelHideTimer = 0;
        }
      }
    });
  }
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
 * Soft post-match “Add friend?” after a real stranger call ends (Next/Stop).
 * Only if: had partner code, not already friends, match lasted ≥25s, once per partner/session.
 */
const friendNudgeShown = new Set();

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
    // Toast only when long enough and not fighting friend-add dialog
    if (s.sec < 8) return;
    if ($("post-match-friend-nudge") || $("stop-invite-nudge") || $("path-stats-tip"))
      return;
    const id = "match-path-summary-toast";
    const existing = $(id);
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.id = id;
    toast.className = "friend-soft-toast match-path-summary-toast";
    toast.setAttribute("role", "status");
    toast.innerHTML = `
      <strong>${escapeHtml(_t("conn.matchSummaryTitle") || "Last call")}</strong>
      <span>${escapeHtml(bits.join(" · "))}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 5500);
  } catch (_) {}
}

/**
 * Hover / focus tip copy for star badges.
 * @param {"local"|"remote"} which
 * @param {number} n
 */
function starsTipCopy(which, n) {
  const countLine =
    n <= 0
      ? _t("stars.tipNone") || "No stars yet."
      : n === 1
        ? _t("stars.tipCountOne") || "1 star"
        : _t("stars.tipCount", { n }) || `${n} stars`;
  if (which === "local") {
    const title = _t("stars.tipYoursTitle") || "★ Your stars";
    let body =
      _t("stars.tipYoursBody") ||
      "Others can gift you a star after a 16+ min chat (once per person). Spend stars on gifts like Behind bars. At 100+ stars your reports count double.";
    if (n >= 100) {
      body +=
        " " +
        (_t("stars.tipTrusted") || "You are a trusted reporter.");
    }
    return { title, body: `${countLine}. ${body}` };
  }
  return {
    title: _t("stars.tipTheirsTitle") || "★ Reputation",
    body: `${countLine}. ${
      _t("stars.tipTheirsBody") ||
      "Earned when someone gifts a star after a 16+ min chat. Spend on gifts. 100+ stars = stronger reports."
    }`,
  };
}

/**
 * Show/hide gold star badge on a tile; hover shows star info tip.
 * Click during a live chat opens spend-gift menu.
 * @param {"local"|"remote"} which
 * @param {number} count
 */
function setStarsBadge(which, count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const badge = $(which === "local" ? "local-stars-badge" : "remote-stars-badge");
  const el = $(which === "local" ? "local-stars-count" : "remote-stars-count");
  const tip = $(which === "local" ? "local-stars-tip" : "remote-stars-tip");
  if (el) el.textContent = String(n);
  if (which === "local") myStars = n;
  if (which === "remote") partnerStars = n;
  if (badge) {
    const live = !!(matched || inFriendCall);
    // Partner: show when they have stars. You: show when you have stars OR in a live chat (so you can click to spend).
    const show =
      which === "local" ? n > 0 || live : n > 0 || (live && !!primaryPartnerUserId);
    badge.hidden = !show;
    if (show) badge.removeAttribute("hidden");
    else badge.setAttribute("hidden", "");
    badge.classList.toggle("is-clickable", live && !!primaryPartnerUserId);
    badge.classList.toggle("is-live-chat", live);
    const tipCopy = starsTipCopy(which, n);
    const spendHint = live
      ? " " +
        (_t("stars.tipClickSpend") || "Click to spend stars on this chat.")
      : "";
    badge.setAttribute("aria-label", `${tipCopy.title}. ${tipCopy.body}${spendHint}`);
    badge.title = ""; // rich CSS tip on hover
    if (tip) {
      const titleEl = tip.querySelector(".stars-tip-title");
      const bodyEl = tip.querySelector(".stars-tip-body");
      if (titleEl) titleEl.textContent = tipCopy.title;
      if (bodyEl) bodyEl.textContent = tipCopy.body + spendHint;
    }
  }
}

function starGiftPopOpen() {
  const pop = $("star-gift-pop");
  return pop && !pop.hidden;
}

function closeStarGiftPop() {
  const pop = $("star-gift-pop");
  if (!pop) return;
  pop.hidden = true;
  pop.setAttribute("hidden", "");
  pop.classList.remove("is-open");
}

/**
 * Open spend menu near a star badge (only during live match/friend call).
 * @param {HTMLElement | null} anchor
 */
function openStarGiftPop(anchor) {
  const pop = $("star-gift-pop");
  if (!pop) return;
  if (!matched && !inFriendCall) {
    setStatus(_t("stars.needLive") || "Only during a live chat");
    return;
  }
  if (!primaryPartnerUserId && !lastMatchMeta?.user_id) {
    setStatus(_t("stars.noPartner") || "No partner to gift");
    return;
  }
  try {
    closePartnerMenu();
  } catch (_) {}
  const bal = $("star-gift-bal");
  if (bal) bal.textContent = `★ ${Math.max(0, myStars || 0)}`;
  const hint = $("star-gift-hint");
  if (hint) {
    hint.textContent =
      myStars < STAR_EFFECT_COST
        ? _t("stars.needStars", { n: STAR_EFFECT_COST, have: myStars }) ||
          `Need ${STAR_EFFECT_COST} stars (you have ${myStars})`
        : _t("stars.spendHint") ||
          "Gift the person you’re chatting with. No money — reputation only.";
  }
  ["btn-star-gift-bars", "btn-star-gift-flowers"].forEach((id) => {
    const b = $(id);
    if (b) b.disabled = myStars < STAR_EFFECT_COST;
  });
  pop.hidden = false;
  pop.removeAttribute("hidden");
  pop.classList.add("is-open");
  // Position near badge (or center of partner tile)
  const rect = (anchor || $("local-stars-badge") || $("remote-stars-badge"))?.getBoundingClientRect?.();
  const vw = window.innerWidth || 800;
  const vh = window.innerHeight || 600;
  const pw = Math.min(280, vw - 16);
  let left = rect ? rect.left + rect.width / 2 - pw / 2 : vw / 2 - pw / 2;
  let top = rect ? rect.bottom + 8 : vh / 2 - 80;
  left = Math.max(8, Math.min(left, vw - pw - 8));
  if (top + 220 > vh) {
    top = rect ? Math.max(8, rect.top - 200) : 8;
  }
  pop.style.width = pw + "px";
  pop.style.left = left + "px";
  pop.style.top = top + "px";
  trackEvent("star_gift_pop_open", { stars: myStars || 0 });
}

function wireStarBadgeInteractions() {
  const onBadgeActivate = (which, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const badge = $(which === "local" ? "local-stars-badge" : "remote-stars-badge");
    if (!badge || badge.hidden) return;
    if (matched || inFriendCall) {
      openStarGiftPop(badge);
    }
    // else hover tip alone is enough when idle
  };
  ["local", "remote"].forEach((which) => {
    const badge = $(which === "local" ? "local-stars-badge" : "remote-stars-badge");
    if (!badge || badge.dataset.starWired) return;
    badge.dataset.starWired = "1";
    badge.addEventListener("click", (e) => onBadgeActivate(which, e));
    badge.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") onBadgeActivate(which, e);
    });
  });
  $("btn-star-gift-close")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeStarGiftPop();
  });
  $("btn-star-gift-bars")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeStarGiftPop();
    spendBarsOnPartner();
  });
  $("btn-star-gift-flowers")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeStarGiftPop();
    spendFlowersOnPartner();
  });
  document.addEventListener(
    "click",
    (e) => {
      if (!starGiftPopOpen()) return;
      const pop = $("star-gift-pop");
      if (pop?.contains(e.target)) return;
      if (e.target?.closest?.(".stars-badge")) return;
      closeStarGiftPop();
    },
    true
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && starGiftPopOpen()) closeStarGiftPop();
  });
}

function clearPartnerStarsBadge() {
  partnerStars = 0;
  setStarsBadge("remote", 0);
  try {
    closeStarGiftPop();
  } catch (_) {}
}
/** Keep your ★ visible/clickable during a live chat. */
function refreshLocalStarsVisibility() {
  setStarsBadge("local", myStars);
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
 * @param {string} kind "bars" | "flowers" | ""
 * @param {number} until unix seconds
 */
function setFxOverlay(which, kind, until) {
  const k = String(kind || "").toLowerCase();
  const u = Math.max(0, Number(until) || 0);
  const now = unixNowSec();
  const activeBars = k === "bars" && u > now;
  const activeFlowers = k === "flowers" && u > now;
  const active = activeBars || activeFlowers;

  const bars = $(which === "local" ? "local-fx-bars" : "remote-fx-bars");
  const flowers = $(
    which === "local" ? "local-fx-flowers" : "remote-fx-flowers"
  );
  const barsTimer = $(
    which === "local" ? "local-fx-bars-timer" : "remote-fx-bars-timer"
  );
  const flowersTimer = $(
    which === "local" ? "local-fx-flowers-timer" : "remote-fx-flowers-timer"
  );

  if (which === "local") {
    selfFx = active ? { kind: k, until: u } : null;
  } else {
    partnerFx = active ? { kind: k, until: u } : null;
  }

  const hide = (el, timerEl) => {
    if (el) {
      el.hidden = true;
      el.setAttribute("hidden", "");
    }
    if (timerEl) timerEl.textContent = "";
  };
  const show = (el, timerEl, label) => {
    if (!el) return;
    el.hidden = false;
    el.removeAttribute("hidden");
    // Petals for flowers
    if (el.classList.contains("fx-flowers")) {
      ensureFlowerPetals(el);
    }
    if (timerEl) {
      const left = Math.max(0, u - now);
      timerEl.textContent =
        label +
        (which === "remote" && myStars >= STAR_EFFECT_COST
          ? ` · +${STAR_EFFECT_SECS}s = ${STAR_EFFECT_COST}★`
          : "");
    }
  };

  if (activeBars) {
    hide(flowers, flowersTimer);
    show(
      bars,
      barsTimer,
      _t("stars.barsTimer", { s: Math.max(0, u - now) }) ||
        `🔒 ${Math.max(0, u - now)}s`
    );
  } else if (activeFlowers) {
    hide(bars, barsTimer);
    show(
      flowers,
      flowersTimer,
      _t("stars.flowersTimer", { s: Math.max(0, u - now) }) ||
        `🌸 ${Math.max(0, u - now)}s`
    );
  } else {
    hide(bars, barsTimer);
    hide(flowers, flowersTimer);
  }
  if (active) ensureFxTicker();
}

/** Populate petal nodes once for flower ring animation. */
function ensureFlowerPetals(overlay) {
  const ring = overlay?.querySelector?.(".fx-flowers-ring");
  if (!ring || ring.dataset.ready === "1") return;
  const glyphs = ["🌸", "🌺", "🌼", "💮", "🌹", "🌷", "🌻", "💐"];
  let html = "";
  for (let i = 0; i < 14; i++) {
    const g = glyphs[i % glyphs.length];
    html += `<span class="fx-petal" style="--i:${i}">${g}</span>`;
  }
  ring.innerHTML = html;
  ring.dataset.ready = "1";
}

function clearPartnerFx() {
  setFxOverlay("remote", "", 0);
}

function ensureFxTicker() {
  if (fxTickTimer) return;
  fxTickTimer = setInterval(() => {
    const now = unixNowSec();
    let any = false;
    if (partnerFx && partnerFx.until > now) {
      setFxOverlay("remote", partnerFx.kind, partnerFx.until);
      any = true;
    } else if (partnerFx) {
      setFxOverlay("remote", "", 0);
    }
    if (selfFx && selfFx.until > now) {
      setFxOverlay("local", selfFx.kind, selfFx.until);
      any = true;
    } else if (selfFx) {
      setFxOverlay("local", "", 0);
    }
    if (!any && fxTickTimer) {
      clearInterval(fxTickTimer);
      fxTickTimer = 0;
    }
  }, 1000);
}

/** Spend stars on a partner gift effect (bars / flowers). */
function spendEffectOnPartner(effect) {
  const kind = String(effect || "bars").toLowerCase();
  const uid = primaryPartnerUserId || lastMatchMeta?.user_id || "";
  if (!uid) {
    setStatus(_t("stars.noPartner") || "No partner to gift");
    return;
  }
  if (!matched && !inFriendCall) {
    setStatus(_t("stars.needLive") || "Only during a live chat");
    return;
  }
  if (myStars < STAR_EFFECT_COST) {
    setStatus(
      _t("stars.needStars", { n: STAR_EFFECT_COST, have: myStars }) ||
        `Need ${STAR_EFFECT_COST} stars (you have ${myStars})`
    );
    return;
  }
  trackEvent("star_spend", { effect: kind, cost: STAR_EFFECT_COST });
  send({ type: "spend_stars", to_user_id: uid, effect: kind });
  closePartnerMenu();
}

function spendBarsOnPartner() {
  spendEffectOnPartner("bars");
}
function spendFlowersOnPartner() {
  spendEffectOnPartner("flowers");
}

/**
 * After RatePrompt from hub (chat ≥16 min): give a star or skip.
 * Same pair can only review once (server-enforced).
 */
function showStarReviewPrompt(msg) {
  try {
    const uid = String(msg?.user_id || "").trim();
    if (!uid) return;
    if ($("star-review-toast")) return;
    const name = String(msg?.name || lastMatchMeta?.name || "Partner").trim() || "Partner";
    const mins = Math.max(16, Math.floor((Number(msg?.duration_secs) || STAR_MIN_SECS) / 60));
    const toast = document.createElement("div");
    toast.id = "star-review-toast";
    toast.className = "friend-soft-toast star-review-toast";
    toast.setAttribute("role", "dialog");
    toast.style.pointerEvents = "auto";
    toast.innerHTML = `
      <strong>${escapeHtml(_t("stars.reviewTitle") || "Rate this chat?")}</strong>
      <span>${escapeHtml(
        _t("stars.reviewBody", { name, m: mins }) ||
          `${name} · you talked ${mins}+ min. Give a star?`
      )}</span>
      <div class="export-nudge-actions" style="margin-top:0.45rem">
        <button type="button" class="pill tight ghost" id="btn-star-no">${escapeHtml(
          _t("stars.skip") || "No star"
        )}</button>
        <button type="button" class="pill tight btn-star-yes" id="btn-star-yes">${escapeHtml(
          _t("stars.give") || "★ Star"
        )}</button>
      </div>`;
    document.body.appendChild(toast);
    const dismiss = () => {
      if (toast.parentNode) toast.remove();
    };
    const sendRate = (star) => {
      trackEvent("star_rate", { star: star ? 1 : 0 });
      send({ type: "rate_partner", user_id: uid, star: !!star });
      dismiss();
      setStatus(
        star
          ? _t("stars.given") || "Star given"
          : _t("stars.skipped") || "No star"
      );
    };
    $("btn-star-no")?.addEventListener("click", () => sendRate(false));
    $("btn-star-yes")?.addEventListener("click", () => sendRate(true));
    // Auto-dismiss without rating after 45s (user can only rate while pending on server)
    setTimeout(dismiss, 45000);
  } catch (_) {}
}

function maybeShowPostMatchFriendNudge(reason) {
  try {
    if (matchMode === "friend" || inFriendCall) return;
    // Snapshot before any tear-down clears partner fields
    const code = String(lastMatchMeta?.friend_code || "").toUpperCase();
    const uid = primaryPartnerUserId || lastMatchMeta?.user_id || "";
    // Need a way to send the request
    if (!code && !uid) return;
    // Already friends (or request in flight) — never ask again
    if (isPartnerAlreadyFriend(uid, code) || isPartnerRequestPending(uid, code)) {
      return;
    }
    if (!code) return; // can't add without code
    // Shorter chats still get a soft ask (was 25s — too rare)
    if (matchDurationSec() < 12) return;
    const key = uid || code;
    if (friendNudgeShown.has(key)) return;
    if ($("post-match-friend-nudge")) return;
    friendNudgeShown.add(key);
    const name =
      lastMatchMeta?.name || lastMatchMeta?.short_id || code || "Partner";
    const toast = document.createElement("div");
    toast.id = "post-match-friend-nudge";
    toast.className = "friend-soft-toast post-match-friend-nudge";
    toast.setAttribute("role", "dialog");
    toast.style.pointerEvents = "auto";
    toast.innerHTML = `
      <strong>${escapeHtml(
        _t("friends.postMatchTitle") || "Add as friend?"
      )}</strong>
      <span>${escapeHtml(name)} · ${escapeHtml(
      _t("friends.postMatchBody") ||
        "Request them to Call later when online."
      )}</span>
      <span class="post-match-code mono">${escapeHtml(
        (_t("friends.theirCode") || "Code") + ": " + code
      )}</span>
      <div class="export-nudge-actions" style="margin-top:0.45rem">
        <button type="button" class="pill tight ghost" id="btn-post-friend-no">${escapeHtml(
          _t("friends.postMatchNo") || "No thanks"
        )}</button>
        <button type="button" class="pill tight" id="btn-post-friend-copy">${escapeHtml(
          _t("friends.copyCode") || "Copy code"
        )}</button>
        <button type="button" class="pill tight accent" id="btn-post-friend-yes">${escapeHtml(
          _t("friends.postMatchYes") || "Add friend"
        )}</button>
      </div>`;
    document.body.appendChild(toast);
    const dismiss = () => {
      if (toast.parentNode) toast.remove();
    };
    $("btn-post-friend-no")?.addEventListener("click", () => {
      trackEvent("friend_nudge_dismiss", { reason: reason || "" });
      dismiss();
    });
    $("btn-post-friend-copy")?.addEventListener("click", async () => {
      trackEvent("friend_nudge_copy_code", { reason: reason || "" });
      try {
        await copyToClipboard(code, "friends.codeCopied");
      } catch (_) {
        setStatus(code);
      }
    });
    $("btn-post-friend-yes")?.addEventListener("click", () => {
      trackEvent("friend_nudge_accept", { reason: reason || "" });
      dismiss();
      requestAddFriend(code);
      setStatus(_t("friends.requestSent") || "Friend request sent");
    });
    setTimeout(dismiss, 16000);
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
    if (stopInviteNudgeDone()) return;
    if (matched || inFriendCall || inQueue || wantSearch) return;
    if ($("post-match-friend-nudge") || $("stop-invite-nudge")) return;
    // Only when pool felt empty (alone / quiet)
    const others = Math.max(0, (lastWaitingCount || 0) - 1);
    if (others > 0) return;
    markStopInviteNudgeDone();
    const toast = document.createElement("div");
    toast.id = "stop-invite-nudge";
    toast.className = "friend-soft-toast stop-invite-nudge";
    toast.setAttribute("role", "status");
    toast.style.pointerEvents = "auto";
    const shareBtn = ROOMS_ENABLED
      ? `<button type="button" class="pill tight accent" id="btn-stop-invite-share">${escapeHtml(
          _t("remote.shareRoom") || "Share room"
        )}</button>`
      : "";
    toast.innerHTML = `
      <strong>${escapeHtml(
        _t("remote.stopInviteTitle") || "Bring a friend"
      )}</strong>
      <span>${escapeHtml(
        _t("remote.stopInviteBody") ||
          "Pool was quiet — open Friends to share your code when you want company."
      )}</span>
      <div class="export-nudge-actions" style="margin-top:0.45rem">
        <button type="button" class="pill tight ghost" id="btn-stop-invite-later">${escapeHtml(
          _t("friends.exportNudgeLater") || "Later"
        )}</button>
        <button type="button" class="pill tight${ROOMS_ENABLED ? "" : " accent"}" id="btn-stop-invite-friends">${escapeHtml(
          _t("friends.open") || "Friends"
        )}</button>
        ${shareBtn}
      </div>`;
    document.body.appendChild(toast);
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
    $("btn-stop-invite-share")?.addEventListener("click", () => {
      trackEvent("stop_invite_share");
      dismiss();
      if (!ROOMS_ENABLED) return;
      shareOrCopy(
        roomShareUrl({ mintIfEmpty: true }),
        siteBrandName() + " room",
        "room.shared",
        "room.copied",
        { preferShare: true }
      );
    });
    setTimeout(dismiss, 16000);
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
function sendLiveChat(body, opts = {}) {
  const text = String(body || "").trim().slice(0, 500);
  if (!text) return false;
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
  if (!msg || (msg.type !== "chat" && msg.type !== "friend_chat")) return;
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
  }
  thr.updated = ts;
  thr.title = activeChat.peerName || thr.title;
  thr.peerUserId = activeChat.peerUserId || thr.peerUserId;
  map[activeChat.threadKey] = thr;
  saveChatThreads(map);

  if (isDup) return;

  const box = $("chat-messages");
  if (box) {
    // Keep compact tile panel for live match; inbox handles deeper nav
    if (activeChat.live || activeChat.mode === "match" || activeChat.mode === "history") {
      showChatPanel(true);
    }
    updateChatHeader();
    box.appendChild(renderChatBubbleEl(entry));
    box.scrollTop = box.scrollHeight;
  }
  appendToInboxIfOpen(entry);
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
    // Rematch same person — restore history
    renderThreadToDom(key);
    showChatPanel(true);
  } else {
    clearChatDom();
    showChatPanel(false);
  }
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
    // Unread first, then online, then recent
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    if (a.online !== b.online) return a.online ? -1 : 1;
    return (b.updated || 0) - (a.updated || 0);
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

  // Also mirror to in-tile panel for live match convenience
  renderThreadToDom(threadKey);
  if (live && (mode === "match" || matched)) {
    showChatPanel(true);
  }
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
    if (activeChat.live && activeChat.mode === "match") showChatPanel(true);
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
  const id = "back-online-toast";
  const existing = $(id);
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = id;
  toast.className = "friend-soft-toast friend-soft-toast-ok back-online-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <strong>${escapeHtml(_t("conn.backOnline") || "Back online")}</strong>
    <span>${escapeHtml(
      _t("conn.backOnlineBody") || "Hub reconnected — you can search or call again."
    )}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 4200);
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
let webrtcConnectedOk = false;
let coachShownForMatch = false;

function clearWebrtcWatch() {
  if (webrtcWatchTimer) {
    clearTimeout(webrtcWatchTimer);
    webrtcWatchTimer = 0;
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

function setPreferDirectOnly(on, { silent = false } = {}) {
  savePrefs({ preferDirectOnly: !!on });
  const chk = $("chk-prefer-direct");
  if (chk) chk.checked = !!on;
  if (typeof applyIceDirectPreference === "function") {
    applyIceDirectPreference();
  }
  try {
    syncSettingsSummary?.();
    refreshConnectionDetails?.();
  } catch (_) {}
  if (!silent) {
    setStatus(
      on
        ? _t("settings.preferDirectOnStatus") ||
            "Prefer Direct on — next match uses STUN only"
        : _t("settings.preferDirectOffStatus") ||
            "TURN allowed again on next match"
    );
  }
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
    setTimeout(() => {
      if (matched && !webrtcConnectedOk) {
        hideCallCoach();
        $("btn-next")?.click();
      }
    }, 700);
  }
  return true;
}

function showPreferDirectAutoToast() {
  const id = "prefer-direct-auto-toast";
  const existing = $(id);
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = id;
  toast.className = "weak-conn-tip prefer-direct-auto-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <span>${escapeHtml(
      _t("conn.preferDirectAutoOffBody") ||
        "Direct-only mode couldn’t connect. TURN relay is on again for the next match (you can re-enable Prefer Direct in Settings)."
    )}</span>
    <button type="button" class="pill tight ghost" id="btn-prefer-auto-dismiss">${escapeHtml(
      _t("coach.dismiss") || "Dismiss"
    )}</button>`;
  document.body.appendChild(toast);
  $("btn-prefer-auto-dismiss")?.addEventListener("click", () => toast.remove());
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 10000);
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
  // If no media path after 14s while still matched → coach / Prefer Direct recovery
  webrtcWatchTimer = setTimeout(() => {
    if (!matched || webrtcConnectedOk) return;
    const hasRemote =
      !!$("remote")?.srcObject &&
      ($("remote").srcObject.getTracks?.() || []).some((t) => t.readyState === "live");
    if (!hasRemote) {
      // Prefer Direct stuck: auto-allow TURN + Next (toast). Else open coach.
      if (!autoDisablePreferDirectOnFail({ autoNext: true })) {
        showCallCoach("coach.timeout");
      }
    }
  }, 14000);
}

function handleWebrtcConnectionState(s) {
  setStatus(_t("status.webrtc", { s }));
  if (s === "connected") {
    webrtcConnectedOk = true;
    clearWebrtcWatch();
    hideCallCoach();
    startStats();
    setRemoteEmpty(false);
    ensurePartnerVideoVisible();
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
    // Upgrade match toast once media path is live
    showMatchFoundToast({ connected: true });
    flashPartnerTile();
    // Hide compact "In a call" if ice-path badge is showing
    const liveChip = $("live-compact-chip");
    if (liveChip && $("ice-path") && !$("ice-path").hidden) {
      liveChip.hidden = true;
    }
  } else if (s === "failed") {
    // Prefer Direct ICE fail: auto-allow TURN + soft Next (once/session)
    if (autoDisablePreferDirectOnFail({ autoNext: true })) {
      /* toast + Next scheduled */
    } else {
      showCallCoach("coach.failed");
    }
  } else if (s === "disconnected") {
    setConnStrip("warn", _t("coach.unstable"), "");
  }
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
  stack?.classList.toggle("split", !!on);
  if (v2) v2.hidden = !on;
  if (!on && v2) v2.srcObject = null;
}

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

function enableTrioLayout(on, { searching = false } = {}) {
  trioBrowse = !!on;
  const stage = document.querySelector("main.stage");
  stage?.classList.toggle("stage-trio", !!on);
  stage?.classList.toggle("stage-trio-searching", !!(on && searching));
  const third = $("tile-third");
  if (third) third.hidden = !on;
  const empty = $("third-empty");
  const r3 = $("remote-third");
  if (!on) {
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
  // Brand loop in middle pane while hunting for 3rd (was stuck as static poster)
  if (searching) {
    forceThirdBrandLoop();
    setTimeout(() => forceThirdBrandLoop(), 100);
    setTimeout(() => forceThirdBrandLoop(), 400);
    setTimeout(() => forceThirdBrandLoop(), 1000);
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
 */
function forceThirdBrandLoop() {
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
  // Hide live stranger slot while hunting
  const r3 = $("remote-third");
  if (r3) {
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
  const r3 = $("remote-third");
  const empty = $("third-empty");
  const tag = $("third-tag");
  const wrap = $("third-tile-tag");
  if (stream && r3) {
    prepareVideoEl(r3, { muted: false });
    r3.srcObject = stream;
    r3.hidden = false;
    playVideoEl(r3);
    if (empty) empty.hidden = true;
    syncThirdEmptyBrand(false);
    document.querySelector("main.stage")?.classList.remove("stage-trio-searching");
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
    el.srcObject = stream;
    playVideoEl(el);
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
  el.srcObject = stream || pc.remoteStream || null;
  playVideoEl(el);
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
 * After find-third, server may re-list the same person with a different key style —
 * fall back to the only live stream PC so we never drop the first conversationalist.
 */
function findPcForPeer(peerId) {
  if (peerId && peerPcs.has(peerId)) return peerPcs.get(peerId);
  const entries = [...peerPcs.entries()];
  if (!entries.length) return null;
  const live = entries.filter(([, pc]) =>
    (pc.remoteStream?.getVideoTracks?.() || []).some((t) => t.readyState === "live")
  );
  if (live.length === 1) return live[0][1];
  if (entries.length === 1) return entries[0][1];
  // Prefer anything already marked teammate/friend
  const mate = entries.find(([, pc]) => isTeammateRole(pc._role));
  if (mate) return mate[1];
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
 * Bind first conversationalist (teammate) onto #remote and force video visible.
 * Call on find-third accept and whenever trio layout is active.
 */
function bindFirstPartnerToMain(meta) {
  const remote = $("remote");
  if (!remote) return null;
  const peerId = meta?.peer_id || "";
  let pc = findPcForPeer(peerId);
  if (!pc) {
    // Last resort: any PC with a remote stream
    for (const p of peerPcs.values()) {
      if (p.remoteStream) {
        pc = p;
        break;
      }
    }
  }
  if (!pc) return null;
  if (peerId) rekeyPeerPc(peerId, pc);
  pc._role = "teammate";
  // Detach from friend-pip if still there
  showFriendPip(false);
  bindPcVideo(pc, remote);
  const stream = pc.remoteStream;
  if (stream) {
    prepareVideoEl(remote, { muted: false });
    remote.srcObject = stream;
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
  if (wrap) wrap.hidden = !(tag && (tag.textContent || "").trim());
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
  // Find 3rd: stranger 1v1 only (same rules as partner menu)
  const hasLivePeer =
    peerPcs.size >= 1 ||
    (typeof partnerHasLiveVideo === "function" && partnerHasLiveVideo());
  const canFindThird =
    TRIO_FIND_ENABLED &&
    !!matched &&
    !inFriendCall &&
    matchMode === "solo" &&
    yourRole === "solo" &&
    !trioBrowse &&
    hasLivePeer &&
    findThirdPending !== "out" &&
    findThirdPending !== "in";
  if (findThird) {
    findThird.hidden = !canFindThird;
    findThird.disabled = !canFindThird;
    findThird.classList.toggle("accent", canFindThird);
  }
  if (findCancel) {
    findCancel.hidden = findThirdPending !== "out";
  }
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
  if (preferShare) {
    try {
      if (navigator.share) {
        await navigator.share({
          title: title || brand,
          url,
          text: title || url,
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
  const r = await copyToClipboard(url, okCopyKey);
  trackEvent("share", { via: "copy", key: okCopyKey || "room.copied" });
  return r;
}

function friendInviteUrl() {
  const u = new URL(location.origin + location.pathname);
  if (myFriendCode) u.searchParams.set("friend", myFriendCode);
  const name = getDisplayName();
  if (name && name !== "anon") u.searchParams.set("name", name);
  return u.toString();
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
    setStatus(_t("status.callTimeout"));
    log(_t("friends.noAnswer"));
    if (lastOutgoingCallPeer?.user_id) {
      recordMissedCall({
        ...lastOutgoingCallPeer,
        name: lastOutgoingCallPeer.name || "Friend",
      });
    }
    lastOutgoingCallPeer = null;
  }, 30000);
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
  startSession({ forceMedia: true });
  // User gesture — start partner empty brand loop
  showPartnerEmptyWithBrand({ searching: false });
  // Room invite deep-link: join as soon as gate is done
  setTimeout(() => maybeAutoJoinRoomInvite(), 350);
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
  v.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;display:block!important;opacity:1!important;visibility:visible!important;pointer-events:none;";

  if (!v.getAttribute("src")) {
    v.src = "/brand/loading-screen.mp4?v=4";
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

  // Mobile: friend invite when alone in queue (not room share)
  if (mobile) {
    const showMobileFriend = searchingAlone && !ROOMS_ENABLED;
    mobile.hidden = !showMobileFriend;
    mobile.classList.toggle("is-searching-alone", showMobileFriend);
    const roomBtn = $("btn-mobile-share");
    const friendBtn = $("btn-mobile-invite-friend");
    if (roomBtn) roomBtn.hidden = !ROOMS_ENABLED;
    if (friendBtn) friendBtn.hidden = !showMobileFriend;
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
}

/**
 * While idle/searching: chip strip of online friends (call / open chat).
 */
function updateFriendsOnlineStrip() {
  const strip = $("friends-online-strip");
  const row = $("friends-online-row");
  if (!strip || !row) return;
  const empty = $("remote-empty");
  const emptyOpen =
    !!empty &&
    !empty.classList.contains("hidden") &&
    !matched &&
    !inFriendCall &&
    !trioBrowse;
  const online = (friendsCache || []).filter(
    (f) => f && f.online && f.user_id && f.user_id !== myUserId
  );
  if (!emptyOpen || !online.length) {
    strip.hidden = true;
    row.innerHTML = "";
    return;
  }
  strip.hidden = false;
  row.innerHTML = online
    .slice(0, 8)
    .map((f) => {
      const name = escapeHtml(
        friendDisplayName(f) || f.name || f.short_id || "friend"
      );
      const av =
        isValidAvatarDataUrl(f.avatar) && f.avatar
          ? `<img class="fos-av" src="${escapeAttr(f.avatar)}" alt="" />`
          : `<span class="fos-av fos-av-fallback" aria-hidden="true">${escapeHtml(
              (name || "?").slice(0, 1).toUpperCase()
            )}</span>`;
      return `<button type="button" class="friends-online-chip" data-friend-online="${escapeAttr(
        f.user_id
      )}" title="${escapeAttr(
        _t("friends.call") || "Call"
      )}">${av}<span class="fos-name">${name}</span></button>`;
    })
    .join("");
  row.querySelectorAll("[data-friend-online]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const uid = btn.getAttribute("data-friend-online");
      if (!uid) return;
      trackEvent("friends_online_strip_call");
      placeFriendCall(uid, { closePanel: false });
    });
  });
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
  // Local QR — no third-party image host (works offline once shell is cached)
  if (typeof RuletQr !== "undefined" && RuletQr.render) {
    RuletQr.render(qr, url, { size: 140, margin: 2, alt });
  } else {
    // Fallback if qr.js failed to load
    const src =
      "https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=6&data=" +
      encodeURIComponent(url);
    qr.innerHTML = `<img src="${src}" width="140" height="140" alt="${escapeAttr(
      alt
    )}" loading="lazy" />`;
  }
  qr.hidden = false;
  emptyShareQrMode = mode;
  const btn = $("btn-empty-qr");
  if (btn) {
    btn.textContent = _t("remote.hideQr") || "Hide QR";
  }
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
  // Partner tray: hide compose until searching/matched (calmer empty state)
  const partnerFloor = $("tile-floor-partner");
  if (partnerFloor) {
    partnerFloor.classList.toggle("is-idle", isIdle);
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

/** Set partner-tile title while searching; alone pool → friend-invite sub copy. */
function setSearchingEmptyCopy() {
  const empty = $("remote-empty");
  const titleEl = empty?.querySelector(".empty-title");
  const subEl = empty?.querySelector(".empty-sub") || $("remote-empty-sub");
  const room = currentRoom();
  const alone = isPoolAlone();
  if (titleEl) {
    if (room && ROOMS_ENABLED) {
      titleEl.textContent =
        _t("remote.searchingRoom", { r: room }) ||
        `Waiting in room “${room}”…`;
    } else if (alone) {
      titleEl.textContent =
        _t("remote.aloneInviteTitle") ||
        _t("remote.searchingTitle") ||
        "Looking for a partner…";
    } else {
      titleEl.textContent =
        _t("remote.searchingTitle") || "Looking for a partner…";
    }
  }
  if (subEl) {
    if (alone && (inQueue || wantSearch) && !trioBrowse) {
      subEl.hidden = false;
      subEl.removeAttribute("hidden");
      subEl.textContent =
        _t("friends.aloneInviteBody") ||
        "Few people online. Invite a friend — they add your code, you Accept, then Call.";
    } else {
      subEl.hidden = true;
      subEl.textContent = "";
    }
  }
  updateEmptyAloneActions();
  maybeScheduleAloneSearchCopy();
}

/**
 * Alone in queue: show Invite / Copy code / Friends under Start.
 * Growth path while ROOMS_ENABLED is false.
 */
function updateEmptyAloneActions() {
  const row = $("empty-alone-actions");
  const empty = $("remote-empty");
  const emptyOpen =
    !!empty &&
    !empty.classList.contains("hidden") &&
    !matched &&
    !inFriendCall &&
    !trioBrowse;
  const show =
    emptyOpen &&
    isPoolAlone() &&
    (inQueue || wantSearch) &&
    !trioBrowse;
  if (row) {
    row.hidden = !show;
    if (show) row.removeAttribute("hidden");
    else row.setAttribute("hidden", "");
  }
  document.documentElement.classList.toggle("alone-searching", !!show);
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
  aloneInviteToastShown = false;
  try {
    $("alone-invite-toast")?.remove?.();
    $("people-online-nudge")?.remove?.();
  } catch (_) {}
  trackEvent("start_match");
  maybeShowCellularDataTip();
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

/** Place a friend call (ring). Only mutual friends — never strangers. */
function placeFriendCall(userId, { closePanel = true } = {}) {
  const uid = (userId || "").trim();
  if (!uid) return false;
  if (!isMutualFriend(uid)) {
    clearCallTimeout();
    setStatus(
      _t("friends.callOnlyFriends") ||
        "Only friends can call — add them by code first"
    );
    log(_t("friends.callOnlyFriends") || "only friends can call");
    return false;
  }
  const fr = (friendsCache || []).find((f) => f && f.user_id === uid);
  lastOutgoingCallPeer = {
    user_id: uid,
    name: friendDisplayName(fr) || fr?.name || "",
    friend_code: fr?.friend_code || "",
    short_id: fr?.short_id || "",
  };
  if (!send({ type: "call_friend", user_id: uid })) {
    clearCallTimeout();
    lastOutgoingCallPeer = null;
    setStatus(_t("status.disconnected") || "disconnected — reconnecting…");
    log(_t("status.disconnected") || "not connected");
    return false;
  }
  setStatus(_t("status.calling") || "Calling…");
  startCallTimeout();
  log(_t("status.calling") || "Calling…");
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
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!chimeCtx || chimeCtx.state === "closed") chimeCtx = new AC();
    const ctx = chimeCtx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const tones = [
      { f: 660, t: 0, d: 0.09 },
      { f: 880, t: 0.08, d: 0.12 },
    ];
    for (const { f, t, d } of tones) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.12, now + t + 0.02);
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
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!chimeCtx || chimeCtx.state === "closed") chimeCtx = new AC();
    const ctx = chimeCtx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const tones = [
      { f: 520, t: 0, d: 0.14 },
      { f: 780, t: 0.16, d: 0.16 },
      { f: 520, t: 0.36, d: 0.14 },
    ];
    for (const { f, t, d } of tones) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.14, now + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + d);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + t);
      o.stop(now + t + d + 0.02);
    }
  } catch (_) {}
}

function startIncomingRing(name) {
  stopIncomingRing();
  playRingBurst();
  ringTimer = setInterval(() => {
    if (!incomingCallFrom) {
      stopIncomingRing();
      return;
    }
    playRingBurst();
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
  // System notification if page is hidden
  tryShowCallNotification(name);
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
}

function tryShowCallNotification(name) {
  if (typeof Notification === "undefined") return;
  if (document.visibilityState === "visible") return;
  const show = () => {
    try {
      activeCallNotification = new Notification(_t("friends.incomingNotifTitle"), {
        body: _t("friends.incomingNotifBody", { n: name || "Friend" }),
        tag: "ruletka-friend-call",
        renotify: true,
        silent: false,
      });
      activeCallNotification.onclick = () => {
        window.focus();
        activeCallNotification?.close();
      };
    } catch (_) {}
  };
  if (Notification.permission === "granted") show();
  else if (Notification.permission === "default") {
    Notification.requestPermission().then((p) => {
      if (p === "granted" && incomingCallFrom && document.visibilityState !== "visible") {
        show();
      }
    });
  }
}

/** Never auto-prompt for notifications — only if UI later offers an explicit opt-in. */
function ensureNotifPermissionSoft() {
  // Intentionally empty: pop-up permission nags feel like "stay on the site" pressure.
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

/** Brief soft toast when a match lands / media path is up. */
function showMatchFoundToast(opts = {}) {
  const existing = $("match-found-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "match-found-toast";
  toast.className = "friend-soft-toast friend-soft-toast-ok match-found-toast";
  toast.setAttribute("role", "status");
  const friend = matchMode === "friend" || inFriendCall;
  let title;
  let body = "";
  if (opts.connected) {
    title =
      _t("match.connectedTitle") ||
      (friend ? "Friend call connected" : "Connected");
    const path = ($("ice-path")?.textContent || "").trim();
    body =
      path ||
      _t("match.connectedBody") ||
      (friend ? "Private call · P2P video" : "Video is peer-to-peer");
  } else {
    title =
      _t("match.foundTitle") || (friend ? "Friend connected" : "Partner found");
    body =
      _t("match.foundBody") ||
      (friend ? "Connecting video…" : "Connecting video…");
  }
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(
    body
  )}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, opts.connected ? 2800 : 2200);
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
    el.textContent = _t("sec.pathRelay") || "Relay (TURN)";
    el.classList.add("path-relay");
    el.title =
      _t("sec.pathRelayTitle") ||
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

function fillSelect(sel, devices, kindLabel, prefKey) {
  if (!sel) return;
  const prev = sel.value;
  const prefs = loadPrefs();
  const preferred = prefs[prefKey];
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

  if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
  else if (preferred && [...sel.options].some((o) => o.value === preferred))
    sel.value = preferred;
}

async function refreshDevices() {
  try {
    const { cameras, mics, speakers } = await listMediaDevices();
    fillSelect($("sel-camera"), cameras, _t("device.camera"), "cameraId");
    fillSelect($("sel-mic"), mics, _t("device.mic"), "micId");
    fillSelect($("sel-speaker"), speakers, _t("device.speaker"), "speakerId");
    if (!speakers?.length && $("sel-speaker")) {
      $("sel-speaker").innerHTML = `<option value="">${escapeHtml(
        _t("device.defaultSpeaker")
      )}</option>`;
    }
    const prefs = loadPrefs();
    if (typeof prefs.volume === "number") {
      syncVolumeSliders(prefs.volume);
      applyRemoteVolume();
    }
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
  const v = String(val);
  if ($("remote-vol")) $("remote-vol").value = v;
  if ($("remote-vol-sheet")) $("remote-vol-sheet").value = v;
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
  const local = $("local");
  if (local && previewStream) {
    if (local.srcObject !== previewStream) local.srcObject = previewStream;
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

function setPartnerBlur(on) {
  partnerBlurred = !!on;
  updateSideIcons();
}

function togglePartnerBlur() {
  // User took control — cancel pending auto-unblur
  clearIntroBlurTimer();
  introBlurGen++;
  setPartnerBlur(!partnerBlurred);
  log(partnerBlurred ? _t("log.blurOn") : _t("log.blurOff"));
}

function setSelfBlur(on) {
  selfBlurred = !!on;
  pushOutboundVideoTracks().catch(() => {});
  updateSideIcons();
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
 * Attach a MediaStream to the local preview UI (shared by auto + settings paths).
 */
async function attachLocalStream(stream) {
  // Stop previous tracks
  if (previewStream && previewStream !== stream) {
    previewStream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch (_) {}
    });
  }
  previewStream = stream;
  previewStream.getAudioTracks().forEach((t) => {
    t.enabled = !micMuted;
  });
  previewStream.getVideoTracks().forEach((t) => {
    t.enabled = !camOff; // local preview; outbound privacy via pushOutboundVideoTracks
  });
  const local = $("local");
  if (local) {
    prepareVideoEl(local, { muted: true });
    local.srcObject = previewStream;
    prepareVideoEl(local, { muted: true });
    try {
      await local.play();
    } catch (_) {
      // iOS/Android: retry play after a tick / next gesture
      setTimeout(() => playVideoEl(local), 100);
    }
  }
  showEnableCamButton(false, _t("local.emptySub"));
  setLocalEmpty(false);
  await startMeter(previewStream);
  updateSideIcons();
  // Keep "connected" if socket is already up
  if (ws && ws.readyState === WebSocket.OPEN) {
    /* leave status as connected / whatever the server last said for match */
  } else {
    setStatus(_t("status.previewOn"));
  }
  log(_t("log.previewStart"));
  await resumeMeterCtx();

  const vTrack = previewStream.getVideoTracks()[0];
  const aTrack = previewStream.getAudioTracks()[0];
  const vId = vTrack?.getSettings?.().deviceId || null;
  const aId = aTrack?.getSettings?.().deviceId || null;
  // Persist what actually opened (so next load matches reality)
  const patch = {};
  if (vId) patch.cameraId = vId;
  if (aId) patch.micId = aId;
  if (Object.keys(patch).length) savePrefs(patch);

  for (const pc of peerPcs.values()) {
    pc.setLocalStream(previewStream);
    await pc.syncLocalTracksToPc();
  }
  await pushOutboundVideoTracks();

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

/** Front (`user`) vs rear (`environment`) — only used when starting getUserMedia, not the Reverse button. */
let cameraFacing = "user";
/** When true, do not soft-fallback to the opposite facingMode (mobile device select). */
let facingModeStrict = false;

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
 * Build getUserMedia attempts. Mobile prefers facingMode (front cam).
 * Desktop prefers selected / saved device ids first.
 * Uses Settings → Camera resolution when set.
 */
function buildMediaAttempts(videoDeviceId, audioDeviceId) {
  const audioBase = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
  };
  const { primary: videoHi, fallback: videoMid } = videoSizeForPref(getVideoResolutionPref());
  const attempts = [];
  const mobile = isLikelyMobile();

  // Mobile (and reverse-cam): never use exact desktop deviceIds — OverconstrainedError is common
  if (mobile || facingModeStrict) {
    if (mobile) {
      videoDeviceId = null;
      audioDeviceId = null;
    }
    const face =
      cameraFacing === "environment" ? "environment" : "user";
    const faceAlt = face === "user" ? "environment" : "user";
    // Strict reverse: try exact facing first so front↔back actually switches
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
    // Soft fallbacks only when not reversing (would undo the switch)
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
    // Desktop reverse: continue into deviceId attempts below if facingMode fails
  }

  if (videoDeviceId || audioDeviceId) {
    attempts.push({
      video: videoDeviceId
        ? { deviceId: { exact: videoDeviceId }, ...videoHi }
        : { ...videoHi },
      audio: audioDeviceId
        ? { deviceId: { exact: audioDeviceId }, ...audioBase }
        : audioBase,
    });
    attempts.push({
      video: videoDeviceId
        ? { deviceId: { ideal: videoDeviceId }, ...videoHi }
        : { ...videoHi },
      audio: audioDeviceId
        ? { deviceId: { ideal: audioDeviceId }, ...audioBase }
        : audioBase,
    });
    attempts.push({
      video: videoDeviceId
        ? { deviceId: { ideal: videoDeviceId }, ...videoMid }
        : { ...videoMid },
      audio: audioDeviceId
        ? { deviceId: { ideal: audioDeviceId }, ...audioBase }
        : audioBase,
    });
    if (videoDeviceId) {
      attempts.push({
        video: { deviceId: { ideal: videoDeviceId }, ...videoMid },
        audio: false,
      });
    }
    if (audioDeviceId) {
      attempts.push({
        video: false,
        audio: { deviceId: { ideal: audioDeviceId }, ...audioBase },
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
    // Desktop: restore prefs. Mobile: ignore — deviceIds from another phone/PC break GUM
    if (!mobile) {
      if (!videoDeviceId && prefs.cameraId) videoDeviceId = prefs.cameraId;
      if (!audioDeviceId && prefs.micId) audioDeviceId = prefs.micId;
    } else {
      videoDeviceId = null;
      audioDeviceId = null;
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

    // If we only got one kind, try to add the other
    if (!stream.getVideoTracks().length) {
      try {
        const face =
          cameraFacing === "environment" ? "environment" : "user";
        const vConstraints = mobile
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
          audio: mobile
            ? true
            : audioDeviceId
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
    if (videoDeviceId || audioDeviceId) {
      const gotV = stream.getVideoTracks()[0]?.getSettings?.().deviceId;
      const gotA = stream.getAudioTracks()[0]?.getSettings?.().deviceId;
      if (videoDeviceId && gotV && gotV !== videoDeviceId) {
        log(_t("device.camFallback") || "camera fell back to another device");
      }
      if (audioDeviceId && gotA && gotA !== audioDeviceId) {
        log(_t("device.micFallback") || "mic fell back to another device");
      }
    }
  } catch (e) {
    const name = e?.name || "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      mediaPermissionDenied = true;
    }
    // Clear bad desktop device prefs that poison mobile (if any leaked)
    if (name === "OverconstrainedError" && isLikelyMobile()) {
      try {
        savePrefs({ cameraId: "", micId: "" });
      } catch (_) {}
    }
    log(_t("log.previewFail", { e: (e && (e.message || e.name)) || e }));
    setStatus(_t("status.previewFailed"));
    showEnableCamButton(true, friendlyMediaError(e));
  } finally {
    mediaPreviewBusy = false;
  }
}

function stopPreview() {
  stopMeter();
  if (previewStream) {
    previewStream.getTracks().forEach((tr) => tr.stop());
    previewStream = null;
  }
  $("local").srcObject = null;
  setLocalEmpty(true);
  updateSideIcons();
  log(_t("log.previewStop"));
  setStatus(matched ? _t("status.matchedPreviewOff") : _t("status.previewOff"));
}

function toggleMicMute() {
  micMuted = !micMuted;
  const tracks = previewStream?.getAudioTracks() || [];
  tracks.forEach((tr) => {
    tr.enabled = !micMuted;
  });
  for (const pc of peerPcs.values()) {
    pc.setMicEnabled?.(!micMuted);
  }
  updateSideIcons();
  updateMicPill(0);
  log(micMuted ? _t("log.micMuted") : _t("log.micUnmuted"));
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
  const id = $("sel-speaker")?.value;
  savePrefs({ speakerId: id || null });
  if (id && typeof remote.setSinkId === "function") {
    try {
      await remote.setSinkId(id);
    } catch (e) {
      log(_t("log.speakerFail", { e: e.message || e }));
    }
  }
}

function applyRemoteVolume() {
  const el = $("remote-vol") || $("remote-vol-sheet");
  const vol = Number(el?.value ?? 100);
  syncVolumeSliders(vol);
  savePrefs({ volume: vol });
  for (const id of ["remote", "remote2", "remote-third"]) {
    const remote = $(id);
    if (!remote) continue;
    remote.volume = partnerMuted ? 0 : vol / 100;
    remote.muted = partnerMuted;
  }
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
  syncVolumeSliders(100);
  applyRemoteVolume();
  updateSideIcons();
}

function togglePartnerMute() {
  partnerMuted = !partnerMuted;
  updateSideIcons();
  applyRemoteVolume();
  log(partnerMuted ? _t("log.partnerMuted") : _t("log.partnerUnmuted"));
}

function showSettingsView(name) {
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
  const chk = $("chk-prefer-direct");
  if (!chk) return;
  const prefs = loadPrefs();
  chk.checked = !!prefs.preferDirectOnly;
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
  if (starsEl) {
    starsEl.textContent = `★ ${Math.max(0, Number(myStars) || 0)}`;
  }
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
    const camPart = shortDeviceLabel(cam, 14) || camShort;
    $("settings-devices-summary").textContent =
      res === "auto" ? camPart : `${camPart} · ${res}p`;
  }
  // Safety summary — keep short so it never truncates mid-word
  if ($("settings-safety-summary")) {
    const prefs = loadPrefs();
    const parts = [];
    if (prefs.blurFirst === true) parts.push(_t("settings.sumBlur"));
    if (prefs.nsfwAuto !== false) parts.push(_t("settings.sumNsfw"));
    if (typeof prefs.matchSound === "boolean" ? prefs.matchSound : true) {
      parts.push(_t("settings.sumSound"));
    }
    if (parts.length === 3) {
      $("settings-safety-summary").textContent = _t("settings.sumAllOn") || "All on";
    } else if (parts.length) {
      $("settings-safety-summary").textContent = parts.join(" · ");
    } else {
      $("settings-safety-summary").textContent = _t("settings.sumOff");
    }
  }
  syncMatchPrefsUi();
  syncHubSettingsUi();
  refreshSecurityPanel();
  refreshAvatarUi();
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
        savePrefs({ cameraId: id });
        await startPreview();
      } else if (k === "mic") {
        savePrefs({ micId: id });
        await startPreview();
      } else if (k === "speaker") {
        savePrefs({ speakerId: id });
        applySpeaker();
      }
      showSettingsView("devices");
    });
  });
}

function wireSettingsNav() {
  document.querySelectorAll("[data-settings-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-settings-open");
      if (name) showSettingsView(name);
    });
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
  $("btn-empty-open-friends")?.addEventListener("click", () => {
    trackEvent("empty_alone_open_friends");
    try {
      openFriends();
    } catch (_) {}
  });
  $("btn-empty-copy-code")?.addEventListener("click", async () => {
    trackEvent("empty_alone_copy_code");
    try {
      await shareFriendInvite({ preferShare: false, liveNow: true });
    } catch (_) {}
  });
  $("btn-empty-invite-share")?.addEventListener("click", async () => {
    trackEvent("empty_alone_invite_share");
    try {
      await shareFriendInvite({ preferShare: true, liveNow: true });
    } catch (_) {}
  });
  $("btn-mobile-invite-friend")?.addEventListener("click", async () => {
    trackEvent("mobile_alone_invite_friend");
    try {
      await shareFriendInvite({ preferShare: true, liveNow: true });
    } catch (_) {
      try {
        openFriends();
      } catch (_) {}
    }
  });
  wireStarBadgeInteractions();
  $("btn-settings-done")?.addEventListener("click", () => closeSettings());
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
    $("import-profile-file")?.click();
  });
  $("import-profile-file")?.addEventListener("change", (e) => {
    const f = e.target?.files?.[0];
    if (f) importProfileFile(f);
    e.target.value = "";
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

function loadHistorySafe() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(raw) ? raw.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
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
  return {
    format: PROFILE_FORMAT,
    exported_at: new Date().toISOString(),
    software: "ruletka.vip",
    note:
      "Import this file on another browser/device to keep the same identity. Friends are stored on the hub under user_id — same hub + same user_id restores them automatically. friend_codes help re-request if identity is lost.",
    identity: {
      user_id: id.user_id || myUserId || "",
      name: (id.name || getDisplayName() || "").slice(0, 32),
      friend_code: myFriendCode || "",
    },
    friends: loadFriendsBackup(),
    prefs: loadPrefs(),
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
const EXPORT_NUDGE_RETRY_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const IMPORT_BACKUP_NUDGE_KEY = "ruletka-import-backup-nudge-v1";

function exportNudgeDone() {
  try {
    // Explicit dismiss or successful export
    if (localStorage.getItem(EXPORT_NUDGE_KEY) === "1") return true;
    // Soft: re-show after a few days if they never acted
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

/** Soft one-shot after successful profile import (shown post-reload). */
function maybeShowImportBackupNudge() {
  try {
    if (localStorage.getItem(IMPORT_BACKUP_NUDGE_KEY) !== "1") return;
  } catch {
    return;
  }
  if ($("export-nudge-toast") || $("import-backup-nudge")) return;
  clearImportBackupNudge();
  const toast = document.createElement("div");
  toast.id = "import-backup-nudge";
  toast.className = "export-nudge-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <p>${escapeHtml(
      _t("friends.importBackupNudge") ||
        "Profile imported. Export a fresh backup when you can — keep a copy off this browser."
    )}</p>
    <div class="export-nudge-actions">
      <button type="button" class="pill tight ghost" id="btn-import-nudge-later">${escapeHtml(
        _t("friends.importBackupLater") || "Later"
      )}</button>
      <button type="button" class="pill tight accent" id="btn-import-nudge-now">${escapeHtml(
        _t("friends.importBackupBtn") || "Export now"
      )}</button>
    </div>`;
  document.body.appendChild(toast);
  const dismiss = () => {
    if (toast.parentNode) toast.remove();
  };
  $("btn-import-nudge-later")?.addEventListener("click", dismiss);
  $("btn-import-nudge-now")?.addEventListener("click", () => {
    exportProfileFile();
    dismiss();
  });
  setTimeout(dismiss, 22000);
}

/**
 * Soft toast after first friend / mutual accept.
 * Marks permanent done only on Export or Later — auto-hide can re-show after 3 days.
 */
function maybeShowFirstFriendExportNudge(reason) {
  if (exportNudgeDone()) return;
  if ($("export-nudge-toast") || $("import-backup-nudge") || $("alone-invite-toast"))
    return;
  markExportNudgeShown();
  const toast = document.createElement("div");
  toast.id = "export-nudge-toast";
  toast.className = "export-nudge-toast";
  toast.setAttribute("role", "status");
  toast.style.pointerEvents = "auto";
  toast.innerHTML = `
    <p>${escapeHtml(
      _t("friends.exportNudge") ||
        "Friend added! Export a profile backup so you don’t lose them if this browser is cleared."
    )}</p>
    <div class="export-nudge-actions">
      <button type="button" class="pill tight ghost" id="btn-export-nudge-later">${escapeHtml(
        _t("friends.exportNudgeLater") || "Later"
      )}</button>
      <button type="button" class="pill tight accent" id="btn-export-nudge-now">${escapeHtml(
        _t("friends.exportNudgeBtn") || "Export now"
      )}</button>
    </div>`;
  document.body.appendChild(toast);
  trackEvent("export_nudge_show", { reason: reason || "first_friend" });
  const dismiss = (permanent) => {
    if (permanent) markExportNudgeDone();
    if (toast.parentNode) toast.remove();
  };
  $("btn-export-nudge-later")?.addEventListener("click", () => {
    trackEvent("export_nudge_later");
    dismiss(true);
  });
  $("btn-export-nudge-now")?.addEventListener("click", () => {
    trackEvent("export_nudge_export");
    exportProfileFile();
    dismiss(true);
  });
  // Auto-hide without permanent dismiss — may re-ask after retry window
  setTimeout(() => dismiss(false), 22000);
}

function closeAllFriendMoreMenus() {
  document.querySelectorAll(".friend-more-menu").forEach((m) => {
    m.hidden = true;
  });
  document.querySelectorAll(".btn-friend-more").forEach((b) => {
    b.setAttribute("aria-expanded", "false");
  });
}

function exportProfileFile() {
  try {
    const data = buildProfileExport();
    if (!data.identity.user_id) {
      setStatus(_t("settings.exportNoId") || "No identity yet — open live once first");
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = `ruletka-profile-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    markExportNudgeDone();
    setStatus(_t("settings.exportDone"));
    log(_t("settings.exportDone"));
  } catch (e) {
    setStatus(_t("settings.exportFail") || "Export failed");
    console.warn("[export]", e);
  }
}

async function importProfileFile(file) {
  if (!file) return;
  let data;
  try {
    const text = await file.text();
    data = JSON.parse(text);
  } catch {
    setStatus(_t("settings.importBad") || "Invalid profile file");
    return;
  }
  const uid =
    data?.identity?.user_id ||
    data?.user_id ||
    (typeof data?.identity === "string" ? data.identity : "");
  if (!uid || String(uid).length < 8) {
    setStatus(_t("settings.importBad") || "Invalid profile file");
    return;
  }
  if (data.format && data.format !== PROFILE_FORMAT) {
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
    });
    if (data.prefs && typeof data.prefs === "object") {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(data.prefs));
      } catch (_) {}
    }
    if (Array.isArray(data.history)) {
      try {
        localStorage.setItem(
          HISTORY_KEY,
          JSON.stringify(data.history.slice(0, MAX_HISTORY))
        );
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
    // Restore local friend-code backup for re-request UI
    if (Array.isArray(data.friends) && data.friends.length) {
      saveFriendsBackup(data.friends);
    }
    markImportBackupNudgePending();
    setStatus(_t("settings.importDone"));
    log(_t("settings.importDone") + " → " + String(uid).slice(0, 16));
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
  // Use most of the viewport so Friends / Call history can scroll fully
  return Math.min(vh * 0.88, 720);
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
  // Prefer opening upward for Friends/Settings so we get more vertical room above the dock
  const placeAbove =
    isFriends || isSettings
      ? spaceAbove >= Math.min(preferH * 0.55, 280) || spaceAbove >= spaceBelow
      : spaceAbove >= Math.min(preferH, 240) || spaceAbove >= spaceBelow;
  const maxH = Math.max(
    isFriends || isSettings ? 320 : 160,
    Math.min(preferH, placeAbove ? spaceAbove - DOCK_FLYOUT_GAP : spaceBelow - DOCK_FLYOUT_GAP)
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
    sheet.style.bottom = `${Math.round(vh - rect.top + DOCK_FLYOUT_GAP)}px`;
    sheet.style.transformOrigin = opts.align === "end" ? "bottom right" : opts.align === "start" ? "bottom left" : "bottom center";
  } else {
    sheet.style.bottom = "auto";
    sheet.style.top = `${Math.round(rect.bottom + DOCK_FLYOUT_GAP)}px`;
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
}

function closeAllDockFlyouts(except) {
  if (except !== "settings" && settingsIsOpen()) closeSettings();
  if (except !== "friends" && friendsIsOpen()) closeFriends();
  if (except !== "messages" && messagesIsOpen()) closeMessages();
}

function openSettings() {
  closeAllDockFlyouts("settings");
  const sheet = $("settings-sheet");
  const bd = $("sheet-backdrop");
  const btn = $("btn-settings");
  // Re-apply strings so labels never stick as raw keys
  try {
    NextfaceI18n?.applyI18n?.(sheet || document);
  } catch (_) {}
  // Show main view first so the sheet has content while measuring
  showSettingsView("main");
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
    // Apply pending friend invite from URL
    const invite = new URLSearchParams(location.search).get("friend");
    if (invite) {
      setTimeout(() => {
        if (ws === socket && ws.readyState === WebSocket.OPEN) {
          if (requestAddFriend(invite)) {
            setStatus(_t("friends.inviteAdded") || "Friend request sent from invite link");
          }
          // strip friend param so refresh doesn't re-add noise
          try {
            const u = new URL(location.href);
            u.searchParams.delete("friend");
            history.replaceState(null, "", u.pathname + u.search + u.hash);
          } catch (_) {}
        }
      }, 400);
    }
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
      setStarsBadge("local", myStars);
      // Bars (etc.) persist across logout — re-apply on hello
      setFxOverlay("local", msg.effect || "", Number(msg.effect_until) || 0);
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
        if (msg.friend_code) {
          myFriendCode = msg.friend_code;
          if ($("my-friend-code")) $("my-friend-code").textContent = myFriendCode;
        }
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
      clearCallTimeout();
      if (msg.reason && /declin|no answer|timeout|missed/i.test(msg.reason)) {
        if (lastOutgoingCallPeer?.user_id) {
          recordMissedCall(lastOutgoingCallPeer);
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
      }
      log(msg.reason || "call ended");
      setStatus(msg.reason || "call ended");
      break;
    case "rate_prompt":
      showStarReviewPrompt(msg);
      break;
    case "rate_result":
      {
        const n = Math.max(0, Number(msg.stars) || 0);
        const uid = String(msg.user_id || "");
        if (msg.ok && msg.star && uid && uid === myUserId) {
          // Someone starred us
          myStars = n;
          setStarsBadge("local", myStars);
          syncAccountSettingsSummary();
          setStatus(_t("stars.received") || "You received a star ★");
        } else if (msg.ok && msg.star && uid) {
          // We starred them (or updated their count)
          if (uid === primaryPartnerUserId || uid === lastMatchMeta?.user_id) {
            setStarsBadge("remote", n);
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
        const fromMe =
          String(msg.from_user_id || "") === String(myUserId || "");
        if (msg.ok) {
          if (fromMe) {
            myStars = Math.max(0, Number(msg.spender_stars) || 0);
            setStarsBadge("local", myStars);
            syncAccountSettingsSummary();
            setStatus(_srv(msg.message) || msg.message || "Gift sent");
          }
          if (uid === myUserId) {
            setFxOverlay("local", kind, until);
            if (!fromMe && msg.from_user_id) {
              const name = msg.from_name || "Someone";
              if (kind === "flowers") {
                setStatus(
                  _t("stars.flowersOnYou", { name }) ||
                    `${name} sent you flowers`
                );
              } else {
                setStatus(
                  _t("stars.barsOnYou", { name }) ||
                    `${name} put you behind bars`
                );
              }
            }
          }
          if (
            uid &&
            (uid === primaryPartnerUserId || uid === lastMatchMeta?.user_id)
          ) {
            setFxOverlay("remote", kind, until);
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
            setStarsBadge("local", myStars);
            syncAccountSettingsSummary();
          }
        }
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
          maybeShowPostMatchFriendNudge("partner_left");
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
        // Friend-call failures should cancel the "calling…" timeout UI
        if (
          /friend offline|not friends|only friends can call|friend request|friend is busy|cannot call|caller offline|accept their friend/i.test(
            em
          )
        ) {
          clearCallTimeout();
          hideIncomingCall();
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
  clearCallTimeout();
  clearWaitTipsWatch();
  hideWaitTips();
  clearLongWaitBoost();
  clearWeakConnWatch();
  pathStatRecordedForMatch = false;
  wantSearch = msg.mode !== "friend";
  isOfferer = !!msg.is_offerer;
  matchMode = msg.mode || "solo";
  yourRole = msg.your_role || "solo";
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
    for (const pc of peerPcs.values()) {
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
        stars: Math.max(0, Number(primary.stars) || 0),
      }
    : {
        user_id: "",
        name: msg.partner_short || "",
        short_id: msg.partner_short || "",
        friend_code: "",
        flag: "",
        avatar: "",
        stars: 0,
      };
  partnerStars = lastMatchMeta.stars || 0;
  setStarsBadge("remote", partnerStars);
  setStarsBadge("local", myStars); // show yours so click-to-spend works
  // Partner may already be behind bars from a prior gift
  {
    const p =
      peers.find((x) => x.role === "stranger" && x.user_id) ||
      peers.find((x) => x.user_id) ||
      primary;
    setFxOverlay(
      "remote",
      p?.effect || "",
      Number(p?.effect_until) || 0
    );
  }
  pushHistory({
    kind: matchMode === "friend" ? "friend" : "stranger",
    ...lastMatchMeta,
  });
  // Strangers: 2s intro blur (auto-clear) or permanent if blur-first is on.
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

  // Opponents only (exclude friend/teammate). Cap 2 remotes → 1v1 / 1v2 / 2v2 only.
  const opponents = peers
    .filter((p) => p.role === "stranger" || p.role === "party")
    .slice(0, 2);
  const split = opponents.length >= 2 && !trioBrowse;
  setSplitRemote(split);
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
    if (wrap) wrap.hidden = !(tag && (tag.textContent || "").trim());
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
  trackEvent("match", {
    mode: matchMode || "solo",
    role: yourRole || "solo",
  });

  setTimeout(() => {
    joinPeers(peers)
      .then(() => {
        // Rebind path may not re-fire ontrack — force empty off + play
        ensurePartnerVideoVisible();
      })
      .catch((e) => log(String(e)));
  }, 300);
  // Belt-and-suspenders: clear connecting overlay once streams attach
  setTimeout(() => ensurePartnerVideoVisible(), 1200);
  setTimeout(() => ensurePartnerVideoVisible(), 3000);
}

function handleIncomingSignal(msg) {
  const from = msg.from_peer || "";
  let pc = from ? peerPcs.get(from) : null;
  if (!pc && peerPcs.size === 1) {
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
    if ($("remote")) $("remote").srcObject = null;
    if ($("remote2")) $("remote2").srcObject = null;
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
  for (const [pid, pc] of [...peerPcs.entries()]) {
    const still = list.find((p) => p.peer_id === pid);
    if (still) {
      // Keep connection; update role (stranger → teammate, etc.)
      if (still.role) pc._role = still.role;
      continue;
    }
    if (isTeammateRole(pc._role) && matchMode !== "solo") {
      // Durable co-search / friend link while party-browsing — not after trio→solo collapse
      continue;
    }
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
    setRemoteEmpty(false);
    if (opponents[0]) {
      const opc =
        peerPcs.get(opponents[0].peer_id) || findPcForPeer(opponents[0].peer_id);
      videoSlotsTrioBind(opponents[0], opc);
    } else {
      setThirdSlotStream(null);
    }
  } else {
    setSplitRemote(opponents.length >= 2);
  }

  const videoSlots = new Map();
  if (useTrio && yourRole === "party") {
    if (friendMeta) videoSlots.set(friendMeta.peer_id, $("remote"));
    if (opponents[0]) videoSlots.set(opponents[0].peer_id, $("remote-third") || $("remote2"));
  } else if (opponents.length >= 2) {
    videoSlots.set(opponents[0].peer_id, $("remote"));
    videoSlots.set(opponents[1].peer_id, $("remote2"));
    if ($("remote2")) $("remote2").hidden = false;
  } else if (opponents.length === 1) {
    videoSlots.set(opponents[0].peer_id, $("remote"));
  }

  if (!useTrio && partyBrowsing && yourRole === "party" && friendMeta) {
    // Classic friend party: stranger on main, friend PiP
    const fpc = peerPcs.get(friendMeta.peer_id);
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
      const fpc = peerPcs.get(friendMeta.peer_id);
      if (fpc) bindPcVideo(fpc, $("remote"));
    }
  } else if (!useTrio) {
    showFriendPip(false);
  }

  for (const p of list) {
    // Teammate / friend: always reuse existing media — never tear down & renegotiate
    if (isTeammateRole(p.role)) {
      const existing = findPcForPeer(p.peer_id);
      if (existing) {
        rekeyPeerPc(p.peer_id, existing);
        existing._role = p.role || "teammate";
        const el =
          useTrio && yourRole === "party"
            ? $("remote")
            : partyBrowsing && yourRole === "party" && !useTrio
              ? $("friend-pip")
              : $("remote");
        if (useTrio && yourRole === "party") {
          bindFirstPartnerToMain(p);
        } else {
          bindPcVideo(existing, el);
          if (existing.remoteStream) paintRemoteFromPc(existing, existing.remoteStream);
        }
        continue;
      }
      // No PC yet (shouldn't happen mid find-third) — fall through to create
    }

    if (peerPcs.has(p.peer_id) || findPcForPeer(p.peer_id)) {
      const existing = peerPcs.get(p.peer_id) || findPcForPeer(p.peer_id);
      if (existing && (p.role === "stranger" || p.role === "party")) {
        rekeyPeerPc(p.peer_id, existing);
        const el = videoSlots.get(p.peer_id) || $("remote");
        bindPcVideo(existing, el);
        if (useTrio && yourRole === "party" && (el === $("remote-third") || el?.id === "remote-third")) {
          setThirdSlotStream(existing.remoteStream || null, p.name || "");
        }
      }
      continue;
    }

    // Never open a second PC for a teammate if we already have live media to anyone
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
          paintRemoteFromPc(pc, stream);
          if (
            useTrio &&
            yourRole === "party" &&
            (p.role === "stranger" || p.role === "party")
          ) {
            setThirdSlotStream(stream, p.name || "");
          }
        },
        onConnectionState: (s) => {
          handleWebrtcConnectionState(s);
        },
        onIceConnectionState: (ice) => {
          if (ice === "failed") handleWebrtcConnectionState("failed");
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
    pc.setLocalStream(previewStream);
    peerPcs.set(p.peer_id, pc);
    if (!isTeammateRole(p.role) || !rtc) rtc = pc;
    if (isTeammateRole(p.role) && videoEl === $("friend-pip")) {
      showFriendPip(true);
    }
    try {
      await pc.connect();
      const left = [];
      for (const s of pendingSignals.splice(0)) {
        if (!s.from_peer || s.from_peer === p.peer_id || p.peer_id === "legacy") {
          await pc.handleRemoteSignal(s.kind, s.payload);
        } else {
          left.push(s);
        }
      }
      pendingSignals.push(...left);
    } catch (e) {
      log(_t("log.callFail", { e: e.message || e }));
    }
  }

  if (useTrio && yourRole === "party" && friendMeta) {
    const fpc = peerPcs.get(friendMeta.peer_id);
    if (fpc) {
      bindPcVideo(fpc, $("remote"));
      showFriendPip(false);
    }
    syncLocalPipMirror();
  } else if (partyBrowsing && yourRole === "party" && friendMeta && !useTrio) {
    const fpc = peerPcs.get(friendMeta.peer_id);
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

function stopStats() {
  if (statsTimer) clearInterval(statsTimer);
  statsTimer = 0;
  const el = $("call-quality");
  if (el) {
    el.textContent = "";
    el.className = "quality";
    el.hidden = true;
  }
  clearConnChip();
  clearIcePathBadge();
  lastConnGrade = "";
  lastIceKind = "";
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
  const existing = $("weak-conn-tip");
  if (existing) existing.remove();
  const preferOn =
    typeof preferDirectOnlyEnabled === "function" && preferDirectOnlyEnabled();
  const tip = document.createElement("div");
  tip.id = "weak-conn-tip";
  tip.className = "weak-conn-tip";
  tip.setAttribute("role", "status");
  const body =
    preferOn || iceKind === "relay"
      ? _t("conn.weakTipDirect") ||
        "Connection is weak — try Wi‑Fi, or turn off Prefer Direct in Settings → Connection."
      : _t("conn.weakTip") ||
        "Connection is weak — try Wi‑Fi or move closer to your router.";
  tip.innerHTML = `
    <span>${escapeHtml(body)}</span>
    <button type="button" class="pill tight ghost" id="btn-weak-conn-dismiss">${escapeHtml(
      _t("coach.dismiss") || "Dismiss"
    )}</button>`;
  document.body.appendChild(tip);
  $("btn-weak-conn-dismiss")?.addEventListener("click", () => tip.remove());
  setTimeout(() => {
    if (tip.parentNode) tip.remove();
  }, 12000);
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
  let grade = "ok";
  if (
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
  const label =
    grade === "good"
      ? _t("conn.chipGood") || "Good"
      : grade === "weak"
        ? _t("conn.chipWeak") || "Weak"
        : _t("conn.chipOk") || "OK";

  lastConnGrade = grade;
  chip.hidden = false;
  chip.className = "conn-chip grade-" + grade + (iceKind === "relay" ? " path-relay" : "");
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
        el.hidden = !parts.length;
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
    el.innerHTML = friendsCache
      .map((f) => {
        const online = f.online ? "online" : "";
        const st = f.online ? _t("friends.online") : _t("friends.offline");
        const display = friendDisplayName(f);
        const hasNick = !!(nicks[f.user_id] || "").trim();
        const realName = (f.name || f.short_id || "").toString();
        const callBtn = f.online
          ? `<button type="button" class="pill tight btn-call-friend" data-uid="${escapeAttr(
              f.user_id
            )}">${escapeHtml(_t("friends.call"))}</button>`
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
        return `<div class="friend-row ${online}${unread}">
        ${friendAvatarHtml(f)}
        <span class="dot"></span>
        <div class="meta">
          <strong>${escapeHtml(display)}</strong>${starsChip}
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
  if (!uid) return false;
  const silent = !!opts.silent;
  if (!silent && !confirm(_t("friends.blockConfirm"))) return false;
  send({ type: "block_user", user_id: uid });
  setStatus(_t("friends.blockNeverAgain") || _t("friends.blockOk"));
  log(_t("friends.blockOk"));
  if (!opts.skipToast) {
    showBlockCertaintyToast({
      title: _t("friends.blockOkTitle") || "Blocked",
      body:
        _t("friends.blockNeverAgain") ||
        "You will not match them again. Unblock anytime in Friends.",
    });
  }
  trackEvent("block", { silent: silent ? 1 : 0 });
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
  if (!silent) closeFriends();
  closePartnerMenu();
  return true;
}

function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
  } catch (_) {}
}

/**
 * @param {{ kind: string, name?: string, user_id?: string, friend_code?: string, short_id?: string }} entry
 */
function pushHistory(entry) {
  if (!entry) return;
  const list = loadHistory();
  const row = {
    t: Date.now(),
    kind: entry.kind || "stranger",
    name: (entry.name || entry.short_id || "anon").slice(0, 32),
    user_id: entry.user_id || "",
    friend_code: entry.friend_code || "",
    short_id: entry.short_id || "",
  };
  // Dedupe consecutive same user
  if (
    list[0] &&
    list[0].user_id &&
    row.user_id &&
    list[0].user_id === row.user_id &&
    list[0].kind === row.kind &&
    Date.now() - list[0].t < 60000
  ) {
    list[0] = row;
  } else {
    list.unshift(row);
  }
  saveHistory(list);
  try {
    syncFriendsTabCounts();
    if (friendsSheetTab === "history") renderHistoryList();
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
  // Friends (esp. online) float to the top for quick redial
  list = [...list].sort((a, b) => {
    const aFr = a.user_id && friendIds.has(a.user_id);
    const bFr = b.user_id && friendIds.has(b.user_id);
    const aOn = aFr
      ? !!(friendsCache.find((f) => f.user_id === a.user_id)?.online)
      : false;
    const bOn = bFr
      ? !!(friendsCache.find((f) => f.user_id === b.user_id)?.online)
      : false;
    if (aOn !== bOn) return aOn ? -1 : 1;
    if (aFr !== bFr) return aFr ? -1 : 1;
    return (b.t || 0) - (a.t || 0);
  });
  el.hidden = false;
  const head = `<div class="hint-inline history-head"><strong>${escapeHtml(
    _t("friends.historyTitle") || "Call history"
  )}</strong>
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
        const metaBits = [
          isFriend ? _t("friends.kindFriend") || "Friend" : kindLabel(h.kind),
          formatHistoryTime(h.t),
          dur ? dur : "",
          pathBit,
          gradeBit,
          isFriend && !onlineFriend ? _t("friends.offline") : "",
          onlineFriend ? _t("friends.online") || "Online" : "",
        ]
          .filter(Boolean)
          .join(" · ");
        let actions = "";
        if (onlineFriend) {
          actions = `<button type="button" class="pill tight accent btn-hist-call" data-uid="${escapeAttr(
            h.user_id
          )}">${escapeHtml(_t("friends.redial") || "Call")}</button>`;
        } else if (isFriend && h.user_id) {
          actions = `<button type="button" class="pill tight ghost btn-hist-msg" data-uid="${escapeAttr(
            h.user_id
          )}" data-name="${escapeAttr(display)}">${escapeHtml(
            _t("friends.message") || "Message"
          )}</button>`;
        } else if (h.friend_code && !isFriend) {
          actions = `<button type="button" class="pill tight btn-hist-add" data-code="${escapeAttr(
            h.friend_code
          )}">${escapeHtml(_t("friends.addFromHistory") || "Add")}</button>`;
        }
        return `<div class="friend-row${onlineFriend ? " online" : ""}${
          isFriend ? " is-friend" : ""
        }">
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
  el.querySelectorAll(".btn-hist-call").forEach((btn) => {
    btn.addEventListener("click", () => {
      placeFriendCall(btn.getAttribute("data-uid"));
    });
  });
  el.querySelectorAll(".btn-hist-msg").forEach((btn) => {
    btn.addEventListener("click", () => {
      openFriendChat(btn.getAttribute("data-uid"), {
        name: btn.getAttribute("data-name") || "",
      });
    });
  });
  el.querySelectorAll(".btn-hist-add").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-code");
      if (!code) return;
      requestAddFriend(code);
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
            <span class="friend-wait-badge">${waitLbl}</span>
            <span class="friend-wait-sub">${waitSub}</span>
            <span>${escapeHtml(f.friend_code || "")}</span>
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
  const el = $("match-timer");
  if (el) {
    el.hidden = false;
    el.textContent = "0:00";
  }
  matchTimerInterval = setInterval(() => {
    const el2 = $("match-timer");
    if (!el2 || !matched) return;
    el2.textContent = formatMatchDuration(Date.now() - matchTimerStartedAt);
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
  }
  matchTimerStartedAt = 0;
  const el = $("match-timer");
  if (el) {
    el.hidden = true;
    el.textContent = "0:00";
  }
}

function patchHistoryDuration(userId, secs) {
  if (!userId || secs < 1) return;
  const list = loadHistory();
  const row = list.find((h) => h.user_id === userId);
  if (!row) return;
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

/** Friend came online — toast + optional OS notification + one-tap Call */
function showFriendOnlineToast(f) {
  const name = friendDisplayName(f) || f?.name || f?.friend_code || "Friend";
  const uid = f?.user_id || "";
  const id = "presence-toast";
  const existing = $(id);
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = id;
  toast.className = "presence-toast presence-toast-call";
  toast.setAttribute("role", "status");
  toast.style.pointerEvents = "auto";
  const canCall = !!(uid && f?.online);
  toast.innerHTML = `
    <div class="presence-toast-text">
      <strong>${escapeHtml(name)}</strong>
      <span>${escapeHtml(_t("friends.onlineNow") || "is online")}</span>
    </div>
    ${
      canCall
        ? `<button type="button" class="pill tight accent" id="btn-presence-call">${escapeHtml(
            _t("friends.call") || "Call"
          )}</button>`
        : ""
    }`;
  document.body.appendChild(toast);
  $("btn-presence-call")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toast.remove();
    trackEvent("friend_online_toast_call");
    placeFriendCall(uid, { closePanel: false });
  });
  toast.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    toast.remove();
    openFriends();
  });
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 8000);
  tryShowFriendOnlineNotification(name, uid);
}

function tryShowFriendOnlineNotification(name, uid) {
  if (typeof Notification === "undefined") return;
  if (document.visibilityState === "visible") return;
  const show = () => {
    try {
      const n = new Notification(
        _t("friends.onlineNotifTitle") || "Friend online",
        {
          body: _t("friends.onlineNotifBody", { n: name || "Friend" }) ||
            `${name || "Friend"} is online — open to Call`,
          tag: "ruletka-friend-online-" + (uid || "x"),
          renotify: true,
        }
      );
      n.onclick = () => {
        window.focus();
        n.close();
        if (uid) placeFriendCall(uid, { closePanel: false });
        else openFriends();
      };
    } catch (_) {}
  };
  if (Notification.permission === "granted") show();
  else if (Notification.permission === "default") {
    // Soft: only if user already interacted with Friends (no auto-nag)
  }
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
  tryShowMissedCallNotification(entry?.name || "Friend");
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

  const coarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none), (pointer: coarse)").matches;
  if (coarse) {
    // Always-on via CSS media query
    document.documentElement.classList.add("chrome-always");
    return;
  }
  document.documentElement.classList.add("chrome-autohide");

  /** @type {WeakMap<Element, number>} */
  const hideTimers = new WeakMap();

  const flyoutOpenOn = (tile) => {
    if (!tile) return false;
    if (tile.querySelector?.(".is-flyout-open")) return true;
    if (tile.querySelector?.("#match-more-menu:not([hidden])")) return true;
    // Settings flyout is portaled in body but triggered from local rail
    if (
      tile.id === "tile-local" &&
      $("settings-sheet") &&
      !$("settings-sheet").hidden &&
      $("settings-sheet").classList.contains("is-open")
    ) {
      return true;
    }
    if (
      tile.id === "tile-remote" &&
      (($("friends-sheet") &&
        !$("friends-sheet").hidden &&
        $("friends-sheet").classList.contains("is-open")) ||
        ($("messages-sheet") &&
          !$("messages-sheet").hidden &&
          $("messages-sheet").classList.contains("is-open")))
    ) {
      return true;
    }
    return false;
  };

  const clearHide = (tile) => {
    const t = hideTimers.get(tile);
    if (t) {
      clearTimeout(t);
      hideTimers.delete(tile);
    }
  };

  const scheduleHide = (tile) => {
    if (!tile) return;
    clearHide(tile);
    const id = setTimeout(() => {
      hideTimers.delete(tile);
      if (flyoutOpenOn(tile)) {
        // Keep open while flyout is up; re-check soon
        scheduleHide(tile);
        return;
      }
      tile.classList.remove("is-chrome-open");
    }, CHROME_AUTOHIDE_MS);
    hideTimers.set(tile, id);
  };

  const showChrome = (tile) => {
    if (!tile) return;
    // Only one tile chrome at a time
    if (remote && remote !== tile) {
      remote.classList.remove("is-chrome-open");
      clearHide(remote);
    }
    if (local && local !== tile) {
      local.classList.remove("is-chrome-open");
      clearHide(local);
    }
    tile.classList.add("is-chrome-open");
    scheduleHide(tile);
  };

  const hideChromeSoon = (tile) => {
    if (!tile) return;
    // Short delay so moving between rail buttons doesn't flicker
    clearHide(tile);
    const id = setTimeout(() => {
      hideTimers.delete(tile);
      if (flyoutOpenOn(tile)) {
        scheduleHide(tile);
        return;
      }
      // Still inside tile? keep until full autohide timer from last move
      if (tile.matches?.(":hover")) {
        scheduleHide(tile);
        return;
      }
      tile.classList.remove("is-chrome-open");
    }, 200);
    hideTimers.set(tile, id);
  };

  [remote, local].forEach((tile) => {
    if (!tile) return;
    tile.addEventListener(
      "pointerenter",
      () => {
        showChrome(tile);
      },
      { passive: true }
    );
    tile.addEventListener(
      "pointermove",
      () => {
        // Any movement restarts the 3s clock
        if (!tile.classList.contains("is-chrome-open")) showChrome(tile);
        else scheduleHide(tile);
      },
      { passive: true }
    );
    tile.addEventListener(
      "pointerdown",
      () => {
        showChrome(tile);
      },
      { passive: true }
    );
    tile.addEventListener(
      "pointerleave",
      () => {
        hideChromeSoon(tile);
      },
      { passive: true }
    );
  });

  // Activity on controls also resets timer
  document.addEventListener(
    "pointerdown",
    (e) => {
      const tile = e.target?.closest?.(".tile-remote, .tile-local");
      if (tile) showChrome(tile);
    },
    { passive: true }
  );
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
  const existing = $("friend-sent-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "friend-sent-toast";
  toast.className = "friend-soft-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <strong>${escapeHtml(_t("friends.sentToast") || "Request sent — waiting for them to Accept")}</strong>
    <span>${escapeHtml(code || "")}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 5000);
}

/** Soft toast when mutual friendship completes. */
function showFriendAcceptedToast(f) {
  const existing = $("friend-accepted-toast");
  if (existing) existing.remove();
  const name = friendDisplayName(f) || f?.name || f?.friend_code || "Friend";
  const toast = document.createElement("div");
  toast.id = "friend-accepted-toast";
  toast.className = "friend-soft-toast friend-soft-toast-ok";
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <strong>${escapeHtml(name)}</strong>
    <span>${escapeHtml(
      _t("friends.acceptedToast") || "You’re friends now — Call when they’re online"
    )}</span>`;
  document.body.appendChild(toast);
  try {
    playMatchChime();
  } catch (_) {}
  trackEvent("friend_accepted");
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 6000);
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

  const toast = document.createElement("div");
  toast.id = "call-toast";
  toast.className = "call-toast";
  toast.setAttribute("role", "dialog");
  toast.setAttribute("aria-live", "assertive");
  toast.innerHTML = `
    <div class="call-toast-body">
      <strong id="call-toast-name">${escapeHtml(name)}</strong>
      <span>${escapeHtml(_t("friends.incoming"))}</span>
    </div>
    <div class="call-toast-actions">
      <button type="button" class="pill primary" id="btn-accept-call">${escapeHtml(_t("friends.accept"))}</button>
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
    recordMissedCall({
      name,
      user_id: incomingCallFrom,
      short_id: msg.from_short || "",
      friend_code: msg.from_code || "",
    });
    send({ type: "call_respond", user_id: incomingCallFrom, accept: false });
    hideIncomingCall();
  });

  startIncomingRing(name);
  log(`${name} calling…`);
  setStatus(_t("friends.incoming"));
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

function updatePipButton() {
  const btn = $("btn-pip-remote");
  if (!btn) return;
  const show = pipSupported() && matched && !!$("remote")?.srcObject;
  btn.hidden = !show;
  const active =
    document.pictureInPictureElement &&
    document.pictureInPictureElement === $("remote");
  btn.classList.toggle("is-active", !!active);
  btn.setAttribute(
    "aria-pressed",
    active ? "true" : "false"
  );
  const title = active
    ? _t("btn.pipExit") || "Exit picture-in-picture"
    : _t("btn.pipTitle") || "Picture-in-picture";
  btn.title = title;
  btn.setAttribute("aria-label", title);
}

async function togglePartnerPip({ silent = false } = {}) {
  const v = $("remote");
  if (!v || !pipSupported()) {
    if (!silent) {
      setStatus(_t("btn.pipUnsupported") || "Picture-in-picture not available here");
    }
    return;
  }
  try {
    if (document.pictureInPictureElement === v) {
      await document.exitPictureInPicture();
      trackEvent("pip_exit");
    } else {
      if (!v.srcObject) {
        if (!silent) setStatus(_t("btn.pipNeedVideo") || "Partner video not ready yet");
        return;
      }
      // Ensure video is playing so PiP is allowed
      try {
        v.muted = false;
        const p = v.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch (_) {}
      await v.requestPictureInPicture();
      trackEvent("pip_enter");
      if (!silent) {
        setStatus(_t("btn.pipOn") || "Partner in picture-in-picture");
      }
    }
  } catch (e) {
    if (!silent) {
      setStatus(_t("btn.pipFail") || "Could not open picture-in-picture");
      log("pip: " + (e?.message || e));
    }
  }
  updatePipButton();
}

/** Soft auto-PiP when the tab hides mid-call (Chromium); no-op if blocked. */
function maybeAutoPipOnHide() {
  if (document.visibilityState === "visible") return;
  if (!matched && !inFriendCall) return;
  if (!pipSupported()) return;
  if (document.pictureInPictureElement) return;
  // Prefer-reduced-motion users still get PiP (it's functional, not animation)
  togglePartnerPip({ silent: true });
}

const REPORTS_KEY = "rulet.reports.v1";

function partnerMenuOpen() {
  const menu = $("partner-menu");
  return menu && !menu.hidden;
}

function showPartnerMenuMain() {
  const main = $("partner-menu-main");
  const rep = $("partner-menu-report");
  if (main) {
    main.hidden = false;
    main.removeAttribute("hidden");
  }
  if (rep) {
    rep.hidden = true;
    rep.setAttribute("hidden", "");
  }
  const title = $("partner-menu-title");
  if (title) title.textContent = _t("partnerMenu.title") || "Partner";
}

function showPartnerReportReasons() {
  const main = $("partner-menu-main");
  const rep = $("partner-menu-report");
  if (main) {
    main.hidden = true;
    main.setAttribute("hidden", "");
  }
  if (rep) {
    rep.hidden = false;
    rep.removeAttribute("hidden");
  }
  const title = $("partner-menu-title");
  if (title) title.textContent = _t("partnerMenu.reportNext") || _t("partnerMenu.report") || "Report";
  // 100+ stars → trusted reporter (server weights report as 2)
  const trustedHint = $("partner-menu-trusted-hint");
  if (trustedHint) {
    const trusted = myStars >= 100;
    trustedHint.hidden = !trusted;
    if (trusted) trustedHint.removeAttribute("hidden");
    else trustedHint.setAttribute("hidden", "");
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

  // Find 3rd: same rules as footer button (stranger 1v1)
  const findBtn = $("btn-partner-find-third");
  if (findBtn) {
    const canFind =
      TRIO_FIND_ENABLED &&
      !!matched &&
      !inFriendCall &&
      matchMode === "solo" &&
      yourRole === "solo" &&
      !trioBrowse &&
      !findThirdPending;
    findBtn.hidden = !canFind;
    findBtn.disabled = !canFind;
  }

  // Star gifts (5★ / 30s, extendable)
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
on("btn-restart-cam", "click", async () => {
  endCallKeepPreview();
  stopPreview();
  await startPreview();
});
on("btn-mute-mic", "click", () => toggleMicMute());
// btn-mute-cam removed from DOM — cam on/off feature retired
on("btn-mute-remote", "click", () => togglePartnerMute());
on("btn-blur-remote", "click", () => togglePartnerBlur());
on("btn-blur-self", "click", () => toggleSelfBlur());
on("btn-fs-remote", "click", () => toggleFullscreenPartner());
on("btn-pip-remote", "click", () => togglePartnerPip());
document.addEventListener("enterpictureinpicture", () => updatePipButton());
document.addEventListener("leavepictureinpicture", () => updatePipButton());
on("btn-partner-friend", "click", () => invitePartnerFriend());
on("btn-partner-bars", "click", () => spendBarsOnPartner());
on("btn-partner-flowers", "click", () => spendFlowersOnPartner());
on("btn-partner-find-third", "click", () => {
  closePartnerMenu();
  if (!TRIO_FIND_ENABLED || findThirdPending || !matched) return;
  findThirdPending = "out";
  send({ type: "find_third_invite" });
  setStatus(_t("trio.inviteSent") || "Invite sent — waiting for them…");
  trackEvent("find_third_invite", { via: "partner_menu" });
  updateFriendActionButtons();
});
on("btn-partner-block", "click", () => blockPartnerFromMenu());
on("btn-partner-report", "click", () => showPartnerReportReasons());
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
on("btn-conn-retry", "click", () => manualReconnect());
on("sheet-close", "click", () => closeSettings());
// Backdrop is transparent — click outside flyout closes it (no dim)
on("sheet-backdrop", "click", () => closeSettings());
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
  log("browse together…");
});
on("btn-find-third", "click", () => {
  if (!TRIO_FIND_ENABLED || findThirdPending || !matched) return;
  findThirdPending = "out";
  send({ type: "find_third_invite" });
  setStatus(_t("trio.inviteSent") || "Invite sent — waiting for them…");
  trackEvent("find_third_invite");
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
on("remote-vol-sheet", "input", onVolInput);

on("sel-camera", "change", async () => {
  const id = $("sel-camera")?.value || "";
  if (!id) return;
  savePrefs({ cameraId: id });
  setStatus(_t("device.switchingCam") || "switching camera…");
  await startPreview();
  applyLocalMirrorClass();
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
  savePrefs({ micId: id });
  setStatus(_t("device.switchingMic") || "switching mic…");
  await startPreview();
});
on("sel-speaker", "change", () => {
  const id = $("sel-speaker")?.value || "";
  savePrefs({ speakerId: id || "" });
  applySpeaker();
});
// Partner video click → friend / block / report (fullscreen stays on Full button / F)
$("tile-remote")?.addEventListener("click", (e) => {
  if (e.target.closest(
    ".side-rail, .tile-dock, .chat-panel, .partner-menu, button, a, input, select, textarea, label"
  )) {
    return;
  }
  if (!matched || !primaryPartnerUserId || primaryPartnerUserId === myUserId) return;
  if (partnerMenuOpen()) {
    closePartnerMenu();
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
  setStarsBadge("local", myStars); // hide if 0 when not in call
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
  maybeShowPostMatchFriendNudge("next");
  trackEvent("next");
  send(nextPayload());
  updateConnFromState();
  log(_t("log.next"));
});

/** Stop: leave queue / end stranger match; do not auto-search again. */
function doStopMatchmaking() {
  maybeShowMatchPathSummary("stop");
  maybeShowPostMatchFriendNudge("stop");
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
  let title =
    _t("friends.inviteLiveTitle", { code, brand }) ||
    `${brand} · my code ${code}`;
  if (liveNow || inQueue || wantSearch || matched) {
    title =
      _t("friends.inviteLiveNow", { code, brand }) ||
      `I'm on ${brand} live now — add me with code ${code} then Call when Online`;
  }
  trackEvent("friend_invite_share", {
    preferShare: preferShare ? 1 : 0,
    liveNow: liveNow || inQueue || wantSearch ? 1 : 0,
  });
  await shareOrCopy(url, title, "friends.inviteShared", "friends.inviteCopied", {
    preferShare,
  });
}

function syncFriendsIdentityBanner(hasFriends, recoverableN) {
  const ban = $("friends-identity-banner");
  if (!ban) return;
  // Show when no friends OR we have recoverable codes (likely identity split)
  const show = !hasFriends || recoverableN > 0;
  ban.hidden = !show;
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
$("chk-nsfw-auto")?.addEventListener("change", (e) => {
  const on = !!e.target.checked;
  savePrefs({ nsfwAuto: on });
  if (on && matched && matchMode !== "friend") startNsfwWatch();
  else if (!on) stopNsfwWatch();
  syncSettingsSummary();
});
$("chk-blur-first")?.addEventListener("change", (e) => {
  savePrefs({ blurFirst: !!e.target.checked });
  syncSettingsSummary();
});
$("chk-prefer-direct")?.addEventListener("change", (e) => {
  const on = !!e.target.checked;
  // User explicitly re-enabled — allow future auto-off again after another fail
  if (on) preferDirectAutoOffDone = false;
  setPreferDirectOnly(on, { silent: false });
  log(
    on
      ? "prefer direct P2P (no TURN)"
      : "prefer direct off (TURN allowed)"
  );
});
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
  } else if (e.key === "i" || e.key === "I") {
    e.preventDefault();
    togglePartnerPip();
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
  navigator.mediaDevices.addEventListener("devicechange", () => {
    refreshDevices().catch(() => {});
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
  if ($("chk-nsfw-auto")) {
    $("chk-nsfw-auto").checked = prefs.nsfwAuto !== false;
  }
  if ($("chk-blur-first")) {
    $("chk-blur-first").checked = prefs.blurFirst === true;
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

/** Open cam/mic as soon as possible. */
async function ensurePreview() {
  if (previewStream?.active) return true;
  await startPreview();
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
    if (!rulesAccepted()) return;
    if (previewStream?.active) return;
    // User tap can clear a soft denial; hard denial needs the Enable button
    if (mediaPermissionDenied) return;
    startSession({ forceMedia: true });
  },
  { capture: true, passive: true }
);

on("btn-enable-cam", "click", async (e) => {
  e?.preventDefault?.();
  e?.stopPropagation?.();
  mediaPermissionDenied = false;
  showEnableCamButton(false, _t("local.emptySub"));
  setStatus(_t("status.previewStarting") || "starting camera…");
  try {
    await startPreview();
  } catch (err) {
    log("enable-cam: " + (err?.message || err));
  }
  if (!previewStream?.active) {
    showEnableCamButton(true, _t("local.enableHint"));
  }
});

// Rules gate first (does not block WS forever — session starts after accept or if already ok)
wireRulesGate();
const gateBlocks = showRulesGate();

// Immediate boot — media waits for rules accept if first visit
startSession({ forceMedia: !gateBlocks });
updateEmptyShareVisibility();
updateStartButtonVisibility();
// Soft post-import backup reminder (one shot, not a nag loop)
setTimeout(() => {
  try {
    maybeShowImportBackupNudge();
  } catch (_) {}
}, 900);
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
