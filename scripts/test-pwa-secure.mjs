import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function includesAll(content, expected, label) {
  const missing = expected.filter(item => !content.includes(item));
  if (missing.length) throw new Error(`${label} sem trechos obrigatorios: ${missing.join(", ")}`);
}

for (const file of ["public/sw.js", "public/offline.html", "public/icons/pwa-icon.svg", "public/icons/pwa-maskable.svg", "public/pwa-splash.svg"]) {
  if (!existsSync(join(root, file))) throw new Error(`Arquivo PWA ausente: ${file}`);
}

const html = read("index.html");
const sw = read("public/sw.js");
const server = read("server.ts");
const app = read("src/App.tsx");
const installPrompt = read("src/components/pwa/PwaInstallPrompt.tsx");
const main = read("src/main.tsx");
const register = read("src/pwa/registerPwa.ts");
const branding = read("src/context/tenant-branding/TenantBrandingContext.tsx");

includesAll(html, [
  "manifest.webmanifest",
  "theme-color",
  "apple-mobile-web-app-capable",
  "apple-touch-startup-image",
  "/icons/pwa-icon.svg"
], "index PWA");

includesAll(server, [
  "app.get(\"/manifest.webmanifest\"",
  "application/manifest+json",
  "theme_color",
  "publicTenantBranding",
  "branding.logo_url",
  "pwa-maskable.svg",
  "pwa-splash.svg"
], "manifest dinamico por tenant");

includesAll(sw, [
  "CACHE_VERSION",
  "OFFLINE_URL",
  "NEVER_CACHE_PATTERNS",
  "PUBLIC_STATIC_PATTERNS",
  "/^\\/api\\//",
  "/^\\/admin(?:\\/|$)/",
  "/^\\/superadmin(?:\\/|$)/",
  "/^\\/checkout(?:\\/|$)/",
  "request.mode === \"navigate\"",
  "caches.open(PUBLIC_ASSET_CACHE)"
], "service worker seguro");

if (/cache\.put\(request/.test(sw) && !/isPublicAsset\(url, request\)/.test(sw)) {
  throw new Error("Service worker precisa limitar cache a assets publicos");
}
if (/localStorage|sessionStorage|Authorization|Bearer|access_token|refresh_token/i.test(sw)) {
  throw new Error("Service worker nao pode manipular tokens ou autorizacao");
}

includesAll(app, ["PwaInstallPrompt"], "App PWA");
includesAll(installPrompt, ["beforeinstallprompt", "Voce esta offline", "Instalar", "navigator.onLine"], "UI PWA");
includesAll(main, ["registerCifherServiceWorker"], "bootstrap service worker");
includesAll(register, ["navigator.serviceWorker.register(\"/sw.js\"", "window.location.protocol !== \"https:\"", "localhost"], "registro service worker");
includesAll(branding, ["meta[name=\"theme-color\"]", "themeColor.content = primary"], "theme color por tenant");

console.log("[pwa-secure] ok");
