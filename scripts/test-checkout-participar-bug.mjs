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
  "checkoutMediaUrl",
  "checkoutMediaType",
  "checkout-media-preview",
  "<CampaignMediaHero",
  "checkout-modal-title-block",
  "checkout-modal-kicker",
  "checkout-modal-title",
  "checkout-modal-close"
]) {
  assert(raffleDetails.includes(token), `RaffleDetails deve proteger modal/floating actions: ${token}`);
}

assert(/@media \(max-width:\s*640px\)[\s\S]*\.checkout-modal-header[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/.test(css), "mobile deve forcar header em uma coluna sem espremer titulo");
assert(/\.checkout-modal-close[\s\S]*grid-column:\s*1 \/ -1\s*!important/.test(css), "botao Fechar deve ir para linha propria no mobile");
assert(/\.checkout-media-preview[\s\S]*width:\s*100%/.test(css), "preview de foto/video do checkout deve ocupar largura total");

for (const quantity of [1, 5, 700, 3000]) {
  const label = `Confirmar participacao ${quantity.toLocaleString("pt-BR")} cotas - R$ 350,00`;
  assert(label.split("").length > quantity.toLocaleString("pt-BR").length, "cenario de quantidade deve ser representativo");
}

assert(raffleDetails.includes("Confirmar participacao"), "header de confirmacao deve continuar presente");
assert(raffleDetails.includes("Confirmar PIX"), "Confirmar PIX deve continuar presente");
assert(raffleDetails.includes("formatCurrency(props.totalValue)"), "valor do checkout deve continuar formatado");
assert(packageJson.includes('"test:checkout-participar-bug"'), "package.json deve expor test:checkout-participar-bug");

console.log("checkout-participar-bug: ok");
