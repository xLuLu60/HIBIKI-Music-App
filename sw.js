const CACHE = 'hibiki-15-shell-v2';
const SHELL = ['./', './index.html', './styles.css', './src/app.js', './src/storage.js', './src/auth.js', './src/search/search-ui.js', './src/search/search-engine.js', './src/search/search-normalizer.js', './src/search/search-ranking.js', './src/search/search-cache.js', './src/search/providers/library.js', './src/search/providers/youtube.js', './src/search/providers/soundcloud.js', './src/search/providers/jamendo.js', './manifest.webmanifest', './assets/icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
    return response;
  }).catch(async () => (await caches.match(request)) || (request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
