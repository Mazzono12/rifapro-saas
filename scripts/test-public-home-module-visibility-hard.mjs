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
const navbar = read("src/components/Navbar.tsx");
const footer = read("src/components/Footer.tsx");
const app = read("src/App.tsx");
const adminConfig = read("src/pages/admin/AdminConfig.tsx");
const css = read("src/index.css");
const server = read("server.ts");
const packageJson = read("package.json");
const raffleDetails = read("src/pages/RaffleDetails.tsx");
const adminRaffles = read("src/pages/admin/AdminRaffles.tsx");
const brandingSettings = read("src/components/branding/BrandingSettingsForm.tsx");
const logoUploader = read("src/components/branding/LogoUploader.tsx");

hasNone(home, [
  "function PublicHomeFooter",
  "footer-trust-seals.png",
  "cfx-device-time",
  "9:41",
  "rp-home-",
  "HomeMinimalLinks",
  "ShortcutRow",
  "useModalidades",
  "FazendinhaSection",
  "TodaySection",
  "DezenaSection",
  "SpecialRafflesSection",
  "showAffiliates",
  "InviteBanner",
  "Convide amigos"
], "Home Premium nova nao deve renderizar estruturas antigas ou modulos desligados");

hasAll(home, [
  "<Hero raffle={featuredRaffle} ranking={ranking} />",
  "fetch(`/api/raffles/${featuredRaffle.id}/ranking`)",
  "className=\"cfx-home-hero\"",
  "className=\"cfx-home-hero-media\"",
  "className=\"cfx-home-media-block\"",
  "className=\"cfx-home-play\"",
  "className=\"cfx-video-control\"",
  "className=\"cfx-countdown-grid\"",
  "className=\"cfx-home-progress\"",
  "className=\"cfx-home-primary\"",
  "Participar agora",
  "Link to={`/raffle/${raffle.id}`}",
  "className=\"cfx-home-secondary\"",
  "Meus bilhetes",
  "Link to=\"/minhas-cotas\"",
  "fallbackImageUrl={raffle.image}",
  "function TopBuyers",
  "className=\"cfx-top-buyers\"",
  "Ranking em apuração com dados reais da campanha.",
  "function HomeTrustRail",
  "className=\"cfx-home-trust-rail\"",
  "Selos de confiança",
  "function HomeBottomNav",
  "className=\"cfx-home-bottom-nav\""
], "Home Premium deve expor contratos visuais novos da Fase 01");

hasAll(css, [
  ".cfx-home-page",
  "--public-navbar-height: 68px",
  ".cfx-home-hero",
  ".cfx-home-hero-media",
  ".cfx-home-play",
  ".cfx-video-control",
  ".cfx-live-card",
  ".cfx-countdown-grid",
  ".cfx-home-progress",
  ".cfx-home-primary",
  ".cfx-home-secondary",
  ".cfx-top-buyers",
  ".cfx-home-trust-rail",
  ".cfx-home-bottom-nav",
  ".cfx-premium-media-placeholder",
  "@media (max-width: 899px)",
  "aspect-ratio: 9 / 16"
], "CSS da Home Premium deve validar frame mobile 9:16 e identidade cfx");

hasNone(css, [
  ".public-shell:has(.cfx-home-page) .premium-site-header",
  ".cfx-device-time"
], "Home Premium deve usar Navbar real, sem esconder o cabecalho global");

hasNone(home, [
  "selectedNumber",
  "selectedNumbers",
  "manualNumber",
  "numberGrid",
  "NumberGrid",
  "Escolha seus números",
  "Escolher números"
], "Home nao pode renderizar grid nem escolha manual de numeros");

hasAll(footer, [
  "export function Footer()",
  "return null"
], "Rodape global institucional deve permanecer inerte");
hasNone(app, [
  "import { Footer }",
  "<Footer"
], "App publico nao deve renderizar rodape institucional global");
for (const forbiddenFooterText of [
  "CNPJ",
  "FAQ:",
  "Termos:",
  "Transparência dos sorteios",
  "contato@nexusdraw",
  "contato@cifher.com",
  "Rifas digitais premium",
  "footer-trust-seals.png",
  "premium-site-footer-image",
  "premium-site-footer-tenant",
  "Sistema por"
]) {
  assert.equal(footer.includes(forbiddenFooterText), false, `Rodape global nao deve renderizar texto antigo: ${forbiddenFooterText}`);
}
hasNone(css, [".premium-site-footer-image-only", ".premium-site-footer-image", ".premium-site-footer-tenant", ".premium-site-footer-logo"], "CSS nao deve manter camada de rodape institucional duplicado");

hasAll(navbar, [
  "sticky top-0",
  "h-[68px]",
  "z-[80]",
  "bottomNavItems",
  "label: \"Campanhas\"",
  "label: \"Meus Jogos\"",
  "label: \"Ganhadores\"",
  "label: \"Afiliados\"",
  "label: \"Termos\"",
  "label: \"Contato\"",
  "settings?.publicModules?.affiliates !== false"
], "Menu publico segue fluxo de compra e flag de afiliados");
assert.equal(navbar.includes("Meus Afiliados"), false, "Menu da conta nao deve listar Meus Afiliados publicamente.");

hasAll(raffleDetails, [
  "const quickAmounts = [200, 700, 1800, 3000, 5000, 10000]",
  "<strong>+{amount.toLocaleString(\"pt-BR\")}</strong>",
  "Seus números serão gerados automaticamente após a confirmação do pagamento.",
  "Aguardando pagamento",
  "Copiar código PIX",
  "Ver meus numeros",
  "data-random-raffle-checkout=\"quantity-only\""
], "Pagina da rifa mantem compra por quantidade e fluxo visual solicitado");

hasAll(adminConfig, [
  "publicModules",
  "updatePublicModules",
  "Exibir Área de Afiliados na página pública",
  "settings.publicModules?.affiliates !== false",
  "updatePublicModules({ affiliates: e.target.checked })"
], "Admin possui controle de afiliados");

hasAll(server, [
  "publicModules: {",
  "affiliates: true",
  "sourceSettings.publicModules =",
  "publicModules: { ...currentSettings.publicModules, ...(req.body.publicModules || {}) }",
  "getTenantSettings(resolveRequestTenantId(req))",
  "tenantSettings[tenantId] = updatedSettings"
], "Configuracao publica e multitenant");

hasAll(adminRaffles, ["Nome da rifa / edital", "currentRaffle.title"], "Admin permite editar nome da rifa/edital");
hasAll(brandingSettings, ["Logo compatível com PNG, JPG, WEBP, SVG e GIF animado."], "Admin informa compatibilidade da logo com GIF animado");
hasAll(logoUploader, [".gif", "image/gif", "Enviar logo/GIF"], "Upload de logo aceita GIF animado");

assert.equal(raffleDetails.includes("publicModules"), false, "Detalhe/checkout da rifa principal nao deve depender da flag publica de modulos.");
assert.equal(raffleDetails.includes("showFazendinha"), false, "Detalhe/checkout da rifa principal nao deve receber controle da Home.");
assert.match(raffleDetails, /data-random-raffle-checkout="quantity-only"/, "Rifa principal deve continuar por quantidade.");
assert.match(packageJson, /"test:public-home-module-visibility-hard"/, "package.json deve registrar o teste hard.");

for (const forbidden of [
  "api/webhooks/asaas",
  "api/webhooks/mercadopago",
  "api/webhooks/pagbank",
  "api/webhooks/primepag",
  "api/webhooks/pay2m",
  "api/webhooks/cora"
]) {
  assert.ok(server.includes(forbidden), `Webhook protegido continua registrado: ${forbidden}`);
}

console.log("PASS: Home Premium nova validada sem exigir classes antigas, com hero 9:16, CTAs, contador, progresso, top compradores e selos.");
