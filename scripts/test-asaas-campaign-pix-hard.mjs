import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const read = path => readFileSync(path, "utf8");

const server = read("server.ts");
const adminRaffles = read("src/pages/admin/AdminRaffles.tsx");
const raffleDetails = read("src/pages/RaffleDetails.tsx");
const checkoutResume = read("src/pages/CheckoutOrderResume.tsx");
const asaasProviderTs = read("src/server/payments/AsaasProvider.ts");

function has(source, snippets, label) {
  for (const snippet of snippets) {
    assert.ok(source.includes(snippet), `${label}: trecho ausente: ${snippet}`);
  }
}

function lacks(source, snippets, label) {
  for (const snippet of snippets) {
    assert.ok(!source.includes(snippet), `${label}: trecho proibido encontrado: ${snippet}`);
  }
}

has(adminRaffles, [
  "PIX individual do sorteio",
  "Chave privada Asaas deste sorteio",
  "updateRafflePixConfig",
  "PAYMENT_CONFIRMED",
  "webhookUrl: \"/api/webhooks/asaas\""
], "Admin deve salvar PIX Asaas por campanha");

has(server, [
  "normalizeRafflePixConfigForStorage",
  "inheritGlobal: false",
  'gateway: "asaas"',
  "hasPixGatewayCredentials(\"asaas\", localCredentials)",
  "hasGlobalAsaasCredentials",
  "inheritGlobal: true",
  "Gateway Asaas não configurado para esta campanha."
], "Resolucao campanha -> tenant deve priorizar campanha e herdar global quando ausente");

has(server, [
  "attachAsaasPixToOrder",
  "createPixPayment",
  "getPixQrCode",
  "pixPayload",
  "pixQrCodeBase64",
  "externalPaymentId: asaasPaymentId",
  "paymentProvider: \"asaas\"",
  "provider_payment_id: asaasPaymentId",
  "asaas_payment_id: asaasPaymentId"
], "Criacao do PIX Asaas deve salvar identificadores, payload e QR Code");

has(server, [
  "safePix.orderId = safePix.purchaseId || safePix.id",
  "safePix.gateway = safePix.pixGateway || \"asaas\"",
  "safePix.pixGateway = safePix.pixGateway || \"asaas\"",
  "safePix.paymentProvider = safePix.paymentProvider || safePix.pixGateway || \"asaas\"",
  "data:image/png;base64,"
], "Resposta publica deve padronizar campos PIX para frontend");

has(server, [
  "refreshAsaasPixForPendingPurchase",
  "getPixQrCode(paymentId)",
  "asaas-pix-recovered",
  "app.get(\"/api/checkout/orders/:orderId/status\""
], "Recuperacao de pedido deve reconsultar QR Code Asaas sem duplicar cobranca");

has(server, [
  "app.post(\"/api/webhooks/asaas\"",
  "timingSafeEqual",
  "resolveAsaasWebhookPayment",
  "buildPaymentIdempotencyKey",
  "asaasRemoteVerified: true",
  "releaseReservedNumbers(raffle, purchase.numeros)",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED"
], "Webhook Asaas deve validar, localizar pedido, ser idempotente e liberar/cancelar reserva");

has(server, [
  "process.env.RIFAPRO_TEST_MODE && isInternalPixGateway(requestedGateway) ? requestedGateway : \"asaas\"",
  "throw new Error(\"Não foi possível gerar PIX pelo Asaas.\")"
], "Checkout real deve bloquear mock/fallback e falhar claramente quando Asaas falhar");

lacks(server, [
  "Gateway PIX mock/teste nao permitido no checkout publico. Configure um gateway de producao.;",
  "selectedGateway === \"mercadopago\""
], "Checkout de producao nao deve cair em Mercado Pago/mock");

has(raffleDetails, [
  "Não foi possível gerar o PIX. Tente novamente ou fale com o suporte.",
  "getPixPayload",
  "getPixQrCodeBase64"
], "Checkout da rifa deve exibir erro claro e ler payload/QR");

has(checkoutResume, [
  "Não foi possível gerar o PIX. Tente novamente ou fale com o suporte.",
  "status?.pixPayload",
  "purchase.pixPayload"
], "Recuperacao de pedido deve exibir erro claro e payload pendente");

const js = transformSync(asaasProviderTs, {
  loader: "ts",
  format: "esm",
  target: "es2022"
}).code;

const moduleUrl = `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
const { AsaasProvider } = await import(moduleUrl);

const calls = [];
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  if (String(url).endsWith("/customers")) {
    const body = JSON.parse(String(init.body || "{}"));
    assert.equal(body.externalReference, "customer-1");
    return Response.json({ id: "cus_123" }, { status: 200 });
  }
  if (String(url).endsWith("/payments")) {
    const body = JSON.parse(String(init.body || "{}"));
    assert.equal(body.billingType, "PIX");
    assert.equal(body.customer, "cus_123");
    assert.equal(body.externalReference, "TENANT:tenant-1:ORDER:order-1");
    return Response.json({ id: "pay_123", status: "PENDING", externalReference: body.externalReference }, { status: 200 });
  }
  if (String(url).endsWith("/payments/pay_123/pixQrCode")) {
    return Response.json({ encodedImage: "BASE64PNG", payload: "000201PIX-COPIA-E-COLA", expirationDate: "2026-06-17T01:00:00Z" }, { status: 200 });
  }
  if (String(url).endsWith("/payments/pay_123")) {
    return Response.json({ id: "pay_123", status: "RECEIVED", externalReference: "TENANT:tenant-1:ORDER:order-1" }, { status: 200 });
  }
  throw new Error(`Unexpected URL ${url}`);
};

const provider = new AsaasProvider({ apiKey: "$aact_prod_test", environment: "production", userAgent: "CIFHER Test" });
const customer = await provider.createCustomer({
  name: "Cliente Teste",
  cpfCnpj: "12345678909",
  mobilePhone: "11999999999",
  externalReference: "customer-1"
});
assert.equal(customer.id, "cus_123");

const payment = await provider.createPixPayment({
  customerId: customer.id,
  value: 10,
  dueDate: "2026-06-17",
  externalReference: "TENANT:tenant-1:ORDER:order-1",
  description: "Pedido order-1"
});
assert.equal(payment.id, "pay_123");

const qrCode = await provider.getPixQrCode(payment.id);
assert.equal(qrCode.encodedImage, "BASE64PNG");
assert.equal(qrCode.payload, "000201PIX-COPIA-E-COLA");

const remote = await provider.getPayment(payment.id);
assert.equal(remote.status, "RECEIVED");

assert.ok(calls.every(call => call.url.startsWith("https://api.asaas.com/v3/")), "AsaasProvider deve usar endpoint de producao");
assert.ok(calls.every(call => String(call.init?.headers?.access_token || "") === "$aact_prod_test"), "AsaasProvider deve enviar access_token configurado");

console.log("PASS: PIX Asaas por campanha auditado: campanha propria, heranca tenant, erro claro, QR/copia-e-cola, recuperacao e webhook.");
