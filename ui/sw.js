/* ruletka — light service worker (offline shell + safe updates).
 *
 * Design:
 * - Pre-cache only a *small* offline shell (not live.js / webrtc.js — those change every deploy).
 * - Network-first for navigations + static assets; cache is offline fallback only.
 * - Bump CACHE when shell list changes so activate cleans old entries.
 * - No skipWaiting on install (avoids mid-call takeover); client posts SKIP_WAITING on Reload.
 */
const CACHE = "rulet-shell-v6";

/** Offline-safe shell only — versioned live stack is always network-first. */
const SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/safety.html",
  "/donate.html",
  "/contribute.html",
  "/style.css",
  "/home.css",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/brand.js",
  "/pwa-install.js",
  "/brand/icon-192.png",
  "/brand/icon-512.png",
  "/brand/favicon-32.png",
  "/brand/logo-mark.png",
];

/** Paths that must never be served from cache (always hit network). */
function isVolatilePath(pathname) {
  return (
    pathname === "/live.js" ||
    pathname === "/live.html" ||
    pathname === "/webrtc.js" ||
    pathname === "/identity.js" ||
    pathname === "/hubs.js" ||
    pathname === "/i18n.js" ||
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
