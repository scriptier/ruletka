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
  /** Built-in seeds — dual TLD so DNS/blocks on one path can fail over */
  const BUILTIN_SEEDS = ["https://ruletka.vip", "https://ruletka.me"];

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

  /**
   * @returns {Promise<{base:string, online:number, waiting:number, has_turn:boolean, ok:boolean, rttMs:number}|null>}
   */
  async function probeHealth(hubBase) {
    const b = normalizeBase(hubBase);
    if (!b) return null;
    const t0 =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    try {
      const j = await fetchJson(b + "/health", 3500);
      const t1 =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now();
      if (j && j.ok !== false && j.service) {
        return {
          base: b,
          online: j.online || 0,
          waiting: j.waiting || 0,
          has_turn: !!j.has_turn,
          ok: true,
          rttMs: Math.max(1, Math.round(t1 - t0)),
          instance_id: j.federation?.instance_id || j.instance_id || "",
        };
      }
    } catch (_) {}
    return null;
  }

  /** Rank healthy probes: lower is better. */
  function scoreProbe(h, { preferBase = "", origin = "" } = {}) {
    if (!h || !h.ok) return 1e9;
    let s = h.rttMs || 500;
    if (h.base === preferBase) s -= 80;
    if (h.base === origin) s -= 40;
    if (h.has_turn) s -= 25;
    // Slight preference for quieter hubs (faster match feel)
    s += Math.min(40, (h.waiting || 0) * 2);
    return s;
  }

  async function loadDirectory(force = false) {
    if (!force && directoryCache.length && Date.now() - directoryLoadedAt < 45_000) {
      return directoryCache;
    }
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
              alias_of: h.alias_of || "",
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
   * Probe directory hubs; optionally switch away from a dead / sticky current hub.
   * @param {{ forceSwitch?: boolean, preferDifferent?: boolean }} [opts]
   * @returns {Promise<{base:string, switched:boolean, probed:object[], reason?:string}>}
   */
  async function ensureHealthyHub({ forceSwitch = false, preferDifferent = false } = {}) {
    resolveBaseSync();
    const list = await loadDirectory(forceSwitch || preferDifferent);
    const origin = sameOriginBase();
    const cur = base();
    const order = [];
    // When not forcing, try current first
    if (cur && !forceSwitch) order.push(cur);
    // Same page origin next (unless forcing away)
    if (origin && origin !== cur) order.push(origin);
    for (const h of list) {
      if (h.base) order.push(h.base);
    }
    for (const s of BUILTIN_SEEDS) order.push(s);

    const seen = new Set();
    const candidates = order.filter((b) => {
      if (!b || seen.has(b)) return false;
      seen.add(b);
      return true;
    });

    // Parallel probe (cap concurrency lightly via chunks)
    const probed = [];
    const chunk = 4;
    for (let i = 0; i < candidates.length; i += chunk) {
      const slice = candidates.slice(i, i + chunk);
      const results = await Promise.all(slice.map((b) => probeHealth(b)));
      for (const h of results) {
        if (h) probed.push(h);
      }
      // Fast path: current is healthy and we don't need to leave
      if (!forceSwitch && !preferDifferent) {
        const curOk = probed.find((p) => p.base === cur);
        if (curOk) {
          return { base: cur, switched: false, probed, reason: "current_ok" };
        }
      }
    }

    if (!probed.length) {
      return { base: cur, switched: false, probed, reason: "none_healthy" };
    }

    // Prefer a different host when forced or when current never answered
    const curAlive = probed.some((p) => p.base === cur);
    const wantOther = forceSwitch || preferDifferent || !curAlive;

    let pool = probed.slice();
    if (wantOther) {
      const alts = pool.filter((p) => p.base !== cur);
      if (alts.length) pool = alts;
    }

    pool.sort(
      (a, b) =>
        scoreProbe(a, { preferBase: wantOther ? "" : cur, origin }) -
        scoreProbe(b, { preferBase: wantOther ? "" : cur, origin })
    );
    const best = pool[0];
    const switched = best.base !== cur;
    if (switched) {
      if (autoFailoverEnabled() || forceSwitch) {
        setBase(best.base, { persist: autoFailoverEnabled() });
      } else {
        currentBase = best.base;
      }
    }
    return {
      base: best.base,
      switched,
      probed,
      reason: switched ? "switched" : "kept",
    };
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
    scoreProbe,
  };
})(typeof window !== "undefined" ? window : globalThis);
