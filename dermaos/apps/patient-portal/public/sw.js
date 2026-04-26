// Service Worker — DermaOS Portal do Paciente
// Estratégia: cache para assets estáticos (shell, JS, CSS, imagens UI).
// NUNCA cachear respostas de API com dados do paciente (dados sensíveis).

const CACHE_NAME = 'dermaos-portal-v1';
const OFFLINE_URL = '/offline';

// Assets estáticos que devem ser cacheados (shell do app)
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
];

// Padrões de URL que NUNCA devem ser cacheados (dados do paciente)
const NO_CACHE_PATTERNS = [
  /\/portal\//,       // Todos os endpoints da API do portal
  /\/api\//,          // API principal
  /\.json$/,          // Dados JSON dinâmicos
];

// ─── Install ─────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
    }),
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições não-GET
  if (request.method !== 'GET') return;

  // Ignorar extensões de browser e devtools
  if (url.protocol === 'chrome-extension:') return;

  // NUNCA cachear dados do paciente (API endpoints)
  const isApiRequest = NO_CACHE_PATTERNS.some((p) => p.test(url.pathname));
  if (isApiRequest) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Sem conexão. Verifique sua internet.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );
    return;
  }

  // Estratégia: Network first para navegação, Cache first para assets
  const isNavigation = request.mode === 'navigate';

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(OFFLINE_URL).then((r) => r ?? fetch(OFFLINE_URL))),
    );
    return;
  }

  // Assets estáticos: Cache first → Network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((networkResponse) => {
        // Só cachear responses bem-sucedidas de assets estáticos
        if (
          networkResponse.ok &&
          networkResponse.type !== 'opaque' &&
          (url.pathname.startsWith('/_next/static/') ||
           url.pathname.endsWith('.png') ||
           url.pathname.endsWith('.ico') ||
           url.pathname.endsWith('.svg') ||
           url.pathname === '/manifest.json')
        ) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      }).catch(() => {
        if (request.destination === 'image') {
          return new Response('', { status: 404 });
        }
        return caches.match(OFFLINE_URL) ?? new Response('Offline', { status: 503 });
      });
    }),
  );
});

// ─── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = { title: 'DermaOS', body: 'Nova notificação.' };
  try {
    data = event.data.json();
  } catch {
    data.body = event.data.text();
  }

  const options = {
    body:    data.body,
    icon:    '/icons/icon-192.png',
    badge:   '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    data:    { url: '/' },
    actions: [{ action: 'open', title: 'Ver' }],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    }),
  );
});
