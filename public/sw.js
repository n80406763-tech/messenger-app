const CACHE_NAME = 'messenger-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('/index.html'));
    })
  );
});


self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let title = 'Messenger';
      let body = 'Новое сообщение';
      let url = '/';

      try {
        const subscription = await self.registration.pushManager.getSubscription();
        if (subscription?.endpoint) {
          const response = await fetch(`/api/push/pull?endpoint=${encodeURIComponent(subscription.endpoint)}`);
          if (response.ok) {
            const data = await response.json();
            if (data?.notification) {
              title = data.notification.title || title;
              body = data.notification.body || body;
              url = data.notification.url || url;
            }
          }
        }
      } catch {
        // fallback to generic notification
      }

      await self.registration.showNotification(title, {
        body,
        badge: '/icon-192.svg',
        icon: '/icon-192.svg',
        data: { url }
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const targetUrl = event.notification?.data?.url || '/';
      const existing = windowClients.find((client) => client.url.includes('/') && 'focus' in client);
      if (existing) return existing.focus();
      return clients.openWindow(targetUrl);
    })
  );
});
