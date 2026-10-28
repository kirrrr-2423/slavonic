'use strict';
/* Работа без интернета: все файлы программы хранятся в кэше браузера.
   Версия меняется при каждой сборке — тогда браузер скачивает новые файлы. */
const VERSION = '035ab2b264a8';
const CACHE = 'cs-app-' + VERSION;
const FONTS = 'cs-fonts';
const ASSETS = ["./", "app.js", "checker.js", "data.js", "dictionary.js", "fonts/FreeSerif.woff", "forms.js", "icons/apple-touch-icon.png", "icons/favicon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-192.png", "icons/maskable-512.png", "index.html", "keyboard.js", "manifest.webmanifest", "slovar-data.js", "styles.css", "titla.js", "web.css", "web.js"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      const index = new URL('index.html', self.registration.scope).href;
      event.respondWith(caches.match(index).then((hit) => hit || fetch(req)));
      return;
    }
    event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
    return;
  }
  // шрифт Ponomar с Google Fonts: один раз скачать — дальше брать из кэша
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(FONTS).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }));
  }
});
