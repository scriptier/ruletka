/**
 * Dual-domain brand helper (ruletka.vip / ruletka.me).
 * Updates visible labels + document title; SEO canonical stays on the visited host
 * for same-content dual branding (both domains serve the same app).
 */
(function (global) {
  function hostBrand() {
    try {
      var h = (location.hostname || "").toLowerCase().replace(/^www\./, "");
      if (h === "ruletka.me" || h.endsWith(".ruletka.me")) return "ruletka.me";
      if (h === "ruletka.vip" || h.endsWith(".ruletka.vip")) return "ruletka.vip";
      // localhost / IP previews
      if (h === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return "ruletka.vip";
      return h || "ruletka.vip";
    } catch (_) {
      return "ruletka.vip";
    }
  }

  function originBase() {
    try {
      return location.origin || "https://ruletka.vip";
    } catch (_) {
      return "https://ruletka.vip";
    }
  }

  function applyBrand(root) {
    var brand = hostBrand();
    var scope = root || document;

    // Visible brand labels
    scope.querySelectorAll("[data-brand-name], [data-i18n='brand.name']").forEach(function (el) {
      // Prefer text content for simple spans; keep structure
      if (el.childElementCount === 0) el.textContent = brand;
    });
    scope.querySelectorAll(".home-brand > span, .brand > span[data-i18n='brand.name']").forEach(function (el) {
      el.textContent = brand;
    });
    // Home nav brand text (no data-i18n on span)
    scope.querySelectorAll("a.home-brand > span").forEach(function (el) {
      el.textContent = brand;
    });

    // Aria / alt / titles that hardcode vip
    scope.querySelectorAll("a.home-brand").forEach(function (a) {
      a.setAttribute("aria-label", brand + " home");
    });
    scope.querySelectorAll("img.home-logo, video.home-hero-video, .home-hero-fallback").forEach(function (el) {
      if (el.tagName === "VIDEO") el.setAttribute("aria-label", brand);
      else if (el.getAttribute("alt") != null) el.setAttribute("alt", brand);
    });
    var share = scope.getElementById ? scope.getElementById("btn-share-site") : null;
    if (share) {
      share.setAttribute("title", "Share " + brand);
      share.setAttribute("aria-label", "Share " + brand);
    }

    // Document title: swap domain token if present
    try {
      var t = document.title || "";
      if (t.indexOf("ruletka.vip") !== -1 || t.indexOf("ruletka.me") !== -1) {
        document.title = t
          .replace(/ruletka\.vip/g, brand)
          .replace(/ruletka\.me/g, brand);
      }
    } catch (_) {}

    // Body copy from i18n often hardcodes ruletka.vip — rewrite to the host brand
    try {
      var brandSel =
        "[data-i18n='home.diffBody'], [data-i18n='home.openBody'], [data-i18n='home.lead'], " +
        "[data-i18n='rules.ageGateSub'], .home-diff-body, .home-lead, meta[name='description']";
      scope.querySelectorAll(brandSel).forEach(function (el) {
        if (el.tagName === "META") {
          var c = el.getAttribute("content") || "";
          if (/ruletka\.(vip|me)/.test(c)) {
            el.setAttribute(
              "content",
              c.replace(/ruletka\.vip/g, brand).replace(/ruletka\.me/g, brand)
            );
          }
          return;
        }
        if (el.innerHTML && /ruletka\.(vip|me)/.test(el.innerHTML)) {
          el.innerHTML = el.innerHTML
            .replace(/ruletka\.vip/g, brand)
            .replace(/ruletka\.me/g, brand);
        } else if (el.textContent && /ruletka\.(vip|me)/.test(el.textContent)) {
          el.textContent = el.textContent
            .replace(/ruletka\.vip/g, brand)
            .replace(/ruletka\.me/g, brand);
        }
      });
    } catch (_) {}

    // OG/twitter site name for the current host (share previews when scraped on that host)
    try {
      var ogSite = document.querySelector('meta[property="og:site_name"]');
      if (ogSite) ogSite.setAttribute("content", brand);
      var ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        ogTitle.setAttribute(
          "content",
          (ogTitle.getAttribute("content") || "").replace(/ruletka\.(vip|me)/g, brand)
        );
      }
      var twTitle = document.querySelector('meta[name="twitter:title"]');
      if (twTitle) {
        twTitle.setAttribute(
          "content",
          (twTitle.getAttribute("content") || "").replace(/ruletka\.(vip|me)/g, brand)
        );
      }
      // Point og:url / canonical at *this* host so shares match what users type
      var path = location.pathname || "/";
      var search = location.search || "";
      var pageUrl = originBase() + path + search;
      var canon = document.querySelector('link[rel="canonical"]');
      if (canon) canon.setAttribute("href", originBase() + path);
      var ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl) ogUrl.setAttribute("content", pageUrl);
    } catch (_) {}

    // i18n packs: override brand.name at runtime so applyI18n keeps host brand
    try {
      if (global.NextfaceI18n && typeof global.NextfaceI18n.patchStrings === "function") {
        global.NextfaceI18n.patchStrings({ "brand.name": brand });
      } else if (global.NextfaceI18n && global.NextfaceI18n.STR) {
        Object.keys(global.NextfaceI18n.STR).forEach(function (lang) {
          if (global.NextfaceI18n.STR[lang]) {
            global.NextfaceI18n.STR[lang]["brand.name"] = brand;
          }
        });
      }
    } catch (_) {}

    return brand;
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
    name: hostBrand,
    apply: applyBrand,
    origin: originBase,
  };
})(typeof window !== "undefined" ? window : globalThis);
