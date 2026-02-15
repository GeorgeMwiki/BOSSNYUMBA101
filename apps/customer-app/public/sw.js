/* eslint-disable no-restricted-globals */
/**
 * BOSSNYUMBA Customer App - Service Worker
 * Handles: static asset caching, offline fallback, background sync, push notifications
 */

const CACHE_NAME = 'bossnyumba-customer-v2';
const OFFLINE_FALLBACK = '/offline';
const PAYMENT_SYNC_TAG = 'payment-sync';

// Static assets to cache on install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Cache strategies
const CACHE_FIRST_PATTERNS = [
  /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|eot)$/i,
  /\/icons\//,
];
const NETWORK_FIRST_PATTERNS = [
  /\/api\//,
  /\/payments\//,
  /\/auth\//,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] Precache failed:', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin (except same-origin API)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin && !url.pathname.startsWith('/api')) return;

  // Static assets: cache first
  if (CACHE_FIRST_PATTERNS.some((re) => re.test(url.pathname))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // API / dynamic: network first
  if (NETWORK_FIRST_PATTERNS.some((re) => re.test(url.pathname))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // HTML/navigation: network first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() =>
          caches.match(request).then((r) => r || caches.match(OFFLINE_FALLBACK) || caches.match('/'))
        )
    );
    return;
  }

  // Default: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// Background sync for payments
self.addEventListener('sync', (event) => {
  if (event.tag === PAYMENT_SYNC_TAG) {
    event.waitUntil(syncPayments());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? 'BOSSNYUMBA';
  const options = {
    body: data.body ?? '',
    icon: data.icon ?? '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: data.tag ?? 'default',
    data: { url: data.url ?? '/', ...data },
    actions: data.actions ?? [],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        if (clients.length) {
          clients[0].focus();
          clients[0].navigate?.(url);
        } else if (self.clients.openWindow) {
          self.clients.openWindow(url);
        }
      })
  );
});

// --- Cache strategies ---

function cacheFirst(request) {
  return caches.match(request).then((cached) => cached ?? fetch(request));
}

function networkFirst(request) {
  return fetch(request)
    .then((res) => {
      const clone = res.clone();
      if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(request, clone));
      return res;
    })
    .catch(() => caches.match(request));
}

function staleWhileRevalidate(request) {
  return caches.match(request).then((cached) => {
    const fetchPromise = fetch(request).then((res) => {
      const clone = res.clone();
      if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(request, clone));
      return res;
    });
    return cached ?? fetchPromise;
  });
}

async function syncPayments() {
  // Payment sync logic - client stores pending payments in IndexedDB
  // This runs when back online; client reads from IndexedDB and retries
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((c) => c.postMessage({ type: 'SYNC_PAYMENTS' }));
}
