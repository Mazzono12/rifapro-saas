import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

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
  "@media (max-width: 899px)",
  "aspect-ratio: 9 / 16"
], "CSS da Home Premium deve validar frame mobile 9:16 e identidade cfx");

hasNone(home, [
  "selectedNumber",
  "selectedNumbers",
  "manualNumber",
  "numberGrid",
  "NumberGrid",
  "Escolha seus números",
  "Escolher números"
], "Home nao pode renderizar grid nem escolha manual de numeros");

assert.ok(existsSync("public/footer-trust-seals.png"), "Imagem oficial do rodape deve existir em public.");
hasAll(footer, [
  "footer-trust-seals.png",
  "premium-site-footer-image-only",
  "premium-site-footer-image"
], "Rodape premium global deve existir e renderizar a imagem oficial");
for (const forbiddenFooterText of [
  "CNPJ",
  "FAQ:",
  "Termos:",
  "Transparência dos sorteios",
  "contato@nexusdraw",
  "Sistema por",
  "footer_text"
]) {
  assert.equal(footer.includes(forbiddenFooterText), false, `Rodape global nao deve renderizar texto antigo: ${forbiddenFooterText}`);
}
hasAll(css, [".premium-site-footer-image-only", ".premium-site-footer-image"], "CSS do rodape premium global");

hasAll(navbar, [
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
