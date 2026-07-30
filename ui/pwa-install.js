/**
 * Soft PWA install affordance — only when browser fires beforeinstallprompt.
 * No nag after dismiss (localStorage). Safe no-op if already installed.
 */
(function () {
  var DISMISS_KEY = "rulet-pwa-install-dismiss-v1";
  var deferred = null;
  var banner = null;

  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
        return true;
      }
      if (navigator.standalone === true) return true;
    } catch (_) {}
    return false;
  }

  function dismissed() {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function setDismissed() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
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

  function showBanner() {
    if (banner || isStandalone() || dismissed() || !deferred) return;
    banner = document.createElement("div");
    banner.id = "pwa-install-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Install app");
    banner.innerHTML =
      '<div class="pwa-install-inner">' +
      '<img class="pwa-install-icon" src="/brand/icon-192.png" width="40" height="40" alt="" />' +
      '<div class="pwa-install-copy">' +
      "<strong>" +
      tr("pwa.installTitle", "Install ruletka") +
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

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showBanner);
    } else {
      // slight delay so it doesn't fight the rules modal
      setTimeout(showBanner, 2500);
    }
  });

  window.addEventListener("appinstalled", function () {
    deferred = null;
    setDismissed();
    removeBanner();
  });

  // Service worker registration (homepage + live)
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
})();
