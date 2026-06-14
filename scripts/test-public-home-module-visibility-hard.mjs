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
const sorteios = read("src/pages/Sorteios.tsx");
const navbar = read("src/components/Navbar.tsx");
const publicBottomNav = read("src/components/PublicBottomNav.tsx");
const supportChat = read("src/components/SupportChat.tsx");
const footer = read("src/components/Footer.tsx");
const app = read("src/App.tsx");
const adminConfig = read("src/pages/admin/AdminConfig.tsx");
const css = read("src/index.css");
const server = read("server.ts");
const packageJson = read("package.json");
const raffleDetails = read("src/pages/RaffleDetails.tsx");
const adminRaffles = read("src/pages/admin/AdminRaffles.tsx");
const mediaPicker = read("src/components/admin/MediaPicker.tsx");
const mediaAspectUtils = read("src/utils/mediaAspect.ts");
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
  "InviteBanner",
  "Convide amigos"
], "Home Premium nova nao deve renderizar estruturas antigas ou modulos desligados");

hasAll(home, [
  "<Hero raffle={featuredRaffle} ranking={ranking} topSellers={topSellers} />",
  "fetch(`/api/raffles/${featuredRaffle.id}/ranking`)",
  "fetch(`/api/raffles/${featuredRaffle.id}/top-sellers`)",
  "className=\"cfx-home-hero\"",
  "cfx-home-hero-media--story",
  "className=\"cfx-home-media-block\"",
  "function resolveHomeHeroMedia",
  "data-home-hero-fallback=\"premium\"",
  "className=\"cfx-home-hero-quick-cta\"",
  "Comprar Agora",
  "PIX imediato",
  "Compra segura",
  "className=\"cfx-home-progress\"",
  "showHomePrice",
  "showHomeText",
  "className=\"cfx-home-hero-quick-cta\"",
  "Link to={`/raffle/${raffle.id}`}",
  "fallbackImageUrl={heroMedia.fallbackImageUrl}",
  "function TopBuyers",
  "className=\"cfx-top-buyers\"",
  "Ranking em apuração com dados reais da campanha.",
  "const secondaryRaffles = useMemo",
  "activeRaffles.filter(raffle => raffle.id !== featuredRaffle?.id)",
  "<CampaignsSection raffles={secondaryRaffles} />",
  "if (raffles.length === 0) return null",
  "isVideoMediaType",
  "isStoryFirstVideoSource",
  "resolveHomeMediaAspect",
  "resolveHomeMediaFit",
  "normalized === \"story\" || normalized === \"vertical\"",
  "if (normalized === \"portrait\") return \"portrait\"",
  "if (normalized === \"square\") return \"square\"",
  "normalized === \"wide\" || normalized === \"horizontal\" || normalized === \"landscape\" || normalized === \"cinematic\" || normalized === \"banner\"",
  "url.includes(\"player.mediadelivery.net\")",
  "if (isVideo && isStoryFirstVideoSource(raffle)) return \"story\"",
  "data-home-media-type={mediaKind}",
  "data-home-media-aspect={homeMediaAspect}",
  "aspectMode={homeMediaAspect}",
  "preferredFit={resolveHomeMediaFit(raffle.mediaFit)}",
  "safeText(raffle.homeTitle",
  "safeText(raffle.homeHighlightText",
  "rewardWinnerName",
  "buyerName: rewardWinnerName"
], "Home Premium deve expor contratos visuais novos da Fase 01");

hasNone(home, [
  "Rifa principal",
  "className=\"cfx-home-price-strip\"",
  "POR APENAS",
  "className=\"cfx-home-secondary\"",
  "Meus bilhetes",
  "HomeSocialProofStrip",
  "HomeTrustRail",
  "AffiliateSection",
  "HowItWorksSection",
  "SecuritySection",
  "PaymentAndLiveSection",
  "SupportSection",
  "Sorteio ao vivo em",
  "Seja um afiliado",
  "Como funciona",
  "Duvidas?"
], "Home enxuta nao deve renderizar duplicidades, afiliado, como funciona, suporte ou sorteio ao vivo.");

hasNone(home, [
  "function HomeBottomNav",
  "className=\"cfx-home-bottom-nav\""
], "Home deve usar o rodape global novo em vez do rodape antigo local");

hasAll(publicBottomNav, [
  "export function PublicBottomNav",
  "public-mobile-bottom-nav",
  "label: \"Início\"",
  "label: \"Sorteios\"",
  "to: \"/sorteios\"",
  "location.pathname === \"/sorteios\"",
  "label: \"Ganhadores\"",
  "label: \"WhatsApp\"",
  "label: \"Instagram\"",
  "to: \"/ganhadores\"",
  "settings?.socialLinks?.whatsapp",
  "settings?.socialLinks?.instagram"
], "Rodape global deve substituir o rodape antigo da Home");

hasAll(app, [
  "const Sorteios = lazy(() => import(\"./pages/Sorteios\")",
  "<Route path=\"/sorteios\" element={<Sorteios />} />"
], "App deve expor pagina publica de sorteios.");
hasNone(app, [
  "<Route path=\"/sorteios\" element={<Navigate to=\"/\" replace />} />"
], "Sorteios nao pode redirecionar para Home.");

hasAll(sorteios, [
  "export function Sorteios",
  "useRaffleCatalog",
  "useFazendinha",
  "useModalidades",
  "fetch(\"/api/winners\")",
  "activeRaffles",
  "completedRaffles",
  "status === \"completed\"",
  "Sorteios Ativos",
  "Sorteios Encerrados",
  "Ganhador",
  "Cota vencedora",
  "Resultado",
  "cfx-draw-participate-button",
  "Participar",
  "cfx-draw-progress",
  "card.progress",
  "showProgress: false"
], "Pagina Sorteios deve listar ativos, encerrados e modalidades sem duplicar a Home.");
hasNone(sorteios, [
  "Bilhetes vendidos",
  "bilhetes vendidos",
  "Cotas vendidas",
  "cotas vendidas",
  "Total de bilhetes",
  "Total de cotas"
], "Pagina Sorteios nao deve exibir quantidade de bilhetes/cotas.");

hasNone(home, [
  "className=\"cfx-home-play\"",
  "className=\"cfx-video-control\"",
  "{sold.toLocaleString(\"pt-BR\")} / {total.toLocaleString(\"pt-BR\")}",
  "cfx-home-remaining",
  "cotas restantes"
], "Frame de midia da Home deve ficar limpo, sem play fake ou controles sobrepostos");
assert.ok(
  home.indexOf("className=\"cfx-home-hero-quick-cta\"") < home.indexOf("<TopBuyers ranking={ranking} />"),
  "CTA principal deve aparecer no bloco da midia antes dos rankings."
);
assert.ok(
  home.indexOf("const secondaryRaffles = useMemo") < home.indexOf("<CampaignsSection raffles={secondaryRaffles} />"),
  "Lista de campanhas deve usar apenas rifas secundarias."
);

hasAll(css, [
  ".cfx-home-page",
  "--public-navbar-height: 68px",
  ".cfx-home-hero",
  ".cfx-home-hero-media",
  ".cfx-home-hero-fallback",
  ".cfx-home-hero-quick-cta",
  ".cfx-home-progress",
  ".cfx-home-primary",
  ".cfx-top-buyers",
  ".cfx-home-trust-rail",
  ".public-mobile-bottom-nav",
  ".cfx-detail-layout--single",
  ".cfx-detail-ranking",
  ".cfx-premium-media-placeholder",
  "data-home-media-type=\"image\"",
  "data-home-media-type=\"video\"",
  "data-home-media-aspect=\"horizontal\"",
  "data-home-media-aspect=\"story\"",
  "data-home-media-aspect=\"vertical\"",
  "data-home-media-aspect=\"square\"",
  "data-home-media-aspect=\"portrait\"",
  ".cfx-home-hero-media.cfx-home-hero-media--story",
  "aspect-ratio: 5 / 6",
  "aspect-ratio: 16 / 9",
  "aspect-ratio: 9 / 16",
  "aspect-ratio: 1 / 1",
  "aspect-ratio: 4 / 5",
  "width: min(100%, 430px) !important",
  "border: 2px solid rgba(190, 63, 255, .74) !important",
  "radial-gradient(circle at 50% 24%, rgba(168, 85, 247, .28), transparent 15rem)",
  "grid-template-columns: repeat(5, minmax(0, 1fr))",
  "white-space: nowrap"
], "CSS da Home Premium deve validar midia dominante por tipo/aspecto e identidade cfx");

hasAll(css, [
  ".cfx-draws-page",
  ".cfx-draw-card",
  ".cfx-draw-card-shell",
  ".cfx-draw-participate-button",
  "cfx-draw-pulse",
  ".cfx-draw-progress"
], "CSS deve estilizar a pagina publica de sorteios.");

hasAll(css, [
  ".cfx-detail-hero-stats",
  "grid-template-columns: repeat(3, minmax(0, 1fr))",
  "overflow-wrap: anywhere",
  "white-space: normal"
], "Cards do hero da campanha devem ser responsivos e nao cortar Menor compra.");

hasNone(css, [
  ".public-shell:has(.cfx-home-page) .premium-site-header",
  ".cfx-device-time",
  "data-home-media-layout=\"compact\"",
  "data-home-media-layout=\"balanced\"",
  "data-home-media-layout=\"vertical\"",
  "data-home-media-layout=\"wide\""
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
  "label: \"Início\"",
  "label: \"Sorteios\"",
  "to: \"/sorteios\"",
  "label: \"Ganhadores\"",
  "to: \"/ganhadores\"",
  "label: \"WhatsApp\"",
  "label: \"Instagram\"",
  "].slice(0, 5)",
  "settings?.publicModules?.affiliates !== false",
  "settings?.socialLinks?.whatsapp || branding.support_whatsapp",
  "settings?.socialLinks?.instagram",
  "tone: \"whatsapp\"",
  "tone: \"instagram\""
], "Menu publico segue fluxo de compra e links sociais configuraveis");
hasNone(navbar, [
  "label: \"Afiliados\"",
  "label: \"Termos\"",
  "label: \"Contato\"",
  "public-floating-actions"
], "Menu publico nao deve manter atalhos antigos nem botoes flutuantes.");
assert.equal(navbar.includes("Meus Afiliados"), false, "Menu da conta nao deve listar Meus Afiliados publicamente.");
hasAll(supportChat, [
  "useLocation",
  "location.pathname === \"/\"",
  "if (hideOnHome) return null;"
], "Atendimento flutuante nao deve competir com menu inferior da Home.");

hasAll(raffleDetails, [
  "const quickAmounts = [200, 700, 1800, 3000, 5000, 10000]",
  "amount < minimum ? minimum.toLocaleString(\"pt-BR\") : `+${amount.toLocaleString(\"pt-BR\")}`",
  "Aguardando pagamento",
  "Copiar código PIX",
  "MEUS BILHETES",
  "data-random-raffle-checkout=\"quantity-only\""
], "Pagina da rifa mantem compra por quantidade e fluxo visual solicitado");
hasNone(raffleDetails, [
  "Seus números serão gerados automaticamente após a confirmação do pagamento.",
  "cfx-auto-number-note"
], "Area de compra nao deve renderizar aviso de numeracao automatica.");
hasNone(raffleDetails, [
  "<RaffleCountdownPanel countdown={countdown} />"
], "Tela publica da rifa nao deve renderizar o card grande de contador regressivo.");
hasNone(css, [
  ".cfx-auto-number-note"
], "CSS nao deve manter bloco visual do aviso removido.");
hasAll(css, [
  ".cfx-detail-buybox .cfx-quantity-control input",
  "font-size: clamp(1.65rem, 7.5vw, 2.35rem)"
], "Numero selecionado na escolha rapida deve ficar destacado no mobile.");
hasAll(css, [
  "PIX payment stage readability",
  ".cfx-pix-premium .cfx-pix-campaign strong",
  ".cfx-pix-premium .cfx-pix-summary-card .cfx-info-card p:last-child",
  "font-size: clamp(1.75rem, 6.7vw, 2.45rem)",
  ".cfx-pix-premium .cfx-pix-timer-card strong",
  "font-size: clamp(3.15rem, 12vw, 4.35rem)",
  ".cfx-pix-premium .cfx-pix-trust-card strong"
], "Tela PIX deve manter textos e numeros legiveis no mobile.");
hasAll(raffleDetails, [
  "cfx-detail-layout cfx-detail-layout--single",
  "<RaffleTitleBlock",
  "onParticipate={onParticipate}",
  "<NumberSelectionPanel",
  "raffle.showHomePrice !== false",
  "<RaffleMetricCard icon={<Ticket />} label=\"POR APENAS\"",
  "<RaffleTopBuyersPanel ranking={ranking} />",
  "<RaffleTopSellersPanel ranking={topSellers} />",
  "<LatestWinnersPanel winners={latestWinners} />",
  "<MobilePurchaseBar",
  "Comprar Agora",
  "[raffle.salesEndAt, raffle.countdownEndAt, raffle.drawDate]",
  "Ranking em apuração com dados reais da campanha.",
  "copyTextToClipboard",
  "document.execCommand(\"copy\")",
  "Nao foi possivel copiar o PIX"
], "Pagina da rifa deve ordenar banner, nome, escolha rapida, valor e ranking com dados reais.");
assert.ok(
  raffleDetails.indexOf("<RaffleTitleBlock") < raffleDetails.indexOf("<NumberSelectionPanel"),
  "Escolha rapida deve aparecer logo abaixo do nome do sorteio."
);
assert.ok(
  raffleDetails.indexOf("<NumberSelectionPanel") < raffleDetails.indexOf("<RaffleMetricCard icon={<Ticket />} label=\"POR APENAS\""),
  "Escolha rapida deve aparecer antes do valor da cota."
);
assert.ok(
  raffleDetails.indexOf("<RaffleMetricCard icon={<Ticket />} label=\"POR APENAS\"") < raffleDetails.indexOf("<RaffleTopBuyersPanel ranking={ranking} />"),
  "Valor da cota deve aparecer antes do ranking."
);
hasNone(raffleDetails, [
  "RESERVA DO PIX",
  "reserveCountdown"
], "Tela de revisao do checkout nao deve renderizar cronometro visual de reserva do PIX.");
hasAll(adminConfig, [
  "publicModules",
  "updatePublicModules",
  "Exibir Área de Afiliados na página pública",
  "settings.publicModules?.affiliates !== false",
  "updatePublicModules({ affiliates: e.target.checked })"
], "Admin possui controle de afiliados");

hasAll(adminRaffles, [
  "Mostrar bloco \"POR APENAS\"",
  "currentRaffle.showHomePrice !== false",
  "showHomePrice: e.target.checked"
], "Admin da campanha deve permitir ligar/desligar o bloco de valor da cota.");
hasAll(adminRaffles, [
  "Mostrar texto abaixo do banner",
  "currentRaffle.showHomeText !== false",
  "showHomeText: e.target.checked"
], "Admin da campanha deve permitir ligar/desligar o texto abaixo do banner.");

hasAll(server, [
  "publicModules: {",
  "affiliates: true",
  "sourceSettings.publicModules =",
  "publicModules: { ...currentSettings.publicModules, ...(req.body.publicModules || {}) }",
  "getTenantSettings(resolveRequestTenantId(req))",
  "tenantSettings[tenantId] = updatedSettings",
  "isPrivateDevHost",
  "private_dev_host_fallback",
  "resolveLocalDevTenant(req)",
  "if (isProductionRuntime) return null",
  "x-tenant-slug",
  "x-tenant-id",
  "req.query?.tenant",
  "process.env.DEFAULT_TENANT_ID",
  "local_dev_no_active_tenant"
], "Configuracao publica e multitenant");
hasAll(server, [
  "app.get(\"/api/public/raffles/catalog\"",
  "[\"active\", \"completed\"].includes(String(raffle.status))",
  "tenantCatalog.map(sanitizeRaffleForPublic)"
], "Backend deve expor catalogo publico tenant-scoped com ativos e encerrados.");
hasNone(server, [
  "tenantWithActiveRaffle",
  "raffles.some(raffle => raffle.tenant_id === tenant.id && raffle.status === \"active\")"
], "Fallback local nao pode escolher tenant automaticamente por campanha ativa.");

hasAll(adminRaffles, ["Nome da rifa / edital", "currentRaffle.title"], "Admin permite editar nome da rifa/edital");
hasAll(adminRaffles, [
  "homeMediaAspectOptions",
  "getDefaultHomeMediaAspect",
  "Mídia da Home",
  "Mídia principal da Home",
  "Tipo da mídia principal",
  "Escolha abaixo o formato visual da foto ou banner.",
  "Escolha abaixo o formato visual do player.",
  "Formato da mídia da Home",
  "Horizontal / Banner 16:9",
  "Vertical / Story 9:16",
  "Quadrado / Feed 1:1",
  "Retrato 4:5",
  "Enquadramento da mídia da Home",
  "name=\"home-media-type\"",
  "currentRaffle.mediaFit",
  "raffle.mediaAspect",
  "mediaAspect: mediaAspect as Raffle[\"mediaAspect\"]",
  "aspectValue={getDefaultHomeMediaAspect(currentRaffle)}",
  "onAspectChange={(mediaAspect) => setCurrentRaffle({ ...currentRaffle, mediaAspect: mediaAspect as Raffle[\"mediaAspect\"] })}",
  "fitValue={(currentRaffle.mediaFit || \"cover\") as ResponsiveMediaFit}",
  "onFitChange={(mediaFit) => setCurrentRaffle({ ...currentRaffle, mediaFit: mediaFit as Raffle[\"mediaFit\"] })}",
  "aspectOptions={homeMediaAspectOptions}",
  "homeTitle",
  "homeSubtitle",
  "homeHighlightText",
  "showHomeText",
  "Textos editáveis da Home"
], "Admin da rifa deve editar tipo de midia e textos especificos da Home.");
hasAll(adminRaffles, [
  "Mídia do Checkout",
  "Mídia principal do Checkout",
  "currentRaffle.checkoutMediaUrl",
  "currentRaffle.checkoutMediaType",
  "currentRaffle.checkoutMediaAspect",
  "currentRaffle.checkoutMediaFit",
  "value={currentRaffle.checkoutMediaAspect || \"wide\"}"
], "Admin da rifa deve manter mídia do checkout separada da mídia da Home.");
hasAll(mediaPicker, [
  "aspectValue?: ResponsiveMediaAspectMode",
  "onAspectChange?: (aspect: ResponsiveMediaAspectMode) => void",
  "fitValue?: ResponsiveMediaFit",
  "onFitChange?: (fit: ResponsiveMediaFit) => void",
  "aspectOptions?: Array<{ value: ResponsiveMediaAspectMode; label: string }>",
  "const selectedAspectPreference = aspectValue || mediaAspectPreference",
  "onAspectChange?.(nextAspect)",
  "value={selectedAspectPreference}",
  "aspectOptions.map(option =>",
  "aspectMode={selectedAspectPreference}"
], "MediaPicker deve permitir que Proporção preferida controle o campo persistido da Home.");
hasAll(mediaAspectUtils, [
  "ResponsiveMediaAspectMode = \"auto\" | \"square\" | \"vertical\" | \"horizontal\" | \"wide\" | \"cinematic\" | \"story\" | \"banner\" | \"portrait\"",
  "orientation === \"banner\" || orientation === \"cinematic\""
], "Utilitario de media deve aceitar proporcoes persistidas pelo Admin sem quebrar preview.");
hasNone(adminRaffles, [
  "homeMediaLayoutOptions",
  "Compacto 4:5 — melhor para banners/imagens",
  "Equilibrado 5:6 — recomendado",
  "Vertical 9:16 — ideal para vídeos/Reels",
  "value={currentRaffle.homeMediaLayout || \"balanced\"}",
  "Formato da mídia principal da Home",
  "Proporção da landing",
  "Encaixe da landing"
], "Admin da rifa nao deve expor configuracoes antigas que quebram o layout da Home.");
hasAll(server, [
  "homeTitle:",
  "homeSubtitle:",
  "homeHighlightText:"
], "Backend seed/admin/publico deve manter campos editaveis de texto da Home.");
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

console.log("PASS: Home Premium nova validada sem exigir classes antigas, com imagem 5:6, video 16:9, CTAs, contador, progresso, top compradores e selos.");
