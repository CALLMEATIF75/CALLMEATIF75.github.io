/* Abiana Manager — service worker (offline-capable; document is network-first
   so baked-data fixes reach the phone on the next open, assets cache-first) */
var CACHE = 'abiana-manager-v23';
var ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (u) {
        return c.add(new Request(u, { cache: 'no-cache' }));
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  if (e.data && (e.data.type === 'SKIP_WAITING' || e.data === 'SKIP_WAITING')) self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  /* Bill data is baked into index.html, so the DOCUMENT must never sit stale:
     navigations (and index.html itself) go network-first — fresh copy wins
     whenever the phone is online, cache is the offline fallback. Static
     assets stay cache-first (they only change with a cache-name bump). */
  var isDocument = e.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  if (isDocument) {
    e.respondWith(
      fetch(new Request(e.request, { cache: 'no-cache' })).then(function (res) {
        var c1 = res.clone(), c2 = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', c1); c.put('./', c2); });
        return res;
      }).catch(function () {
        return caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
