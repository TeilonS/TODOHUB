/* service-worker.js
   Cache estático simples (Network falling back to Cache)
*/
const CACHE = 'todohub-v6';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/auth.js',
  './js/theme.js',
  './js/storage.js',
  './js/sw-register.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null)))
    )
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
