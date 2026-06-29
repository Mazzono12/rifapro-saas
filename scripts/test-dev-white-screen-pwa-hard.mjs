import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const registerPwa = readFileSync("src/pwa/registerPwa.ts", "utf8");
const main = readFileSync("src/main.tsx", "utf8");
const viteConfig = readFileSync("vite.config.ts", "utf8");
const server = readFileSync("server.ts", "utf8");

function includesAll(source, snippets, label) {
  for (const snippet of snippets) {
    assert.ok(source.includes(snippet), `${label}: esperado encontrar ${snippet}`);
  }
}

includesAll(main, [
  "registerCifherServiceWorker",
  "void registerCifherServiceWorker();",
], "bootstrap PWA continua isolado do render");

includesAll(registerPwa, [
  "try {",
  "if (!(\"serviceWorker\" in navigator)) return;",
  "if (import.meta.env.DEV)",
  "await unregisterDevelopmentServiceWorkers();",
  "return;",
  "if (!import.meta.env.PROD) return;",
  "if (window.location.protocol !== \"https:\") return;",
  "navigator.serviceWorker.register(\"/service-worker.js\"",
  "if (import.meta.env.PROD)",
  "navigator.serviceWorker.register(\"/sw.js\"",
], "registro PWA seguro por ambiente");

includesAll(registerPwa, [
  "async function unregisterDevelopmentServiceWorkers()",
  "navigator.serviceWorker.getRegistrations().catch(() => [])",
  "registration.unregister().catch(() => false)",
  "if (\"caches\" in window)",
  "caches.keys().catch(() => [])",
  "key.startsWith(\"rifapro-\")",
  "caches.delete(key).catch(() => false)",
], "limpeza de service workers/caches antigos em dev");

const devBlock = registerPwa.slice(
  registerPwa.indexOf("if (import.meta.env.DEV)"),
  registerPwa.indexOf("if (!import.meta.env.PROD)")
);
assert.ok(devBlock.includes("unregisterDevelopmentServiceWorkers"), "DEV deve limpar SW antigo");
assert.ok(!devBlock.includes("serviceWorker.register"), "DEV nao deve registrar service worker");

assert.ok(!viteConfig.includes("ENABLE_HMR"), "Vite nao deve depender de ENABLE_HMR para ligar Fast Refresh");
assert.ok(!viteConfig.includes("DISABLE_HMR"), "Vite nao deve desligar HMR por variavel de workaround");
assert.ok(!/hmr\s*:\s*false/.test(viteConfig), "Vite nao deve forcar hmr:false");
assert.ok(!/watch\s*:\s*null/.test(viteConfig), "Vite nao deve desligar watch por padrao");

includesAll(server, [
  "isNodeProduction ? \"script-src 'self'\" : \"script-src 'self' 'unsafe-inline'\"",
  "Content-Security-Policy",
  "createViteServer",
  "middlewareMode: true",
], "CSP de dev deve permitir preamble inline do React Refresh sem relaxar producao");

console.log("test-dev-white-screen-pwa-hard: OK");
