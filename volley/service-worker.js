/* Slime Volleyball — network-first service worker.
   Network-first so new deploys are always visible online; cache is only an
   offline fallback. Cross-origin (fonts/Supabase) is not intercepted. */
const CACHE = 'slimevolley-v8-icons';
const ASSETS = [
  './', './index.html', './404.html', './style.css', './game.js', './leaderboard.js',
  './manifest.webmanifest', './assets/favicon-32-v2.png',
  './assets/app-icon-volley-v2-16.png', './assets/app-icon-volley-v2-32.png',
  './assets/app-icon-volley-v2-180.png', './assets/app-icon-volley-v2-192.png',
  './assets/app-icon-volley-v2-512.png', './assets/app-icon-volley-v2-maskable-512.png',
  './assets/ikea-maintenance-slime.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => k === CACHE ? null : caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => { const copy = res.clone(); if (res.ok) caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
  );
});
