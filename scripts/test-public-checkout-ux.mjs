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
const soundToggle = read("src/components/VideoSoundToggle.tsx");
const raffleDetails = read("src/pages/RaffleDetails.tsx");
const receipt = read("src/components/checkout/PrePaymentReceiptModal.tsx");
const geoService = read("src/services/GeoPrefillService.ts");
const useCityDetection = read("src/hooks/useCityDetection.ts");
const api = read("src/services/api.ts");
const server = read("server.ts");
const numberMode = read("src/pages/NumberModePage.tsx");
const fazendinha = read("src/pages/Fazendinha.tsx");
const fazendinhaSection = read("src/components/FazendinhaSection.tsx");

assert(campaignHero.includes("VideoHeroPlayer"), "CampaignMediaHero deve usar VideoHeroPlayer para videos");
assert(videoPlayer.includes("video.muted = false"), "VideoHeroPlayer deve tentar iniciar com audio habilitado");
assert(videoPlayer.includes("video.muted = true"), "VideoHeroPlayer deve cair para muted quando autoplay com audio for bloqueado");
assert(videoPlayer.includes("playsInline"), "VideoHeroPlayer deve preservar playsInline para mobile");
assert(videoPlayer.includes('preload={priority ? "auto" : "metadata"}'), "VideoHeroPlayer deve usar preload metadata fora de prioridade");
assert(soundToggle.includes("Ativar Som"), "VideoSoundToggle deve exibir CTA Ativar Som");

const paymentPix = sliceBetween(raffleDetails, "function PaymentPix", "function PremiumTicket");
assert(!/Suporte WhatsApp|supportUrl|wa\.me|api\.whatsapp\.com/i.test(paymentPix), "Checkout PIX nao pode conter CTA de WhatsApp");
assert(paymentPix.includes("Confirmar PIX"), "Checkout PIX deve conter botao Confirmar PIX");
assert(raffleDetails.includes("checkoutService.checkPixPaymentStatus(purchase.purchaseId)"), "Confirmar PIX deve consultar status seguro do pedido");
assert(api.includes('fetch(`/api/checkout/orders/${orderId}/status`)'), "Status PIX deve usar GET /api/checkout/orders/:id/status");
assert(server.includes('app.get("/api/checkout/orders/:orderId/status"'), "Backend deve expor endpoint seguro de status");
assert(server.includes("Confirmacao manual pelo cliente nao e permitida"), "Confirmacao manual deve continuar bloqueada");

assert(receipt.includes("TenantLogo"), "Recibo pre-pagamento deve usar logo do tenant");
assert(receipt.includes("TenantHeaderName"), "Recibo pre-pagamento deve usar nome do tenant");
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
