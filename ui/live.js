/* global RouletteWebRtc, listMediaDevices, loadRtcConfig, getIceConfig, NextfaceI18n, t */

const $ = (id) => document.getElementById(id);
const PREFS_KEY = "freenet-roulette-media-prefs-v1";

// i18n helpers (fallback if i18n.js missing)
const _t =
  typeof t === "function"
    ? t
    : (k) => k;
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

/** @typedef {"dark"|"light"|"saloon"} UiTheme */
const THEME_IDS = ["dark", "light", "saloon"];
const THEME_META = {
  dark: { color: "#0a0b0e", labelKey: "settings.themeDark", fallback: "Dark" },
  light: { color: "#f4f6fa", labelKey: "settings.themeLight", fallback: "Light" },
  saloon: { color: "#1a1008", labelKey: "settings.themeSaloon", fallback: "Saloon" },
};
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
  document.documentElement.style.colorScheme = id === "light" ? "light" : "dark";
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
      id === "light" ? "#i-sun" : id === "saloon" ? "#i-star" : "#i-moon";
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
let intentionalClose = false;
let reconnectAttempt = 0;
let reconnectTimer = 0;
let pingTimer = 0;
let statsTimer = 0;
let micMuted = false;
let camOff = false;
let partnerMuted = false;
/** Manual blur of partner video */
let partnerBlurred = false;
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
/** Last lobby waiting count for pool hint */
let lastWaitingCount = 0;
const RULES_KEY = "nextface-rules-v1";
const HISTORY_KEY = "nextface-history-v1";
const MAX_HISTORY = 40;
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
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["NZ", "New Zealand"],
  ["IE", "Ireland"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["ES", "Spain"],
  ["IT", "Italy"],
  ["PT", "Portugal"],
  ["NL", "Netherlands"],
  ["BE", "Belgium"],
  ["CH", "Switzerland"],
  ["AT", "Austria"],
  ["SE", "Sweden"],
  ["NO", "Norway"],
  ["DK", "Denmark"],
  ["FI", "Finland"],
  ["PL", "Poland"],
  ["CZ", "Czechia"],
  ["SK", "Slovakia"],
  ["HU", "Hungary"],
  ["RO", "Romania"],
  ["BG", "Bulgaria"],
  ["GR", "Greece"],
  ["TR", "Türkiye"],
  ["UA", "Ukraine"],
  ["RU", "Russia"],
  ["BY", "Belarus"],
  ["KZ", "Kazakhstan"],
  ["UZ", "Uzbekistan"],
  ["GE", "Georgia"],
  ["AM", "Armenia"],
  ["AZ", "Azerbaijan"],
  ["IL", "Israel"],
  ["SA", "Saudi Arabia"],
  ["AE", "United Arab Emirates"],
  ["EG", "Egypt"],
  ["MA", "Morocco"],
  ["ZA", "South Africa"],
  ["NG", "Nigeria"],
  ["KE", "Kenya"],
  ["IN", "India"],
  ["PK", "Pakistan"],
  ["BD", "Bangladesh"],
  ["LK", "Sri Lanka"],
  ["CN", "China"],
  ["TW", "Taiwan"],
  ["HK", "Hong Kong"],
  ["JP", "Japan"],
  ["KR", "South Korea"],
  ["VN", "Vietnam"],
  ["TH", "Thailand"],
  ["ID", "Indonesia"],
  ["MY", "Malaysia"],
  ["PH", "Philippines"],
  ["SG", "Singapore"],
  ["BR", "Brazil"],
  ["MX", "Mexico"],
  ["AR", "Argentina"],
  ["CL", "Chile"],
  ["CO", "Colombia"],
  ["PE", "Peru"],
  ["VE", "Venezuela"],
  ["CU", "Cuba"],
  ["PR", "Puerto Rico"],
  ["EU", "European Union"],
];

function normalizeFlagCode(raw) {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
  if (s.length !== 2) return "";
  if (s === "EU") return "EU"; // regional / pseudo — still cosmetic
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

function refreshLocalNameChip() {
  const tile = $("local-name");
  if (tile) tile.textContent = formatNameWithFlag(getDisplayName(), getFlag());
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

function matchPrefs() {
  const p = loadPrefs();
  const gender = ["man", "woman", "other"].includes(p.gender) ? p.gender : "";
  const looking = ["man", "woman", "any"].includes(p.looking) ? p.looking : "any";
  const flag = normalizeFlagCode(p.flag);
  const avatar = isValidAvatarDataUrl(p.avatar) ? p.avatar : "";
  return { gender, looking, flag, avatar };
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
  });
}

function renderFlagPickerList(filter = "") {
  const list = $("settings-flag-list");
  if (!list) return;
  const q = String(filter || "").trim().toLowerCase();
  const cur = getFlag();
  const rows = FLAG_OPTIONS.filter(([code, name]) => {
    if (!q) return true;
    if (!code && ("none".includes(q) || "no flag".includes(q) || "без".includes(q)))
      return true;
    return (
      code.toLowerCase().includes(q) ||
      name.toLowerCase().includes(q) ||
      flagEmoji(code).includes(q)
    );
  });
  list.innerHTML = rows
    .map(([code, name]) => {
      const em = code ? flagEmoji(code) : "🏳️";
      const selected = (code || "") === (cur || "");
      const label = code ? `${em} ${name}` : _t("flag.none") || name;
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
  const { gender, looking } = matchPrefs();
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
  if ($("settings-match-summary")) {
    $("settings-match-summary").textContent =
      prefsLabel("looking", looking) +
      (gender ? " · " + prefsLabel("gender", gender) : "");
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
    appendChatBubble(line, cls);
  } else {
    console.log(`[ruletka.vip]`, line);
  }
}

function showChatPanel(show) {
  const panel = $("chat-panel");
  if (!panel) return;
  panel.hidden = !show;
}

function clearChat() {
  const box = $("chat-messages");
  if (box) box.innerHTML = "";
}

function appendChatBubble(text, cls) {
  const box = $("chat-messages");
  if (!box) return;
  showChatPanel(true);
  // Parse "[author] body" if present
  let who = "";
  let body = text;
  const m = /^\[([^\]]+)\]\s*(.*)$/s.exec(text);
  if (m) {
    who = m[1];
    body = m[2];
  }
  const d = document.createElement("div");
  d.className = "chat-bubble " + (cls === "mine" ? "mine" : cls === "theirs" ? "theirs" : "sys");
  if (who) {
    const w = document.createElement("span");
    w.className = "who";
    w.textContent = who;
    d.appendChild(w);
  }
  d.appendChild(document.createTextNode(body));
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
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
  strip.classList.remove("ok", "warn", "bad", "call", "idle");
  if (kind) strip.classList.add(kind);
  // Hide the strip when idle-connected (no status text to show)
  const hide = kind === "idle" || (kind === "ok" && !label);
  strip.hidden = !!hide;
  strip.setAttribute("aria-hidden", hide ? "true" : "false");
}

function updateConnFromState() {
  // No STUN/TURN ice line on the page
  if (!ws || ws.readyState === WebSocket.CONNECTING) {
    setConnStrip("warn", _t("conn.connecting"), "");
    return;
  }
  if (ws.readyState !== WebSocket.OPEN) {
    const retrying = reconnectTimer || reconnectAttempt > 0;
    setConnStrip(
      "bad",
      retrying
        ? _t("conn.retrying") || _t("conn.disconnected")
        : _t("conn.disconnected"),
      "",
      { showRetry: true }
    );
    return;
  }
  if (matchMode === "friend" || (inFriendCall && matchMode !== "party_browse")) {
    setConnStrip("call", _t("conn.friend"), "");
    return;
  }
  if (matchMode === "party_browse" && yourRole === "party") {
    setConnStrip("call", _t("conn.party"), "");
    return;
  }
  if (matched) {
    setConnStrip("call", _t("conn.matched"), "");
    return;
  }
  const phase = $("phase")?.className || "";
  if (phase.includes("waiting")) {
    setConnStrip("warn", _t("conn.searching"), "");
    return;
  }
  // Connected and idle — hide strip (no "Connected — ready" clutter)
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
}

function showCallCoach(reasonKey) {
  if (coachShownForMatch && $("call-coach") && !$("call-coach").hidden) return;
  coachShownForMatch = true;
  const el = $("call-coach");
  if (!el) return;
  const lead = $("call-coach-lead");
  if (lead) {
    lead.textContent = _t(reasonKey || "coach.lead");
  }
  const meta = $("call-coach-meta");
  if (meta) {
    const turn =
      window.__hasTurn || window.__iceMeta?.has_turn
        ? _t("coach.metaTurnOn")
        : _t("coach.metaTurnOff");
    const path = $("ice-path")?.textContent || "";
    meta.textContent = [turn, path].filter(Boolean).join(" · ");
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
  // If no media path after 14s while still matched → coach
  webrtcWatchTimer = setTimeout(() => {
    if (!matched || webrtcConnectedOk) return;
    const hasRemote =
      !!$("remote")?.srcObject &&
      ($("remote").srcObject.getTracks?.() || []).some((t) => t.readyState === "live");
    if (!hasRemote) {
      showCallCoach("coach.timeout");
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
    setArchPill("p2p");
    setConnStrip("call", _t("conn.matched"), "");
  } else if (s === "failed") {
    showCallCoach("coach.failed");
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
  el.textContent = label;
  el.className = "phase " + p;
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
}

function setSplitRemote(on) {
  const stack = $("remote-stack");
  const v2 = $("remote2");
  stack?.classList.toggle("split", !!on);
  if (v2) v2.hidden = !on;
  if (!on && v2) v2.srcObject = null;
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
 * Bind a peer connection’s remote stream to a video element (or detach).
 * Fixes party-browse: friend used to own #remote and blocked the stranger feed.
 */
function bindPcVideo(pc, el) {
  if (!pc) return;
  pc._videoEl = el || null;
  const stream = pc.remoteStream;
  if (el && stream) {
    el.srcObject = stream;
    try {
      const p = el.play?.();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) {}
  }
}

function paintRemoteFromPc(pc, stream) {
  const el = pc?._videoEl;
  if (!el) return;
  el.srcObject = stream || pc.remoteStream || null;
  try {
    const p = el.play?.();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (_) {}
  // Main partner tile only — not friend PiP
  if (el.id === "remote" || el.id === "remote2") {
    setRemoteEmpty(false);
    applyRemoteVolume();
    applySpeaker();
  }
}

/** After stranger leaves, put friend back on the main remote tile. */
function reattachFriendToMainRemote() {
  showFriendPip(false);
  setSplitRemote(false);
  for (const pc of peerPcs.values()) {
    if (pc._role !== "friend") continue;
    bindPcVideo(pc, $("remote"));
    if (pc.remoteStream) {
      paintRemoteFromPc(pc, pc.remoteStream);
    }
  }
}

function updateFriendActionButtons() {
  const browse = $("btn-browse-together");
  const hang = $("btn-hangup-friend");
  const block = $("btn-block");
  if (browse) browse.hidden = !inFriendCall || matchMode === "party_browse";
  if (hang) hang.hidden = !inFriendCall && matchMode !== "friend";
  if (inFriendCall && matchMode === "friend") {
    if (browse) browse.hidden = false;
    if (hang) hang.hidden = false;
  }
  if (matchMode === "party_browse" && yourRole === "party") {
    if (browse) browse.hidden = true;
    if (hang) hang.hidden = false;
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
  updatePartnerClickable();
}

function setStatus(s) {
  $("status").textContent = s;
}

function setPool({ online, waiting, offers, room }) {
  if (online != null && $("stat-online")) $("stat-online").textContent = String(online);
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
}

function updateRoomChip(room) {
  const chip = $("room-chip");
  const label = $("room-chip-label");
  if (!chip) return;
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
  const others = Math.max(0, n - 1);
  const room = (currentRoom() || "").trim();
  if (room) {
    if (others > 0) {
      hint.textContent = _t("pool.roomOthers", { n: others, r: room });
    } else if (inQueue || wantSearch) {
      hint.textContent = _t("pool.roomAlone", { r: room });
    } else {
      hint.textContent = "";
    }
  } else if (others > 0) {
    hint.textContent = _t("pool.othersWaiting", { n: others });
  } else if (inQueue || wantSearch) {
    hint.textContent = _t("pool.alone");
  } else {
    hint.textContent = "";
  }
  hint.hidden = !hint.textContent;
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
async function shareOrCopy(url, title, okShareKey, okCopyKey, opts) {
  const preferShare = !opts || opts.preferShare !== false;
  if (preferShare) {
    try {
      if (navigator.share) {
        await navigator.share({
          title: title || "ruletka.vip",
          url,
          text: title || url,
        });
        setStatus(_t(okShareKey || "room.shared"));
        log(_t(okShareKey || "room.shared") + ": " + url);
        return "share";
      }
    } catch (e) {
      if (e && (e.name === "AbortError" || e.name === "NotAllowedError"))
        return "cancel";
    }
  }
  return copyToClipboard(url, okCopyKey);
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

function startCallTimeout() {
  clearCallTimeout();
  callTimeoutTimer = setTimeout(() => {
    callTimeoutTimer = 0;
    setStatus(_t("status.callTimeout"));
    log(_t("friends.noAnswer"));
  }, 30000);
}

function rulesAccepted() {
  try {
    return localStorage.getItem(RULES_KEY) === "1";
  } catch {
    return false;
  }
}

function showRulesGate() {
  const ov = $("rules-overlay");
  if (!ov || rulesAccepted()) return false;
  ov.hidden = false;
  const chk = $("chk-rules-age");
  const btn = $("btn-rules-accept");
  if (chk) chk.checked = false;
  if (btn) btn.disabled = true;
  return true;
}

function wireRulesGate() {
  const chk = $("chk-rules-age");
  const btn = $("btn-rules-accept");
  const ov = $("rules-overlay");
  if (!ov) return;
  chk?.addEventListener("change", () => {
    if (btn) btn.disabled = !chk.checked;
  });
  btn?.addEventListener("click", () => {
    if (!chk?.checked) return;
    try {
      localStorage.setItem(RULES_KEY, "1");
    } catch (_) {}
    ov.hidden = true;
    startSession({ forceMedia: true });
  });
  if (!rulesAccepted()) {
    ov.hidden = false;
    if (btn) btn.disabled = true;
  }
}

function setLocalEmpty(show) {
  $("local-empty")?.classList.toggle("hidden", !show);
}
function setRemoteEmpty(show) {
  $("remote-empty")?.classList.toggle("hidden", !show);
  // Hide partner name chip when no one is connected
  if (show) {
    const wrap = $("remote-tile-tag");
    const tag = $("remote-tag");
    if (wrap) wrap.hidden = true;
    if (tag) tag.textContent = "";
    setTileAvatar("remote", "");
  }
  // Loop brand loading video only while partner slot is empty
  const v = $("remote-empty-video");
  if (v) {
    if (show) {
      try {
        v.muted = true;
        const p = v.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch (_) {}
    } else {
      try {
        v.pause();
      } catch (_) {}
    }
  }
}

function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function currentRoom() {
  return ($("room")?.value || $("room-settings")?.value || "").trim();
}

function syncRoomInputs(value) {
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

function roomShareUrl() {
  const u = new URL(location.origin + location.pathname);
  const room = currentRoom();
  if (room) u.searchParams.set("room", room);
  const lang = NextfaceI18n?.getLang?.();
  if (lang && lang !== "en") u.searchParams.set("lang", lang);
  return u.toString();
}

async function copyRoomLink() {
  const url = roomShareUrl();
  try {
    await shareOrCopy(url, "ruletka.vip room", "room.shared", "room.copied");
  } catch (e) {
    log(_t("room.copyFail") + ": " + url);
  }
}

function matchSoundEnabled() {
  const prefs = loadPrefs();
  if (typeof prefs.matchSound === "boolean") return prefs.matchSound;
  return true;
}

/** Short dual-tone chime (no asset files). */
function playMatchChime() {
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

function ensureNotifPermissionSoft() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "default") return;
  // Only prompt once after user opens friends (user gesture path)
  try {
    if (sessionStorage.getItem("rulet-notif-asked")) return;
    sessionStorage.setItem("rulet-notif-asked", "1");
  } catch (_) {}
  Notification.requestPermission().catch(() => {});
}

function flashPartnerTile() {
  const tile = $("tile-remote");
  if (!tile) return;
  tile.classList.remove("match-flash");
  // reflow to restart animation
  void tile.offsetWidth;
  tile.classList.add("match-flash");
  setTimeout(() => tile.classList.remove("match-flash"), 900);
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

function setIcePathBadge(kind) {
  const el = $("ice-path");
  if (!el) return;
  el.hidden = false;
  el.classList.remove("path-direct", "path-relay", "path-unknown");
  if (kind === "direct") {
    el.textContent = _t("sec.pathDirect");
    el.classList.add("path-direct");
    el.title = _t("sec.pathDirectTitle");
    setArchPill("direct");
  } else if (kind === "relay") {
    el.textContent = _t("sec.pathRelay");
    el.classList.add("path-relay");
    el.title = _t("sec.pathRelayTitle");
    setArchPill("relay");
  } else {
    el.textContent = _t("sec.pathUnknown");
    el.classList.add("path-unknown");
    el.title = _t("sec.pathUnknownTitle");
  }
}

function clearIcePathBadge() {
  const el = $("ice-path");
  if (el) {
    el.hidden = true;
    el.textContent = "";
    el.classList.remove("path-direct", "path-relay", "path-unknown");
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
        live || _t("sec.pathUnknownShort") || _t("sec.pathUnknown");
    } else {
      pathEl.textContent = _t("sec.mediaP2pShort") || _t("sec.mediaP2p");
    }
  }
  if (turnEl) {
    const trust = meta?.security?.turn_trust || "";
    if (trust === "open_relay_demo")
      turnEl.textContent = _t("sec.turnOpenShort") || _t("sec.turnOpen");
    else if (trust === "self_hosted_ephemeral")
      turnEl.textContent = _t("sec.turnEphemeralShort") || _t("sec.turnEphemeral");
    else if (trust === "self_hosted_static")
      turnEl.textContent = _t("sec.turnStaticShort") || _t("sec.turnStatic");
    else if (trust === "no_turn")
      turnEl.textContent = _t("sec.turnNoneShort") || _t("sec.turnNone");
    else if (meta?.has_turn)
      turnEl.textContent = _t("sec.turnOnShort") || _t("sec.turnOn");
    else turnEl.textContent = _t("sec.turnNoneShort") || _t("sec.turnNone");
  }
  if (idEl) {
    const idn = loadIdentity();
    const cryptoOn = !!idn.cryptoBound || String(idn.user_id || "").startsWith("k");
    idEl.textContent = cryptoOn ? _t("sec.idCrypto") : _t("sec.idLegacy");
  }
  if (noteEl)
    noteEl.textContent = _t("sec.partnerRecordShort") || _t("sec.partnerRecord");
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
  $("btn-mute-mic")?.classList.toggle("muted-on", micMuted);
  $("btn-mute-cam")?.classList.toggle("muted-on", camOff);
  $("btn-mute-remote")?.classList.toggle("muted-on", partnerMuted);
  $("btn-blur-remote")?.classList.toggle("active", partnerBlurred);
  $("tile-remote")?.classList.toggle("partner-blurred", partnerBlurred);
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
    t.enabled = !camOff;
  });
  const local = $("local");
  if (local) {
    local.srcObject = previewStream;
    local.muted = true;
    local.defaultMuted = true;
    local.playsInline = true;
    local.setAttribute("playsinline", "");
    local.setAttribute("webkit-playsinline", "");
    local.setAttribute("muted", "");
    try {
      await local.play();
    } catch (_) {
      // Android: retry play after a tick
      setTimeout(() => {
        local.play?.().catch(() => {});
      }, 100);
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

/**
 * Build getUserMedia attempts. Mobile prefers facingMode (front cam).
 * Desktop prefers selected / saved device ids first.
 */
function buildMediaAttempts(videoDeviceId, audioDeviceId) {
  const audioBase = { echoCancellation: true, noiseSuppression: true };
  const attempts = [];
  const mobile = isLikelyMobile();

  // Mobile: never use exact desktop deviceIds — OverconstrainedError is common
  if (mobile) {
    videoDeviceId = null;
    audioDeviceId = null;
    attempts.push({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: audioBase,
    });
    attempts.push({
      video: { facingMode: { ideal: "user" } },
      audio: true,
    });
    attempts.push({ video: true, audio: true });
    attempts.push({ video: { facingMode: "user" }, audio: false });
    attempts.push({ video: true, audio: false });
    attempts.push({ video: false, audio: audioBase });
    return attempts;
  }

  if (videoDeviceId || audioDeviceId) {
    attempts.push({
      video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
      audio: audioDeviceId
        ? { deviceId: { exact: audioDeviceId }, ...audioBase }
        : audioBase,
    });
    attempts.push({
      video: videoDeviceId ? { deviceId: { ideal: videoDeviceId } } : true,
      audio: audioDeviceId
        ? { deviceId: { ideal: audioDeviceId }, ...audioBase }
        : audioBase,
    });
    if (videoDeviceId) {
      attempts.push({
        video: { deviceId: { ideal: videoDeviceId } },
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
  // Cold start / fallback
  attempts.push({ video: true, audio: audioBase });
  attempts.push({ video: true, audio: true });
  attempts.push({ video: true, audio: false });
  attempts.push({ video: false, audio: audioBase });
  return attempts;
}

/** After permission denied, stop auto-retry spam (Android locks up). */
let mediaPermissionDenied = false;
let mediaPreviewBusy = false;

function showEnableCamButton(show, message) {
  const btn = $("btn-enable-cam");
  const sub = $("local-empty-sub");
  if (btn) btn.hidden = !show;
  if (sub && message) sub.textContent = message;
  if (show) setLocalEmpty(true);
}

function friendlyMediaError(e) {
  const name = e?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return _t("local.permDenied");
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return _t("local.noDevice");
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return _t("local.camBusy");
  }
  if (name === "OverconstrainedError") {
    return _t("local.camConstraints");
  }
  return _t("local.enableHint");
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
        const vConstraints = mobile
          ? { video: { facingMode: "user" }, audio: false }
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

function toggleCam() {
  camOff = !camOff;
  const tracks = previewStream?.getVideoTracks() || [];
  tracks.forEach((tr) => {
    tr.enabled = !camOff;
  });
  for (const pc of peerPcs.values()) {
    pc.setCamEnabled?.(!camOff);
  }
  updateSideIcons();
  log(camOff ? _t("log.camOff") : _t("log.camOn"));
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
  for (const id of ["remote", "remote2"]) {
    const remote = $(id);
    if (!remote) continue;
    remote.volume = partnerMuted ? 0 : vol / 100;
    remote.muted = partnerMuted;
  }
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
    listEl.innerHTML = "";
    for (const h of hubs.slice(0, 12)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "settings-row settings-choice" + (h.base === cur ? " is-selected" : "");
      btn.innerHTML = `<span class="row-left"><span class="row-ico" aria-hidden="true"><svg class="icon icon-sm"><use href="#i-globe"/></svg></span><span>${shortHubLabel(
        h.base,
        36
      )}</span></span><span class="choice-check">${h.base === cur ? "✓" : ""}</span>`;
      btn.addEventListener("click", async () => {
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
  if ($("settings-mic-value")) {
    $("settings-mic-value").textContent = micShort;
  }
  if ($("settings-speaker-value")) {
    $("settings-speaker-value").textContent = spkShort;
  }
  if ($("settings-devices-summary")) {
    $("settings-devices-summary").textContent = shortDeviceLabel(cam, 16) || camShort;
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
        viewId === "settings-view-speaker"
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
  refreshLocalNameChip();
  $("btn-settings-done")?.addEventListener("click", () => closeSettings());
  $("btn-export-profile")?.addEventListener("click", () => exportProfileFile());
  $("btn-import-profile")?.addEventListener("click", () => {
    $("import-profile-file")?.click();
  });
  $("import-profile-file")?.addEventListener("change", (e) => {
    const f = e.target?.files?.[0];
    if (f) importProfileFile(f);
    e.target.value = "";
  });
  $("btn-clear-local")?.addEventListener("click", async () => {
    if (!confirm(_t("settings.clearConfirm"))) return;
    try {
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
      "Import this file on another browser/device to keep the same identity. Friends are stored on each hub under user_id — reconnect to the same hub to restore friends.",
    identity: {
      user_id: id.user_id || "",
      name: (id.name || getDisplayName() || "").slice(0, 32),
      friend_code: myFriendCode || "",
    },
    prefs: loadPrefs(),
    history: loadHistorySafe(),
    lang,
    rules_accepted: rulesAccepted(),
    hub: { base: hubBase, auto: hubAuto },
  };
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
    setStatus(_t("settings.importDone"));
    log(_t("settings.importDone") + " → " + String(uid).slice(0, 16));
    setTimeout(() => location.reload(), 400);
  } catch (e) {
    console.warn("[import]", e);
    setStatus(_t("settings.importFail") || "Import failed");
  }
}

function openSettings() {
  const sheet = $("settings-sheet");
  const bd = $("sheet-backdrop");
  if (sheet) {
    sheet.hidden = false;
    // force reflow then animate in
    void sheet.offsetWidth;
    sheet.classList.add("is-open");
  }
  if (bd) {
    bd.hidden = false;
    void bd.offsetWidth;
    bd.classList.add("is-open");
  }
  showSettingsView("main");
  syncNameInputs(getDisplayName());
  refreshSecurityPanel();
  (async () => {
    if (!previewStream?.active) await ensurePreview();
    await refreshDevices().catch(() => {});
    syncSettingsSummary();
  })();
}
function closeSettings() {
  const sheet = $("settings-sheet");
  const bd = $("sheet-backdrop");
  sheet?.classList.remove("is-open");
  bd?.classList.remove("is-open");
  // Allow fade/slide to finish before hiding
  setTimeout(() => {
    if (sheet) sheet.hidden = true;
    if (bd) bd.hidden = true;
    showSettingsView("main");
  }, 180);
}

function settingsIsOpen() {
  const sheet = $("settings-sheet");
  return sheet && !sheet.hidden;
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

function manualReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = 0;
  }
  reconnectAttempt = 0;
  intentionalClose = false;
  setStatus(_t("conn.connecting"));
  setConnStrip("warn", _t("conn.connecting"), "");
  connect(false);
}

function scheduleReconnect() {
  if (intentionalClose) return;
  if (reconnectAttempt >= MAX_RECONNECT) {
    setStatus(_t("status.disconnected"));
    setConnStrip("bad", _t("conn.gaveUp") || _t("conn.disconnected"), "", {
      showRetry: true,
    });
    log(_t("hub.gaveUp") || "gave up reconnecting — trying other hubs / reload");
    // Try another hub from the public directory, then reconnect
    reconnectTimer = setTimeout(async () => {
      reconnectAttempt = 0;
      if (
        typeof RuletHub !== "undefined" &&
        RuletHub.ensureHealthyHub &&
        RuletHub.autoFailoverEnabled()
      ) {
        try {
          const r = await RuletHub.ensureHealthyHub({ forceSwitch: true });
          if (r?.switched) {
            log(_t("hub.switched", { h: r.base }));
            syncHubSettingsUi();
            if (typeof loadRtcConfig === "function") {
              loadRtcConfig(r.base).catch(() => {});
            }
          }
        } catch (_) {}
      }
      connect(false);
    }, 4000);
    return;
  }
  const delay = Math.min(12000, 600 * Math.pow(1.7, reconnectAttempt++));
  const secs = Math.round(delay / 100) / 10;
  setStatus(_t("log.reconnectIn", { s: secs }));
  setConnStrip(
    "warn",
    _t("conn.retryIn", { s: secs }) || _t("log.reconnectIn", { s: secs }),
    "",
    { showRetry: true }
  );
  reconnectTimer = setTimeout(async () => {
    if (
      reconnectAttempt >= 3 &&
      typeof RuletHub !== "undefined" &&
      RuletHub.ensureHealthyHub &&
      RuletHub.autoFailoverEnabled()
    ) {
      try {
        const r = await RuletHub.ensureHealthyHub({ forceSwitch: true });
        if (r?.switched) {
          log(_t("hub.switched", { h: r.base }));
          syncHubSettingsUi();
          if (typeof loadRtcConfig === "function") {
            loadRtcConfig(r.base).catch(() => {});
          }
        }
      } catch (_) {}
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
          send({ type: "add_friend", code: invite.trim() });
          setStatus(_t("friends.inviteAdded"));
          // strip friend param so refresh doesn't re-add noise
          try {
            const u = new URL(location.href);
            u.searchParams.delete("friend");
            history.replaceState(null, "", u.pathname + u.search + u.hash);
          } catch (_) {}
        }
      }, 300);
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
    }
  };
  socket.onclose = () => {
    if (ws !== socket) return; // superseded by a newer connect()
    stopPing();
    stopStats();
    clearCallTimeout();
    ws = null;
    setStatus(_t("status.disconnected"));
    updateConnFromState();
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
      // Prefer local saved name; otherwise accept server echo
      {
        const local = (loadIdentity().name || "").trim();
        const shown = local || msg.name || "anon";
        if (local) saveIdentity({ name: local });
        else if (msg.name && msg.name !== "anon") saveIdentity({ name: msg.name });
        syncNameInputs(shown);
      }
      setStatus(_t("status.connected"));
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
        const prevOnline = new Map(
          (friendsCache || []).map((f) => [f.user_id, !!f.online])
        );
        friendsCache = msg.friends || [];
        blockedCache = Array.isArray(msg.blocked) ? msg.blocked : [];
        incomingRequests = Array.isArray(msg.incoming_requests)
          ? msg.incoming_requests
          : [];
        outgoingRequests = Array.isArray(msg.outgoing_requests)
          ? msg.outgoing_requests
          : [];
        if (msg.friend_code) {
          myFriendCode = msg.friend_code;
          if ($("my-friend-code")) $("my-friend-code").textContent = myFriendCode;
        }
        // Toast when a known friend comes online (not first empty→full load)
        if (prevOnline.size) {
          for (const f of friendsCache) {
            if (f.online && prevOnline.has(f.user_id) && !prevOnline.get(f.user_id)) {
              showFriendOnlineToast(f);
            }
          }
        }
        renderFriendsList();
        renderRequestLists();
        renderHistoryList();
      }
      break;
    case "friend_request":
      if (!msg.from_user_id) break;
      // Ensure request appears in Friends list immediately
      if (!incomingRequests.some((r) => r.user_id === msg.from_user_id)) {
        incomingRequests = [
          {
            user_id: msg.from_user_id,
            name: msg.from_name || msg.from_code || "friend",
            friend_code: msg.from_code || "",
            short_id: "",
            online: true,
          },
          ...incomingRequests,
        ];
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
      showIncomingCall(msg);
      break;
    case "call_ended":
      hideIncomingCall();
      clearCallTimeout();
      if (msg.reason && /declin|no answer|timeout|missed/i.test(msg.reason)) {
        /* recorded on decline path when we know the peer */
      }
      inFriendCall = false;
      matchMode = "solo";
      updateFriendActionButtons();
      if (!matched) {
        closeAllPeers({ keepFriend: false });
        setSplitRemote(false);
        setRemoteEmpty(true);
      }
      log(msg.reason || "call ended");
      setStatus(msg.reason || "call ended");
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
      if (
        matched &&
        (msg.phase === "waiting" ||
          msg.phase === "idle" ||
          /partner hit Next|partner disconnected|party moved|searching again/i.test(
            detailRaw
          ))
      ) {
        const keepFriend = inFriendCall || yourRole === "party";
        matched = msg.phase === "friend_call" || keepFriend;
        wantSearch = msg.phase === "waiting" || /searching again/i.test(detailRaw);
        pendingSignals.length = 0;
        closeAllPeers({ keepFriend });
        if (!keepFriend) {
          setSplitRemote(false);
          setRemoteEmpty(true);
          resetRemoteEmptyCopy();
          matchMode = "solo";
          yourRole = "solo";
          setFedChip(false);
          showFriendPip(false);
        } else {
          // Still with friend — back to 1:1 friend layout
          matchMode = "friend";
          yourRole = "friend";
          reattachFriendToMainRemote();
        }
        setArchPill("default");
        if (detailRaw) log(detailRu);
      }
      if (msg.phase === "waiting" || msg.phase === "claiming") {
        inQueue = true;
        wantSearch = true;
        const others = Math.max(0, (msg.waiting_peers || 1) - 1);
        setStatus(
          others
            ? _t("status.searchingOthers", { n: others })
            : _t("status.searching")
        );
        updatePoolHint();
      } else {
        if (msg.phase === "matched" || msg.phase === "friend_call") {
          inQueue = false;
        } else if (msg.phase === "idle") {
          inQueue = false;
        }
        setStatus(detailRu || _phase(msg.phase));
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
    case "chat": {
      const myName = getDisplayName();
      const mine =
        msg.author === myShortId ||
        (myName && msg.author === myName);
      log(`[${msg.author}] ${msg.body}`, mine ? "mine" : "theirs");
      break;
    }
    case "signal":
      handleIncomingSignal(msg);
      break;
    case "error":
      log(_t("log.error", { e: _srv(msg.message) || msg.message }));
      setStatus(_srv(msg.message) || msg.message);
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
  wantSearch = msg.mode !== "friend";
  isOfferer = !!msg.is_offerer;
  matchMode = msg.mode || "solo";
  yourRole = msg.your_role || "solo";
  inFriendCall = matchMode === "friend" || yourRole === "party";
  setPhase(matchMode === "friend" ? "friend_call" : "matched");
  clearChat();
  // Keep chat closed until the user sends or receives a real message
  showChatPanel(false);
  updateConnFromState();
  startWebrtcWatch();
  startMatchTimer();
  {
    const titleEl = $("remote-empty")?.querySelector(".empty-title");
    const subEl = $("remote-empty")?.querySelector(".empty-sub");
    if (titleEl) titleEl.textContent = _t("remote.connecting");
    if (subEl) subEl.textContent = _t("remote.handshake");
  }
  setRemoteEmpty(true);

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
    peers.find((p) => p.role === "friend" && p.user_id) ||
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
      }
    : {
        user_id: "",
        name: msg.partner_short || "",
        short_id: msg.partner_short || "",
        friend_code: "",
        flag: "",
        avatar: "",
      };
  pushHistory({
    kind: matchMode === "friend" ? "friend" : "stranger",
    ...lastMatchMeta,
  });
  // Strangers: 2s intro blur (auto-clear) or permanent if blur-first is on.
  // Friends start clear.
  const isFriendMatch = matchMode === "friend" || inFriendCall;
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

  // Opponents only (exclude friend teammate). Cap 2 remotes → 1v1 / 1v2 / 2v2 only.
  const opponents = peers
    .filter((p) => p.role === "stranger" || p.role === "party")
    .slice(0, 2);
  const split = opponents.length >= 2;
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
          peers.find((p) => p.role === "friend") ||
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
        tag.textContent = formatNameWithFlag(named, fl);
        const av =
          (isValidAvatarDataUrl(peer?.avatar) && peer.avatar) ||
          lastMatchMeta?.avatar ||
          "";
        setTileAvatar("remote", av);
      }
    }
    if (wrap) wrap.hidden = !(tag && tag.textContent);
  }

  setStatus(
    _t("log.matchedStatus", {
      id: msg.partner_short,
      role: msg.is_offerer ? _t("log.roleOffer") : _t("log.roleAnswer"),
    })
  );
  log(_t("log.matched", { id: msg.partner_short }) + ` · ${matchMode}`);
  playMatchChime();
  flashPartnerTile();
  updateFriendActionButtons();

  setTimeout(() => {
    joinPeers(peers).catch((e) => log(String(e)));
  }, 300);
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
        yourRole === "party" ||
        inFriendCall) &&
      pc._role === "friend";
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
    showFriendPip(false);
  } else {
    // Stranger gone — friend back on main remote (not PiP)
    reattachFriendToMainRemote();
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
  const friendMeta = list.find((p) => p.role === "friend");
  const partyBrowsing =
    matchMode === "party_browse" &&
    (yourRole === "party" || opponents.length > 0);

  // Drop opponent PCs that are gone; keep friend link
  for (const [pid, pc] of [...peerPcs.entries()]) {
    const still = list.find((p) => p.peer_id === pid);
    if (pc._role === "friend") {
      // Keep friend PC always during party / friend call
      continue;
    }
    // Close stranger/party PCs not in this match (or role changed)
    if (!still || still.role === "friend") {
      try {
        pc.closeCall({ keepLocal: true, sendBye: false });
      } catch (_) {}
      peerPcs.delete(pid);
    }
  }

  // Video layout: opponents on main remote tile(s); friend → PiP when party-browsing
  setSplitRemote(opponents.length >= 2);
  const videoSlots = new Map();
  if (opponents.length >= 2) {
    videoSlots.set(opponents[0].peer_id, $("remote"));
    videoSlots.set(opponents[1].peer_id, $("remote2"));
    if ($("remote2")) $("remote2").hidden = false;
  } else if (opponents.length === 1) {
    videoSlots.set(opponents[0].peer_id, $("remote"));
  }

  if (partyBrowsing && yourRole === "party" && friendMeta) {
    // Free #remote for stranger — friend moves to corner PiP
    const fpc = peerPcs.get(friendMeta.peer_id);
    const pip = $("friend-pip");
    if (fpc) {
      // Clear friend from main remote if still attached
      if ($("remote")?.srcObject && fpc.remoteStream && $("remote").srcObject === fpc.remoteStream) {
        $("remote").srcObject = null;
      }
      bindPcVideo(fpc, pip);
      showFriendPip(true);
    } else {
      showFriendPip(false);
    }
  } else if (matchMode === "friend" || (inFriendCall && opponents.length === 0)) {
    // Pure friend call — friend on main remote
    showFriendPip(false);
    if (friendMeta) {
      const fpc = peerPcs.get(friendMeta.peer_id);
      if (fpc) bindPcVideo(fpc, $("remote"));
    }
  } else {
    showFriendPip(false);
  }

  for (const p of list) {
    // Friend already connected from friend call — never rebuild
    if (p.role === "friend") {
      if (peerPcs.has(p.peer_id)) continue;
      // Friend listed but no PC yet (rare) — fall through and create
    }

    if (peerPcs.has(p.peer_id)) {
      // Rebind video for existing opponent PC if needed
      const existing = peerPcs.get(p.peer_id);
      if (existing && (p.role === "stranger" || p.role === "party")) {
        const el = videoSlots.get(p.peer_id) || $("remote");
        bindPcVideo(existing, el);
      }
      continue;
    }

    // Cap stranger/party PCs at 2
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
    if (p.role === "friend") {
      videoEl =
        partyBrowsing && yourRole === "party"
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
        },
        onConnectionState: (s) => {
          handleWebrtcConnectionState(s);
        },
        onIceConnectionState: (ice) => {
          if (ice === "failed") handleWebrtcConnectionState("failed");
        },
      },
      !!p.is_offerer,
      p.peer_id === "legacy" ? "" : p.peer_id
    );
    pc._role = p.role || "stranger";
    pc._videoEl = videoEl;
    pc.setLocalStream(previewStream);
    peerPcs.set(p.peer_id, pc);
    // Prefer stranger as active rtc for mute/stats when present
    if (p.role !== "friend" || !rtc) rtc = pc;
    if (p.role === "friend" && videoEl === $("friend-pip")) {
      showFriendPip(true);
    }
    try {
      await pc.connect();
      // Drain pending for this peer
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

  // Ensure friend PiP still painted after stranger connects
  if (partyBrowsing && yourRole === "party" && friendMeta) {
    const fpc = peerPcs.get(friendMeta.peer_id);
    if (fpc?.remoteStream && $("friend-pip")) {
      bindPcVideo(fpc, $("friend-pip"));
      showFriendPip(true);
    }
  }
}

function stopStats() {
  if (statsTimer) clearInterval(statsTimer);
  statsTimer = 0;
  const el = $("call-quality");
  if (el) {
    el.textContent = "";
    el.className = "quality";
  }
  clearIcePathBadge();
}

function startStats() {
  stopStats();
  statsTimer = setInterval(async () => {
    if (!rtc?.pc) return;
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
      if (!el) return;
      el.textContent = parts.join(" · ") || "";
      el.className = "quality";
      if (rtt != null && rtt > 250) el.classList.add("warn");
      if ((rtt != null && rtt > 500) || (loss != null && loss > 5)) el.classList.add("bad");

      // Media path: Direct P2P vs TURN relay
      if (typeof getIcePathKind === "function") {
        const kind = await getIcePathKind(rtc.pc);
        if (kind !== "unknown" || matched) setIcePathBadge(kind);
      }
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
  if (!friendsCache.length) {
    el.innerHTML = `<div class="hint-inline">${escapeHtml(_t("friends.empty"))}</div>`;
  } else {
    el.innerHTML = friendsCache
      .map((f) => {
        const online = f.online ? "online" : "";
        const st = f.online ? _t("friends.online") : _t("friends.offline");
        const callBtn = f.online
          ? `<button type="button" class="pill tight btn-call-friend" data-uid="${escapeAttr(
              f.user_id
            )}">${escapeHtml(_t("friends.call"))}</button>`
          : "";
        return `<div class="friend-row ${online}">
        <span class="dot"></span>
        <div class="meta">
          <strong>${escapeHtml(f.name || f.short_id)}</strong>
          <span>${escapeHtml(st)} · ${escapeHtml(f.friend_code || "")}</span>
        </div>
        <div class="friend-actions">
          ${callBtn}
          <button type="button" class="pill tight ghost btn-remove-friend" data-uid="${escapeAttr(
            f.user_id
          )}">${escapeHtml(_t("friends.remove"))}</button>
          <button type="button" class="pill tight danger btn-block-friend" data-uid="${escapeAttr(
            f.user_id
          )}">${escapeHtml(_t("friends.block"))}</button>
        </div>
      </div>`;
      })
      .join("");
  }
  el.querySelectorAll(".btn-call-friend").forEach((btn) => {
    btn.addEventListener("click", () => {
      send({ type: "call_friend", user_id: btn.getAttribute("data-uid") });
      setStatus(_t("status.calling"));
      startCallTimeout();
      log(_t("status.calling"));
      closeFriends();
    });
  });
  el.querySelectorAll(".btn-remove-friend").forEach((btn) => {
    btn.addEventListener("click", () => {
      send({ type: "remove_friend", user_id: btn.getAttribute("data-uid") });
    });
  });
  el.querySelectorAll(".btn-block-friend").forEach((btn) => {
    btn.addEventListener("click", () => {
      blockUserId(btn.getAttribute("data-uid"));
    });
  });

  const bl = $("blocked-list");
  if (bl) {
    if (!blockedCache.length) {
      bl.hidden = true;
      bl.innerHTML = "";
    } else {
      bl.hidden = false;
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
}

/** @returns {boolean} true if block was applied */
function blockUserId(uid, opts = {}) {
  if (!uid) return false;
  const silent = !!opts.silent;
  if (!silent && !confirm(_t("friends.blockConfirm"))) return false;
  send({ type: "block_user", user_id: uid });
  setStatus(_t("friends.blockOk"));
  log(_t("friends.blockOk"));
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

function renderHistoryList() {
  const el = $("history-list");
  if (!el) return;
  const list = loadHistory();
  el.hidden = false;
  const friendIds = new Set(friendsCache.map((f) => f.user_id));
  const head = `<div class="hint-inline history-head"><strong>${escapeHtml(
    _t("friends.historyTitle")
  )}</strong>
      <button type="button" class="pill tight ghost" id="btn-clear-history">${escapeHtml(
        _t("friends.historyClear")
      )}</button>
    </div>`;
  if (!list.length) {
    el.innerHTML =
      head +
      `<p class="hint-inline muted">${escapeHtml(_t("friends.historyEmpty"))}</p>`;
    $("btn-clear-history")?.addEventListener("click", () => {
      saveHistory([]);
      renderHistoryList();
    });
    return;
  }
  el.innerHTML =
    head +
    list
      .slice(0, 24)
      .map((h) => {
        const isFriend = h.user_id && friendIds.has(h.user_id);
        const fr = isFriend
          ? friendsCache.find((f) => f.user_id === h.user_id)
          : null;
        const onlineFriend = !!(fr && fr.online);
        const dur = formatDurationShort(h.duration_secs);
        const metaBits = [
          kindLabel(h.kind),
          formatHistoryTime(h.t),
          dur ? dur : "",
          isFriend && !onlineFriend ? _t("friends.offline") : "",
        ]
          .filter(Boolean)
          .join(" · ");
        let actions = "";
        if (onlineFriend) {
          actions = `<button type="button" class="pill tight btn-hist-call" data-uid="${escapeAttr(
            h.user_id
          )}">${escapeHtml(_t("friends.redial"))}</button>`;
        } else if (isFriend && h.user_id) {
          actions = `<button type="button" class="pill tight ghost" disabled title="${escapeAttr(
            _t("friends.offline")
          )}">${escapeHtml(_t("friends.offline"))}</button>`;
        } else if (h.friend_code && !isFriend) {
          actions = `<button type="button" class="pill tight btn-hist-add" data-code="${escapeAttr(
            h.friend_code
          )}">${escapeHtml(_t("friends.addFromHistory"))}</button>`;
        }
        return `<div class="friend-row">
          <span class="dot ${onlineFriend ? "online" : ""}"></span>
          <div class="meta">
            <strong>${escapeHtml(h.name || h.short_id || "anon")}</strong>
            <span>${escapeHtml(metaBits)}</span>
          </div>
          <div class="friend-actions">${actions}</div>
        </div>`;
      })
      .join("");
  $("btn-clear-history")?.addEventListener("click", () => {
    saveHistory([]);
    renderHistoryList();
  });
  el.querySelectorAll(".btn-hist-call").forEach((btn) => {
    btn.addEventListener("click", () => {
      send({ type: "call_friend", user_id: btn.getAttribute("data-uid") });
      setStatus(_t("status.calling"));
      startCallTimeout();
      closeFriends();
    });
  });
  el.querySelectorAll(".btn-hist-add").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-code");
      if (!code) return;
      send({ type: "add_friend", code });
      setStatus(_t("friends.requestSent"));
    });
  });
}

function updateFriendsBadge() {
  const badge = $("friends-badge");
  if (!badge) return;
  const n = incomingRequests.length;
  if (n > 0) {
    badge.hidden = false;
    badge.textContent = n > 9 ? "9+" : String(n);
  } else {
    badge.hidden = true;
    badge.textContent = "0";
  }
}

function renderRequestLists() {
  updateFriendsBadge();
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
        )}</strong> — ${_t("friends.mutualHint")}</div>` +
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
      out.innerHTML =
        `<div class="hint-inline"><strong>${escapeHtml(
          _t("friends.outgoingTitle")
        )}</strong></div>` +
        outgoingRequests
          .map(
            (f) => `<div class="friend-row">
          <span class="dot"></span>
          <div class="meta">
            <strong>${escapeHtml(f.name || f.short_id)}</strong>
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
  if (matchTimerStartedAt && lastMatchMeta?.user_id) {
    const secs = Math.max(0, Math.round((Date.now() - matchTimerStartedAt) / 1000));
    patchHistoryDuration(lastMatchMeta.user_id, secs);
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
  clearWaitTipsWatch();
  hideWaitTips();
  // After 18s still searching → gentle tips (not a full-screen blocker)
  waitTipsTimer = setTimeout(() => {
    if (inQueue && !matched) showWaitTips();
  }, 18000);
}

function wireWaitTips() {
  on("btn-wait-dismiss", "click", () => hideWaitTips());
  on("btn-wait-spin", "click", () => {
    hideWaitTips();
    $("btn-spin")?.click();
  });
}

/** Friend came online */
function showFriendOnlineToast(f) {
  const name = f?.name || f?.friend_code || "Friend";
  const id = "presence-toast";
  const existing = $(id);
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = id;
  toast.className = "presence-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `<strong>${escapeHtml(name)}</strong> · ${escapeHtml(
    _t("friends.onlineNow")
  )}`;
  toast.addEventListener("click", () => {
    toast.remove();
    openFriends();
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 5500);
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
        _t("friends.acceptReq")
      )}</button>
      <button type="button" class="pill danger" id="btn-fr-decline">${escapeHtml(
        _t("friends.declineReq")
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

function openFriends() {
  ensureNotifPermissionSoft();
  if ($("friends-sheet")) $("friends-sheet").hidden = false;
  if ($("friends-backdrop")) $("friends-backdrop").hidden = false;
  syncNameInputs(getDisplayName());
  if ($("my-friend-code")) $("my-friend-code").textContent = myFriendCode || "—";
  renderFriendsList();
  renderRequestLists();
  renderHistoryList();
}
function closeFriends() {
  if ($("friends-sheet")) $("friends-sheet").hidden = true;
  if ($("friends-backdrop")) $("friends-backdrop").hidden = true;
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
    pushHistory({
      kind: "missed",
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

const REPORTS_KEY = "rulet.reports.v1";

function partnerMenuOpen() {
  const menu = $("partner-menu");
  return menu && !menu.hidden;
}

function closePartnerMenu() {
  const menu = $("partner-menu");
  const bd = $("partner-menu-backdrop");
  if (menu) menu.hidden = true;
  if (bd) bd.hidden = true;
  const main = $("partner-menu-main");
  const rep = $("partner-menu-report");
  if (main) main.hidden = false;
  if (rep) rep.hidden = true;
}

function isPartnerAlreadyFriend(uid) {
  if (!uid) return false;
  return (friendsCache || []).some((f) => f.user_id === uid);
}

function isPartnerRequestPending(uid) {
  if (!uid) return false;
  return (outgoingRequests || []).some((r) => r.user_id === uid);
}

function openPartnerMenu() {
  if (!matched || !primaryPartnerUserId || primaryPartnerUserId === myUserId) {
    return;
  }
  const menu = $("partner-menu");
  const bd = $("partner-menu-backdrop");
  if (!menu) return;

  const name = formatNameWithFlag(
    lastMatchMeta?.name || _t("remote.tag"),
    lastMatchMeta?.flag
  );
  const nameEl = $("partner-menu-name");
  if (nameEl) nameEl.textContent = name;

  const friendBtn = $("btn-partner-friend");
  if (friendBtn) {
    const already = isPartnerAlreadyFriend(primaryPartnerUserId);
    const pending = isPartnerRequestPending(primaryPartnerUserId);
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

  const main = $("partner-menu-main");
  const rep = $("partner-menu-report");
  if (main) main.hidden = false;
  if (rep) rep.hidden = true;

  menu.hidden = false;
  if (bd) bd.hidden = false;
}

function invitePartnerFriend() {
  const code = lastMatchMeta?.friend_code || "";
  if (!code) {
    setStatus(_t("partnerMenu.noCode"));
    log(_t("partnerMenu.noCode"));
    closePartnerMenu();
    return;
  }
  if (isPartnerAlreadyFriend(primaryPartnerUserId)) {
    setStatus(_t("partnerMenu.alreadyFriend"));
    closePartnerMenu();
    return;
  }
  send({ type: "add_friend", code });
  setStatus(_t("friends.requestSent"));
  log(_t("friends.requestSent") + (lastMatchMeta?.name ? ` · ${lastMatchMeta.name}` : ""));
  closePartnerMenu();
}

function blockPartnerFromMenu() {
  const uid = primaryPartnerUserId;
  if (!uid) {
    closePartnerMenu();
    return;
  }
  closePartnerMenu();
  if (!blockUserId(uid)) return;
  wantSearch = true;
  send({ type: "next", room: currentRoom() });
}

function showPartnerReportReasons() {
  const main = $("partner-menu-main");
  const rep = $("partner-menu-report");
  if (main) main.hidden = true;
  if (rep) rep.hidden = false;
}

function saveLocalReport(entry) {
  try {
    const raw = JSON.parse(localStorage.getItem(REPORTS_KEY) || "[]");
    const list = Array.isArray(raw) ? raw : [];
    list.unshift(entry);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(list.slice(0, 100)));
  } catch (_) {}
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
  // Clearer community-moderation feedback
  const msg =
    reason === "underage"
      ? _t("partnerMenu.reportOkUnderage") ||
        _t("partnerMenu.reportOk")
      : _t("partnerMenu.reportOkFull") || _t("partnerMenu.reportOk");
  setStatus(msg);
  log((_t("partnerMenu.reportOk") || "reported") + ` · ${entry.reason}`);
  closePartnerMenu();
  // Block + skip so they don't reappear
  blockUserId(uid, { silent: true });
  wantSearch = true;
  matched = false;
  closeAllPeers({ keepFriend: false });
  setSplitRemote(false);
  setRemoteEmpty(true);
  resetRemoteEmptyCopy();
  setFedChip(false);
  updateFriendActionButtons();
  send({ type: "next", room: currentRoom() });
  setPhase("waiting");
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
on("btn-mute-cam", "click", () => toggleCam());
on("btn-mute-remote", "click", () => togglePartnerMute());
on("btn-blur-remote", "click", () => togglePartnerBlur());
on("btn-fs-remote", "click", () => toggleFullscreenPartner());
on("btn-partner-friend", "click", () => invitePartnerFriend());
on("btn-partner-block", "click", () => blockPartnerFromMenu());
on("btn-partner-report", "click", () => showPartnerReportReasons());
on("btn-report-dock", "click", () => {
  if (!primaryPartnerUserId || !matched) return;
  openPartnerMenu();
  showPartnerReportReasons();
});
on("btn-partner-menu-cancel", "click", () => closePartnerMenu());
on("btn-partner-report-back", "click", () => {
  const main = $("partner-menu-main");
  const rep = $("partner-menu-report");
  if (main) main.hidden = false;
  if (rep) rep.hidden = true;
});
on("partner-menu-backdrop", "click", () => closePartnerMenu());
$("partner-menu-report")?.querySelectorAll("[data-report-reason]").forEach((btn) => {
  btn.addEventListener("click", () => {
    reportPartner(btn.getAttribute("data-report-reason") || "other");
  });
});
on("btn-settings", "click", () => openSettings());
on("btn-conn-retry", "click", () => manualReconnect());
on("sheet-close", "click", () => closeSettings());
on("sheet-backdrop", "click", () => closeSettings());
on("btn-refresh-devices", "click", () => refreshDevices());
on("btn-friends", "click", () => openFriends());
on("friends-close", "click", () => closeFriends());
on("friends-backdrop", "click", () => closeFriends());
on("btn-add-friend", "click", () => {
  const code = ($("add-friend-code")?.value || "").trim();
  if (!code) return;
  send({ type: "add_friend", code });
  if ($("add-friend-code")) $("add-friend-code").value = "";
  setStatus(_t("friends.requestSent"));
});
on("btn-copy-code", "click", async () => {
  if (!myFriendCode) {
    setStatus(_t("friends.noCode") || "Friend code not ready yet");
    return;
  }
  await copyToClipboard(myFriendCode, "friends.codeCopied");
});
on("btn-browse-together", "click", () => {
  send({ type: "browse_together", room: currentRoom() });
  wantSearch = true;
  log("browse together…");
});
on("btn-hangup-friend", "click", () => {
  send({ type: "hangup_friend" });
  inFriendCall = false;
  matchMode = "solo";
  primaryPartnerUserId = "";
  closeAllPeers({ keepFriend: false });
  setSplitRemote(false);
  setRemoteEmpty(true);
  updateFriendActionButtons();
});
on("btn-block", "click", () => {
  if (!primaryPartnerUserId) return;
  blockUserId(primaryPartnerUserId);
  // Re-queue after block (server also requeues; send next for good measure)
  wantSearch = true;
  send({ type: "next", room: currentRoom() });
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
});
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
  pendingSignals.length = 0;
  matched = false;
  wantSearch = true;
  closeAllPeers({ keepFriend: false });
  inFriendCall = false;
  matchMode = "solo";
  yourRole = "solo";
  primaryPartnerUserId = "";
  setSplitRemote(false);
  setRemoteEmpty(true);
  resetRemoteEmptyCopy();
  setArchPill("default");
  clearChat();
  showChatPanel(false);
  updateFriendActionButtons();
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
  pendingSignals.length = 0;
  const keepFriend = inFriendCall || yourRole === "party" || matchMode === "friend";
  matched = keepFriend;
  wantSearch = true;
  closeAllPeers({ keepFriend });
  if (!keepFriend) {
    setSplitRemote(false);
    setRemoteEmpty(true);
    resetRemoteEmptyCopy();
    matchMode = "solo";
    yourRole = "solo";
    clearChat();
    showChatPanel(false);
  } else {
    clearChat();
  }
  setArchPill("default");
  setFedChip(false);
  updateFriendActionButtons();
  send(nextPayload());
  updateConnFromState();
  log(_t("log.next"));
});

/** Stop: leave queue / end stranger match; do not auto-search again. */
function doStopMatchmaking() {
  pendingSignals.length = 0;
  wantSearch = false;
  matched = false;
  inQueue = false;
  inFriendCall = false;
  matchMode = "solo";
  yourRole = "solo";
  primaryPartnerUserId = "";
  closeAllPeers({ keepFriend: false });
  setSplitRemote(false);
  setRemoteEmpty(true);
  const titleEl = $("remote-empty")?.querySelector(".empty-title");
  const subEl = $("remote-empty")?.querySelector(".empty-sub");
  if (titleEl) titleEl.textContent = _t("remote.stoppedTitle") || _t("status.stopped");
  if (subEl) subEl.textContent = _t("remote.stoppedSub") || _t("remote.emptySub");
  setArchPill("default");
  setFedChip(false);
  clearChat();
  showChatPanel(false);
  updateFriendActionButtons();
  send({ type: "stop" });
  setPhase("idle");
  setStatus(_t("status.stopped") || _t("phase.idle"));
  updateConnFromState();
  log(_t("log.stopped") || "stopped");
}
on("btn-stop", "click", () => doStopMatchmaking());

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
on("btn-clear-chat", "click", () => clearChat());
async function shareFriendInvite({ preferShare = true } = {}) {
  if (!myFriendCode) {
    setStatus(_t("friends.noCode") || "Friend code not ready yet");
    return;
  }
  const url = friendInviteUrl();
  const title = _t("friends.title") + " · " + myFriendCode;
  await shareOrCopy(url, title, "friends.inviteShared", "friends.inviteCopied", {
    preferShare,
  });
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

function resetRemoteEmptyCopy() {
  const titleEl = $("remote-empty")?.querySelector(".empty-title");
  const subEl = $("remote-empty")?.querySelector(".empty-sub");
  if (titleEl) titleEl.textContent = _t("remote.emptyTitle");
  if (subEl) subEl.textContent = _t("remote.emptySub");
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
      const body = $("msg").value.trim();
      if (!body) return;
      send({ type: "chat", body });
      $("msg").value = "";
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
  } else if (e.key === "v" || e.key === "V") {
    e.preventDefault();
    toggleCam();
  } else if (e.key === "p" || e.key === "P") {
    e.preventDefault();
    togglePartnerMute();
  } else if (e.key === "b" || e.key === "B") {
    e.preventDefault();
    togglePartnerBlur();
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
wireHubSettings();
wireMatchPrefs();
wireNameInputs();
syncMatchPrefsUi();
{
  const prefs = loadPrefs();
  const idn = loadIdentity();
  const q = new URLSearchParams(location.search);
  // Priority: ?room= → saved pref
  const fromUrl = q.get("room");
  if (fromUrl != null) syncRoomInputs(fromUrl);
  else if (prefs.room) syncRoomInputs(prefs.room);
  else syncRoomInputs("");
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
  if (!(loadIdentity().name || "").trim()) {
    // Soft hint — don't block boot
    setTimeout(() => {
      if (!(loadIdentity().name || "").trim()) {
        setStatus(_t("name.needed"));
        $("display-name-top")?.focus();
      }
    }, 1500);
  }
  syncRoomUrl();
}
setLocalEmpty(true);
setRemoteEmpty(true);
resetRemoteEmptyCopy();
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
  if (
    bootTries >= 8 ||
    (isWsOpen() && (previewStream?.active || mediaPermissionDenied))
  ) {
    clearInterval(bootTimer);
    if (!previewStream?.active && rulesAccepted()) {
      showEnableCamButton(true, _t("local.enableHint"));
    }
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
  if (document.visibilityState !== "visible") return;
  if (!rulesAccepted() || qHasNoconnect()) return;
  if (!isWsOpen()) {
    reconnectAttempt = 0;
    connect(true);
  } else {
    send({ type: "ping" });
  }
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
