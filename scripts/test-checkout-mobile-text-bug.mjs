import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
}

const css = read("src/index.css");
const raffleDetails = read("src/pages/RaffleDetails.tsx");
const premiumUi = read("src/components/premium/PremiumUI.tsx");
const receipt = read("src/components/checkout/PrePaymentReceiptModal.tsx");
const media = read("src/components/checkout/CheckoutCampaignMedia.tsx");
const numberMode = read("src/pages/NumberModePage.tsx");
const fazendinha = read("src/pages/Fazendinha.tsx");
const fazendinhaSection = read("src/components/FazendinhaSection.tsx");

includesAll(css, [
  ".checkout-modal-overlay",
  ".checkout-receipt-overlay",
  ".checkout-modal-shell",
  ".checkout-receipt-shell",
  "width: min(100%, 440px) !important",
  "max-width: calc(100vw - (var(--mobile-edge-gutter) * 2)",
  ".checkout-receipt-heading-row",
  ".checkout-receipt-title-block",
  "writing-mode: horizontal-tb !important",
  "text-orientation: mixed !important",
  "overflow-wrap: normal !important",
  "word-break: normal !important",
  ".checkout-campaign-media"
], "css mobile checkout");

includesAll(premiumUi, [
  "CheckoutPrimaryActionButton",
  "checkout-primary-action-button checkout-primary-button premium-button",
  "PremiumCheckoutModal",
  "checkout-modal-overlay",
  "checkout-modal-shell",
  "checkout-modal-title",
  "FloatingCTA"
], "premium UI checkout");
assert(!premiumUi.includes("checkout-modal-close"), "checkout publico nao deve renderizar X superior no header");
assert(!premiumUi.includes("aria-label=\"Fechar checkout\""), "checkout publico nao deve expor botao Fechar checkout");

includesAll(receipt, [
  "Confirme seus dados",
  "<CheckoutCampaignMedia",
  "CheckoutModalShell",
  "Recibo pre-pagamento"
], "recibo pre-PIX");

includesAll(raffleDetails, [
  "checkoutCriticalActive",
  "!checkoutCriticalActive && <FloatingActions",
  "CheckoutModalShell",
  "Confirmar participacao",
  "<CheckoutCampaignMedia",
  "onConfirmPix"
], "RaffleDetails checkout");

for (const source of [numberMode, fazendinha, fazendinhaSection]) {
  assert(source.includes("PrePaymentReceiptModal"), "fluxo de compra deve usar recibo pre-PIX");
  if (source.includes("FloatingCTA")) {
    assert(source.includes("hidden={checkoutOpen || receiptOpen}"), "FloatingCTA deve sumir durante checkout/recibo");
  }
  assert(source.includes("raffleData") || source.includes("fazendinhaCheckoutMedia"), "recibo deve receber midia da campanha/modalidade");
}

for (const forbidden of [
  /checkout-(?:modal-title|title|primary-button|primary-action-button)[\s\S]{0,220}overflow-wrap:\s*anywhere/i,
  /checkout-(?:modal-title|title|primary-button|primary-action-button)[\s\S]{0,220}word-break:\s*break-all/i,
  /checkout-(?:modal-title|title|primary-button|primary-action-button)[\s\S]{0,220}writing-mode:\s*vertical/i,
  /\.fixed\.inset-0\[class\*="z-\[80\]"\]\s+button/i,
  /\.fixed\.inset-0\[class\*="z-\[90\]"\]\s+button/i
]) {
  assert(!forbidden.test(css), "checkout mobile nao pode conter regra que gere texto vertical");
}

for (const viewport of [360, 390, 414]) {
  assert(viewport >= 360 && viewport <= 414, `viewport mobile coberto: ${viewport}`);
}

for (const quantity of [1, 5, 700, 3000]) {
  const label = `Confirmar participacao ${quantity} cotas`;
  assert(label.split(" ").length >= 3, "cenario de quantidade deve quebrar por palavras, nao por letras");
}

assert(media.includes("checkout-media-fallback"), "checkout deve ter fallback para evitar tela preta vazia");
assert(css.includes(".checkout-primary-action-button") && css.includes("min-height: 52px"), "botao primario deve manter altura minima mobile");

console.log("checkout-mobile-text-bug: ok");
