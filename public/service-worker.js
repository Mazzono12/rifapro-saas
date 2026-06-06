const CACHE_VERSION = "rifapro-enterprise-pwa-v1";
const STATIC_CACHE = `${CACHE_VERSION}:static`;
const OFFLINE_URL = "/offline.html";

const STATIC_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/pwa-icon.svg",
  "/icons/pwa-maskable.svg",
  "/pwa-splash.svg"
];

const NEVER_CACHE = [
  /^\/api\//,
  /^\/admin(?:\/|$)/,
  /^\/superadmin(?:\/|$)/,
  /^\/checkout(?:\/|$)/,
  /^\/assets\/.*\.(?:js|css)$/i,
  /pix/i,
  /token/i
];

function isNeverCache(url) {
  return NEVER_CACHE.some(pattern => pattern.test(url.pathname));
}

function parsePushPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    return { title: "Nova notificacao", body: event.data.text() };
  }
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => !key.startsWith(CACHE_VERSION)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isNeverCache(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (!["image", "font", "manifest"].includes(request.destination || "") && !url.pathname.startsWith("/icons/") && !url.pathname.startsWith("/uploads/branding/")) return;

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok && response.type === "basic") {
        const clone = response.clone();
        caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
      }
      return response;
    }))
  );
});

self.addEventListener("push", event => {
  const payload = parsePushPayload(event);
  const title = String(payload.title || "Nova notificacao");
  const options = {
    body: String(payload.body || "Ha uma atualizacao importante na plataforma."),
    icon: String(payload.icon || "/icons/pwa-icon.svg"),
    image: payload.image ? String(payload.image) : undefined,
    badge: "/icons/pwa-maskable.svg",
    data: {
      notificationId: String(payload.id || ""),
      actionUrl: String(payload.action_url || payload.actionUrl || "/")
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const data = event.notification.data || {};
  const actionUrl = typeof data.actionUrl === "string" && data.actionUrl.startsWith("/") ? data.actionUrl : "/";
  const notificationId = typeof data.notificationId === "string" ? data.notificationId : "";
  event.waitUntil((async () => {
    if (notificationId) {
      await fetch(`/api/push/notifications/${encodeURIComponent(notificationId)}/click`, { method: "POST" }).catch(() => null);
    }
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const target = new URL(actionUrl, self.location.origin).href;
    for (const client of windows) {
      if ("focus" in client) {
        await client.navigate(target).catch(() => null);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
