/* ruletka — light service worker (offline shell + safe updates).
 *
 * Design:
 * - Pre-cache only a *small* offline shell (not live.js / webrtc.js — those change every deploy).
 * - Network-first for navigations + static assets; cache is offline fallback only.
 * - Bump CACHE when shell list changes so activate cleans old entries.
 * - No skipWaiting on install (avoids mid-call takeover); client posts SKIP_WAITING on Reload.
 */
const CACHE = "rulet-shell-v25";

/** Offline-safe shell only — keep small (no 250KB icons / mp4). Live stack is network-first. */
const SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/safety.html",
  "/donate.html",
  "/contribute.html",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/brand/favicon-32.png",
  "/brand/icon-192.png",
];

/** Paths that must never be served from cache (always hit network). */
function isVolatilePath(pathname) {
  return (
    pathname === "/live.js" ||
    pathname === "/live.html" ||
    pathname === "/live-stage.css" ||
    pathname === "/live-themes.css" ||
    pathname === "/webrtc.js" ||
    pathname === "/identity.js" ||
    pathname === "/hubs.js" ||
    pathname === "/i18n.js" ||
    pathname === "/pwa-install.js" ||
    pathname === "/web-push.js" ||
    pathname === "/brand.js" ||
    pathname === "/home.css" ||
    pathname === "/style.css" ||
    pathname === "/index.html" ||
    pathname === "/" ||
    pathname === "/admin.html" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/i18n/")
  );
}

self.addEventListener("install", (event) => {
  // Pre-cache shell only. Do NOT skipWaiting here — live calls must not
  // lose the controller mid-session; client shows “Update available” and
  // posts SKIP_WAITING when the user reloads.
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(
        SHELL.map((url) =>
          c.add(url).catch(() => {
            /* optional asset missing — ignore */
          })
        )
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
          for (const client of clients) {
            try {
              client.postMessage({ type: "SW_ACTIVATED", cache: CACHE });
            } catch (_) {}
          }
        })
      )
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data === "SKIP_WAITING" || data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/**
 * True Web Push — friend call when the tab is fully closed.
 * Hub sends AES128GCM payload JSON: { type, title, body, from_name, url, tag }.
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    if (event.data) {
      const t = event.data.text();
      try {
        data = JSON.parse(t);
      } catch (_) {
        data = { body: t };
      }
    }
  } catch (_) {}

  const title =
    (data && (data.title || data.from_name)) ||
    "Incoming call";
  const body =
    (data && (data.body || data.text)) ||
    (data && data.from_name
      ? `${data.from_name} is calling — tap to answer`
      : "A friend is calling — tap to answer");
  const tag = (data && data.tag) || "ruletka-friend-call";
  const url = (data && data.url) || "/live.html";
  const fromName = (data && data.from_name) || "";

  event.waitUntil(
    self.registration.showNotification(String(title).slice(0, 80), {
      body: String(body).slice(0, 180),
      tag,
      renotify: true,
      requireInteraction: true,
      silent: false,
      icon: "/brand/icon-192.png",
      badge: "/brand/favicon-32.png",
      data: {
        url,
        type: (data && data.type) || "friend_call_ring",
        from_name: fromName,
        from_user_id: (data && data.from_user_id) || "",
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = (event.notification && event.notification.data) || {};
  let path = data.url || "/live.html";
  if (typeof path !== "string" || !path.startsWith("/")) path = "/live.html";
  // Prefer live stage for friend rings
  const targetUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          try {
            if (client.url && client.url.indexOf(self.location.origin) === 0) {
              if ("focus" in client) {
                client.postMessage({
                  type: "PUSH_OPEN_CALL",
                  from_name: data.from_name || "",
                  from_user_id: data.from_user_id || "",
                });
                return client.focus();
              }
            }
          } catch (_) {}
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

function isApiPath(pathname) {
  return (
    pathname === "/ws" ||
    pathname === "/health" ||
    pathname === "/config.json" ||
    pathname.startsWith("/v1/")
  );
}

function isStaticAsset(pathname) {
  return /\.(css|js|svg|png|jpg|jpeg|webp|webmanifest|mp4|json|txt|xml|woff2?)$/i.test(
    pathname
  );
}

// Network-first for navigations + shell; cache fallback offline
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isApiPath(url.pathname)) return;

  // Volatile app code: network only (no cache put). Offline → no stale live.js.
  if (isVolatilePath(url.pathname)) {
    if (req.mode === "navigate" || url.pathname === "/live.html") {
      event.respondWith(
        fetch(req).catch(() =>
          caches.match("/offline.html").then((r) => r || caches.match("/"))
        )
      );
      return;
    }
    event.respondWith(
      fetch(req).catch(() =>
        // Prefer no response over wrong version for script/json
        new Response("", { status: 503, statusText: "Offline" })
      )
    );
    return;
  }

  // Navigations: network first → offline page
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then(
              (r) =>
                r ||
                caches.match("/offline.html") ||
                caches.match("/")
            )
        )
    );
    return;
  }

  // Static: network first, then cache
  if (
    isStaticAsset(url.pathname) ||
    url.pathname.startsWith("/brand/")
  ) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});
