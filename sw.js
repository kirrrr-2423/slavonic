'use strict';
// Generated from every packaged runtime asset, including the worker lifecycle template.
const VERSION = '91f1222faabdafd1';
const PRECACHE = [
  "app.js",
  "checker.js",
  "data.js",
  "dictionary.js",
  "fonts/FreeSerif-LICENSE.txt",
  "fonts/FreeSerif.woff",
  "fonts/Ponomar-OFL.txt",
  "fonts/Ponomar-Regular.otf",
  "forms.js",
  "icons/apple-touch-icon.png",
  "icons/favicon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-192.png",
  "icons/maskable-512.png",
  "index.html",
  "keyboard.js",
  "legacy-data.js",
  "legacy.js",
  "licenses/SCI-MIT.txt",
  "manifest.webmanifest",
  "practice-data.js",
  "practice.js",
  "pwa.css",
  "pwa.js",
  "slovar-data.js",
  "spell-data.js",
  "spell.js",
  "studio.css",
  "studio.js",
  "styles.css",
  "titla.js"
];
const PREFIX = 'slavonic-web:' + self.registration.scope + ':';
const CACHE = PREFIX + VERSION;
const INDEX = new URL('index.html', self.registration.scope).href;
const ASSETS = new Set(PRECACHE.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(
    PRECACHE.map(path => new Request(new URL(path, self.registration.scope), {cache:'reload'}))
  )));
  // Keep the old application running until the user explicitly accepts this version.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  // Sources and all other external links use the browser's normal network handling.
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  url.search = ''; url.hash = '';
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return await cache.match(INDEX) || fetch(request);
    })());
  } else if (ASSETS.has(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return await cache.match(url.href) || fetch(request);
    })());
  }
});
