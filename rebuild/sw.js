// Wilbanks Field Tech — STAGING Service Worker
const CACHE_NAME = 'wc-fieldtech-rebuild-v1';
const BASE = '/wilbanks-fieldtech-staging/rebuild';

const URLS_TO_CACHE = [
  BASE + '/',
  BASE + '/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.hostname.includes('railway.app')) {
    event.respondWith(fetch(event.request));
    return;
  }
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

self.addEventListener('push', (event) => {
  let data = { title: 'New Job', body: 'You have a new job assigned.' };
  try { if (event.data) data = event.data.json(); } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Wilbanks Field Tech', {
      body: data.body || '',
      icon: BASE + '/icons/icon-192.png',
      badge: BASE + '/icons/badge-72.png',
      tag: data.tag || 'job-notification',
      data: data,
    }).then(() => {
      return self.navigator && self.navigator.setAppBadge
        ? self.navigator.setAppBadge(1)
        : Promise.resolve();
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const jobId = event.notification.data && event.notification.data.jobId;
  const url = jobId ? BASE + '/jobs/' + jobId : BASE + '/jobs';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) { client.focus(); return; }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEARBADGE') {
    self.clearAppBadge && self.clearAppBadge();
  }
});
