/**
 * Brand helper. The public name is always "Ruletka.me".
 * Titles, descriptions, canonical, and og:url stay as authored
 * (canonical host https://ruletka.me). host() is only for artwork.
 */
(function (global) {
  var MARK = "/brand/logo-mark.png?v=10";
  var VIP_ART = /logo-hero|og-share|homepage-hero/;

  function hostBrand() {
    try {
      var h = (location.hostname || "").toLowerCase().replace(/^www\./, "");
      if (h === "ruletka.me" || h.endsWith(".ruletka.me")) return "ruletka.me";
      if (h === "ruletka.vip" || h.endsWith(".ruletka.vip")) return "ruletka.vip";
      if (h === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return "ruletka.vip";
      return h || "ruletka.vip";
    } catch (_) {
      return "ruletka.vip";
    }
  }

  function originBase() {
    try {
      return location.origin || "https://ruletka.me";
    } catch (_) {
      return "https://ruletka.me";
    }
  }

  function swapVipArt(scope) {
    if (hostBrand() !== "ruletka.me") return;
    scope.querySelectorAll("img, video, source").forEach(function (el) {
      ["src", "poster", "data-src"].forEach(function (attr) {
        var v = el.getAttribute(attr) || "";
        if (VIP_ART.test(v)) el.setAttribute(attr, MARK);
      });
    });
    scope
      .querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]')
      .forEach(function (el) {
        var v = el.getAttribute("content") || "";
        if (VIP_ART.test(v)) {
          el.setAttribute("content", "https://ruletka.me/brand/logo-mark.png");
        }
      });
  }

  function applyBrand(root) {
    var name = "Ruletka.me";
    var scope = root || document;

    scope.querySelectorAll("[data-brand-name], [data-i18n='brand.name']").forEach(function (el) {
      if (el.childElementCount === 0) el.textContent = name;
    });
    scope.querySelectorAll(".home-brand > span, .brand > span[data-i18n='brand.name']").forEach(function (el) {
      el.textContent = name;
    });
    scope.querySelectorAll("a.home-brand > span").forEach(function (el) {
      el.textContent = name;
    });
    scope.querySelectorAll("a.home-brand").forEach(function (a) {
      a.setAttribute("aria-label", name);
    });
    scope.querySelectorAll("img.home-logo, video.home-hero-video, .home-hero-fallback").forEach(function (el) {
      if (el.tagName === "VIDEO") el.setAttribute("aria-label", name);
      else if (el.getAttribute("alt") != null) el.setAttribute("alt", name);
    });
    var share = scope.getElementById ? scope.getElementById("btn-share-site") : null;
    if (share) {
      var shareLabel = share.getAttribute("data-share-label") || "Share " + name;
      if (!share.getAttribute("title")) share.setAttribute("title", shareLabel);
    }

    try {
      swapVipArt(scope);
    } catch (_) {}

    try {
      if (global.NextfaceI18n && typeof global.NextfaceI18n.patchStrings === "function") {
        global.NextfaceI18n.patchStrings({ "brand.name": name });
      } else if (global.NextfaceI18n && global.NextfaceI18n.STR) {
        Object.keys(global.NextfaceI18n.STR).forEach(function (lang) {
          if (global.NextfaceI18n.STR[lang]) {
            global.NextfaceI18n.STR[lang]["brand.name"] = name;
          }
        });
      }
    } catch (_) {}

    return name;
  }

  function boot() {
    applyBrand(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.RuletBrand = {
    name: function () {
      return "Ruletka.me";
    },
    host: hostBrand,
    apply: applyBrand,
    origin: originBase,
  };
})(typeof window !== "undefined" ? window : globalThis);
