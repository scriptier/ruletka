/**
 * Shared i18n for secondary pages (donate, safety, contribute, legal).
 * Uses same localStorage key + /i18n/{lang}.json packs as home/live.
 */
(function () {
  var LANG_KEY = "nextface-lang-v1";
  var LANGS = [
    { code: "ru", native: "Русский" },
    { code: "en", native: "English" },
    { code: "uk", native: "Українська" },
    { code: "pl", native: "Polski" },
    { code: "cs", native: "Čeština" },
    { code: "bg", native: "Български" },
    { code: "sr", native: "Српски" },
    { code: "es", native: "Español" },
    { code: "de", native: "Deutsch" },
    { code: "fr", native: "Français" },
    { code: "pt", native: "Português" },
    { code: "tr", native: "Türkçe" },
    { code: "ar", native: "العربية" },
    { code: "zh", native: "中文" },
  ];
  var PACK_V = "134";
  var packCache = {};
  var current = "ru";

  function codes() {
    return LANGS.map(function (l) {
      return l.code;
    });
  }

  function normalize(code) {
    if (!code) return "";
    var c = String(code).toLowerCase().replace("_", "-");
    var primary = c.split("-")[0];
    if (primary === "zh") return "zh";
    return primary;
  }

  function isSupported(code) {
    return codes().indexOf(normalize(code)) >= 0;
  }

  function detectLang() {
    try {
      var q = new URLSearchParams(location.search).get("lang");
      var nq = normalize(q);
      if (nq && isSupported(nq)) return nq;
      var s = localStorage.getItem(LANG_KEY);
      var ns = normalize(s);
      if (ns && isSupported(ns)) return ns;
      var nav = navigator.languages || [navigator.language || ""];
      for (var i = 0; i < nav.length; i++) {
        var n = normalize(nav[i]);
        if (n && isSupported(n)) return n;
      }
    } catch (_) {}
    return "ru";
  }

  function t(key, dict) {
    dict = dict || packCache[current] || {};
    var s = dict[key];
    if (s == null && packCache.en) s = packCache.en[key];
    if (s == null || s === "") return null;
    return s;
  }

  function applyDict(lang, dict) {
    current = lang;
    document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (_) {}

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var k = el.getAttribute("data-i18n");
      var v = t(k, dict);
      if (v != null) el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var k = el.getAttribute("data-i18n-html");
      var v = t(k, dict);
      if (v != null) el.innerHTML = v;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var k = el.getAttribute("data-i18n-placeholder");
      var v = t(k, dict);
      if (v != null) el.setAttribute("placeholder", v);
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      var k = el.getAttribute("data-i18n-title");
      var v = t(k, dict);
      if (v != null) el.setAttribute("title", v);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var k = el.getAttribute("data-i18n-aria");
      var v = t(k, dict);
      if (v != null) el.setAttribute("aria-label", v);
    });
    // empty-state attributes (donate addresses)
    document.querySelectorAll("[data-i18n-empty]").forEach(function (el) {
      var k = el.getAttribute("data-i18n-empty");
      var v = t(k, dict);
      if (v != null) {
        el.setAttribute("data-empty", v);
        if (el.classList.contains("empty") || !el.textContent.trim() || el.dataset.wasEmpty === "1") {
          el.textContent = v;
          el.dataset.wasEmpty = "1";
        }
      }
    });

    var titleKey = document.body.getAttribute("data-i18n-title-key");
    if (titleKey) {
      var tv = t(titleKey, dict);
      if (tv) document.title = tv;
    }

    // Lang selects
    document.querySelectorAll("select.site-lang, #home-lang, #site-lang").forEach(function (sel) {
      if (!sel.options.length || sel.dataset.filled !== "1") {
        sel.innerHTML = LANGS.map(function (l) {
          return '<option value="' + l.code + '">' + l.native + "</option>";
        }).join("");
        sel.dataset.filled = "1";
      }
      sel.value = lang;
    });

    // Live links keep lang
    document.querySelectorAll('a[href*="live.html"]').forEach(function (a) {
      try {
        var nu = new URL(a.getAttribute("href") || a.href, location.origin);
        if (nu.pathname.indexOf("live") < 0) return;
        if (lang && lang !== "en") nu.searchParams.set("lang", lang);
        else nu.searchParams.delete("lang");
        a.setAttribute("href", nu.pathname + nu.search + (nu.hash || ""));
      } catch (_) {}
    });

    // Internal page links preserve lang
    document.querySelectorAll("a[data-keep-lang]").forEach(function (a) {
      try {
        var nu = new URL(a.getAttribute("href") || a.href, location.origin);
        if (lang && lang !== "en") nu.searchParams.set("lang", lang);
        else nu.searchParams.delete("lang");
        a.setAttribute("href", nu.pathname + nu.search + (nu.hash || ""));
      } catch (_) {}
    });

    if (window.RuletBrand && RuletBrand.apply) {
      try {
        RuletBrand.apply(document);
      } catch (_) {}
    }

    // Brand name substitution {brand}
    var brand =
      (window.RuletBrand && RuletBrand.name && RuletBrand.name()) || "ruletka.vip";
    document.querySelectorAll("[data-i18n-brand]").forEach(function (el) {
      var k = el.getAttribute("data-i18n-brand");
      var v = t(k, dict);
      if (v != null) el.textContent = v.replace(/\{brand\}/g, brand);
    });
    document.querySelectorAll("[data-i18n-html-brand]").forEach(function (el) {
      var k = el.getAttribute("data-i18n-html-brand");
      var v = t(k, dict);
      if (v != null) el.innerHTML = v.replace(/\{brand\}/g, brand);
    });
    if (titleKey) {
      var tvb = t(titleKey, dict);
      if (tvb) document.title = tvb.replace(/\{brand\}/g, brand);
    }

    document.dispatchEvent(
      new CustomEvent("site-i18n-applied", { detail: { lang: lang, dict: dict } })
    );
  }

  function setLang(lang) {
    lang = normalize(lang);
    if (!isSupported(lang)) lang = "ru";
    if (packCache[lang]) {
      applyDict(lang, packCache[lang]);
      return Promise.resolve(packCache[lang]);
    }
    // show previous/en stubs if any
    if (packCache.en) applyDict(lang, packCache.en);
    return fetch("/i18n/" + lang + ".json?v=" + PACK_V, { cache: "force-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("pack");
        return r.json();
      })
      .then(function (j) {
        packCache[lang] = j || {};
        var want = normalize(localStorage.getItem(LANG_KEY) || lang);
        if (want === lang) applyDict(lang, packCache[lang]);
        return packCache[lang];
      })
      .catch(function () {
        return null;
      });
  }

  function wireSelects() {
    document.querySelectorAll("select.site-lang, #home-lang, #site-lang").forEach(function (sel) {
      if (sel.dataset.wired === "1") return;
      sel.dataset.wired = "1";
      sel.addEventListener("change", function () {
        setLang(sel.value);
        // update URL ?lang= without reload
        try {
          var u = new URL(location.href);
          if (sel.value && sel.value !== "en") u.searchParams.set("lang", sel.value);
          else u.searchParams.delete("lang");
          history.replaceState(null, "", u.pathname + u.search + u.hash);
        } catch (_) {}
      });
    });
  }

  function boot() {
    wireSelects();
    var lang = detectLang();
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (_) {}
    // Preload en for fallbacks then active lang
    return fetch("/i18n/en.json?v=" + PACK_V, { cache: "force-cache" })
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .then(function (en) {
        packCache.en = en || {};
        return setLang(lang);
      })
      .catch(function () {
        return setLang(lang);
      });
  }

  window.SiteI18n = {
    t: function (k) {
      return t(k, packCache[current]);
    },
    setLang: setLang,
    getLang: function () {
      return current;
    },
    boot: boot,
    langs: LANGS,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
