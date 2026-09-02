/*
 * MONO service worker — hand-rolled, no build step, no dependency.
 *
 * Strategy (deliberately conservative for a private two-person app):
 *   - Precache only the offline fallback + the app icons.
 *   - Cache-first for content-hashed build assets (/_next/static/**) and static images/fonts —
 *     they are immutable, so a hit is always correct.
 *   - Network-first for page navigations; on failure serve the cached /offline page. Page HTML
 *     is never written to the cache (it can contain one user's couple data).
 *   - /api/** and /media/** are never touched — always straight to the network. /media holds
 *     per-request-authorised couple photos and must not sit in a cache.
 *   - Everything else falls through to the browser untouched.
 *
 * Updating: bump VERSION. The new worker precaches, `skipWaiting()`s on the page's nudge, and
 * on activate deletes every cache whose name doesn't start with the current VERSION.
 */
const VERSION = "mono-v2";
const PRECACHE = VERSION + "-precache";
const STATIC = VERSION + "-static";

const PRECACHE_URLS = [
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => {
        /* a missing precache URL must not block install */
      }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// --- Web Push -------------------------------------------------------------
// The server sends an encrypted JSON body { title, body, url, tag }. `userVisibleOnly` was
// required at subscribe time, so every push must show a notification.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "MONO", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "MONO";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/notifications", self.location.origin);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        const url = new URL(client.url);
        if (url.pathname === target.pathname && "focus" in client) return client.focus();
      }
      const anyClient = windows.find((c) => "focus" in c);
      if (anyClient) {
        await anyClient.focus();
        return anyClient.navigate(target.href);
      }
      return self.clients.openWindow(target.href);
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache private or sensitive paths — hand them straight to the network.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/media/")) return;

  // Immutable, content-hashed build assets.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Stable static files (icons, fonts, images, the manifest).
  if (
    url.pathname.startsWith("/icons/") ||
    /\.(?:png|jpg|jpeg|webp|gif|svg|ico|woff2?|webmanifest)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Page navigations: fresh content when online, the offline page when not.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/offline", { ignoreSearch: true }).then(
          (cached) =>
            cached ||
            new Response("You are offline.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            }),
        ),
      ),
    );
    return;
  }

  // Anything else (RSC payloads, etc.): untouched — the browser handles it.
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === "basic") {
      const cache = await caches.open(STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline and nothing cached — let the caller see the failure.
    return caches.match(request).then((c) => c || Response.error());
  }
}
