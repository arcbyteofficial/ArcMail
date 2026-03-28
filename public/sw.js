self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const parse = () => {
    try {
      if (!event.data) return null;
      return event.data.json();
    } catch {
      try {
        const text = event.data ? event.data.text() : '';
        return text ? JSON.parse(text) : null;
      } catch {
        return null;
      }
    }
  };
  const payload = parse() || {};
  const title = payload.title || 'ArcMail';
  const options = {
    body: payload.body || 'You have new mail.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.tag || 'arcmail',
    data: { url: payload.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of list) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(url);
            } catch {
              return;
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
