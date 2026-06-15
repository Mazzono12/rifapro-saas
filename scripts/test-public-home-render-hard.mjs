import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const serverEntry = "dist/server.js";
assert.equal(existsSync(serverEntry), true, "Execute npm run build antes deste teste.");

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(content, tokens, context) {
  for (const token of tokens) {
    assert.ok(content.includes(token), `${context}: esperado encontrar "${token}"`);
  }
}

const home = read("src/pages/Home.tsx");
const app = read("src/App.tsx");
const api = read("src/services/api.ts");
const branding = read("src/context/tenant-branding/TenantBrandingContext.tsx");
const standardRaffleMediaBlock = read("src/components/StandardRaffleMediaBlock.tsx");
const css = read("src/index.css");

includesAll(home, [
  "PublicHomeErrorBoundary",
  "componentDidCatch",
  "PublicHomeFallback",
  "Não foi possível carregar as campanhas",
  "Nenhuma campanha ativa no momento",
  "Array.isArray(rawRaffles)",
  "normalizePublicRaffle",
  "safeProgress",
  "homeDebug",
  "[public-home] loading",
  "[public-home] raffles_count",
  "[public-home] render_error",
  "<HomeV1Hero raffle={featuredRaffle} />",
  "<HomeV1Meta raffle={featuredRaffle} />",
  "<HomeV1LivePurchases items={livePurchases} />",
  "resolveHomeHeroMedia",
  "fallbackImageUrl=\"\"",
  "loadHomeRankings(activeRaffles)",
  "fetch(`/api/raffles/${featuredRaffle.id}/ranking`)",
  "fetch(`/api/raffles/${featuredRaffle.id}/top-sellers`)",
  "HomeV1FeaturedDraws",
  "HomeV1StayInside"
], "Home Premium V1 resiliente");

assert.ok(home.indexOf("PublicHomeErrorBoundary") < home.indexOf("function HomeContent"), "Boundary deve envolver a Home antes dos hooks.");
assert.ok(home.includes("const rawMedia = safeText(raffle.mediaUrl"), "Home deve usar o slot de midia da Home.");
assert.ok(home.includes("heroMedia.hasMedia ?"), "Home deve renderizar fallback premium quando nao houver midia.");
assert.equal(home.includes("cotas vendidas"), false, "Home nao deve mostrar cotas vendidas na meta.");
assert.equal(home.includes("bilhetes vendidos"), false, "Home nao deve mostrar bilhetes vendidos na meta.");
assert.equal(home.includes("className=\"cfx-home-price-strip\""), false, "Home nao deve duplicar valor da cota.");
assert.equal(home.includes("AffiliateSection"), false, "Home nao deve mostrar bloco seja afiliado.");
assert.equal(home.includes("HowItWorksSection"), false, "Home nao deve mostrar como funciona.");

includesAll(css, [
  ".cfx-home-premium-v1",
  ".cfx-v1-primary-cta",
  ".cfx-v1-media-empty",
  ".cfx-v1-progress",
  ".cfx-v1-live",
  ".cfx-v1-rankings",
  ".cfx-v1-empty"
], "CSS deve garantir fallback visual, CTA e blocos V1.");

includesAll(branding, ["fallbackBranding", "normalizeBranding", "home_branding", "setBranding(fallbackBranding)"], "Branding nulo/falho deve cair para fallback e expor Home Branding.");
includesAll(api, ["content-type", "application/json", "Array.isArray(payload) ? payload as Raffle[] : []"], "Servico publico de rifas deve rejeitar HTML e tolerar payload nao array.");
includesAll(standardRaffleMediaBlock, [
  "clean-media-block",
  "preferredFit={preferredFit}",
  "aspectMode={aspectMode}",
  "autoPlay",
  "playsInline",
  "controls={false}",
  "interactive={false}"
], "Home deve continuar usando o bloco padrao de midia limpa.");
includesAll(app, ["<Route path=\"/\" element={<Home />} />", "<Route path=\"/login\" element={<Login />} />", "TenantBrandingProvider"], "Rotas publicas principais devem continuar registradas.");

const port = Number(process.env.PORT || (3610 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  RIFAPRO_TEST_MODE: "true",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.public-home@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-public-home-render-hard-jwt-secret-long-value",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-public-home-render-hard-gateway-key"
};

const server = spawn(process.execPath, [serverEntry], {
  cwd: process.cwd(),
  env,
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
server.stdout.on("data", chunk => { output += chunk.toString(); });
server.stderr.on("data", chunk => { output += chunk.toString(); });

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) break;
    try {
      const response = await fetch(`${baseUrl}/api/public/health`);
      if (response.status === 200) return;
    } catch {
      // Server is still starting.
    }
    await wait(100);
  }
  throw new Error(`Servidor de teste nao iniciou a tempo.\n${output.slice(-2000)}`);
}

async function get(path, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      host: "principal.meudominio.com",
      "x-forwarded-host": "principal.meudominio.com",
      ...headers
    }
  });
  const text = await response.text();
  return { response, text };
}

try {
  await waitForServer();

  for (const path of ["/", "/?preview=mobile", "/login", "/sorteios", "/ganhadores", "/raffle/1", "/admin"]) {
    const page = await get(path);
    assert.equal(page.response.status, 200, `${path} deve retornar SPA 200.`);
    assert.match(page.text, /<div id="root"><\/div>/, `${path} deve servir o app.`);
  }

  const debug = await get("/api/public/raffles-debug");
  assert.equal(debug.response.status, 200, "/api/public/raffles-debug deve continuar funcionando.");
  assert.equal(debug.response.headers.get("content-type")?.includes("application/json"), true, "/api/public/raffles-debug deve retornar JSON.");
  const debugJson = JSON.parse(debug.text);
  assert.equal(Boolean(debugJson.tenantSlug), true, "Debug deve confirmar tenant resolvido.");
  assert.equal(debugJson.activeRaffles >= 1, true, "Debug deve confirmar pelo menos uma rifa ativa.");

  const raffles = await get("/api/raffles");
  assert.equal(raffles.response.status, 200, "/api/raffles deve retornar rifas publicas.");
  assert.equal(raffles.response.headers.get("content-type")?.includes("application/json"), true, "/api/raffles deve retornar JSON.");
  const rafflesJson = JSON.parse(raffles.text);
  assert.equal(Array.isArray(rafflesJson), true, "/api/raffles deve retornar lista.");
  assert.equal(rafflesJson.some(item => item.status === "active"), true, "Home deve ter ao menos uma rifa ativa para renderizar.");

  const brandingPayload = await get("/api/public/branding");
  assert.equal(brandingPayload.response.status, 200, "/api/public/branding deve retornar branding publico.");
  const brandingJson = JSON.parse(brandingPayload.text);
  assert.equal(Boolean(brandingJson.home_branding), true, "Branding publico deve conter home_branding.");
  assert.equal(["centered", "inline"].includes(brandingJson.home_branding.brandLayout), true, "home_branding deve ter layout valido.");

  console.log("PASS: Home Premium V1 publica e rotas preservadas.");
} finally {
  server.kill("SIGTERM");
}
