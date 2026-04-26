// Service Worker do vita id (push notifications + cache offline basico).
// Registrado em 08-perfil.html quando paciente clica "Receber lembretes".

const CACHE = 'vita-id-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push event (lembrete de consulta)
self.addEventListener('push', (event) => {
  let payload = { title: 'vita id', body: 'Voce tem uma notificacao' };
  try {
    if (event.data) payload = event.data.json();
  } catch (_e) {
    if (event.data) payload.body = event.data.text();
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/vitaid-logo.svg',
    badge: payload.badge || '/vitaid-logo.svg',
    data: payload.data || {},
    actions: payload.actions || [],
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'vita id', options)
  );
});

// Click em notificacao
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || '/08-perfil.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const c of clients) {
          if (c.url.includes(url) && 'focus' in c) return c.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
