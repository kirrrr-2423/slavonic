'use strict';
// Generated from every packaged runtime asset, including the worker lifecycle template.
const VERSION = 'e3b4036eca623be8';
const PRECACHE = [
  "app.js",
  "checker.js",
  "data.js",
  "dictionary-popup.css",
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
  "practice.css",
  "practice.js",
  "pwa.css",
  "pwa.js",
  "reliability.css",
  "rule-popup.css",
  "rule-popup.js",
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
function inScope(client) {
  try {
    const url = new URL(client.url), scope = new URL(self.registration.scope);
    return url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
  } catch { return false; }
}
async function otherWindows(source) {
  const clients = await self.clients.matchAll({type:'window', includeUncontrolled:true});
  return clients.filter(client => client.id !== source.id && inScope(client));
}
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(
    PRECACHE.map(path => new Request(new URL(path, self.registration.scope), {cache:'reload'}))
  )));
  // Keep the old application running until the user explicitly accepts this version.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const previous = (await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE);
    // Keep two prior releases as a bounded safety margin for late clients and
    // an older worker finishing an in-flight request. Do not delete its cache
    // at the instant it is replaced. CacheStorage keys are in creation order.
    for (const key of previous.slice(0, -2)) await caches.delete(key);
    // The accepted update already replaces controllers of existing clients.
    // Only the first install claims previously uncontrolled network pages.
    if (previous.length === 0) await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'ACTIVATE_UPDATE') return;
  const source = event.source;
  if (!source || source.type !== 'window' || !inScope(source)) return;
  event.waitUntil((async () => {
    const reply = status => {
      try { source.postMessage({type:'UPDATE_RESULT', status, requestId:event.data.requestId}); }
      catch { /* The requesting window may have closed during the client check. */ }
    };
    try {
      if ((await otherWindows(source)).length) { reply('blocked'); return; }
      // Recheck after another asynchronous client snapshot. A window opened
      // during the first check must keep the old worker and its assets alive.
      if ((await otherWindows(source)).length) { reply('blocked'); return; }
      reply('accepted');
      await self.skipWaiting();
    } catch { reply('failed'); }
  })());
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
