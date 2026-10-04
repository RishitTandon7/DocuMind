// DocuMind Service Worker v3
// Strategy: NEVER cache /_next/static/chunks (JS bundles) in dev.
// Only cache truly immutable assets (images, fonts, manifest).
// HTML pages always go network-first.

const CACHE_VERSION = 'documind-v3';
const IMMUTABLE_CACHE = 'documind-immutable-v3';

// Truly immutable assets safe to cache forever
const IMMUTABLE_EXTENSIONS = /\.(png|jpg|jpeg|webp|svg|ico|woff2?|ttf|otf)$/;

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  // Skip waiting immediately so the new SW takes over right away
  self.skipWaiting();
  event.waitUntil(
    caches.open(IMMUTABLE_CACHE).then((cache) =>
      cache.addAll([
        '/icon-192.png',
        '/icon-512.png',
        '/apple-touch-icon.png',
        '/icon.svg',
        '/manifest.json',
      ]).catch((err) => console.warn('[SW] Pre-cache failure (non-fatal):', err))
    )
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_VERSION && k !== IMMUTABLE_CACHE)
            .map((k) => {
              console.log('[SW] Deleting stale cache:', k);
              return caches.delete(k);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET
  if (request.method !== 'GET') return;

  // Never intercept API calls
  if (url.pathname.startsWith('/api/')) return;

  // Never intercept non-http(s)
  if (!url.protocol.startsWith('http')) return;

  // ── RULE 1: JS/CSS chunks from Next.js → ALWAYS NETWORK, never cache ──
  // This prevents stale module bundles from being served after code changes.
  if (
    url.pathname.startsWith('/_next/static/chunks/') ||
    url.pathname.startsWith('/_next/static/css/') ||
    url.pathname.startsWith('/_next/') && url.pathname.endsWith('.js')
  ) {
    // Let the browser handle normally — no SW interception
    return;
  }

  // ── RULE 2: Truly immutable assets (images, fonts, icons) → cache-first ──
  if (IMMUTABLE_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(IMMUTABLE_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── RULE 3: HTML pages → network-first, no cache fallback in dev ──
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request).catch(() => caches.match('/') ?? new Response('Offline', { status: 503 }))
    );
    return;
  }

  // ── RULE 4: Everything else → network only (no caching) ──
  // This covers /_next/static/media, webpack HMR, etc.
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'DocuMind', body: 'Document ready' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })
  );
});
