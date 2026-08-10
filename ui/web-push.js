/**
 * Web Push subscription for offline friend-call rings (tab fully closed).
 *
 * Flow:
 * 1. GET /config.json → vapid_public_key
 * 2. PushManager.subscribe({ applicationServerKey })
 * 3. hub register_push platform=web with subscription JSON
 *
 * Requires secure context + granted Notification permission + SW with push handler.
 */
(function (global) {
  "use strict";

  const LS_SUB = "ruletka-web-push-endpoint-v1";

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function pushSupported() {
    return (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      (window.isSecureContext || location.hostname === "localhost")
    );
  }

  async function fetchVapidPublic() {
    try {
      const r = await fetch("/config.json", { cache: "no-store" });
      if (!r.ok) return "";
      const j = await r.json();
      return String(j.vapid_public_key || "").trim();
    } catch (_) {
      return "";
    }
  }

  async function getRegistration() {
    if (!("serviceWorker" in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      return reg || null;
    } catch (_) {
      try {
        return await navigator.serviceWorker.getRegistration();
      } catch {
        return null;
      }
    }
  }

  /**
   * Subscribe (or reuse) and return PushSubscription JSON string, or null.
   * @returns {Promise<string|null>}
   */
  async function ensureSubscription() {
    if (!pushSupported()) return null;
    if (Notification.permission !== "granted") return null;

    const vapid = await fetchVapidPublic();
    if (!vapid) {
      console.info("[web-push] hub has no vapid_public_key — closed-tab rings off");
      return null;
    }

    const reg = await getRegistration();
    if (!reg || !reg.pushManager) {
      console.info("[web-push] no service worker / pushManager");
      return null;
    }

    let sub = null;
    try {
      sub = await reg.pushManager.getSubscription();
    } catch (_) {}

    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        });
      } catch (e) {
        console.warn("[web-push] subscribe failed", e);
        return null;
      }
    }

    try {
      const json = sub.toJSON ? sub.toJSON() : null;
      const token = json
        ? JSON.stringify(json)
        : JSON.stringify({
            endpoint: sub.endpoint,
            keys: {
              p256dh: arrayBufToB64(sub.getKey && sub.getKey("p256dh")),
              auth: arrayBufToB64(sub.getKey && sub.getKey("auth")),
            },
          });
      try {
        localStorage.setItem(LS_SUB, (json && json.endpoint) || sub.endpoint || "");
      } catch (_) {}
      return token;
    } catch (e) {
      console.warn("[web-push] serialize failed", e);
      return null;
    }
  }

  function arrayBufToB64(buf) {
    if (!buf) return "";
    const bytes = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    // URL-safe no pad (matches browser toJSON)
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /**
   * Register with hub via send({ type: "register_push", ... }).
   * @param {(obj: object) => boolean} sendFn
   * @param {boolean} enabled
   */
  async function syncHubPush(sendFn, enabled) {
    if (typeof sendFn !== "function") return { ok: false, reason: "no_send" };
    if (!enabled) {
      try {
        sendFn({ type: "register_push", token: "", platform: "web", clear: true });
      } catch (_) {}
      // Best-effort unsubscribe so we don't leave orphan browser endpoints
      try {
        const reg = await getRegistration();
        const sub = reg && (await reg.pushManager.getSubscription());
        if (sub) await sub.unsubscribe();
      } catch (_) {}
      try {
        localStorage.removeItem(LS_SUB);
      } catch (_) {}
      return { ok: true, reason: "cleared" };
    }
    const token = await ensureSubscription();
    if (!token) return { ok: false, reason: "no_subscription" };
    const sent = sendFn({
      type: "register_push",
      token,
      platform: "web",
      clear: false,
    });
    return { ok: !!sent, reason: sent ? "registered" : "ws_closed", tokenLen: token.length };
  }

  global.RuletWebPush = {
    pushSupported,
    ensureSubscription,
    syncHubPush,
    fetchVapidPublic,
  };
})(typeof window !== "undefined" ? window : globalThis);
