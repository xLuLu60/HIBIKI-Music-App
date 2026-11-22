const CACHE = 'hibiki-15-shell-v1';
const SHELL = ['./', './index.html', './styles.css', './src/app.js', './src/storage.js', './src/auth.js', './manifest.webmanifest', './assets/icon.svg'];
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
