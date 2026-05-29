import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function includes(path, tokens, context) {
  const content = read(path);
  for (const token of tokens) {
    assert(content.includes(token), `${context}: esperado encontrar "${token}" em ${path}`);
  }
  return content;
}

const css = read("src/index.css");
const receipt = includes("src/components/checkout/PrePaymentReceiptModal.tsx", [
  "checkout-receipt-overlay",
  "checkout-receipt-shell",
  "checkout-title",
  "checkout-card",
  "checkout-summary-row",
  "checkout-summary-label",
  "checkout-summary-value",
  "checkout-action-button",
  "Resumo da Compra",
  "Confirme seus dados",
  "Seus Dados"
], "recibo pre-PIX responsivo");

includes("src/components/premium/PremiumUI.tsx", [
  "checkout-modal-overlay",
  "checkout-screen checkout-modal-shell",
  "checkout-modal-header",
  "hidden = false",
  "if (hidden) return null"
], "modal premium e CTA flutuante");

includes("src/pages/RaffleDetails.tsx", [
  "checkout-modal-overlay",
  "checkout-screen checkout-modal-shell",
  "checkout-info-grid",
  "customer-identified-card",
  "checkout-actions",
  "break-words"
], "checkout principal da rifa");

includes("src/pages/NumberModePage.tsx", ["hidden={checkoutOpen || receiptOpen}"], "CTA flutuante modalidades");
includes("src/pages/Fazendinha.tsx", ["hidden={checkoutOpen || receiptOpen}"], "CTA flutuante fazendinha");

for (const token of [
  "--app-header-height",
  ".app-shell-content",
  ".mobile-safe-content",
  ".checkout-modal-overlay",
  ".checkout-receipt-overlay",
  ".checkout-summary-row",
  ".checkout-summary-value",
  ".customer-identified-card",
  "@media (max-width: 767px)",
  "env(safe-area-inset-top)",
  "env(safe-area-inset-bottom)",
  "grid-template-columns: minmax(0, 1fr) !important",
  ".premium-floating-cta"
]) {
  assert(css.includes(token), `CSS responsivo do checkout deve conter ${token}`);
}

assert(!receipt.includes("text-slate-600"), "recibo nao deve usar icone/texto apagado no bloco de cliente");
assert(css.includes("overflow-wrap") || css.includes("break-words"), "checkout deve quebrar textos longos");

console.log("checkout-layout-hard: ok");
