/* ruletka.vip — light service worker (app shell + offline page). */
const CACHE = "rulet-shell-v2";
const SHELL = [
  "/",
  "/index.html",
  "/live.html",
  "/offline.html",
  "/contribute.html",
  "/style.css",
  "/home.css",
  "/live-stage.css",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/brand/icon-192.png",
  "/brand/icon-512.png",
  "/brand/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        Promise.all(
          SHELL.map((url) =>
            c.add(url).catch(() => {
              /* optional asset missing — ignore */
            })
          )
        )
      )
      .then(() => self.skipWaiting())
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
                caches.match("/live.html") ||
                caches.match("/")
            )
        )
    );
    return;
  }

  // Static: network first, then cache
  if (isStaticAsset(url.pathname) || url.pathname.startsWith("/i18n/") || url.pathname.startsWith("/brand/")) {
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
