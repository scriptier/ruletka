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
        // RuletI18n.t humanizes missing keys ("pwa.updateTitle" → "Update Title").
        // Prefer the English fallback in that case so banners never show raw key labels.
        if (v && v !== key) {
          var last = String(key || "").split(".").pop() || "";
          var human = last
            .replace(/([A-Z])/g, " $1")
            .replace(/[_-]+/g, " ")
            .replace(/^\s+/, "")
            .replace(/^./, function (c) {
              return c.toUpperCase();
            });
          if (v === human || v === last) return fallback;
          return v;
        }
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

  // --- Service worker: register + soft update UX (avoid stale live.js after deploy) ---
  var RELOAD_ONCE_KEY = "rulet-sw-reload-once";
  var updateBanner = null;

  function removeUpdateBanner() {
    if (updateBanner && updateBanner.parentNode) {
      updateBanner.parentNode.removeChild(updateBanner);
    }
    updateBanner = null;
  }

  function showUpdateBanner(reg) {
    if (updateBanner || !document.body) return;
    updateBanner = document.createElement("div");
    updateBanner.id = "pwa-update-banner";
    updateBanner.setAttribute("role", "status");
    updateBanner.innerHTML =
      '<div class="pwa-install-inner pwa-update-inner">' +
      '<span class="pwa-install-bar" aria-hidden="true"></span>' +
      '<div class="pwa-install-copy">' +
      "<strong>" +
      tr("pwa.updateTitle", "Update available") +
      "</strong>" +
      "<span>" +
      tr(
        "pwa.updateBody",
        "A newer version is ready. Reload when you’re free (won’t interrupt mid-call if you wait)."
      ) +
      "</span>" +
      "</div>" +
      '<div class="pwa-install-actions">' +
      '<button type="button" class="pwa-install-btn" id="pwa-update-go">' +
      tr("pwa.updateBtn", "Reload") +
      "</button>" +
      '<button type="button" class="pwa-install-x" id="pwa-update-x" aria-label="Dismiss">×</button>' +
      "</div></div>";
    document.body.appendChild(updateBanner);
    document.getElementById("pwa-update-x").addEventListener("click", function () {
      removeUpdateBanner();
    });
    document.getElementById("pwa-update-go").addEventListener("click", function () {
      // Prefer live.js deferred reload if a call is active (don't kill P2P)
      try {
        if (
          typeof isInLiveCall === "function" &&
          isInLiveCall() &&
          typeof requestSoftReload === "function"
        ) {
          requestSoftReload("sw");
          removeUpdateBanner();
          return;
        }
      } catch (_) {}
      try {
        sessionStorage.setItem(RELOAD_ONCE_KEY, "pending");
      } catch (_) {}
      try {
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
          // controllerchange will reload once
          return;
        }
      } catch (_) {}
      location.reload();
    });
  }

  function wireSwUpdates(reg) {
    if (!reg) return;

    // Waiting worker already present (tab left open across deploy)
    if (reg.waiting) {
      showUpdateBanner(reg);
    }

    reg.addEventListener("updatefound", function () {
      var installing = reg.installing;
      if (!installing) return;
      installing.addEventListener("statechange", function () {
        // New worker installed and waiting (old controller still in charge)
        if (installing.state === "installed") {
          if (navigator.serviceWorker.controller || reg.waiting) {
            showUpdateBanner(reg);
          }
        }
      });
    });

    // Periodic + on-focus update checks (deploys should land within ~1–2 min)
    var check = function () {
      try {
        if (document.visibilityState === "visible") reg.update();
      } catch (_) {}
      // If a soft-reload was deferred mid-call, apply when idle
      try {
        if (typeof maybeApplyPendingSoftReload === "function") {
          maybeApplyPendingSoftReload();
        }
      } catch (_) {}
    };
    setInterval(check, 2 * 60 * 1000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") check();
    });
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    window.addEventListener("online", check);
    // First check quickly after register (catch deploy that landed mid-session)
    setTimeout(check, 3 * 1000);
    setTimeout(check, 20 * 1000);
  }

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    // Reload only after user tapped “Reload” (or first control after install)
    var refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (refreshing) return;
      var flag = null;
      try {
        flag = sessionStorage.getItem(RELOAD_ONCE_KEY);
      } catch (_) {}
      if (flag === "pending") {
        try {
          sessionStorage.removeItem(RELOAD_ONCE_KEY);
        } catch (_) {}
        refreshing = true;
        location.reload();
        return;
      }
      // First SW install (no prior controller): no forced reload mid-page
    });

    window.addEventListener("load", function () {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then(function (reg) {
          try {
            reg.update();
          } catch (_) {}
          wireSwUpdates(reg);
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
