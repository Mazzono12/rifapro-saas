import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const provider = readFileSync("src/server/payments/CoraProvider.ts", "utf8");

const start = server.indexOf("app.post(\"/api/webhooks/cora\"");
const end = server.indexOf("app.post(\"/api/admin/payments/cora/reconcile\"", start);
assert.ok(start >= 0 && end > start, "Webhook Cora nao encontrado.");
const block = server.slice(start, end);

for (const needle of [
  "const tenant = getRequestTenant(req)",
  "const tenantId = tenant?.id || \"unknown\"",
  "getCoraGatewayConfig(tenant.id)",
  "getCoraProvider(tenant.id)",
  "timingSafeEqual",
  "provider.provider.getPayment(parsed.providerPaymentId)",
  "webhookEvents.unshift",
  "provider: \"cora\" as IntegrationProviderId",
  "provider_payment_id: parsed.providerPaymentId",
  "reference_id: parsed.txid",
  "end_to_end: parsed.endToEnd",
  "item.tenant_id === tenantId",
  "item.provider === \"cora\"",
  "item.provider_payment_id === parsed.providerPaymentId || item.txid === parsed.txid",
  "Cora pago sem payment interno tenant-scoped; baixa bloqueada",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: payment?.order_id",
  "res.status(200)"
]) assert.ok(block.includes(needle), `Webhook Cora incompleto: ${needle}`);

assert.ok(!block.includes("enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: parsed.externalReference"), "Webhook Cora nao pode baixar por external_reference.");

for (const needle of ["handleWebhook", "providerPaymentId", "txid", "endToEnd"]) assert.ok(provider.includes(needle), `Parser webhook Cora incompleto: ${needle}`);

console.log("PASS: webhook Cora valida tenant/payment, salva evento bruto e nao confia apenas no external_reference.");
