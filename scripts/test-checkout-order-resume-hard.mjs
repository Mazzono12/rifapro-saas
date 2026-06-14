import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
}

const app = read("src/App.tsx");
const page = read("src/pages/CheckoutOrderResume.tsx");
const premiumUi = read("src/components/premium/PremiumUI.tsx");
const pwaInstallPrompt = read("src/components/pwa/PwaInstallPrompt.tsx");
const css = read("src/index.css");
const server = read("server.ts");

includesAll(app, [
  "CheckoutOrderResume",
  'path="/checkout/orders/:orderId"',
  'path="/:mode"'
], "rota publica de retomada PIX");
assert(app.indexOf('path="/checkout/orders/:orderId"') < app.indexOf('path="/:mode"'), "rota /checkout/orders/:orderId deve vir antes da rota dinamica /:mode");

includesAll(page, [
  "Finalize seu PIX",
  "Sua reserva ainda esta ativa",
  "Copie o codigo PIX abaixo",
  "Pagamento confirmado",
  "Reserva expirada",
  "Ja paguei, verificar",
  "PixPaymentCard",
  "useParams",
  "orderId"
], "pagina publica de retomada PIX");
assert((page + premiumUi).includes("Copiar código PIX"), "pagina deve expor CTA Copiar código PIX via componente PIX");

includesAll(pwaInstallPrompt, [
  "isCheckoutSurfaceBlocked",
  "window.location.pathname.startsWith(\"/checkout/orders/\")",
  "document.body.dataset.checkoutOpen === \"true\"",
  "MutationObserver",
  "data-pwa-install-prompt",
  "if (checkoutBlocked) return null"
], "banner PWA deve sumir na retomada PIX e durante checkout aberto");
includesAll(css, [
  "body[data-checkout-open=\"true\"] .pwa-install-prompt",
  "body[data-checkout-open=\"true\"] [data-pwa-install-prompt]",
  "display: none !important"
], "CSS deve proteger checkout aberto contra banner PWA");

assert(page.includes('fetch(`/api/checkout/orders/${orderId}/status`)'), "pagina deve consultar status pelo endpoint publico existente");
assert(page.includes("status?.paid") && page.includes("status?.expired") && page.includes("pending"), "pagina deve tratar estados pago, expirado e pendente");
assert(page.includes("status?.pixPayload") || page.includes("pixPayload"), "pagina deve renderizar PIX pendente existente");
assert(page.includes("normalizeWhatsAppUrl") && page.includes("support_whatsapp"), "pagina deve expor suporte WhatsApp quando configurado");

const forbidden = [
  "/api/checkout/preview",
  "/api/raffles/",
  "/buy",
  "method: \"POST\"",
  "method=\"POST\"",
  "attachActiveGatewayPixToOrder",
  "createPayment",
  "upsertPaymentRecord",
  "pixConfig",
  "webhook"
];
for (const token of forbidden) {
  assert(!page.includes(token), `pagina de retomada nao pode criar/alterar PIX: ${token}`);
}

includesAll(server, [
  'app.get("/api/checkout/orders/:orderId/status"',
  "pixPayload: purchase.status === \"pending\" && !expired ? purchase.pixPayload : \"\"",
  "pixPayload: modePurchase.status === \"reserved\" && !expired ?",
  "pixPayload: farmPurchase.statusPagamento === \"reserved\" && !expired ?"
], "backend reaproveita pixPayload existente por status");

console.log("checkout-order-resume-hard ok");
