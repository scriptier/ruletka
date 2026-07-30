/**
 * Multi-hub discovery + failover for ruletka / roulette-bridge.
 * Protocol seed: GET /hubs.json and GET /v1/directory (ruletka-directory/1).
 *
 * Any origin can host a full hub. This module helps the browser pick a healthy
 * bridge for WebSocket matchmaking without hard-coding a single company.
 */
(function (global) {
  const PREF_KEY = "ruletka-hub-base-v1";
  const PREF_AUTO = "ruletka-hub-auto-v1";
  /** Built-in seed only — communities should publish their own /hubs.json */
  const BUILTIN_SEEDS = ["https://ruletka.vip"];

  let currentBase = "";
  let directoryCache = [];
  let directoryLoadedAt = 0;

  function normalizeBase(url) {
    if (!url) return "";
    try {
      const u = new URL(url, location.href);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      return u.origin;
    } catch {
      return "";
    }
  }

  function sameOriginBase() {
    try {
      return location.origin;
    } catch {
      return "";
    }
  }

  function getSavedBase() {
    try {
      return normalizeBase(localStorage.getItem(PREF_KEY) || "");
    } catch {
      return "";
    }
  }

  function setSavedBase(base) {
    const b = normalizeBase(base);
    try {
      if (b) localStorage.setItem(PREF_KEY, b);
      else localStorage.removeItem(PREF_KEY);
    } catch (_) {}
    return b;
  }

  function autoFailoverEnabled() {
    try {
      const v = localStorage.getItem(PREF_AUTO);
      if (v === null || v === undefined || v === "") return true;
      return v === "1" || v === "true";
    } catch {
      return true;
    }
  }

  function setAutoFailover(on) {
    try {
      localStorage.setItem(PREF_AUTO, on ? "1" : "0");
    } catch (_) {}
  }

  /**
   * Initial base before async health checks.
   * Priority: ?hub= → saved preference → same origin.
   */
  function resolveBaseSync() {
    try {
      const q = new URLSearchParams(location.search).get("hub");
      if (q) {
        const b = normalizeBase(q);
        if (b) {
          currentBase = b;
          return b;
        }
      }
    } catch (_) {}
    const saved = getSavedBase();
    if (saved) {
      currentBase = saved;
      return saved;
    }
    currentBase = sameOriginBase() || BUILTIN_SEEDS[0];
    return currentBase;
  }

  function base() {
    return currentBase || resolveBaseSync();
  }

  function setBase(next, { persist = true } = {}) {
    const b = normalizeBase(next) || sameOriginBase();
    currentBase = b;
    if (persist) setSavedBase(b);
    try {
      global.dispatchEvent(
        new CustomEvent("ruletka:hub", { detail: { base: b } })
      );
    } catch (_) {}
    return b;
  }

  function clearPreference() {
    try {
      localStorage.removeItem(PREF_KEY);
    } catch (_) {}
    currentBase = sameOriginBase() || BUILTIN_SEEDS[0];
    return currentBase;
  }

  function wsUrlFor(hubBase) {
    const b = normalizeBase(hubBase) || base();
    try {
      const u = new URL(b);
      const proto = u.protocol === "https:" ? "wss:" : "ws:";
      return `${proto}//${u.host}/ws`;
    } catch {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      return `${proto}//${location.host}/ws`;
    }
  }

  async function fetchJson(url, ms = 4000) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), ms) : 0;
    try {
      const r = await fetch(url, {
        cache: "no-store",
        credentials: "omit",
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally {
      if (t) clearTimeout(t);
    }
  }

  async function probeHealth(hubBase) {
    const b = normalizeBase(hubBase);
    if (!b) return null;
    try {
      const j = await fetchJson(b + "/health", 3500);
      if (j && j.ok !== false && j.service) {
        return {
          base: b,
          online: j.online || 0,
          waiting: j.waiting || 0,
          has_turn: !!j.has_turn,
          ok: true,
        };
      }
    } catch (_) {}
    return null;
  }

  async function loadDirectory(force = false) {
    if (!force && directoryCache.length && Date.now() - directoryLoadedAt < 60_000) {
      return directoryCache;
    }
    const seeds = [];
    const origin = sameOriginBase();
    const active = base();
    const tryBases = [];
    if (origin) tryBases.push(origin);
    if (active && active !== origin) tryBases.push(active);
    for (const s of BUILTIN_SEEDS) {
      if (!tryBases.includes(s)) tryBases.push(s);
    }

    const found = new Map();

    function addEntry(baseUrl, meta) {
      const b = normalizeBase(baseUrl);
      if (!b) return;
      const prev = found.get(b) || { base: b };
      found.set(b, { ...prev, ...meta, base: b });
    }

    if (origin) addEntry(origin, { name: "this page", source: "origin" });

    for (const root of tryBases) {
      try {
        const staticDir = await fetchJson(root + "/hubs.json", 3000);
        if (staticDir && Array.isArray(staticDir.hubs)) {
          for (const h of staticDir.hubs) {
            addEntry(h.base || h.url, {
              name: h.name,
              region: h.region,
              source: "hubs.json",
            });
          }
        }
      } catch (_) {}
      try {
        const live = await fetchJson(root + "/v1/directory", 3500);
        if (live) {
          if (live.public_base) {
            addEntry(live.public_base, {
              name: live.instance_id,
              online: live.online,
              waiting: live.waiting,
              source: "directory",
            });
          }
          if (Array.isArray(live.hubs)) {
            for (const h of live.hubs) {
              addEntry(h.base, {
                name: h.name || h.instance_id,
                online: h.online,
                waiting: h.waiting,
                source: "directory",
              });
            }
          }
        }
      } catch (_) {}
    }

    for (const s of BUILTIN_SEEDS) addEntry(s, { name: "seed", source: "builtin" });

    directoryCache = [...found.values()];
    directoryLoadedAt = Date.now();
    return directoryCache;
  }

  /**
   * Probe directory hubs; optionally switch away from a dead current hub.
   * @returns {Promise<{base:string, switched:boolean, probed:object[]}>}
   */
  async function ensureHealthyHub({ forceSwitch = false } = {}) {
    resolveBaseSync();
    const list = await loadDirectory(forceSwitch);
    const order = [];
    const cur = base();
    if (cur && !forceSwitch) order.push(cur);
    for (const h of list) {
      if (h.base && h.base !== cur) order.push(h.base);
    }
    // unique
    const seen = new Set();
    const candidates = order.filter((b) => {
      if (seen.has(b)) return false;
      seen.add(b);
      return true;
    });

    const probed = [];
    for (const b of candidates) {
      const h = await probeHealth(b);
      if (h) {
        probed.push(h);
        if (!forceSwitch && b === cur) {
          return { base: cur, switched: false, probed };
        }
        if (b !== cur && (forceSwitch || !probed.find((p) => p.base === cur))) {
          // fall through — keep looking for best if forceSwitch
          if (!forceSwitch) {
            setBase(b, { persist: autoFailoverEnabled() });
            return { base: b, switched: true, probed };
          }
        }
      }
    }

    if (probed.length) {
      const best = probed[0];
      const switched = best.base !== cur;
      if (switched && autoFailoverEnabled()) setBase(best.base, { persist: true });
      else if (switched) currentBase = best.base;
      return { base: best.base, switched, probed };
    }

    // Nothing healthy — keep current
    return { base: cur, switched: false, probed };
  }

  // init sync base immediately
  resolveBaseSync();

  global.RuletHub = {
    PREF_KEY,
    base,
    setBase,
    clearPreference,
    wsUrlFor,
    resolveBaseSync,
    loadDirectory,
    probeHealth,
    ensureHealthyHub,
    autoFailoverEnabled,
    setAutoFailover,
    getSavedBase,
    normalizeBase,
    builtinSeeds: () => BUILTIN_SEEDS.slice(),
  };
})(typeof window !== "undefined" ? window : globalThis);
