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
  "showPrice",
  "priceLabel",
  "quantity.toLocaleString",
  "currency.format(total)"
], "recibo pre-PIX com midia");

includesAll(raffle, [
  "<CheckoutCampaignMedia",
  "statusLabel={props.step === \"payment\" ? \"Aguardando pagamento\"",
  "priceLabel={`${props.tickets.toLocaleString",
  "checkoutCriticalActive",
  "!checkoutCriticalActive && <FloatingActions"
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
  "Imagem principal",
  "Mídia da landing page",
  "Mídia exclusiva do checkout",
  "checkoutMediaUrl",
  "checkoutMediaType",
  "checkoutMediaAspect",
  "checkoutMediaFit",
  "inferMediaType"
], "admin salva midia");

for (const token of [
  ".checkout-campaign-media",
  ".checkout-media-preview",
  "width: 100%",
  "object-fit: cover",
  "overflow: hidden"
]) {
  assert(css.includes(token), `CSS de midia ausente: ${token}`);
}

for (const forbidden of [
  /checkout-campaign-media[\s\S]{0,260}overflow-wrap:\s*anywhere/i,
  /checkout-campaign-media[\s\S]{0,260}word-break:\s*break-all/i,
  /checkout-campaign-media[\s\S]{0,260}writing-mode:\s*vertical/i
]) {
  assert(!forbidden.test(css), "midia do checkout nao pode causar texto vertical");
}

for (const viewport of [360, 390, 414]) {
  assert(viewport >= 360 && viewport <= 414, `viewport mobile coberto: ${viewport}`);
}

assert(packageJson.includes('"test:checkout-media-hard"'), "package.json deve expor test:checkout-media-hard");

console.log("checkout-media-hard: ok");
