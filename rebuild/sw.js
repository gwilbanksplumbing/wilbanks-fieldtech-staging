// Wilbanks Field Tech Service Worker
// Cache name: bump on every deployment that changes assets
const CACHE_NAME = 'wc-fieldtech-v20260526-FT13';

const URLS_TO_CACHE = [
  '.',
  './index.html',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch (network-first for API, cache-first for assets) ────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always go to network for API calls
  if (url.hostname.includes('railway.app')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for same-origin assets
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((response) => {
        if (response && response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
    )
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'New Job', body: 'You have a new job assigned.' };
  try {
    if (event.data) data = event.data.json();
  } catch (_) {}

  event.waitUntil(
    self.registration.showNotification(data.title || 'Wilbanks Field Tech', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.tag || 'job-notification',
      data: data,
    }).then(() => {
      // Set badge count to 1 on new push
      return self.navigator && self.navigator.setAppBadge
        ? self.navigator.setAppBadge(1)
        : Promise.resolve();
    })
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const jobId = event.notification.data && event.notification.data.jobId;
  const base = self.registration.scope;
  const url = jobId ? `${base}#/jobs/${jobId}` : base;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) { client.focus(); return; }
      }
      return clients.openWindow(url);
    })
  );
});

// ── Message handler (badge clearing) ─────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEARBADGE') {
    self.clearAppBadge && self.clearAppBadge();
  }
});
