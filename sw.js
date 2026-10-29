const CACHE = 'ec-v4';
const FILES = ['./', 'index.html', 'config.js', 'app.js', 'styles.css', 'manifest.json', 'icon.svg'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', e => {
  // Audio et polices externes : le navigateur les charge directement (les requêtes partielles de l'audio passent mal par un service worker sur iPhone)
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
