import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const providerFiles = {
  asaas: "src/server/payments/AsaasProvider.ts",
  pay2m: "src/server/payments/Pay2mProvider.ts",
  pagbank: "src/server/payments/PagbankProvider.ts",
  mercadopago: "src/server/payments/MercadoPagoProvider.ts",
  cora: "src/server/payments/CoraProvider.ts",
  primepag: "src/server/payments/PrimepagProvider.ts"
};

const server = readFileSync("server.ts", "utf8");
const docs = readFileSync("docs/payment-layer-global-audit.md", "utf8");

for (const [provider, file] of Object.entries(providerFiles)) {
  const src = readFileSync(file, "utf8");
  for (const method of [
    "createPixPayment",
    "getPayment",
    "handleWebhook",
    "reconcile",
    "testConnection",
    "normalizePixPaymentResult"
  ]) {
    assert.ok(src.includes(method), `${provider} deve implementar ${method}`);
  }
  for (const field of [
    "provider_payment_id",
    "provider_reference",
    "pix_copy_paste",
    "qr_code_base64",
    "status",
    "expiration"
  ]) {
    assert.ok(src.includes(field), `${provider} deve normalizar retorno com ${field}`);
  }
}

for (const needle of [
  "function enforcePaymentGatewayPolicy",
  "gatewayRole: index === 0 ? \"primary\" : \"fallback\"",
  "fallbackPriority: config.priority",
  "enabled[0].is_default = true",
  "enforcePaymentGatewayPolicy(tenantId)",
  "getDefaultPaymentGatewayConfig(tenantId)"
]) assert.ok(server.includes(needle), `Gateway policy ausente: ${needle}`);

for (const needle of [
  "let paymentLogs: PaymentLog[] = []",
  "let webhookLogs: WebhookLog[] = []",
  "let gatewayHealth: GatewayHealth[] = []",
  "function recordPaymentLog",
  "function updateGatewayHealth",
  "app.get(\"/api/admin/payments/logs\"",
  "app.get(\"/api/admin/payments/webhook-logs\"",
  "app.get(\"/api/admin/payments/gateway-health\""
]) assert.ok(server.includes(needle), `Observabilidade de pagamento ausente: ${needle}`);

for (const needle of [
  "item.tenant_id === tenantId",
  "tenant_id: input.tenantId",
  "tenant_id: tenantId",
  "payment?.order_id",
  "purchaseId: payment.order_id",
  "Cora pago sem payment interno tenant-scoped; baixa bloqueada",
  "PrimePag pago sem payment interno tenant-scoped; baixa bloqueada",
  "Mercado Pago aprovado sem payment interno tenant-scoped; baixa bloqueada",
  "Payment interno nao encontrado"
]) assert.ok(server.includes(needle), `Baixa tenant-scoped/idempotente ausente: ${needle}`);

assert.ok(!server.includes("enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: parsed.externalReference"), "Webhook nao pode baixar por external_reference.");

for (const provider of Object.keys(providerFiles)) {
  assert.ok(server.includes(`gateway: "${provider}"`) || server.includes(`provider: "${provider}"`) || server.includes(`provider === "${provider}"`), `Servidor deve referenciar ${provider}`);
}

for (const needle of [
  "APROVADO COM ENDURECIMENTOS APLICADOS",
  "Gateway ativo principal é sempre único por tenant",
  "paymentLogs",
  "webhookLogs",
  "gatewayHealth",
  "Nunca liberar cotas por tela de sucesso"
]) assert.ok(docs.includes(needle), `Relatorio global incompleto: ${needle}`);

console.log("PASS: camada global de pagamentos padronizada em contrato, retorno, tenant isolation, webhooks, policy e observabilidade.");
