const CACHE_VERSION = "rifapro-public-v1";
const PUBLIC_ASSET_CACHE = `${CACHE_VERSION}:assets`;
const OFFLINE_URL = "/offline.html";

const NEVER_CACHE_PATTERNS = [
  /^\/api\//,
  /^\/admin(?:\/|$)/,
  /^\/superadmin(?:\/|$)/,
  /^\/checkout(?:\/|$)/,
  /^\/api\/checkout\//,
  /^\/api\/webhooks\//,
  /^\/api\/admin\//,
  /^\/api\/superadmin\//,
  /pix/i,
  /token/i
];

const PUBLIC_STATIC_PATTERNS = [
  /^\/assets\//,
  /^\/icons\//,
  /^\/uploads\/branding\//,
  /^\/fazendinha-animais-premium\.png$/,
  /^\/pwa-splash\.svg$/,
  /^\/offline\.html$/,
  /^\/manifest\.webmanifest$/
];

function isNeverCacheUrl(url) {
  return NEVER_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname));
}

function isPublicAsset(url, request) {
  if (isNeverCacheUrl(url)) return false;
  if (PUBLIC_STATIC_PATTERNS.some(pattern => pattern.test(url.pathname))) return true;
  return ["style", "script", "image", "font", "manifest"].includes(request.destination || "");
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(PUBLIC_ASSET_CACHE)
      .then(cache => cache.addAll([OFFLINE_URL, "/icons/pwa-icon.svg", "/icons/pwa-maskable.svg", "/pwa-splash.svg"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== PUBLIC_ASSET_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNeverCacheUrl(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  if (!isPublicAsset(url, request)) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(PUBLIC_ASSET_CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
