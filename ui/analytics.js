/**
 * Optional analytics — only loads YM/GA if /config.json publishes ids.
 * Set ROULETTE_YANDEX_METRICA_ID and/or ROULETTE_GA_ID on the bridge.
 *
 * Always-on:
 * - window.RuletTrack(event, params) — local funnel ring + optional beacon
 * - window.RuletFunnel.snapshot() — today counters for this browser
 * - POST /v1/funnel for hub DayMetrics (admin glance)
 */
(function () {
  var ready = false;
  var yandexId = null;
  var gaReady = false;
  var FUNNEL_KEY = "ruletka-funnel-day-v1";
  var FUNNEL_EVENTS = {
    funnel_invite_share: 1,
    friend_invite_share: 1,
    empty_alone_invite_share: 1,
    funnel_invite_land: 1,
    friend_invite_deep_link: 1,
    invite_landing_open: 1,
    funnel_invite_request: 1,
    funnel_invite_connected: 1,
    home_invite_pack_copy: 1,
    home_invite_pack_live: 1,
    friend_nudge_show: 1,
    friend_nudge_accept: 1,
    start_match: 1,
    friend_call_place: 1,
    friend_online_toast_call: 1,
  };

  function todayKey() {
    try {
      return new Date().toISOString().slice(0, 10);
    } catch (_) {
      return "unknown";
    }
  }

  function loadLocalFunnel() {
    try {
      var raw = JSON.parse(localStorage.getItem(FUNNEL_KEY) || "null");
      if (!raw || raw.day !== todayKey()) {
        return { day: todayKey(), counts: {}, last: [] };
      }
      if (!raw.counts || typeof raw.counts !== "object") raw.counts = {};
      if (!Array.isArray(raw.last)) raw.last = [];
      return raw;
    } catch (_) {
      return { day: todayKey(), counts: {}, last: [] };
    }
  }

  function saveLocalFunnel(f) {
    try {
      localStorage.setItem(FUNNEL_KEY, JSON.stringify(f));
    } catch (_) {}
  }

  function recordLocal(event, params) {
    var f = loadLocalFunnel();
    f.counts[event] = (Number(f.counts[event]) || 0) + 1;
    f.last.unshift({
      e: event,
      t: Date.now(),
      p: params || {},
    });
    if (f.last.length > 40) f.last.length = 40;
    saveLocalFunnel(f);
    return f;
  }

  function isFunnelEvent(event) {
    return !!FUNNEL_EVENTS[String(event || "")];
  }

  /** Beacon to hub DayMetrics (best-effort, no cookies). */
  function beaconHub(event) {
    if (!isFunnelEvent(event)) return;
    try {
      var body = JSON.stringify({ event: String(event) });
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/v1/funnel", blob);
        return;
      }
    } catch (_) {}
    try {
      fetch("/v1/funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: String(event) }),
        credentials: "omit",
        keepalive: true,
      }).catch(function () {});
    } catch (_) {}
  }

  function loadScript(src, attrs) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      if (attrs) {
        Object.keys(attrs).forEach(function (k) {
          s.setAttribute(k, attrs[k]);
        });
      }
      s.onload = function () {
        resolve();
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function initYandex(id) {
    if (!id || !/^\d+$/.test(String(id))) return;
    /* eslint-disable */
    (function (m, e, t, r, i, k, a) {
      m[i] =
        m[i] ||
        function () {
          (m[i].a = m[i].a || []).push(arguments);
        };
      m[i].l = 1 * new Date();
      for (var j = 0; j < document.scripts.length; j++) {
        if (document.scripts[j].src === r) {
          return;
        }
      }
      (k = e.createElement(t)),
        (a = e.getElementsByTagName(t)[0]),
        (k.async = 1),
        (k.src = r),
        a.parentNode.insertBefore(k, a);
    })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
    /* eslint-enable */
    yandexId = Number(id);
    window.ym(yandexId, "init", {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: false,
    });
    var noscript = document.createElement("noscript");
    noscript.innerHTML =
      '<div><img src="https://mc.yandex.ru/watch/' +
      id +
      '" style="position:absolute;left:-9999px" alt="" /></div>';
    document.body.appendChild(noscript);
  }

  function initGa(id) {
    if (!id || !/^G-[A-Z0-9]+$/i.test(String(id))) return;
    loadScript(
      "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id)
    ).then(function () {
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        window.dataLayer.push(arguments);
      }
      window.gtag = gtag;
      gtag("js", new Date());
      gtag("config", id, { anonymize_ip: true });
      gaReady = true;
    });
  }

  /**
   * @param {string} event
   * @param {Record<string, string|number|boolean>} [params]
   */
  function track(event, params) {
    if (!event) return;
    var p = params && typeof params === "object" ? params : {};
    try {
      recordLocal(String(event), p);
    } catch (_) {}
    try {
      beaconHub(String(event));
    } catch (_) {}
    try {
      if (yandexId && typeof window.ym === "function") {
        window.ym(yandexId, "reachGoal", String(event), p);
      }
    } catch (_) {}
    try {
      if (gaReady && typeof window.gtag === "function") {
        window.gtag("event", String(event), p);
      }
    } catch (_) {}
    try {
      if (window.__RULETKA_DEBUG_TRACK) {
        console.info("[track]", event, p);
      }
    } catch (_) {}
  }

  function snapshot() {
    var f = loadLocalFunnel();
    var c = f.counts || {};
    return {
      day: f.day,
      providers: {
        yandex: !!yandexId,
        ga: gaReady,
      },
      // Normalized growth funnel for this browser today
      funnel: {
        home_pack_copy: c.home_invite_pack_copy || 0,
        home_pack_live: c.home_invite_pack_live || 0,
        invite_share:
          (c.funnel_invite_share || 0) +
          (c.friend_invite_share || 0) +
          (c.empty_alone_invite_share || 0),
        invite_land:
          (c.funnel_invite_land || 0) +
          (c.friend_invite_deep_link || 0) +
          (c.invite_landing_open || 0),
        invite_request: c.funnel_invite_request || 0,
        invite_connected: c.funnel_invite_connected || 0,
        friend_nudge_show: c.friend_nudge_show || 0,
        friend_nudge_accept: c.friend_nudge_accept || 0,
        start_match: c.start_match || 0,
        friend_call_place: c.friend_call_place || 0,
      },
      counts: c,
      last: f.last || [],
    };
  }

  function boot() {
    fetch("/config.json", { cache: "no-store", credentials: "omit" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (cfg) {
        var a = cfg && cfg.analytics;
        if (!a) {
          ready = true;
          return;
        }
        if (a.yandex_metrica_id) initYandex(a.yandex_metrica_id);
        if (a.ga_measurement_id) initGa(a.ga_measurement_id);
        ready = true;
      })
      .catch(function () {
        ready = true;
      });
  }

  window.RuletTrack = track;
  window.RuletAnalytics = {
    track: track,
    ready: function () {
      return ready;
    },
  };
  window.RuletFunnel = {
    snapshot: snapshot,
    record: recordLocal,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
