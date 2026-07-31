/**
 * Optional analytics — only loads if /config.json publishes ids.
 * Set ROULETTE_YANDEX_METRICA_ID and/or ROULETTE_GA_ID on the bridge.
 * Never hard-code secrets; these IDs are public by design.
 *
 * Funnel helper: window.RuletTrack(event, params)
 * Works even without YM/GA (no-op until providers load).
 */
(function () {
  var ready = false;
  var yandexId = null;
  var gaReady = false;

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
    loadScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id)).then(
      function () {
        window.dataLayer = window.dataLayer || [];
        function gtag() {
          window.dataLayer.push(arguments);
        }
        window.gtag = gtag;
        gtag("js", new Date());
        gtag("config", id, { anonymize_ip: true });
        gaReady = true;
      }
    );
  }

  /**
   * @param {string} event
   * @param {Record<string, string|number|boolean>} [params]
   */
  function track(event, params) {
    if (!event) return;
    var p = params && typeof params === "object" ? params : {};
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
  window.RuletAnalytics = { track: track, ready: function () { return ready; } };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
