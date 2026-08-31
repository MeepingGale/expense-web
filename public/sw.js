/* Ledger service worker: offline-first app shell.
   Navigations go network-first (so deploys show up) with the cached shell as
   the offline fallback; same-origin assets (hashed JS/CSS, fonts, icons) are
   cached on first fetch and served cache-first after that. Bump CACHE to
   invalidate everything. */
const CACHE = "ledger-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          // "./" resolves against the SW script URL, so the shell caches under
          // the app's own path whether it's served at / or /expense-web/.
          caches.open(CACHE).then((c) => c.put("./", copy));
          return r;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit ||
      fetch(e.request).then((r) => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return r;
      }),
    ),
  );
});
