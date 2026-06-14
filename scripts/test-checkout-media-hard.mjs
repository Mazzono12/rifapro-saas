import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
}

const media = read("src/components/checkout/CheckoutCampaignMedia.tsx");
const receipt = read("src/components/checkout/PrePaymentReceiptModal.tsx");
const raffle = read("src/pages/RaffleDetails.tsx");
const numberMode = read("src/pages/NumberModePage.tsx");
const fazendinha = read("src/pages/Fazendinha.tsx");
const fazendinhaSection = read("src/components/FazendinhaSection.tsx");
const adminRaffles = read("src/pages/admin/AdminRaffles.tsx");
const css = read("src/index.css");
const packageJson = read("package.json");

includesAll(media, [
  "getCampaignCheckoutMedia",
  "imageUrl",
  "bannerUrl",
  "coverImage",
  "prizeImage",
  "videoUrl",
  "mediaUrl",
  "mainImage",
  "thumbnailUrl",
  "premioImagem",
  "campanhaImagem",
  "checkout_video_url",
  "checkout_image_url",
  "checkout_video_poster_url",
  "inferCheckoutMediaType",
  "mediadelivery",
  "youtube",
  "vimeo",
  "checkout-media-fallback",
  "showStatus",
  "showPrice",
  "priceLabel",
  "Campanha ativa",
  "Preview do premio"
], "CheckoutCampaignMedia");

includesAll(receipt, [
  "<CheckoutCampaignMedia",
  "raffleData",
  "mediaUrl",
  "mediaType",
  "hideMedia",
  "showPrice",
  "priceLabel",
  "quantity.toLocaleString",
  "currency.format(total)"
], "recibo pre-PIX com midia");

includesAll(raffle, [
  "<CheckoutCampaignMedia",
  "function getRaffleHeroMedia",
  "function getRaffleCheckoutMedia",
  "if (imageUrl) return { mediaUrl: imageUrl, mediaType: inferMediaType(imageUrl) as MediaType }",
  "mediaUrl={heroMedia.mediaUrl}",
  "mediaType={heroMedia.mediaType}",
  "mediaUrl={checkoutMedia.mediaUrl}",
  "mediaType={checkoutMedia.mediaType}",
  "hideMedia={!checkoutMedia.mediaUrl}",
  "className=\"cfx-review-prize-media\"",
  "Pagamento PIX",
  "Preencha os dados e gere o PIX.",
  "TOTAL NO PIX",
  "Cotas:",
  "Finalize seu PIX",
  "Código copia e cola",
  "Copiar código PIX",
  "cfx-pix-campaign-logo",
  "cfx-receipt-campaign"
], "rifa tradicional checkout");

includesAll(numberMode, [
  "import { CheckoutCampaignMedia }",
  "modalityMedia",
  "config.mediaUrl",
  "config.mediaType",
  "<CheckoutCampaignMedia",
  "Aguardando pagamento",
  "raffleData={modalityMedia}"
], "NumberModePage checkout");

includesAll(fazendinha, [
  "import { FazendinhaCheckoutMedia }",
  "useFazendinhaMediaSettings",
  "checkoutMedia",
  "<FazendinhaCheckoutMedia {...checkoutMedia} />",
  "fazendinhaCheckoutMedia={checkoutMedia}",
  "hidden={checkoutOpen || receiptOpen}"
], "Fazendinha checkout");

includesAll(fazendinhaSection, [
  "import { FazendinhaCheckoutMedia }",
  "useFazendinhaMediaSettings",
  "checkoutMedia",
  "<FazendinhaCheckoutMedia {...checkoutMedia}",
  "fazendinhaCheckoutMedia={checkoutMedia}"
], "FazendinhaSection checkout");

includesAll(adminRaffles, [
  "MediaPicker",
  "Imagem da página da campanha",
  "Mídia da Home",
  "Mídia principal da Home",
  "Mídia do Checkout",
  "Mídia principal do Checkout",
  "Se este campo ficar vazio, nenhuma mídia aparece no checkout.",
  "checkoutMediaUrl",
  "checkoutMediaType",
  "checkoutMediaAspect",
  "checkoutMediaFit",
  "inferMediaType"
], "admin salva midia");

assert(!adminRaffles.includes("DEFAULT_MEDIADELIVERY_VIDEO_URL"), "Nova campanha nao deve nascer com midia automatica.");

for (const token of [
  ".checkout-campaign-media",
  ".checkout-media-preview",
  ".cfx-detail-banner > .responsive-media-frame",
  ".cfx-detail-banner-back",
  ".cfx-detail-banner > :not(img):not(video):not(.responsive-media-frame):not(.cfx-detail-banner-back):not(.cfx-media-fallback)",
  "Mobile conversion tightening",
  ".cfx-detail-buybox .cfx-checkout-row > span:nth-child(1)",
  ".cfx-detail-buybox .cfx-checkout-row > span:nth-child(2)",
  "display: none !important",
  "aspect-ratio: 16 / 9 !important",
  "width: 100%",
  "object-fit: cover",
  "overflow: hidden",
  "body[data-checkout-open=\"true\"] .public-mobile-bottom-nav",
  ".cfx-fast-pix-checkout .cfx-review-submit",
  "background: linear-gradient(135deg, #2ddf73, #8dfc9b) !important",
  ".cfx-pix-premium .cfx-pix-code",
  "order: -1",
  ".cfx-pix-premium .cfx-pix-qr-card",
  "order: -2",
  "width: min(100%, 360px) !important"
]) {
  assert(css.includes(token), `CSS de midia ausente: ${token}`);
}

assert(!raffle.includes("<MobilePurchaseBar"), "Detalhe da campanha nao deve renderizar barra fixa Comprar Agora duplicada.");
assert(raffle.includes("className=\"cfx-detail-banner-back\""), "Botao Voltar deve ficar sobre a imagem/banner da campanha.");

for (const forbidden of [
  /checkout-campaign-media[\s\S]{0,260}overflow-wrap:\s*anywhere/i,
  /checkout-campaign-media[\s\S]{0,260}word-break:\s*break-all/i,
  /checkout-campaign-media[\s\S]{0,260}writing-mode:\s*vertical/i
]) {
  assert(!forbidden.test(css), "midia do checkout nao pode causar texto vertical");
}

assert(packageJson.includes('"test:checkout-media-hard"'), "package.json deve expor test:checkout-media-hard");

console.log("checkout-media-hard: ok");
