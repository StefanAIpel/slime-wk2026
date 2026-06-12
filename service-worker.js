/* World Cup Slime — network-first service worker.
   Network-first zodat nieuwe deploys ALTIJD direct zichtbaar zijn online;
   cache dient alleen als offline-fallback. Cross-origin (PeerJS/fonts/Supabase)
   wordt niet onderschept. */
const CACHE = 'wcslime-v14-ned-slime';
const ASSETS = [
  './', './index.html', './404.html', './style.css', './game.js', './leaderboard.js', './manifest.webmanifest',
  './favicon.png', './assets/audio/bg-music.mp3', './assets/audio/whistle.mp3',
  './assets/icons/app-icon-soccer-wc26-v2-16.png', './assets/icons/app-icon-soccer-wc26-v2-32.png',
  './assets/icons/app-icon-soccer-wc26-v2-180.png', './assets/icons/app-icon-soccer-wc26-v2-192.png',
  './assets/icons/app-icon-soccer-wc26-v2-512.png', './assets/icons/app-icon-soccer-wc26-v2-maskable-512.png',
  './assets/icons/slimescore-app-icon-v2-192.png', './assets/icons/slimescore-app-icon-v2-512.png',
  './assets/slimes/ned-left.webp', './assets/slimes/ned-right.webp',
  './assets/ikea-maintenance-slime.png', './assets/slimescore-wk-poule-banner.webp', './assets/slime-volley-banner-3to1.webp'
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
  if (url.origin !== self.location.origin) return;   // CDN's gewoon doorlaten
  e.respondWith(
    fetch(req)
      .then(res => { const copy = res.clone(); if (res.ok) caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
  );
});
