/* Optional offline cache. Only used when the game is served over http(s). */
const CACHE = 'gossip-gardens-v98';
const FILES = ['./', 'index.html', 'style.css', 'icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest',
  'js/data.js', 'js/game.js', 'js/story.js', 'js/meta.js', 'js/sprites.js', 'js/portraits.js', 'js/art.js', 'js/paint.js',
  'js/audio.js', 'js/screens.js', 'js/tutorial.js', 'js/ui.js', 'audio/music.mp3'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first so edits show up while developing; fall back to cache when offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
