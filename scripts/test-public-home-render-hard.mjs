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
const fazendinhaSection = read("src/components/FazendinhaSection.tsx");
const app = read("src/App.tsx");
const theme = read("src/context/theme/ThemeContext.tsx");
const branding = read("src/context/tenant-branding/TenantBrandingContext.tsx");
const campaignMediaHero = read("src/components/CampaignMediaHero.tsx");

includesAll(home, [
  "PublicHomeErrorBoundary",
  "componentDidCatch",
  "PublicHomeFallback",
  "Não foi possível carregar as campanhas",
  "Tentar novamente",
  "Nenhuma campanha ativa no momento",
  "Array.isArray(rawRaffles)",
  "normalizePublicRaffle",
  "safeProgress",
  "[public-home] loading",
  "[public-home] raffles_count",
  "[public-home] render_error",
  "refetchRaffles"
], "Home publica resiliente");

assert.ok(home.indexOf("PublicHomeErrorBoundary") < home.indexOf("function HomeContent"), "Boundary deve envolver a Home antes da renderizacao dos hooks/componentes.");
assert.ok(home.includes("mediaUrl={featuredRaffle.mediaUrl || featuredRaffle.image}"), "Midia nula deve cair para imagem/fallback no hero principal.");
assert.ok(home.includes("mediaUrl={raffle.mediaUrl || raffle.image}"), "Midia nula deve cair para imagem/fallback nos cards.");

const configGuard = "if (!config?.enabled || config.status !== \"active\") return null;";
assert.ok(fazendinhaSection.includes("const config = data?.config;"), "FazendinhaSection deve guardar config opcional.");
assert.ok(fazendinhaSection.indexOf(configGuard) < fazendinhaSection.indexOf("const fazendinhaMedia"), "FazendinhaSection nao pode acessar config antes do guard.");
assert.ok(!fazendinhaSection.includes("data.config"), "FazendinhaSection nao deve acessar data.config diretamente.");

includesAll(theme, ["LOCKED_THEME_ID", "\"vimeu_dark\"", "applyThemeVariables"], "Tema vimeu_dark deve continuar aplicado.");
includesAll(branding, ["fallbackBranding", "normalizeBranding", "catch", "setBranding(fallbackBranding)"], "Branding nulo/falho deve cair para fallback.");
includesAll(campaignMediaHero, ["const hasMedia = Boolean(mediaUrl && !failed)", "Banner da campanha"], "CampaignMediaHero deve tolerar midia nula.");
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

  const homeDesktop = await get("/");
  assert.equal(homeDesktop.response.status, 200, "Home desktop deve retornar SPA 200.");
  assert.match(homeDesktop.text, /<div id="root"><\/div>/, "Fallback SPA deve servir o app para /.");

  const homeMobile = await get("/?preview=mobile");
  assert.equal(homeMobile.response.status, 200, "Home mobile 390px/preview deve retornar SPA 200.");

  const login = await get("/login");
  assert.equal(login.response.status, 200, "/login deve continuar funcionando.");

  const raffleDetails = await get("/raffle/1");
  assert.equal(raffleDetails.response.status, 200, "Clique/rota de detalhe da rifa deve continuar servindo SPA.");

  const admin = await get("/admin");
  assert.equal(admin.response.status, 200, "Admin deve continuar servindo SPA.");

  const debug = await get("/api/public/raffles-debug");
  assert.equal(debug.response.status, 200, "/api/public/raffles-debug deve continuar funcionando.");
  const debugJson = JSON.parse(debug.text);
  assert.equal(debugJson.totalRaffles, 2, "Debug deve confirmar 2 rifas.");
  assert.equal(debugJson.activeRaffles, 2, "Debug deve confirmar 2 rifas ativas.");

  const raffles = await get("/api/raffles");
  assert.equal(raffles.response.status, 200, "/api/raffles deve retornar rifas publicas.");
  const rafflesJson = JSON.parse(raffles.text);
  assert.equal(Array.isArray(rafflesJson), true, "/api/raffles deve retornar lista.");
  const titles = rafflesJson.map(item => item.title).join(" | ");
  assert.match(titles, /Land Rover/i, "Land Rover deve aparecer na Home via API publica.");
  assert.match(titles, /iPhone/i, "iPhone deve aparecer na Home via API publica.");
  assert.equal(rafflesJson.filter(item => item.status === "active").length, 2, "Home deve ter 2 rifas ativas para renderizar.");

  console.log("PASS: Home publica protegida contra tela azul, com campanhas e fallbacks validados.");
} finally {
  server.kill("SIGTERM");
}
