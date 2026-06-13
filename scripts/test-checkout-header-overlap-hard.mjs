import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = path => readFileSync(path, "utf8");
const css = read("src/index.css");
const premium = read("src/components/premium/PremiumUI.tsx");
const receipt = read("src/components/checkout/PrePaymentReceiptModal.tsx");
const raffle = read("src/pages/RaffleDetails.tsx");
const numberMode = read("src/pages/NumberModePage.tsx");
const fazendinha = read("src/pages/Fazendinha.tsx");
const fazendinhaSection = read("src/components/FazendinhaSection.tsx");

function hasAll(source, tokens, label) {
  for (const token of tokens) {
    assert(source.includes(token), `${label}: ausente ${token}`);
  }
}

hasAll(premium, ["CheckoutModalShell", "CheckoutContentArea", "CheckoutSafeTop", "checkout-modal-shell", "flex w-full flex-col", "CheckoutModalHeader"], "shell compartilhado");
hasAll(css, [".checkout-content-area", "max-height: calc(100dvh", "overflow-y: auto", "overscroll-behavior: contain"], "area segura de checkout");
hasAll(css, [".checkout-modal-header", "flex: 0 0 auto", "line-height: 1.2", "writing-mode: horizontal-tb"], "header seguro");
hasAll(css, ["@media (max-width: 640px)", "grid-template-columns: minmax(0, 1fr) !important", "grid-column: 1 / -1 !important"], "mobile header");
hasAll(receipt, ["CheckoutModalShell", "Revise e gere seu PIX", "Checkout seguro", "compact={!hasCheckoutMedia}", "mediaAware"], "recibo pre-PIX");
hasAll(raffle, ["CheckoutModalShell", "CheckoutCampaignMedia", "Pagamento PIX", "Bilhete premium"], "rifa tradicional");
hasAll(numberMode, ["PremiumCheckoutModal", "CheckoutCampaignMedia", "Confirmar participação", "Pagamento PIX"], "NumberMode");
hasAll(fazendinha, ["PremiumCheckoutModal", "Confirmar participação", "Pagamento PIX", "FazendinhaCheckoutMedia"], "Fazendinha page");
hasAll(fazendinhaSection, ["CheckoutModalShell", "Participar da Fazendinha", "FazendinhaCheckoutMedia"], "Fazendinha Home");

const forbiddenNearCritical = [
  /checkout-(?:modal-title|title|primary-button|primary-action-button)[\s\S]{0,260}word-break:\s*break-all/i,
  /checkout-(?:modal-title|title|primary-button|primary-action-button)[\s\S]{0,260}overflow-wrap:\s*anywhere/i,
  /checkout-modal-header[\s\S]{0,220}position:\s*absolute/i,
  /\.checkout-modal-title\s*\{[\s\S]{0,160}white-space:\s*nowrap/i,
  /checkout-modal-title[\s\S]{0,160}truncate/i,
  /writing-mode:\s*vertical/i
];
for (const pattern of forbiddenNearCritical) {
  assert(!pattern.test(css), `CSS proibido para checkout: ${pattern}`);
}

assert(/\.checkout-modal-overlay,\s*\.checkout-receipt-overlay[\s\S]{0,260}padding-top:\s*max\(0\.75rem,\s*env\(safe-area-inset-top\)\)/.test(css), "overlay deve respeitar safe-area no topo");
assert(/\.checkout-modal-shell,\s*\.checkout-receipt-shell[\s\S]{0,320}max-height:\s*calc\(100dvh/.test(css), "shell deve limitar altura do viewport");
assert(/\.checkout-content-area[\s\S]{0,220}min-height:\s*0/.test(css), "conteudo deve rolar dentro do shell sem cobrir header");
assert(/\.checkout-modal-overlay h1,[\s\S]*\.checkout-screen h3[\s\S]{0,260}overflow-wrap:\s*break-word/.test(css), "titulos críticos devem quebrar por palavra");

console.log("checkout-header-overlap-hard ok");
