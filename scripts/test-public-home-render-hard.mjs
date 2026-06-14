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
const sorteios = read("src/pages/Sorteios.tsx");
const fazendinhaSection = read("src/components/FazendinhaSection.tsx");
const app = read("src/App.tsx");
const theme = read("src/context/theme/ThemeContext.tsx");
const branding = read("src/context/tenant-branding/TenantBrandingContext.tsx");
const campaignMediaHero = read("src/components/CampaignMediaHero.tsx");
const api = read("src/services/api.ts");
const standardRaffleMediaBlock = read("src/components/StandardRaffleMediaBlock.tsx");
const mediaRenderer = read("src/components/MediaRenderer.tsx");
const css = read("src/index.css");

includesAll(home, [
  "PublicHomeErrorBoundary",
  "componentDidCatch",
  "PublicHomeFallback",
  "Não foi possível carregar as campanhas",
  "Tentar novamente",
  "Nenhuma campanha ativa no momento",
  "Array.isArray(rawRaffles)",
  "normalizePublicRaffle",
  "normalizeRaffleMediaType",
  "normalizeRaffleMediaFit",
  "safeProgress",
  "homeDebug",
  "[public-home] loading",
  "[public-home] raffles_count",
  "[public-home] render_error",
  "refetchRaffles",
  "<Hero raffle={featuredRaffle} ranking={ranking} topSellers={topSellers} />",
  "fetch(`/api/raffles/${featuredRaffle.id}/top-sellers`)",
  "className=\"cfx-home-hero-media\"",
  "resolveHomeHeroMedia",
  "className=\"cfx-home-hero-quick-cta\"",
  "Comprar Agora",
  "const secondaryRaffles = useMemo",
  "<CampaignsSection raffles={secondaryRaffles} />",
  "if (raffles.length === 0) return null",
  "className=\"cfx-home-progress\"",
  "TopSellers"
], "Home publica resiliente");

assert.ok(home.indexOf("PublicHomeErrorBoundary") < home.indexOf("function HomeContent"), "Boundary deve envolver a Home antes da renderizacao dos hooks/componentes.");
assert.ok(home.includes("const heroMedia = resolveHomeHeroMedia(raffle);"), "Home deve decidir midia do hero pelo slot exclusivo da Home.");
assert.ok(home.includes("heroMedia.hasMedia &&"), "Home nao deve renderizar bloco de midia quando o slot da Home estiver vazio.");
assert.ok(home.includes('fallbackImageUrl=""'), "Home nao deve usar imagem de campanha como fallback da midia da Home.");
assert.ok(home.includes("if (rawMedia)") && home.includes("mediaUrl: rawMedia"), "Home deve usar MediaDelivery/Bunny publicado como midia principal.");
assert.ok(home.indexOf("className=\"cfx-home-hero-quick-cta\"") < home.indexOf("<TopBuyers ranking={ranking} />"), "CTA Comprar Agora deve aparecer no primeiro bloco mobile.");
assert.equal(home.includes("Rifa principal"), false, "Home nao deve mostrar selo Rifa principal.");
assert.equal(home.includes("className=\"cfx-home-price-strip\""), false, "Home nao deve duplicar valor da cota no hero.");
assert.equal(home.includes("className=\"cfx-home-secondary\""), false, "Home nao deve mostrar CTA secundario Meus bilhetes no hero.");
assert.equal(home.includes("AffiliateSection"), false, "Home nao deve mostrar bloco Seja afiliado.");
assert.equal(home.includes("HowItWorksSection"), false, "Home nao deve mostrar Como funciona.");
assert.equal(home.includes("SupportSection"), false, "Home nao deve mostrar bloco de duvidas.");
assert.equal(home.includes("PaymentAndLiveSection"), false, "Home nao deve mostrar sorteio ao vivo na Home.");

assert.ok(fazendinhaSection.includes("const config = data?.config;"), "FazendinhaSection deve guardar config opcional.");
assert.ok(fazendinhaSection.includes("if (!config.enabled || config.status !== \"active\")"), "FazendinhaSection deve proteger config inativa/ausente.");
assert.ok(fazendinhaSection.indexOf("if (!config.enabled || config.status !== \"active\")") < fazendinhaSection.indexOf("const configName"), "FazendinhaSection nao pode acessar config antes do guard.");
assert.ok(!fazendinhaSection.includes("data.config"), "FazendinhaSection nao deve acessar data.config diretamente.");

includesAll(home, [
  "className=\"cfx-home-hero-quick-cta\"",
  "className=\"cfx-top-buyers\""
], "Home deve manter CTA unico e ranking compactos.");
includesAll(css, [
  ".cfx-home-hero-fallback",
  ".cfx-home-hero-quick-cta"
], "CSS deve garantir fallback visual e CTA mobile cedo.");
assert.equal(home.includes("Rifas ativas"), false, "Titulo Rifas ativas deve ser removido da Home publica.");
assert.equal(home.includes("pb-40"), false, "Home nao deve manter spacer grande antes do rodape.");

includesAll(theme, ["LOCKED_THEME_ID", "\"vimeu_dark\"", "applyThemeVariables"], "Tema vimeu_dark deve continuar aplicado.");
includesAll(branding, ["fallbackBranding", "normalizeBranding", "catch", "setBranding(fallbackBranding)"], "Branding nulo/falho deve cair para fallback.");
includesAll(campaignMediaHero, ["const hasMedia = Boolean(mediaUrl && !failed)", "Banner da campanha"], "CampaignMediaHero deve tolerar midia nula.");
includesAll(api, ["content-type", "application/json", "Array.isArray(payload) ? payload as Raffle[] : []"], "Servico publico de rifas deve rejeitar HTML e tolerar payload nao array.");
includesAll(standardRaffleMediaBlock, [
  "clean-media-block",
  "media-info-block",
  "preferredFit={preferredFit}",
  "aspectMode={aspectMode}",
  "autoPlay",
  "playsInline",
  "controls={false}",
  "interactive={false}",
  "mediaClassName=\"h-full w-full\""
], "Hero principal mobile deve mostrar midia limpa e completa sem controles nativos.");
includesAll(mediaRenderer, ["alt = \"\"", "alt={alt}"], "MediaRenderer nao deve renderizar alt quebrado como Media.");
assert.equal(mediaRenderer.includes("alt=\"Media\""), false, "MediaRenderer nao deve mostrar texto Media quebrado.");
includesAll(app, ["<Route path=\"/\" element={<Home />} />", "<Route path=\"/login\" element={<Login />} />", "TenantBrandingProvider"], "Rotas publicas principais devem continuar registradas.");
includesAll(app, ["const Sorteios = lazy(() => import(\"./pages/Sorteios\")", "<Route path=\"/sorteios\" element={<Sorteios />} />"], "Rota publica Sorteios deve estar registrada.");
assert.equal(app.includes("<Route path=\"/sorteios\" element={<Navigate to=\"/\" replace />} />"), false, "Sorteios nao deve redirecionar para Home.");
includesAll(sorteios, [
  "useRaffleCatalog",
  "fetch(\"/api/winners\")",
  "inferMediaType(media.mediaUrl)",
  "const campaignMedia = safeText(raffle.image || raffle.imageUrl",
  "className=\"cfx-draws-hero is-compact\"",
  "Sorteios Ativos",
  "Sorteios Encerrados",
  "Ganhador",
  "Cota vencedora",
  "Resultado",
  "cfx-draw-participate-button",
  "Participar",
  "showProgress: false"
], "Pagina Sorteios deve exibir catalogo com ativos, encerrados e resultados.");
for (const forbiddenVisibleLabel of ["Bilhetes vendidos", "bilhetes vendidos", "Cotas vendidas", "cotas vendidas", "Total de bilhetes", "Total de cotas"]) {
  assert.equal(sorteios.includes(forbiddenVisibleLabel), false, `Pagina Sorteios nao deve renderizar quantidade: ${forbiddenVisibleLabel}`);
}
for (const forbiddenTopCopy of ["Escolha uma campanha ativa", "100% Seguro", "Participação protegida", "Participe agora e concorra.", "Veja os ganhadores.", "Ver todos"]) {
  assert.equal(sorteios.includes(forbiddenTopCopy), false, `Pagina Sorteios nao deve renderizar texto extra no topo: ${forbiddenTopCopy}`);
}

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

  const sorteiosPage = await get("/sorteios");
  assert.equal(sorteiosPage.response.status, 200, "/sorteios deve continuar servindo SPA.");

  const raffleDetails = await get("/raffle/1");
  assert.equal(raffleDetails.response.status, 200, "Clique/rota de detalhe da rifa deve continuar servindo SPA.");

  const admin = await get("/admin");
  assert.equal(admin.response.status, 200, "Admin deve continuar servindo SPA.");

  const debug = await get("/api/public/raffles-debug");
  assert.equal(debug.response.status, 200, "/api/public/raffles-debug deve continuar funcionando.");
  assert.equal(debug.response.headers.get("content-type")?.includes("application/json"), true, "/api/public/raffles-debug deve retornar JSON.");
  const debugJson = JSON.parse(debug.text);
  assert.equal(Boolean(debugJson.tenantSlug), true, "Debug deve confirmar tenant resolvido no dominio principal de teste.");
  assert.equal(debugJson.totalRaffles, 2, "Debug deve confirmar 2 rifas.");
  assert.equal(debugJson.activeRaffles, 2, "Debug deve confirmar 2 rifas ativas.");

  const raffles = await get("/api/raffles");
  assert.equal(raffles.response.status, 200, "/api/raffles deve retornar rifas publicas.");
  assert.equal(raffles.response.headers.get("content-type")?.includes("application/json"), true, "/api/raffles deve retornar JSON.");
  const rafflesJson = JSON.parse(raffles.text);
  assert.equal(Array.isArray(rafflesJson), true, "/api/raffles deve retornar lista.");
  const titles = rafflesJson.map(item => item.title).join(" | ");
  assert.match(titles, /Land Rover/i, "Land Rover deve aparecer na Home via API publica.");
  assert.match(titles, /iPhone/i, "iPhone deve aparecer na Home via API publica.");
  assert.equal(rafflesJson.filter(item => item.status === "active").length, 2, "Home deve ter 2 rifas ativas para renderizar.");
  const noMediaPayload = rafflesJson.map((item, index) => index === 0 ? { ...item, mediaUrl: null, image: null } : item);
  assert.doesNotThrow(() => JSON.stringify(noMediaPayload), "Fixture de campanha sem midia deve continuar serializavel.");
  assert.equal(noMediaPayload[0].mediaUrl, null, "Fixture cobre campaign.media ausente/null.");

  const catalog = await get("/api/public/raffles/catalog");
  assert.equal(catalog.response.status, 200, `/api/public/raffles/catalog deve retornar catalogo publico. Body: ${catalog.text.slice(0, 500)} Logs: ${output.slice(-1500)}`);
  assert.equal(catalog.response.headers.get("content-type")?.includes("application/json"), true, "/api/public/raffles/catalog deve retornar JSON.");
  const catalogJson = JSON.parse(catalog.text);
  assert.equal(Array.isArray(catalogJson), true, "Catalogo publico deve retornar lista.");
  assert.ok(catalogJson.every(item => ["active", "completed"].includes(item.status)), "Catalogo publico deve conter apenas rifas ativas ou encerradas.");

  console.log("PASS: Home publica protegida contra tela azul, com campanhas e fallbacks validados.");
} finally {
  server.kill("SIGTERM");
}
