// STRAYMUTANT.DEV — Tamak Bookshop
// Path: public/sw.js
// Service worker for the counter POS. It does two small things so the till can be opened with no internet:
//   1. keeps a copy of the app's own files (/_next/static/..., which never change once published)
//   2. keeps the last copy of the POS page, and serves it only when the network is down or very slow
//   3. keeps the logo, icons and manifest so the till still looks right offline (refreshed whenever online)
// It does NOT touch anything else (no API calls, no other pages), so it cannot hide new content.
// If you change this file, bump VERSION so devices pick up the new rules and drop old copies.

const VERSION = 'v2';
const STATIC_CACHE = 'tamak-static-' + VERSION;
const PAGE_CACHE = 'tamak-pages-' + VERSION;
const ASSET_CACHE = 'tamak-assets-' + VERSION;
const ASSET_PATHS = ['/logo.png', '/icon.png', '/apple-icon.png', '/favicon.ico', '/manifest.webmanifest'];
const PAGE_TIMEOUT_MS = 8000;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = [STATIC_CACHE, PAGE_CACHE, ASSET_CACHE];
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('tamak-') && !keep.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Logo, icons and manifest: show the saved copy straight away, and quietly refresh it in the background.
  if (ASSET_PATHS.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Only the retail POS page itself. On the admin host the address is /pos.
  if (request.mode === 'navigate' && (url.pathname === '/pos' || url.pathname === '/admin/pos')) {
    event.respondWith(networkFirst(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await refresh) || Response.error();
}

async function networkFirst(request) {
  const cache = await caches.open(PAGE_CACHE);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    // Only keep a good copy of the real page. A redirect usually means "signed out", so never keep that.
    if (response.ok && !response.redirected) cache.put(request, response.clone());
    return response;
  } catch (error) {
    clearTimeout(timer);
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>Offline</title><body style="font-family:sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem">' +
        '<h1>No internet, and this page has not been saved yet</h1>' +
        '<p>Connect once, open the Counter sale page, and it will be saved on this device. ' +
        'After that it opens even when the internet is down.</p></body>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}