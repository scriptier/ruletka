/**
 * Soft PWA install affordance.
 * - Chromium: beforeinstallprompt banner after engagement on live.
 * - iOS: one-shot "Share → Add to Home Screen" tip (no install API).
 * No nag after dismiss (localStorage). Safe no-op if already installed.
 */
(function () {
  var DISMISS_KEY = "rulet-pwa-install-dismiss-v1";
  var IOS_DISMISS_KEY = "rulet-pwa-ios-tip-dismiss-v1";
  var ENGAGED_KEY = "rulet-pwa-engaged-v1";
  var deferred = null;
  var banner = null;
  var shownOnce = false;
  var iosShownOnce = false;

  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
        return true;
      }
      if (navigator.standalone === true) return true;
    } catch (_) {}
    return false;
  }

  function isIOS() {
    try {
      var ua = navigator.userAgent || "";
      if (/iPad|iPhone|iPod/i.test(ua)) return true;
      // iPadOS desktop UA
      if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
    } catch (_) {}
    return false;
  }

  function dismissed() {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch (_) {
      return true;
    }
  }

  function setDismissed() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch (_) {}
  }

  function iosTipDismissed() {
    try {
      return localStorage.getItem(IOS_DISMISS_KEY) === "1";
    } catch (_) {
      return true;
    }
  }

  function setIosTipDismissed() {
    try {
      localStorage.setItem(IOS_DISMISS_KEY, "1");
    } catch (_) {}
  }

  function isLivePage() {
    try {
      return /live\.html/i.test(location.pathname || "");
    } catch (_) {
      return false;
    }
  }

  function isEngaged() {
    // Homepage: allow after normal delay. Live: only after first good match.
    if (!isLivePage()) return true;
    try {
      return localStorage.getItem(ENGAGED_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function markEngaged() {
    try {
      localStorage.setItem(ENGAGED_KEY, "1");
    } catch (_) {}
  }

  function removeBanner() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    banner = null;
  }

  function tr(key, fallback) {
    try {
      var fn =
        (window.RuletI18n && window.RuletI18n.t) ||
        (typeof window.t === "function" ? window.t : null);
      if (fn) {
        var v = fn(key);
        if (v && v !== key) return v;
      }
    } catch (_) {}
    return fallback;
  }

  function brandName() {
    try {
      if (window.RuletBrand && RuletBrand.name) return RuletBrand.name();
    } catch (_) {}
    return "ruletka";
  }

  function showBanner() {
    if (shownOnce || banner || isStandalone() || dismissed() || !deferred) return;
    if (!isEngaged()) return;
    shownOnce = true;
    banner = document.createElement("div");
    banner.id = "pwa-install-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Install app");
    var brand = brandName();
    var title = tr("pwa.installTitle", "Install " + brand).replace(
      /ruletka(\.vip|\.me)?/gi,
      brand
    );
    banner.innerHTML =
      '<div class="pwa-install-inner">' +
      '<span class="pwa-install-bar" aria-hidden="true"></span>' +
      '<img class="pwa-install-icon" src="/brand/icon-192.png" width="40" height="40" alt="" />' +
      '<div class="pwa-install-copy">' +
      "<strong>" +
      title +
      "</strong>" +
      "<span>" +
      tr("pwa.installLead", "Add to home screen for a full-screen chat app.") +
      "</span>" +
      "</div>" +
      '<div class="pwa-install-actions">' +
      '<button type="button" class="pwa-install-btn" id="pwa-install-go">' +
      tr("pwa.install", "Install") +
      "</button>" +
      '<button type="button" class="pwa-install-x" id="pwa-install-x" aria-label="Dismiss">×</button>' +
      "</div>" +
      "</div>";
    document.body.appendChild(banner);

    document.getElementById("pwa-install-x").addEventListener("click", function () {
      setDismissed();
      removeBanner();
    });
    document.getElementById("pwa-install-go").addEventListener("click", function () {
      var promptEvent = deferred;
      deferred = null;
      removeBanner();
      if (!promptEvent) return;
      promptEvent.prompt();
      promptEvent.userChoice
        .then(function (choice) {
          if (choice && choice.outcome === "dismissed") setDismissed();
        })
        .catch(function () {});
    });
  }

  /**
   * iOS has no beforeinstallprompt — teach Share → Add to Home Screen once.
   */
  function showIosTip() {
    if (iosShownOnce || banner || isStandalone()) return;
    if (!isIOS() || iosTipDismissed()) return;
    if (!isEngaged()) return;
    // Prefer Chromium install if we somehow have it
    if (deferred) {
      showBanner();
      return;
    }
    iosShownOnce = true;
    banner = document.createElement("div");
    banner.id = "pwa-install-banner";
    banner.className = "pwa-ios-tip";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Add to Home Screen");
    var brand = brandName();
    var iosTitle = tr("pwa.iosTitle", "Add to Home Screen");
    if (iosTitle.indexOf("ruletka") !== -1) {
      iosTitle = iosTitle.replace(/ruletka(\.vip|\.me)?/gi, brand);
    }
    banner.innerHTML =
      '<div class="pwa-install-inner">' +
      '<span class="pwa-install-bar" aria-hidden="true"></span>' +
      '<img class="pwa-install-icon" src="/brand/icon-192.png" width="40" height="40" alt="" />' +
      '<div class="pwa-install-copy">' +
      "<strong>" +
      iosTitle +
      "</strong>" +
      "<span>" +
      tr(
        "pwa.iosLead",
        "Tap Share, then “Add to Home Screen” for a full-screen chat app."
      ) +
      "</span>" +
      "</div>" +
      '<div class="pwa-install-actions">' +
      '<button type="button" class="pwa-install-btn" id="pwa-ios-ok">' +
      tr("pwa.iosGotIt", "Got it") +
      "</button>" +
      '<button type="button" class="pwa-install-x" id="pwa-install-x" aria-label="Dismiss">×</button>' +
      "</div>" +
      "</div>";
    document.body.appendChild(banner);

    function dismissIos() {
      setIosTipDismissed();
      removeBanner();
    }
    document.getElementById("pwa-install-x").addEventListener("click", dismissIos);
    document.getElementById("pwa-ios-ok").addEventListener("click", dismissIos);
  }

  function tryShow(opts) {
    if (opts && opts.engaged) markEngaged();
    var delay = (opts && opts.delay) || 1800;
    setTimeout(function () {
      if (deferred) showBanner();
      else if (isIOS()) showIosTip();
    }, delay);
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    if (isLivePage() && !isEngaged()) {
      // Hold prompt until first successful match
      return;
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        setTimeout(showBanner, 2500);
      });
    } else {
      setTimeout(showBanner, isLivePage() ? 1800 : 2500);
    }
  });

  window.addEventListener("appinstalled", function () {
    deferred = null;
    setDismissed();
    setIosTipDismissed();
    removeBanner();
  });

  // Service worker registration (homepage + live)
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then(function (reg) {
          try {
            reg.update();
          } catch (_) {}
          setInterval(function () {
            try {
              if (document.visibilityState === "visible") reg.update();
            } catch (_) {}
          }, 60 * 60 * 1000);
        })
        .catch(function () {});
    });
  }

  window.RuletPwa = {
    markEngaged: markEngaged,
    tryShow: tryShow,
    isEngaged: isEngaged,
    isIOS: isIOS,
  };
})();
