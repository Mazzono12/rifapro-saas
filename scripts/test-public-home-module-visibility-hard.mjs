import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function hasAll(content, tokens, context) {
  for (const token of tokens) {
    assert.ok(content.includes(token), `${context}: esperado encontrar "${token}"`);
  }
}

function hasNone(content, tokens, context) {
  for (const token of tokens) {
    assert.equal(content.includes(token), false, `${context}: nao deve conter "${token}"`);
  }
}

const home = read("src/pages/Home.tsx");
const css = read("src/index.css");
const brandingContext = read("src/context/tenant-branding/TenantBrandingContext.tsx");
const brandingSettings = read("src/components/branding/BrandingSettingsForm.tsx");
const adminRaffles = read("src/pages/admin/AdminRaffles.tsx");
const publicBottomNav = read("src/components/PublicBottomNav.tsx");
const navbar = read("src/components/Navbar.tsx");
const server = read("server.ts");
const app = read("src/App.tsx");

hasAll(home, [
  "cfx-home-premium-v1",
  "HomeV1Brand",
  "HomeV1Hero",
  "HomeV1Meta",
  "HomeV1LivePurchases",
  "HomeV1Rankings",
  "HomeV1Chances",
  "HomeV1Winners",
  "HomeV1FeaturedDraws",
  "HomeV1StayInside",
  "HomeV1TrustStrip",
  "StandardRaffleMediaBlock",
  "fallbackImageUrl=\"\"",
  "aspectMode={homeMediaAspect}",
  "preferredFit={resolveHomeMediaFit(raffle.mediaFit)}",
  "loadHomeRankings(activeRaffles)",
  "fetch(`/api/raffles/${featuredRaffle.id}/top-sellers`)",
  "Compras ao vivo",
  "Você pode ser o primeiro ganhador",
  "Novos sorteios chegando",
  "Muitas chances de ganhar",
  "Participar Agora"
], "Home Premium V1 deve conter a nova estrutura mobile");

hasNone(home, [
  "StoriesSection",
  "Rifa principal",
  "cfx-home-price-strip",
  "POR APENAS",
  "Meus bilhetes",
  "Como funciona",
  "Seja um afiliado",
  "Sorteio ao vivo",
  "cotas vendidas",
  "bilhetes vendidos"
], "Home Premium V1 nao deve manter blocos antigos nem numeros absolutos visiveis");

assert.ok(
  home.indexOf("<HomeV1Hero raffle={featuredRaffle} />") < home.indexOf("<HomeV1Meta raffle={featuredRaffle} />"),
  "Hero deve aparecer antes da meta."
);
assert.ok(
  home.indexOf("<HomeV1Meta raffle={featuredRaffle} />") < home.indexOf("<HomeV1LivePurchases items={livePurchases} />"),
  "Meta deve aparecer antes de compras ao vivo."
);

hasAll(css, [
  "HOME PREMIUM V1 MOBILE",
  ".cfx-home-premium-v1",
  ".public-shell:has(.cfx-home-premium-v1) .premium-site-header",
  ".cfx-v1-shell",
  "width: min(100%, 430px)",
  ".cfx-v1-brand",
  ".cfx-v1-media[data-home-media-aspect=\"horizontal\"]",
  ".cfx-v1-media[data-home-media-aspect=\"story\"]",
  ".cfx-v1-media[data-home-media-aspect=\"square\"]",
  ".cfx-v1-media[data-home-media-aspect=\"portrait\"]",
  ".cfx-v1-primary-cta",
  ".cfx-v1-progress",
  ".cfx-v1-rankings",
  ".cfx-v1-chance-grid",
  ".cfx-v1-safe-strip"
], "CSS deve estilizar a Home Premium V1 mobile-first");

hasAll(brandingContext, [
  "home_branding",
  "brandLayout",
  "\"centered\"",
  "\"inline\"",
  "officialGroup"
], "Branding publico deve expor configuracao da Home");

hasAll(brandingSettings, [
  "Branding Home",
  "Logo Centralizada",
  "Logo + Texto Lateral",
  "WhatsApp da Home",
  "Instagram da Home",
  "Grupo Oficial"
], "Admin Aparencia deve permitir configurar Branding Home");

hasAll(server, [
  "sanitizeHomeBranding",
  "home_branding",
  "homeBranding",
  "officialGroup",
  "brandLayout === \"inline\" ? \"inline\" : \"centered\""
], "Backend deve sanitizar e publicar Branding Home");

hasAll(adminRaffles, [
  "Selo da edição",
  "editionLabel",
  "homeEditionLabel",
  "1ª EDIÇÃO"
], "Admin da campanha deve permitir configurar selo da edicao");

hasAll(publicBottomNav, [
  "label: \"Início\"",
  "label: \"Sorteios\"",
  "label: \"Ganhadores\"",
  "label: \"Perfil\"",
  "to: \"/perfil\""
], "Menu inferior publico deve manter os quatro itens solicitados");
hasNone(publicBottomNav, ["label: \"WhatsApp\"", "label: \"Instagram\""], "Menu inferior publico nao deve ter links sociais");
hasNone(navbar, ["label: \"WhatsApp\"", "label: \"Instagram\""], "Menu inferior global da Navbar nao deve ter links sociais");

hasAll(app, [
  "<Route path=\"/\" element={<Home />} />",
  "<Route path=\"/sorteios\" element={<Sorteios />} />",
  "<Route path=\"/ganhadores\" element={<Winners />} />"
], "Rotas publicas principais devem continuar registradas");

console.log("PASS: Home Premium V1 mobile, branding e menu inferior validados.");
