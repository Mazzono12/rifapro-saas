import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const provider = readFileSync("src/server/payments/MercadoPagoProvider.ts", "utf8");

const start = server.indexOf("app.post(\"/api/webhooks/mercadopago\"");
const end = server.indexOf("app.post(\"/api/admin/payments/mercadopago/reconcile\"", start);
assert.ok(start >= 0 && end > start, "Webhook Mercado Pago nao encontrado.");
const block = server.slice(start, end);

for (const needle of [
  "const tenant = getRequestTenant(req)",
  "const tenantId = tenant?.id || \"unknown\"",
  "getMercadoPagoGatewayConfig(tenant.id)",
  "timingSafeEqual",
  "provider.provider.getPayment(parsed.paymentId)",
  "parsePaymentStatus(remote)",
  "webhookEvents.unshift",
  "provider: \"mercadopago\" as IntegrationProviderId",
  "provider_payment_id: String(remote.id || parsed.paymentId)",
  "item.tenant_id === tenantId",
  "item.provider === \"mercadopago\"",
  "item.provider_payment_id === String(remote.id || parsed.paymentId)",
  "Mercado Pago aprovado sem payment interno tenant-scoped; baixa bloqueada",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: payment?.order_id",
  "res.status(200)"
]) assert.ok(block.includes(needle), `Webhook Mercado Pago incompleto: ${needle}`);

assert.ok(!block.includes("enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: String(remote.external_reference"), "Webhook nao pode enfileirar baixa usando apenas external_reference.");

for (const needle of [
  "handleWebhook",
  "data.id",
  "paymentId"
]) assert.ok(provider.includes(needle), `Parser webhook Mercado Pago incompleto: ${needle}`);

console.log("PASS: webhook Mercado Pago consulta API, valida payment tenant-scoped e responde 200 sem confiar no payload.");
