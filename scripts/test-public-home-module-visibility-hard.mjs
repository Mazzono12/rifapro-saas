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
const sorteios = read("src/pages/Sorteios.tsx");
const dashboard = read("src/pages/Dashboard.tsx");
const publicBrandMark = read("src/components/branding/PublicBrandMark.tsx");

hasAll(home, [
  "cfx-home-premium-v1",
  "HomeV1Brand",
  "PublicBrandMark",
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
  "preferredFit=\"cover\"",
  "hideInfo",
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
  ".public-brand-mark",
  ".public-brand-logo",
  ".public-brand-name",
  ".cfx-home-premium-v1",
  ".cfx-v1-shell",
  "width: min(100%, 540px)",
  "width: min(92vw, 420px)",
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
hasNone(css, [
  ".public-shell:has(.cfx-home-premium-v1) .premium-site-header",
  ".public-shell:has(.cfx-customer-page) .premium-site-header"
], "Header publico nao deve ser escondido por seletor :has das paginas publicas principais");

hasAll(brandingContext, [
  "home_branding",
  "brandLayout",
  "showName",
  "\"centered\"",
  "\"inline\"",
  "officialGroup"
], "Branding publico deve expor configuracao da Home");

hasAll(brandingSettings, [
  "Branding Home",
  "Nome no cabeçalho (opcional)",
  "Deixe vazio para usar apenas a logo",
  "Exibir nome junto da logo",
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
  "showName",
  "officialGroup",
  "brandLayout === \"inline\" ? \"inline\" : \"centered\""
], "Backend deve sanitizar e publicar Branding Home");
hasNone(server, [
  "current.company_name ||= current.header_name",
  "current.display_name ||= current.header_name",
  "current.header_name = normalizeLegacyBrandText(current.header_name)",
  "company_name: companyName || displayName || defaultTenantBranding(tenantId).header_name",
  "display_name: displayName || companyName || defaultTenantBranding(tenantId).header_name",
  "header_name: displayName || String(incoming.header_name ?? current.header_name ?? \"\").trim().slice(0, 80) || defaultTenantBranding(tenantId).header_name"
], "Backend deve permitir marca sem nome exibido quando a logo for suficiente");

hasAll(adminRaffles, [
  "Selo da edição",
  "editionLabel",
  "homeEditionLabel",
  "1ª EDIÇÃO"
], "Admin da campanha deve permitir configurar selo da edicao");
hasAll(adminRaffles, [
  "PIX individual do sorteio",
  "updateRafflePixConfig",
  "RafflePixConfig",
  "Chave privada Asaas deste sorteio"
], "Admin da campanha deve expor PIX individual por sorteio");

hasAll(publicBottomNav, [
  "label: \"Início\"",
  "label: \"Sorteios\"",
  "to: \"/sorteios\"",
  "label: \"Ganhadores\"",
  "label: \"Perfil\"",
  "to: \"/perfil\""
], "Menu inferior publico deve manter os quatro itens solicitados");
hasNone(publicBottomNav, ["label: \"WhatsApp\"", "label: \"Instagram\""], "Menu inferior publico nao deve ter links sociais");
hasAll(navbar, [
  "PublicBrandMark",
  "label: \"Sorteios\"",
  "to: \"/sorteios\""
], "Menu inferior da Home/Navbar deve apontar Sorteios para a rota oficial e usar marca global");
hasNone(navbar, ["label: \"WhatsApp\"", "label: \"Instagram\""], "Menu inferior global da Navbar nao deve ter links sociais");
hasAll(publicBrandMark, [
  "useTenantBranding",
  "branding.logo_url",
  "branding.display_name || branding.header_name || branding.company_name || \"\"",
  "branding.home_branding?.showName !== false",
  "logo-only",
  "ResponsiveMediaFrame",
  "public-brand-logo"
], "Marca publica deve vir do branding global do tenant");

hasAll(app, [
  "<Route path=\"/\" element={<Home />} />",
  "const isHomeRoute = location.pathname === \"/\"",
  "{!isHomeRoute && !isRaffleRoute && <Navbar />}",
  "{(isHomeRoute || isRaffleRoute) && <PublicBottomNav />}",
  "<Route path=\"/sorteio\" element={<Navigate to=\"/sorteios\" replace />} />",
  "<Route path=\"/campanhas\" element={<Navigate to=\"/sorteios\" replace />} />",
  "<Route path=\"/rifas\" element={<Navigate to=\"/sorteios\" replace />} />",
  "<Route path=\"/sorteios\" element={<Sorteios />} />",
  "<Route path=\"/ganhadores\" element={<Winners />} />",
  "<Route path=\"/perfil\" element={<UserDashboard />} />",
  "<Route path=\"/mensagens\" element={<Messages />} />"
], "Rotas publicas principais devem continuar registradas");
hasAll(sorteios, [
  "const fazConfigSource = fazendinha?.config || modalidades?.fazendinha",
  "typeof fazConfigSource === \"object\"",
  "!Array.isArray(fazConfigSource)",
  "if (fazConfig && fazConfig.enabled !== false"
], "Tela Sorteios deve tolerar payload parcial/booleano da Fazendinha sem quebrar renderizacao");
hasAll(dashboard, [
  "const customerCpf = String(customer?.cpf || \"\")",
  "const formattedCustomerCpf = customerCpf",
  "CPF {formattedCustomerCpf}",
  "Number(customer.totalTickets || 0).toLocaleString(\"pt-BR\")"
], "Tela Perfil deve tolerar cliente sem CPF/totalizadores sem quebrar renderizacao");
assert.ok(
  app.indexOf("<Route path=\"/sorteio\" element={<Navigate to=\"/sorteios\" replace />} />") < app.indexOf("<Route path=\"/:mode\" element={<NumberModePage />} />"),
  "Rota /sorteio deve redirecionar para /sorteios antes da rota dinamica /:mode."
);
assert.ok(
  app.indexOf("<Route path=\"/sorteios\" element={<Sorteios />} />") < app.indexOf("<Route path=\"/:mode\" element={<NumberModePage />} />"),
  "Rota /sorteios deve renderizar a listagem antes da rota dinamica /:mode."
);

console.log("PASS: Home Premium V1 mobile, branding e menu inferior validados.");
