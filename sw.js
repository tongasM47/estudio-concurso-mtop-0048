// Service worker: funciona sin conexión después de la primera visita.
const CACHE = 'mtop0048-v3';
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'icon.svg', 'manifest.webmanifest',
  'data/const.json', 'data/d500a.json', 'data/d500b.json', 'data/d222.json', 'data/tocaf.json', 'data/tofupa.json', 'data/tofupb.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// Red primero (para recibir actualizaciones), caché como respaldo.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
