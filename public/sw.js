// Service Worker — static asset cache + offline fallback
const VERSION = 'v1.0.0';
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const PRECACHE = [
  '/',
  '/login',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !k.endsWith(VERSION)).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for API (fresh data wins), cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  // API: network-first with 4s timeout, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      Promise.race([
        fetch(request),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
      ])
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request).then(r => r || new Response(JSON.stringify({ error: '离线，无缓存数据' }), { status: 503, headers: { 'Content-Type': 'application/json' } })))
    );
    return;
  }

  // Static: cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (res.ok && (url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/) || res.headers.get('content-type')?.includes('text/html'))) {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(request, clone));
        }
        return res;
      });
    })
  );
});
