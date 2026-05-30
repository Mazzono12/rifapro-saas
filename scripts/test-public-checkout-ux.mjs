import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sliceBetween(content, start, end) {
  const startIndex = content.indexOf(start);
  assert(startIndex >= 0, `Trecho inicial nao encontrado: ${start}`);
  const endIndex = content.indexOf(end, startIndex + start.length);
  assert(endIndex > startIndex, `Trecho final nao encontrado: ${end}`);
  return content.slice(startIndex, endIndex);
}

const campaignHero = read("src/components/CampaignMediaHero.tsx");
const videoPlayer = read("src/components/VideoHeroPlayer.tsx");
const smartVideo = read("src/components/SmartAutoPlayVideo.tsx");
const videoProvider = read("src/context/video-playback/VideoPlaybackContext.tsx");
const smartHook = read("src/hooks/useSmartVideoPlayback.ts");
const soundToggle = read("src/components/VideoSoundToggle.tsx");
const raffleDetails = read("src/pages/RaffleDetails.tsx");
const dashboard = read("src/pages/Dashboard.tsx");
const customerStore = read("src/store/useCustomerStore.ts");
const receipt = read("src/components/checkout/PrePaymentReceiptModal.tsx");
const premiumUi = read("src/components/premium/PremiumUI.tsx");
const geoService = read("src/services/GeoPrefillService.ts");
const useCityDetection = read("src/hooks/useCityDetection.ts");
const api = read("src/services/api.ts");
const server = read("server.ts");
const numberMode = read("src/pages/NumberModePage.tsx");
const fazendinha = read("src/pages/Fazendinha.tsx");
const fazendinhaSection = read("src/components/FazendinhaSection.tsx");

assert(campaignHero.includes("VideoHeroPlayer"), "CampaignMediaHero deve usar VideoHeroPlayer para videos");
assert(videoPlayer.includes("SmartAutoPlayVideo"), "VideoHeroPlayer deve usar SmartAutoPlayVideo");
assert(smartVideo.includes("useSmartVideoPlayback"), "SmartAutoPlayVideo deve usar hook de visibilidade inteligente");
assert(videoProvider.includes("VideoPlaybackProvider"), "Deve existir VideoPlaybackProvider para coordenar videos");
assert(videoProvider.includes("IntersectionObserver") || smartHook.includes("IntersectionObserver"), "Autoplay inteligente deve usar IntersectionObserver");
assert(videoProvider.includes("sort((a, b) => b.ratio - a.ratio)"), "Apenas o video mais visivel deve tocar");
assert(videoProvider.includes("pauseEntry"), "Videos fora de visibilidade devem pausar");
assert(videoProvider.includes("active.video.muted = true"), "Autoplay bloqueado deve cair para muted");
assert(smartHook.includes("observer.disconnect()"), "Observer deve ser limpo no unmount");
assert(videoPlayer.includes("playsInline"), "VideoHeroPlayer deve preservar playsInline para mobile");
assert(smartVideo.includes('preload={priority ? "auto" : preload}'), "SmartAutoPlayVideo deve usar preload metadata fora de prioridade");
assert(soundToggle.includes("Ativar Som"), "VideoSoundToggle deve exibir CTA Ativar Som");

assert(!dashboard.includes("Criar senha"), "Area do cliente nao deve mostrar Criar senha no fluxo de entrada");
assert(dashboard.includes("Entrar"), "Area do cliente deve trocar acao de acesso para Entrar");
assert(dashboard.includes("Sair"), "Area do cliente deve expor botao Sair");
assert(dashboard.includes("clearCustomer()"), "Botao Sair deve limpar sessao do cliente");
assert(customerStore.includes("localStorage.removeItem(customerSessionKey)"), "Logout do cliente deve limpar localStorage do cliente");
assert(customerStore.includes("sessionStorage.removeItem(customerSessionKey)"), "Logout do cliente deve limpar sessionStorage do cliente");
assert(!customerStore.includes("nexusdraw_admin_token"), "Logout do cliente nao deve remover token admin");

const paymentPix = sliceBetween(raffleDetails, "function PaymentPix", "function PremiumTicket");
assert(!/Suporte WhatsApp|supportUrl|wa\.me|api\.whatsapp\.com/i.test(paymentPix), "Checkout PIX nao pode conter CTA de WhatsApp");
assert(paymentPix.includes("Confirmar PIX"), "Checkout PIX deve conter botao Confirmar PIX");
assert(raffleDetails.includes("checkoutService.checkPixPaymentStatus(purchase.purchaseId)"), "Confirmar PIX deve consultar status seguro do pedido");
assert(api.includes('fetch(`/api/checkout/orders/${orderId}/status`)'), "Status PIX deve usar GET /api/checkout/orders/:id/status");
assert(server.includes('app.get("/api/checkout/orders/:orderId/status"'), "Backend deve expor endpoint seguro de status");
assert(server.includes("Confirmacao manual pelo cliente nao e permitida"), "Confirmacao manual deve continuar bloqueada");

assert(receipt.includes("CheckoutModalHeader"), "Recibo pre-pagamento deve usar header compartilhado do checkout");
assert(premiumUi.includes("TenantLogo"), "Header compartilhado do checkout deve usar logo do tenant");
assert(premiumUi.includes("TenantHeaderName"), "Header compartilhado do checkout deve usar nome do tenant");
assert(receipt.includes('label="Cidade"'), "Recibo deve mostrar cidade antes do PIX");
assert(receipt.includes("Recibo pre-pagamento"), "Recibo deve ter hierarquia profissional de pre-pagamento");

assert(server.includes('app.get("/api/public/geo"'), "Backend deve ter endpoint publico seguro de geolocalizacao");
assert(geoService.includes("/api/public/geo"), "GeoPrefillService deve buscar cidade antes do PIX");
assert(geoService.includes("localStorage"), "GeoPrefillService deve cachear cidade localmente");
assert(useCityDetection.includes("GeoPrefillService.detect"), "useCityDetection deve carregar prefill de cidade");
for (const [name, content] of [["RaffleDetails", raffleDetails], ["NumberModePage", numberMode], ["Fazendinha", fazendinha], ["FazendinhaSection", fazendinhaSection]]) {
  assert(content.includes("useCityDetection"), `${name} deve preencher cidade antes do PIX`);
  assert(content.includes("GeoPrefillService.saveManual"), `${name} deve salvar cidade editada no cache`);
  assert(content.includes("Confirmar PIX"), `${name} deve expor Confirmar PIX no fluxo PIX`);
}

assert(!/SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY/.test(campaignHero + videoPlayer + soundToggle + receipt + geoService + useCityDetection), "Codigo publico nao deve expor service role");

console.log("[public-checkout-ux] ok");
