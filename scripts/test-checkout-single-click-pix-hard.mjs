import fs from "node:fs";
import assert from "node:assert/strict";

const raffleDetails = fs.readFileSync("src/pages/RaffleDetails.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");
const receiptModal = fs.readFileSync("src/components/checkout/PrePaymentReceiptModal.tsx", "utf8");

function mustInclude(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

function count(source, needle) {
  return source.split(needle).length - 1;
}

function blockBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.ok(startIndex >= 0, `Nao encontrou inicio: ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  assert.ok(endIndex > startIndex, `Nao encontrou fim: ${end}`);
  return source.slice(startIndex, endIndex);
}

const executeBuy = blockBetween(
  raffleDetails,
  "const executeBuy = async",
  "const copyPix = async"
);

mustInclude(raffleDetails, "useNavigate", "Checkout publico deve poder navegar apos criar o pedido.");
mustInclude(raffleDetails, "const navigate = useNavigate();", "RaffleDetails deve inicializar navigate.");
mustInclude(raffleDetails, "function getCheckoutOrderId(result: any)", "Deve normalizar orderId vindo da API.");
mustInclude(raffleDetails, "result?.orderId || result?.order?.id || result?.purchaseId || result?.id", "orderId deve aceitar os formatos conhecidos.");
mustInclude(raffleDetails, "function getCheckoutRedirectUrl(result: any)", "Deve normalizar URL de checkout.");
mustInclude(raffleDetails, "result?.checkoutUrl || result?.paymentUrl", "checkoutUrl/paymentUrl devem ter prioridade.");
mustInclude(raffleDetails, "`/checkout/pedido/${encodeURIComponent(orderId)}`", "Fallback deve ir para /checkout/pedido/:orderId.");

mustInclude(executeBuy, "if (isSubmitting) return;", "Duplo clique deve ser bloqueado durante submit.");
mustInclude(executeBuy, "const existingCheckoutUrl = getCheckoutRedirectUrl(purchase);", "Segundo clique deve reaproveitar pedido ja criado.");
mustInclude(executeBuy, "if (existingCheckoutUrl && purchase?.status !== \"paid\")", "Pedido PIX pendente deve navegar sem criar nova cobranca.");
mustInclude(executeBuy, "navigate(existingCheckoutUrl);", "Segundo clique deve navegar para o pedido existente.");
mustInclude(executeBuy, "const redirectUrl = getCheckoutRedirectUrl(data);", "Redirect deve ser calculado a partir da resposta direta da API.");
mustInclude(executeBuy, "navigate(redirectUrl);", "Primeiro clique deve redirecionar imediatamente.");
mustInclude(executeBuy, "setPurchase(data);", "Estado local ainda deve ser atualizado para compatibilidade.");

assert.ok(
  executeBuy.indexOf("const redirectUrl = getCheckoutRedirectUrl(data);") < executeBuy.indexOf("setPurchase(data);"),
  "Redirect nao pode depender de setPurchase/state."
);
assert.equal(
  count(executeBuy, "fetch(`/api/raffles/${id}/buy`"),
  1,
  "executeBuy deve ter uma unica chamada de criacao de pedido."
);
assert.ok(
  executeBuy.indexOf("if (isSubmitting) return;") < executeBuy.indexOf("fetch(`/api/raffles/${id}/buy`"),
  "Bloqueio de submit deve vir antes de criar pedido."
);
assert.ok(
  executeBuy.indexOf("navigate(existingCheckoutUrl);") < executeBuy.indexOf("fetch(`/api/raffles/${id}/buy`"),
  "Pedido existente deve navegar antes de tentar criar nova cobranca."
);
assert.ok(
  executeBuy.indexOf("const data = normalizePixPurchase(await readJsonSafely(res));") < executeBuy.indexOf("const redirectUrl = getCheckoutRedirectUrl(data);"),
  "Normalizacao da resposta deve acontecer antes do redirect."
);

mustInclude(app, 'path="/checkout/pedido/:orderId"', "App deve expor a rota publica /checkout/pedido/:orderId.");
assert.ok(
  app.indexOf('path="/checkout/pedido/:orderId"') < app.indexOf('path="/:mode"'),
  "Rota /checkout/pedido/:orderId deve vir antes da rota dinamica /:mode."
);

mustInclude(receiptModal, 'disabled={loading}', "Botao Gerar PIX deve ficar disabled/loading durante submit.");
mustInclude(receiptModal, 'loading ? "Gerando PIX..." : "GERAR PIX"', "Botao deve exibir estado de loading.");

console.log("checkout single-click PIX hard test passed");
