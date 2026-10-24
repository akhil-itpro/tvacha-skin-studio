/* Deliberately exclude app HTML, APIs, auth, face photos and all personal data from caches. */
const CACHE = 'tvacha-public-offline-v1';
const PUBLIC_FILES = ['/offline.html', '/icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('tvacha-public-offline-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (PUBLIC_FILES.includes(url.pathname) && !url.search) {
    event.respondWith(caches.match(url.pathname).then(cached => cached || fetch(request)));
    return;
  }
  if (request.mode === 'navigate' && !/^\/(api|signin-with-chatgpt|signout-with-chatgpt|callback)(\/|$)/.test(url.pathname)) {
    event.respondWith(fetch(request).catch(async () => (await caches.match('/offline.html')) || new Response('You are offline. Reconnect to use Tvacha.', { status: 503, headers: { 'Content-Type': 'text/plain' } })));
  }
});
