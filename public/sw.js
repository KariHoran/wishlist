/* Minimal PWA service worker:
 * - cache-first for static assets (icons, decor, Next static bundles, fonts)
 * - network-first for HTML navigations and /api (wishlist data must stay fresh)
 * - offline fallback: last cached page HTML when network fails
 */
const VERSION = "wishlist-sw-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;

const PRECACHE_URLS = [
  "/",
  "/login",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

function isStaticAsset(url) {
  const { pathname } = url;
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/decor/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|webp|svg|ico)$/i.test(pathname)
  );
}

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("wishlist-sw-") && !key.startsWith(VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Last resort: any cached same-origin document (visited pages shell)
    if (request.mode === "navigate") {
      const fallback =
        (await cache.match("/")) ||
        (await caches.match("/login")) ||
        (await caches.match(request, { ignoreSearch: true }));
      if (fallback) return fallback;
    }
    throw new Error("offline-and-uncached");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Never cache auth/session endpoints — always hit network.
  if (
    url.pathname.startsWith("/api/auth") ||
    url.pathname.startsWith("/monitoring")
  ) {
    return;
  }

  // API: network-only (no cache) so wishlist/auth JSON never goes stale or leaks across sessions.
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirst(request, PAGE_CACHE));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});
