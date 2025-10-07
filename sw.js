const CACHE_VERSION = 'v1';
const APP_SHELL = [
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/offline.html'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open('app-shell-' + CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.includes(CACHE_VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').includes('text/html'))) {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(req);
        const cache = await caches.open('runtime-' + CACHE_VERSION);
        cache.put(req, networkResponse.clone());
        return networkResponse;
      } catch (err) {
        const cacheResp = await caches.match('/index.html');
        return cacheResp || new Response('<h1>Offline</h1><p>No cached page available.</p>', { headers: {'Content-Type': 'text/html'} });
      }
    })());
    return;
  }

  // For images and static assets: cache-first
  if (req.destination === 'image' || /\.(png|jpg|jpeg|svg|gif|webp)$/.test(req.url)) {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(resp => { caches.open('runtime-' + CACHE_VERSION).then(c=>c.put(req, resp.clone())); return resp; })).catch(()=>caches.match('/icon-192.png')));
    return;
  }

  // default: network-first with fallback
  event.respondWith(fetch(req).catch(()=>caches.match(req)));
});