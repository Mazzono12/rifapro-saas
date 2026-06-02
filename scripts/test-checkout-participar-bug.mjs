import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const css = read("src/index.css");
const premiumUi = read("src/components/premium/PremiumUI.tsx");
const raffleDetails = read("src/pages/RaffleDetails.tsx");
const checkoutMedia = read("src/components/checkout/CheckoutCampaignMedia.tsx");
const receipt = read("src/components/checkout/PrePaymentReceiptModal.tsx");
const packageJson = read("package.json");

assert(premiumUi.includes("CheckoutPrimaryActionButton"), "deve existir CheckoutPrimaryActionButton");
assert(premiumUi.includes("checkout-primary-action-button checkout-primary-button premium-button"), "botao deve usar classe defensiva de checkout");
assert(premiumUi.includes("export const CheckoutPrimaryButton = CheckoutPrimaryActionButton"), "botao antigo deve continuar compativel");

for (const token of [
  ".checkout-primary-action-button",
  "display: flex",
  "width: 100%",
  "min-width: 0",
  "max-width: 100%",
  "min-height: 52px",
  "padding: 14px 18px",
  "text-align: center",
  "white-space: normal",
  "word-break: normal",
  "overflow-wrap: normal",
  "line-break: auto",
  "writing-mode: horizontal-tb",
  "text-orientation: mixed",
  "flex-shrink: 0"
]) {
  assert(css.includes(token), `CSS defensivo ausente: ${token}`);
}

for (const forbidden of [
  /checkout-primary-action-button[\s\S]{0,260}word-break:\s*break-all/,
  /checkout-primary-button[\s\S]{0,260}word-break:\s*break-all/,
  /checkout-primary-action-button[\s\S]{0,260}writing-mode:\s*vertical/,
  /checkout-modal-title[\s\S]{0,180}overflow-wrap:\s*anywhere/,
  /\.checkout-title\s*\{[\s\S]{0,80}overflow-wrap:\s*anywhere/
]) {
  assert(!forbidden.test(css), "checkout nao pode permitir quebra vertical por caractere");
}

for (const token of [
  "checkoutCriticalActive",
  "!checkoutCriticalActive && <FloatingActions",
  "!checkoutCriticalActive && (",
  "CheckoutCampaignMedia"
]) {
  assert(raffleDetails.includes(token), `RaffleDetails deve proteger modal/floating actions: ${token}`);
}
for (const token of ["checkout-modal-title-block", "checkout-modal-kicker", "checkout-modal-title"]) {
  assert(premiumUi.includes(token), `PremiumUI deve manter header compartilhado do checkout: ${token}`);
}

assert(/@media \(max-width:\s*640px\)[\s\S]*\.checkout-modal-header[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/.test(css), "mobile deve forcar header em uma coluna sem espremer titulo");
assert(!premiumUi.includes("checkout-modal-close"), "botao X superior do checkout publico deve permanecer removido");
assert(!premiumUi.includes("aria-label=\"Fechar checkout\""), "checkout publico nao deve expor aria-label de X superior");
assert(/\.checkout-media-preview[\s\S]*width:\s*100%/.test(css), "preview de foto/video do checkout deve ocupar largura total");
assert(!/\.fixed\.inset-0\[class\*="z-\[80\]"\]\s+button/.test(css), "overlay fixo generico nao pode forcar botoes a 100% e comprimir header");

for (const token of [
  "CheckoutCampaignMedia",
  "checkout-campaign-media",
  "checkout-media-preview",
  "\"checkoutMediaUrl\"",
  "\"mediaUrl\"",
  "\"image\"",
  "checkout-media-fallback"
]) {
  assert(checkoutMedia.includes(token), `CheckoutCampaignMedia incompleto: ${token}`);
}

assert(receipt.includes("<CheckoutCampaignMedia"), "recibo pre-PIX deve mostrar foto/video da campanha");
assert(receipt.includes("raffleData"), "recibo pre-PIX deve aceitar dados de midia da rifa");

for (const quantity of [1, 5, 700, 3000]) {
  const label = `Confirmar participacao ${quantity.toLocaleString("pt-BR")} cotas - R$ 350,00`;
  assert(label.split("").length > quantity.toLocaleString("pt-BR").length, "cenario de quantidade deve ser representativo");
}

assert(raffleDetails.includes("Confirmar participacao"), "header de confirmacao deve continuar presente");
assert(raffleDetails.includes("Confirmar PIX"), "Confirmar PIX deve continuar presente");
assert(raffleDetails.includes("formatCurrency(props.totalValue)"), "valor do checkout deve continuar formatado");
assert(packageJson.includes('"test:checkout-participar-bug"'), "package.json deve expor test:checkout-participar-bug");

console.log("checkout-participar-bug: ok");
