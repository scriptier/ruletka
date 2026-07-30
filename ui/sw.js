/* ruletka.vip — light service worker (shell offline hint only). */
const CACHE = "rulet-shell-v1";
const SHELL = [
  "/live.html",
  "/style.css",
  "/live-stage.css",
  "/favicon.svg",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for app shell; fall back to cache if offline
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache WS or live API
  if (url.pathname === "/ws" || url.pathname === "/health" || url.pathname === "/config.json") {
    return;
  }
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache successful same-origin navigations / static
        if (res.ok && (req.mode === "navigate" || /\.(css|js|svg|webmanifest)$/.test(url.pathname))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("/live.html")))
  );
});
