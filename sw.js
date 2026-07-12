// Wilbanks Field Tech Service Worker
// Cache name: bump on every deployment that changes assets
const CACHE_NAME = 'wc-fieldtech-staging-fieldwhite-20260712-193936';

// Note: index.html is intentionally NOT precached. It is served network-first
// (see fetch handler) so the installed PWA always picks up the current hashed
// bundle after a deploy and can never get stuck on a stale shell (black screen).
const URLS_TO_CACHE = [];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
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

// ── Fetch ────────────────────────────────────────────────────────────────────
// Strategy:
//   - API calls (railway.app): always network, never cached.
//   - Navigations / HTML (index.html): NETWORK-FIRST, fall back to cache only
//     when offline. This guarantees the installed PWA always loads the current
//     shell pointing at the live hashed bundle, so a stale cache can never
//     black-screen the app.
//   - Everything else (hashed assets, icons, css): cache-first (immutable).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Always go to network for API calls
  if (url.hostname.includes('railway.app')) {
    event.respondWith(fetch(req));
    return;
  }

  // Network-first for navigations and the HTML document
  const isHtml =
    req.mode === 'navigate' ||
    (req.destination === 'document') ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html');

  if (isHtml && req.method === 'GET') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Cache-first for same-origin static assets (hashed → immutable)
  event.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((response) => {
        if (response && response.status === 200 && req.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
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
