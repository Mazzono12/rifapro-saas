import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const provider = readFileSync("src/server/payments/PrimepagProvider.ts", "utf8");

function blockBetween(start, end) {
  const startIndex = server.indexOf(start);
  assert.ok(startIndex >= 0, `Bloco nao encontrado: ${start}`);
  const endIndex = end ? server.indexOf(end, startIndex + start.length) : -1;
  return server.slice(startIndex, endIndex >= 0 ? endIndex : undefined);
}

const webhookBlock = blockBetween("app.post(\"/api/webhooks/primepag\"", "app.post(\"/api/admin/payments/primepag/reconcile\"");

for (const needle of [
  "const tenant = getRequestTenant(req)",
  "getPrimepagGatewayConfig(tenant.id)",
  "authorization",
  "timingSafeEqual",
  "provider.provider.handleWebhook",
  "provider.provider.getPayment(parsed.referenceCode)",
  "provider.provider.parseQrCodeStatus(remote)",
  "webhookEvents.unshift",
  "provider: \"primepag\"",
  "provider_payment_id: parsed.referenceCode",
  "item.tenant_id === tenantId",
  "item.provider === \"primepag\"",
  "item.provider_payment_id === parsed.referenceCode",
  "PrimePag pago sem payment interno tenant-scoped; baixa bloqueada",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: payment.order_id"
]) assert.ok(webhookBlock.includes(needle), `Webhook PrimePag incompleto: ${needle}`);

assert.ok(!webhookBlock.includes("enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: parsed.externalReference"), "Webhook PrimePag nao pode liberar por external_reference.");
assert.ok(provider.includes("notificationType") && provider.includes("referenceCode") && provider.includes("valueCents"), "Provider deve parsear notification_type/reference/value.");

console.log("PASS: webhook PrimePag valida authorization, consulta cobranca e libera somente payment tenant-scoped.");
